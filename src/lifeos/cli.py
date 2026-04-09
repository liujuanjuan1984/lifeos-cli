"""CLI entrypoint for the lifeos package."""

from __future__ import annotations

import argparse
from importlib.metadata import PackageNotFoundError, version


def build_parser() -> argparse.ArgumentParser:
    """Build the top-level CLI parser."""
    parser = argparse.ArgumentParser(prog="lifeos", description="LifeOS command-line interface")
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {get_version()}",
    )
    return parser


def get_version() -> str:
    """Return the installed distribution version when available."""
    try:
        return version("lifeos-cli")
    except PackageNotFoundError:
        return "0+unknown"


def main() -> int:
    """Run the CLI."""
    build_parser().parse_args()
    return 0
