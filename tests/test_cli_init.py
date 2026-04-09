from __future__ import annotations

import builtins
from pathlib import Path

import pytest

from lifeos_cli import cli
from lifeos_cli.cli_support import config_commands
from lifeos_cli.config import clear_config_cache


def test_main_init_non_interactive_writes_config(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))
    monkeypatch.setattr(config_commands, "_handle_db_upgrade", lambda _: 0)
    monkeypatch.setattr(config_commands, "_handle_db_ping_async", lambda _: _async_zero())

    exit_code = cli.main(
        [
            "init",
            "--non-interactive",
            "--database-url",
            "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Wrote config file:" in captured.out
    assert "Database URL: postgresql+psycopg://db-user:***@localhost:5432/lifeos" in captured.out
    content = config_path.read_text(encoding="utf-8")
    assert 'url = "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos"' in content
    clear_config_cache()


def test_main_init_does_not_prompt_for_explicit_database_url(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    prompts: list[str] = []
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))
    monkeypatch.setattr(config_commands, "_handle_db_upgrade", lambda _: 0)
    monkeypatch.setattr(config_commands, "_handle_db_ping_async", lambda _: _async_zero())
    monkeypatch.setattr(config_commands.sys.stdin, "isatty", lambda: True)

    def fake_input(prompt: str) -> str:
        prompts.append(prompt)
        if prompt.startswith("Database schema"):
            return ""
        if prompt.startswith("Enable SQL echo logging"):
            return ""
        raise AssertionError(f"unexpected prompt: {prompt}")

    monkeypatch.setattr(builtins, "input", fake_input)

    exit_code = cli.main(
        [
            "init",
            "--database-url",
            "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Wrote config file:" in captured.out
    assert all(not prompt.startswith("Database URL") for prompt in prompts)
    assert any(prompt.startswith("Database schema") for prompt in prompts)
    clear_config_cache()


def test_main_init_reprompts_invalid_schema_in_interactive_mode(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    prompts: list[str] = []
    responses = iter(["lifeos-dev", "lifeos_dev", ""])
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))
    monkeypatch.setattr(config_commands, "_handle_db_upgrade", lambda _: 0)
    monkeypatch.setattr(config_commands, "_handle_db_ping_async", lambda _: _async_zero())
    monkeypatch.setattr(config_commands.sys.stdin, "isatty", lambda: True)

    def fake_input(prompt: str) -> str:
        prompts.append(prompt)
        return next(responses)

    monkeypatch.setattr(builtins, "input", fake_input)

    exit_code = cli.main(
        [
            "init",
            "--database-url",
            "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos",
            "--skip-ping",
            "--skip-migrate",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "lifeos_dev" in config_path.read_text(encoding="utf-8")
    assert "Use `lifeos_dev` instead of `lifeos-dev`." in captured.err
    assert sum(prompt.startswith("Database schema") for prompt in prompts) == 2
    clear_config_cache()


def test_main_init_rejects_invalid_schema_non_interactively(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))

    exit_code = cli.main(
        [
            "init",
            "--non-interactive",
            "--database-url",
            "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos",
            "--schema",
            "lifeos-dev",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Use `lifeos_dev` instead of `lifeos-dev`." in captured.err
    assert not config_path.exists()
    clear_config_cache()


def test_main_config_show_masks_database_password(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        "\n".join(
            (
                "[database]",
                'url = "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos"',
                'schema = "lifeos"',
                "echo = false",
                "",
            )
        ),
        encoding="utf-8",
    )
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))

    exit_code = cli.main(["config", "show"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Database URL: postgresql+psycopg://db-user:***@localhost:5432/lifeos" in captured.out
    assert "<db-password>" not in captured.out
    clear_config_cache()


def test_main_init_can_repair_invalid_existing_config(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        "\n".join(
            (
                "[database]",
                'url = "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos"',
                'schema = ""',
                "echo = false",
                "",
            )
        ),
        encoding="utf-8",
    )
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))
    monkeypatch.setattr(config_commands, "_handle_db_upgrade", lambda _: 0)
    monkeypatch.setattr(config_commands, "_handle_db_ping_async", lambda _: _async_zero())

    exit_code = cli.main(
        [
            "init",
            "--non-interactive",
            "--database-url",
            "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Wrote config file:" in captured.out
    rewritten = config_path.read_text(encoding="utf-8")
    assert 'schema = "lifeos"' in rewritten
    clear_config_cache()


async def _async_zero() -> int:
    return 0

