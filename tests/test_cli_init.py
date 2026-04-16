from __future__ import annotations

import builtins
from pathlib import Path

import pytest

from lifeos_cli import cli
from lifeos_cli.cli_support.system import config_commands
from lifeos_cli.config import clear_config_cache


def test_main_init_non_interactive_writes_config(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))
    monkeypatch.setattr(config_commands, "upgrade_configured_database", lambda: None)
    monkeypatch.setattr(config_commands, "ping_configured_database", lambda: None)

    exit_code = cli.main(
        [
            "init",
            "--non-interactive",
            "--database-url",
            "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos",
            "--timezone",
            "America/Toronto",
            "--language",
            "zh-Hans",
            "--day-starts-at",
            "04:00",
            "--week-starts-on",
            "sunday",
            "--vision-experience-rate-per-hour",
            "120",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Wrote config file:" in captured.out
    assert "Database URL: postgresql+psycopg://db-user:***@localhost:5432/lifeos" in captured.out
    assert "Preference timezone: America/Toronto" in captured.out
    assert "Preference language: zh-Hans" in captured.out
    assert "Payload language for agent-authored records: zh-Hans" in captured.out
    assert "Agent payload rule:" in captured.out
    assert "Preference vision experience rate per hour: 120" in captured.out
    content = config_path.read_text(encoding="utf-8")
    assert 'url = "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos"' in content
    assert 'timezone = "America/Toronto"' in content
    assert 'language = "zh-Hans"' in content
    assert 'day_starts_at = "04:00"' in content
    assert 'week_starts_on = "sunday"' in content
    assert "vision_experience_rate_per_hour = 120" in content
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
    monkeypatch.setattr(config_commands, "upgrade_configured_database", lambda: None)
    monkeypatch.setattr(config_commands, "ping_configured_database", lambda: None)
    monkeypatch.setattr(config_commands.sys.stdin, "isatty", lambda: True)

    def fake_input(prompt: str) -> str:
        prompts.append(prompt)
        if prompt.startswith("Database schema"):
            return ""
        if prompt.startswith("Preferred language tag for human-authored payloads"):
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
    assert any(
        prompt.startswith("Preferred language tag for human-authored payloads")
        for prompt in prompts
    )
    clear_config_cache()


def test_main_init_reprompts_invalid_schema_in_interactive_mode(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    prompts: list[str] = []
    responses = iter(["lifeos-dev", "lifeos_dev", "", "", ""])
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))
    monkeypatch.setattr(config_commands, "upgrade_configured_database", lambda: None)
    monkeypatch.setattr(config_commands, "ping_configured_database", lambda: None)
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
                "[preferences]",
                'timezone = "America/Toronto"',
                'language = "zh-Hans"',
                'day_starts_at = "04:00"',
                'week_starts_on = "sunday"',
                "vision_experience_rate_per_hour = 90",
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
    assert "Preference timezone: America/Toronto" in captured.out
    assert "Preference language: zh-Hans" in captured.out
    assert "Payload language for agent-authored records: zh-Hans" in captured.out
    assert "Agent payload rule:" in captured.out
    assert "Preference day starts at: 04:00" in captured.out
    assert "Preference week starts on: sunday" in captured.out
    assert "Preference vision experience rate per hour: 90" in captured.out
    clear_config_cache()


def test_main_config_set_updates_preference_value(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        "\n".join(
            (
                "[database]",
                'schema = "lifeos"',
                "echo = false",
                "",
                "[preferences]",
                'timezone = "UTC"',
                'language = "en"',
                'day_starts_at = "00:00"',
                'week_starts_on = "monday"',
                "vision_experience_rate_per_hour = 60",
                "",
                "[notes]",
                'default_editor = "nvim"',
                "",
            )
        ),
        encoding="utf-8",
    )
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))

    exit_code = cli.main(["config", "set", "preferences.timezone", "America/Toronto"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Updated key: preferences.timezone" in captured.out
    assert "Preference timezone: America/Toronto" in captured.out
    content = config_path.read_text(encoding="utf-8")
    assert 'timezone = "America/Toronto"' in content
    assert "[notes]" in content
    assert 'default_editor = "nvim"' in content
    clear_config_cache()


def test_main_config_set_rejects_deployment_scoped_database_schema(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        "\n".join(
            (
                "[database]",
                'schema = "lifeos"',
                "echo = false",
                "",
            )
        ),
        encoding="utf-8",
    )
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))

    exit_code = cli.main(["config", "set", "database.schema", "lifeos_dev"])
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "deployment-scoped" in captured.err
    assert "lifeos init --schema <name>" in captured.err
    assert 'schema = "lifeos"' in config_path.read_text(encoding="utf-8")
    clear_config_cache()


def test_main_config_set_updates_database_echo_strictly(
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
                "[preferences]",
                'timezone = "UTC"',
                'language = "en"',
                'day_starts_at = "00:00"',
                'week_starts_on = "monday"',
                "vision_experience_rate_per_hour = 60",
                "",
            )
        ),
        encoding="utf-8",
    )
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))

    exit_code = cli.main(["config", "set", "database.echo", "true"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Database echo: true" in captured.out
    assert "db-user:***" in captured.out
    assert "echo = true" in config_path.read_text(encoding="utf-8")
    clear_config_cache()


def test_main_config_set_rejects_unknown_key(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))

    exit_code = cli.main(["config", "set", "preferences.unknown", "value"])
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Unsupported config key" in captured.err
    assert not config_path.exists()
    clear_config_cache()


def test_main_config_set_ignores_runtime_env_overrides_when_persisting(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        "\n".join(
            (
                "[database]",
                'schema = "lifeos"',
                "echo = false",
                "",
                "[preferences]",
                'timezone = "America/Toronto"',
                'language = "zh-Hans"',
                'day_starts_at = "04:00"',
                'week_starts_on = "sunday"',
                "vision_experience_rate_per_hour = 90",
                "",
            )
        ),
        encoding="utf-8",
    )
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))
    monkeypatch.setenv("LIFEOS_TIMEZONE", "UTC")

    exit_code = cli.main(["config", "set", "preferences.language", "en-CA"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Updated key: preferences.language" in captured.out
    content = config_path.read_text(encoding="utf-8")
    assert 'timezone = "America/Toronto"' in content
    assert 'language = "en-CA"' in content
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
    monkeypatch.setattr(config_commands, "upgrade_configured_database", lambda: None)
    monkeypatch.setattr(config_commands, "ping_configured_database", lambda: None)

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
    assert "[preferences]" in rewritten
    clear_config_cache()
