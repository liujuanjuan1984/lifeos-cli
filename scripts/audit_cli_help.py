#!/usr/bin/env python3
"""Execute CLI help commands and write a review-friendly report."""

from __future__ import annotations

import argparse
import shlex
import sys
from pathlib import Path

from lifeos_cli.cli import build_parser
from lifeos_cli.cli_support.help_audit import (
    collect_help_invocations,
    filter_help_invocations,
    render_help_audit_report,
    run_help_audit,
)


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments for the help audit script."""
    parser = argparse.ArgumentParser(
        description="Execute lifeos help commands and render a Markdown audit report.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional Markdown output path. Print to stdout when omitted.",
    )
    parser.add_argument(
        "--path-prefix",
        default="",
        help=(
            "Optional command subtree to audit, for example 'note' or 'timelog stats'. "
            "Leave empty to audit every parser level."
        ),
    )
    parser.add_argument(
        "--command-prefix",
        default="uv run lifeos",
        help="Executable prefix used to run help queries. Default: 'uv run lifeos'.",
    )
    return parser.parse_args()


def main() -> int:
    """Run the CLI help audit and emit a Markdown report."""
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    command_prefix = tuple(shlex.split(args.command_prefix))
    path_prefix = tuple(shlex.split(args.path_prefix))

    invocations = collect_help_invocations(build_parser())
    if path_prefix:
        invocations = filter_help_invocations(invocations, path_prefix=path_prefix)
    results = run_help_audit(
        invocations,
        command_prefix=command_prefix,
        cwd=repo_root,
    )
    report = render_help_audit_report(results)

    if args.output is None:
        sys.stdout.write(report)
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report, encoding="utf-8")
        print(f"Wrote CLI help audit report: {args.output}")

    return 0 if all(result.ok for result in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
