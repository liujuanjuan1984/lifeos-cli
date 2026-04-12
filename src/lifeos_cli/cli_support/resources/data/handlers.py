"""CLI handlers for the data resource."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any
from uuid import UUID

from lifeos_cli.cli_support.runtime_utils import run_async
from lifeos_cli.db import session as db_session
from lifeos_cli.db.services import data_ops


def _maybe_record_id(payload: dict[str, Any]) -> UUID | None:
    raw_value = payload.get("id")
    if raw_value is None:
        return None
    try:
        return UUID(str(raw_value))
    except (TypeError, ValueError):
        return None


def _read_text(path: str | None, *, stdin: bool) -> str:
    if stdin:
        return sys.stdin.read()
    if path is None:
        raise data_ops.DataOperationError("Use --file or --stdin to supply input data.")
    return Path(path).read_text(encoding="utf-8")


def _read_rows(path: str | None, *, stdin: bool, input_format: str) -> list[dict[str, Any]]:
    raw_text = _read_text(path, stdin=stdin)
    try:
        if input_format == "jsonl":
            rows = [json.loads(line) for line in raw_text.splitlines() if line.strip()]
        elif input_format == "json":
            loaded = json.loads(raw_text)
            if not isinstance(loaded, list):
                raise data_ops.DataOperationError(
                    "JSON input must be a top-level array of objects."
                )
            rows = loaded
        else:
            raise data_ops.DataOperationError(f"Unsupported input format {input_format!r}.")
    except json.JSONDecodeError as exc:
        raise data_ops.DataOperationError(f"Invalid JSON input: {exc.msg}.") from exc
    if not all(isinstance(row, dict) for row in rows):
        raise data_ops.DataOperationError("Every input row must be a JSON object.")
    return list(rows)


def _read_ids(
    *,
    repeated_ids: list[UUID] | None,
    ids_file: str | None,
    file_path: str | None,
    stdin: bool,
    input_format: str,
) -> list[UUID]:
    ids = list(repeated_ids or [])
    try:
        if ids_file is not None:
            ids.extend(
                UUID(line.strip())
                for line in Path(ids_file).read_text(encoding="utf-8").splitlines()
                if line.strip()
            )
        if file_path is not None or stdin:
            raw_text = _read_text(file_path, stdin=stdin)
            if input_format == "plain":
                ids.extend(UUID(line.strip()) for line in raw_text.splitlines() if line.strip())
            elif input_format == "jsonl":
                for line in raw_text.splitlines():
                    if not line.strip():
                        continue
                    loaded = json.loads(line)
                    if isinstance(loaded, str):
                        ids.append(UUID(loaded))
                    elif isinstance(loaded, dict) and "id" in loaded:
                        ids.append(UUID(str(loaded["id"])))
                    else:
                        raise data_ops.DataOperationError(
                            "Batch-delete JSONL input must contain UUID strings or "
                            "objects with `id`."
                        )
            elif input_format == "json":
                loaded = json.loads(raw_text)
                if not isinstance(loaded, list):
                    raise data_ops.DataOperationError(
                        "Batch-delete JSON input must be a JSON array."
                    )
                for item in loaded:
                    if isinstance(item, str):
                        ids.append(UUID(item))
                    elif isinstance(item, dict) and "id" in item:
                        ids.append(UUID(str(item["id"])))
                    else:
                        raise data_ops.DataOperationError(
                            "Batch-delete JSON input must contain UUID strings or "
                            "objects with `id`."
                        )
            else:
                raise data_ops.DataOperationError(
                    f"Unsupported delete input format {input_format!r}."
                )
    except json.JSONDecodeError as exc:
        raise data_ops.DataOperationError(f"Invalid JSON input: {exc.msg}.") from exc
    except ValueError as exc:
        raise data_ops.DataOperationError(str(exc)) from exc
    if not ids:
        raise data_ops.DataOperationError(
            "Provide identifiers with --id, --ids-file, --file, or --stdin."
        )
    return list(dict.fromkeys(ids))


def _write_output(*, output_path: str | None, content: str) -> None:
    if output_path is None:
        print(content, end="" if content.endswith("\n") else "\n")
        return
    Path(output_path).write_text(content, encoding="utf-8")


def _serialize_rows(*, rows: list[dict[str, Any]], output_format: str) -> str:
    if output_format == "json":
        return json.dumps(rows, ensure_ascii=False, indent=2) + "\n"
    if output_format == "jsonl":
        return "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows)
    raise data_ops.DataOperationError(f"Unsupported export format {output_format!r}.")


def _format_failures(failures: tuple[data_ops.DataOperationFailure, ...]) -> str:
    return "\n".join(
        json.dumps(
            {
                "resource": failure.resource,
                "index": failure.index,
                "record_id": None if failure.record_id is None else str(failure.record_id),
                "message": failure.message,
                "payload": failure.payload,
            },
            ensure_ascii=False,
        )
        for failure in failures
    )


def _write_failures(
    *,
    failure_path: str | None,
    failures: tuple[data_ops.DataOperationFailure, ...],
) -> None:
    if failure_path is None or not failures:
        return
    Path(failure_path).write_text(_format_failures(failures) + "\n", encoding="utf-8")


async def handle_data_export_async(args: argparse.Namespace) -> int:
    try:
        async with db_session.session_scope() as session:
            if args.target == "all":
                if args.output is None:
                    print("Bundle export requires --output.", file=sys.stderr)
                    return 1
                report = await data_ops.export_bundle(
                    session,
                    output_path=Path(args.output),
                    include_deleted=not args.exclude_deleted,
                )
                print(f"Exported bundle to {report.output_path}")
                for resource, count in report.resource_counts.items():
                    print(f"{resource}: {count}")
                return 0

            if args.format == "bundle":
                print("Bundle format is only supported with `data export all`.", file=sys.stderr)
                return 1
            rows = await data_ops.export_resource_snapshot(
                session,
                resource=args.target,
                include_deleted=not args.exclude_deleted,
            )
        _write_output(
            output_path=args.output,
            content=_serialize_rows(rows=rows, output_format=args.format),
        )
        if args.output is not None:
            print(f"Exported {len(rows)} {args.target} rows to {args.output}")
        return 0
    except data_ops.DataOperationError as exc:
        print(str(exc), file=sys.stderr)
        return 1


def handle_data_export(args: argparse.Namespace) -> int:
    return run_async(handle_data_export_async(args))


async def _import_rows(
    *,
    resource: str,
    rows: list[dict[str, Any]],
    dry_run: bool,
    continue_on_error: bool,
) -> data_ops.DataImportReport:
    session = db_session.get_async_session_factory()()
    created_count = 0
    updated_count = 0
    failures: list[data_ops.DataOperationFailure] = []
    try:
        for index, row in enumerate(rows, start=1):
            try:
                async with session.begin_nested():
                    report = await data_ops.import_resource_snapshot(
                        session,
                        resource=resource,
                        rows=[row],
                    )
                    created_count += report.created_count
                    updated_count += report.updated_count
            except (data_ops.DataOperationError, LookupError, ValueError) as exc:
                failures.append(
                    data_ops.DataOperationFailure(
                        index=index,
                        resource=resource,
                        message=str(exc),
                        payload=row,
                        record_id=_maybe_record_id(row),
                    )
                )
                if not continue_on_error:
                    break
        if not failures or continue_on_error:
            await data_ops.run_post_import_hooks(session, resources={resource})
        if dry_run or failures and not continue_on_error:
            await session.rollback()
        else:
            await session.commit()
    finally:
        await session.close()
    return data_ops.DataImportReport(
        resource=resource,
        processed_count=len(rows),
        created_count=created_count,
        updated_count=updated_count,
        failed_count=len(failures),
        failures=tuple(failures),
    )


async def handle_data_import_async(args: argparse.Namespace) -> int:
    try:
        if args.target == "bundle":
            if args.continue_on_error:
                print(
                    "Bundle import is atomic and does not support --continue-on-error.",
                    file=sys.stderr,
                )
                return 1
            if args.file is None:
                print("Bundle import requires --file.", file=sys.stderr)
                return 1
            bundle_payload = data_ops.read_bundle(Path(args.file))
            session = db_session.get_async_session_factory()()
            try:
                bundle_report = await data_ops.import_bundle(
                    session,
                    bundle_rows=bundle_payload.resources,
                    replace_existing=args.replace_existing,
                )
                if args.dry_run:
                    await session.rollback()
                else:
                    await session.commit()
            finally:
                await session.close()
            print(f"Bundle resources: {', '.join(bundle_report.imported_resources) or '-'}")
            print(f"Created rows: {bundle_report.created_count}")
            print(f"Updated rows: {bundle_report.updated_count}")
            if args.dry_run:
                print("Dry run: bundle changes were rolled back.")
            return 0

        if args.format == "bundle":
            print("Bundle format is only supported with `data import bundle`.", file=sys.stderr)
            return 1
        rows = _read_rows(args.file, stdin=args.stdin, input_format=args.format)
        import_report = await _import_rows(
            resource=args.target,
            rows=rows,
            dry_run=args.dry_run,
            continue_on_error=args.continue_on_error,
        )
        _write_failures(failure_path=args.error_file, failures=import_report.failures)
        print(f"Resource: {import_report.resource}")
        print(f"Processed rows: {import_report.processed_count}")
        print(f"Created rows: {import_report.created_count}")
        print(f"Updated rows: {import_report.updated_count}")
        print(f"Failed rows: {import_report.failed_count}")
        return 0 if import_report.failed_count == 0 else 1
    except (data_ops.DataOperationError, LookupError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1


def handle_data_import(args: argparse.Namespace) -> int:
    return run_async(handle_data_import_async(args))


async def handle_data_batch_update_async(args: argparse.Namespace) -> int:
    try:
        rows = _read_rows(args.file, stdin=args.stdin, input_format=args.format)
        session = db_session.get_async_session_factory()()
        try:
            report = await data_ops.batch_update_resource(
                session,
                resource=args.target,
                rows=rows,
                continue_on_error=args.continue_on_error,
            )
            if args.dry_run or report.failed_count and not args.continue_on_error:
                await session.rollback()
            else:
                await session.commit()
        finally:
            await session.close()
        _write_failures(failure_path=args.error_file, failures=report.failures)
        print(f"Resource: {report.resource}")
        print(f"Processed rows: {report.processed_count}")
        print(f"Updated rows: {report.updated_count}")
        print(f"Failed rows: {report.failed_count}")
        return 0 if report.failed_count == 0 else 1
    except data_ops.DataOperationError as exc:
        print(str(exc), file=sys.stderr)
        return 1


def handle_data_batch_update(args: argparse.Namespace) -> int:
    return run_async(handle_data_batch_update_async(args))


async def handle_data_batch_delete_async(args: argparse.Namespace) -> int:
    try:
        record_ids = _read_ids(
            repeated_ids=args.record_ids,
            ids_file=args.ids_file,
            file_path=args.file,
            stdin=args.stdin,
            input_format=args.format,
        )
    except data_ops.DataOperationError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    session = db_session.get_async_session_factory()()
    try:
        report = await data_ops.batch_delete_resource(
            session,
            resource=args.target,
            record_ids=record_ids,
        )
        if args.dry_run:
            await session.rollback()
        else:
            await session.commit()
    except (data_ops.DataOperationError, LookupError, ValueError) as exc:
        await session.rollback()
        await session.close()
        print(str(exc), file=sys.stderr)
        return 1
    await session.close()
    _write_failures(failure_path=args.error_file, failures=report.failures)
    print(f"Resource: {report.resource}")
    print(f"Processed IDs: {report.processed_count}")
    print(f"Deleted rows: {report.deleted_count}")
    print(f"Failed rows: {report.failed_count}")
    return 0 if report.failed_count == 0 else 1


def handle_data_batch_delete(args: argparse.Namespace) -> int:
    return run_async(handle_data_batch_delete_async(args))
