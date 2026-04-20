"""Structured argparse help helpers for CLI resources."""

from __future__ import annotations

import argparse
import shutil
from collections.abc import Callable
from dataclasses import dataclass

from lifeos_cli.i18n import gettext_message as _


@dataclass(frozen=True)
class HelpContent:
    """Structured help content for CLI parsers."""

    summary: str
    description: str
    examples: tuple[str, ...] = ()
    notes: tuple[str, ...] = ()


class CompactSubcommandHelpFormatter(argparse.RawDescriptionHelpFormatter):
    """Render subcommand groups without a duplicated metavar heading."""

    def __init__(
        self,
        prog: str,
        indent_increment: int = 2,
        max_help_position: int = 40,
        width: int | None = None,
    ) -> None:
        """Use a wider default layout so help text wraps less aggressively."""
        terminal_width = shutil.get_terminal_size(fallback=(100, 24)).columns
        effective_width = max(100, terminal_width) if width is None else width
        super().__init__(
            prog,
            indent_increment=indent_increment,
            max_help_position=max_help_position,
            width=effective_width,
        )

    def _format_action(self, action: argparse.Action) -> str:
        if isinstance(action, argparse._SubParsersAction):
            return self._join_parts(
                [
                    self._format_action(subaction)
                    for subaction in self._iter_indented_subactions(action)
                ]
            )
        return super()._format_action(action)


def build_epilog(*, examples: tuple[str, ...] = (), notes: tuple[str, ...] = ()) -> str | None:
    """Build an argparse epilog from examples and notes."""
    sections: list[str] = []
    if examples:
        example_lines = "\n".join(f"  {example}" for example in examples)
        sections.append(f"{_('Examples')}:\n{example_lines}")
    if notes:
        note_lines = "\n".join(f"  {note}" for note in notes)
        sections.append(f"{_('Notes')}:\n{note_lines}")
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
        formatter_class=CompactSubcommandHelpFormatter,
    )


def add_documented_help_parser(
    subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
    name: str,
    *,
    help_content: HelpContent,
) -> argparse.ArgumentParser:
    """Add a documented parser that defaults to printing its own help output."""
    parser = add_documented_parser(subparsers, name, help_content=help_content)
    parser.set_defaults(handler=make_help_handler(parser))
    return parser
