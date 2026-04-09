#!/usr/bin/env python3
"""Permanently remove already soft-deleted records from the database."""

from __future__ import annotations

import argparse
import asyncio
from uuid import UUID

from lifeos_cli.db.maintenance import purge_soft_deleted_record
from lifeos_cli.db.session import session_scope

CONFIRMATION_TEXT = "permanently-delete-soft-deleted-records"


def build_parser() -> argparse.ArgumentParser:
    """Build the purge script CLI parser."""
    parser = argparse.ArgumentParser(
        prog="purge_deleted_records.py",
        description=(
            "Permanently remove already soft-deleted records.\n\n"
            "This is an internal maintenance script. It is intentionally separate from the "
            "public `lifeos` CLI and requires an explicit confirmation phrase."
        ),
    )
    parser.add_argument(
        "resource",
        choices=("note", "area", "tag", "people", "vision", "task"),
        help="Resource type to purge",
    )
    parser.add_argument(
        "--ids",
        dest="record_ids",
        type=UUID,
        nargs="+",
        required=True,
        help="One or more resource identifiers to purge",
    )
    parser.add_argument(
        "--confirm",
        required=True,
        help=f"Required confirmation text: {CONFIRMATION_TEXT}",
    )
    return parser


async def purge_deleted_records(resource: str, record_ids: list[UUID]) -> int:
    """Permanently remove already soft-deleted records for one resource."""
    async with session_scope() as session:
        exit_code = 0
        for record_id in list(dict.fromkeys(record_ids)):
            decision = await purge_soft_deleted_record(
                session,
                resource=resource,
                record_id=record_id,
            )
            if decision.status == "missing":
                print(f"Missing {resource} {record_id}; nothing was purged.")
                exit_code = 1
                continue
            if decision.status == "active":
                print(f"Refusing to purge active {resource} {record_id}; soft-delete it first.")
                exit_code = 1
                continue
            print(f"Purged {resource} {record_id}")
        return exit_code


def main() -> int:
    """Run the purge script."""
    parser = build_parser()
    args = parser.parse_args()
    if args.confirm != CONFIRMATION_TEXT:
        parser.error(f"--confirm must exactly match: {CONFIRMATION_TEXT}")
    return int(asyncio.run(purge_deleted_records(args.resource, list(args.record_ids))))


if __name__ == "__main__":
    raise SystemExit(main())
