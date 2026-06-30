"""Audit frontend usage of fields declared by Web API response interfaces.

This script is a static heuristic for finding API response fields that may be
safe to remove from local Web API payloads. It intentionally does not mutate
code and should be paired with endpoint-specific tests before fields are
removed.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

INTERFACE_PATTERN = re.compile(r"export\s+interface\s+(\w+)\s*\{(?P<body>.*?)\n\}", re.DOTALL)
FIELD_PATTERN = re.compile(r"^\s{2}([A-Za-z_][A-Za-z0-9_]*)\??\s*:", re.MULTILINE)
REFERENCE_TEMPLATE = (
    r"(?:\.{field}\b|\[\s*['\"]{field}['\"]\s*\]|"
    r"(?:\{{|,)\s*{field}\s*(?::|,|\}}))"
)
REQUEST_INTERFACE_SUFFIXES = ("Create", "Update", "Request", "Payload", "Filters")


@dataclass(frozen=True)
class InterfaceField:
    """One top-level field declared by a frontend API interface."""

    source: str
    interface: str
    field: str
    references: int


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _iter_api_files(api_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in api_dir.glob("*.ts")
        if path.is_file() and not path.name.endswith(".test.ts")
    )


def _iter_scan_files(web_src: Path, *, include_api_services: bool) -> list[Path]:
    files = []
    for path in web_src.rglob("*"):
        if not path.is_file() or path.suffix not in {".ts", ".tsx"}:
            continue
        relative = path.relative_to(web_src)
        if "node_modules" in relative.parts or "__tests__" in relative.parts:
            continue
        if not include_api_services and relative.parts[:2] == ("services", "api"):
            continue
        files.append(path)
    return sorted(files)


def _interface_fields(path: Path) -> dict[str, list[str]]:
    text = _read_text(path)
    interfaces: dict[str, list[str]] = {}
    for match in INTERFACE_PATTERN.finditer(text):
        interface = match.group(1)
        if interface.endswith(REQUEST_INTERFACE_SUFFIXES):
            continue
        fields = FIELD_PATTERN.findall(match.group("body"))
        if fields:
            interfaces[interface] = fields
    return interfaces


def _reference_count(field: str, texts: list[str]) -> int:
    pattern = re.compile(REFERENCE_TEMPLATE.format(field=re.escape(field)))
    return sum(len(pattern.findall(text)) for text in texts)


def audit_fields(
    *,
    api_dir: Path,
    web_src: Path,
    include_api_services: bool,
) -> list[InterfaceField]:
    """Return field reference counts for exported API interfaces."""
    scan_files = _iter_scan_files(
        web_src,
        include_api_services=include_api_services,
    )
    scan_texts = [_read_text(path) for path in scan_files]
    results: list[InterfaceField] = []
    for api_file in _iter_api_files(api_dir):
        for interface, fields in _interface_fields(api_file).items():
            for field in fields:
                results.append(
                    InterfaceField(
                        source=str(api_file),
                        interface=interface,
                        field=field,
                        references=_reference_count(field, scan_texts),
                    )
                )
    return results


def _format_markdown(results: list[InterfaceField], *, only_candidates: bool) -> str:
    rows = [item for item in results if not only_candidates or item.references == 0]
    lines = [
        "# Web API Payload Field Usage Audit",
        "",
        "Static heuristic: zero references means no direct frontend property read was found.",
        (
            "Review dynamic access, server-side consumers, cache keys, and tests "
            "before removing fields."
        ),
        "",
        "| Source | Interface | Field | References |",
        "| --- | --- | --- | ---: |",
    ]
    for item in rows:
        source_name = Path(item.source).name
        lines.append(
            f"| `{source_name}` | `{item.interface}` | `{item.field}` | "
            f"{item.references} |"
        )
    lines.append("")
    return "\n".join(lines)


def _format_json(results: list[InterfaceField], *, only_candidates: bool) -> str:
    rows = [item for item in results if not only_candidates or item.references == 0]
    return json.dumps([item.__dict__ for item in rows], indent=2, sort_keys=True)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Audit frontend references to fields declared by Web API "
            "TypeScript interfaces."
        ),
    )
    parser.add_argument(
        "--api-dir",
        type=Path,
        default=Path("web/src/services/api"),
        help="Directory containing frontend API TypeScript modules.",
    )
    parser.add_argument(
        "--web-src",
        type=Path,
        default=Path("web/src"),
        help="Frontend source directory to scan for field references.",
    )
    parser.add_argument(
        "--include-api-services",
        action="store_true",
        help="Also count references inside web/src/services/api.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Show all fields instead of only zero-reference candidates.",
    )
    parser.add_argument(
        "--format",
        choices=("markdown", "json"),
        default="markdown",
        help="Output format.",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    results = audit_fields(
        api_dir=args.api_dir,
        web_src=args.web_src,
        include_api_services=args.include_api_services,
    )
    output_format: Literal["markdown", "json"] = args.format
    if output_format == "json":
        print(_format_json(results, only_candidates=not args.all))
    else:
        print(_format_markdown(results, only_candidates=not args.all))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
