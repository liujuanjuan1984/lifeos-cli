from __future__ import annotations

import subprocess
from pathlib import Path

from lifeos_cli.cli import build_parser
from lifeos_cli.cli_support.help_audit import (
    collect_help_invocations,
    filter_help_invocations,
    render_help_audit_report,
    run_help_audit,
)


def test_collect_help_invocations_covers_nested_parser_paths() -> None:
    invocations = collect_help_invocations(build_parser())
    paths = {invocation.argv for invocation in invocations}

    assert ("--help",) in paths
    assert ("note", "--help") in paths
    assert ("note", "add", "--help") in paths
    assert ("note", "batch", "update-content", "--help") in paths
    assert ("timelog", "stats", "day", "--help") in paths
    assert ("config", "set", "--help") in paths


def test_filter_help_invocations_limits_results_to_one_subtree() -> None:
    invocations = collect_help_invocations(build_parser())

    filtered = filter_help_invocations(invocations, path_prefix=("note",))

    assert filtered
    assert all(invocation.path[:1] == ("note",) for invocation in filtered)
    assert ("note", "--help") in {invocation.argv for invocation in filtered}
    assert ("note", "add", "--help") in {invocation.argv for invocation in filtered}
    assert ("task", "--help") not in {invocation.argv for invocation in filtered}


def test_run_help_audit_executes_requested_commands_and_renders_markdown() -> None:
    invocations = filter_help_invocations(
        collect_help_invocations(build_parser()),
        path_prefix=("note",),
    )[:2]
    captured_commands: list[list[str]] = []

    def fake_runner(
        command: list[str],
        *,
        cwd: str,
        check: bool,
        capture_output: bool,
        text: bool,
    ) -> subprocess.CompletedProcess[str]:
        captured_commands.append(command)
        assert cwd == str(Path.cwd())
        assert check is False
        assert capture_output is True
        assert text is True
        return subprocess.CompletedProcess(
            command,
            0,
            stdout=f"help for {' '.join(command[3:-1]) or 'root'}\n",
            stderr="",
        )

    results = run_help_audit(
        invocations,
        command_prefix=("uv", "run", "lifeos"),
        cwd=Path.cwd(),
        runner=fake_runner,
    )
    report = render_help_audit_report(results)

    assert captured_commands == [
        ["uv", "run", "lifeos", "note", "--help"],
        ["uv", "run", "lifeos", "note", "add", "--help"],
    ]
    assert "## `uv run lifeos note --help`" in report
    assert "help for note add" in report
    assert "- Failures: `0`" in report
