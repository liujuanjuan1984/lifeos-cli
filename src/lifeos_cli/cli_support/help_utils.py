"""Structured argparse help helpers for CLI resources."""

from __future__ import annotations

import argparse
from collections.abc import Callable
from dataclasses import dataclass


@dataclass(frozen=True)
class HelpContent:
    """Structured help content for CLI parsers."""

    summary: str
    description: str
    examples: tuple[str, ...] = ()
    notes: tuple[str, ...] = ()


def build_epilog(*, examples: tuple[str, ...] = (), notes: tuple[str, ...] = ()) -> str | None:
    """Build an argparse epilog from examples and notes."""
    sections: list[str] = []
    if examples:
        example_lines = "\n".join(f"  {example}" for example in examples)
        sections.append(f"Examples:\n{example_lines}")
    if notes:
        note_lines = "\n".join(f"  {note}" for note in notes)
        sections.append(f"Notes:\n{note_lines}")
    if not sections:
        return None
    return "\n\n".join(sections)


def make_help_handler(parser: argparse.ArgumentParser) -> Callable[[argparse.Namespace], int]:
    """Return a handler that prints parser help for resource-level commands."""

    def _handler(_: argparse.Namespace) -> int:
        parser.print_help()
        return 0

    return _handler


def add_documented_parser(
    subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
    name: str,
    *,
    help_content: HelpContent,
) -> argparse.ArgumentParser:
    """Add a parser with structured description and examples."""
    return subparsers.add_parser(
        name,
        help=help_content.summary,
        description=help_content.description,
        epilog=build_epilog(examples=help_content.examples, notes=help_content.notes),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
