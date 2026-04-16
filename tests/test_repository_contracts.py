from pathlib import Path

from babel.messages import pofile

DEPENDABOT_TEXT = Path(".github/dependabot.yml").read_text()
DOCTOR_TEXT = Path("scripts/doctor.sh").read_text()
DEPENDENCY_HEALTH_TEXT = Path("scripts/dependency_health.sh").read_text()
PRE_COMMIT_TEXT = Path(".pre-commit-config.yaml").read_text()
VALIDATE_WORKFLOW_TEXT = Path(".github/workflows/validate.yml").read_text()
VULTURE_WHITELIST_TEXT = Path("scripts/vulture_whitelist.py").read_text()


def test_dependabot_configuration_prefers_a_single_grouped_uv_pr() -> None:
    assert 'package-ecosystem: "uv"' in DEPENDABOT_TEXT
    assert 'package-ecosystem: "github-actions"' not in DEPENDABOT_TEXT
    assert "open-pull-requests-limit: 1" in DEPENDABOT_TEXT
    assert "uv-all-updates" in DEPENDABOT_TEXT


def test_dependency_scripts_keep_separate_scopes() -> None:
    assert "uv run pytest" in DOCTOR_TEXT
    assert "uv pip list --outdated" not in DOCTOR_TEXT
    assert "uv pip list --outdated" in DEPENDENCY_HEALTH_TEXT
    assert "uv run pip-audit" in DEPENDENCY_HEALTH_TEXT
    assert "uv run pytest" not in DEPENDENCY_HEALTH_TEXT


def test_dead_code_scan_is_part_of_the_default_validation_gate() -> None:
    assert "bash ./scripts/dead_code_check.sh" in PRE_COMMIT_TEXT
    assert "uv run pre-commit run --all-files" in DOCTOR_TEXT
    assert 'uv run pytest -m "not integration"' in DOCTOR_TEXT
    assert "bash ./scripts/integration_tests.sh" in DOCTOR_TEXT


def test_locale_catalog_sync_is_part_of_the_default_validation_gate() -> None:
    assert "uv run python scripts/check_locale_catalog.py" in PRE_COMMIT_TEXT


def test_validate_workflow_runs_real_cli_integration_tests() -> None:
    expected_database_url = (
        "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/"  # pragma: allowlist secret
        "lifeos_test"
    )
    assert "integration-postgres" in VALIDATE_WORKFLOW_TEXT
    assert 'LIFEOS_RUN_INTEGRATION: "1"' in VALIDATE_WORKFLOW_TEXT
    assert expected_database_url in VALIDATE_WORKFLOW_TEXT
    assert 'uv run pytest -m "not integration"' in VALIDATE_WORKFLOW_TEXT
    assert "bash ./scripts/integration_tests.sh" in VALIDATE_WORKFLOW_TEXT


def test_integration_tests_require_an_explicit_test_database_url() -> None:
    assert "LIFEOS_TEST_DATABASE_URL:-" in Path("scripts/integration_tests.sh").read_text()
    assert "LIFEOS_DATABASE_URL:-" not in Path("scripts/integration_tests.sh").read_text()
    support_text = Path("tests/cli_integration_support.py").read_text()
    assert 'TEST_DATABASE_URL = os.environ.get("LIFEOS_TEST_DATABASE_URL")' in support_text
    assert "DatabaseSettings.from_env" not in support_text


def test_vulture_whitelist_keeps_intentional_framework_symbols() -> None:
    for symbol in (
        "type_annotation_map",
        "ARGPARSE_MESSAGE_IDS",
        "isolated_runtime_locale",
        "_use_stable_note_timezone",
        "configured_time_preferences",
    ):
        assert symbol in VULTURE_WHITELIST_TEXT


def test_zh_hans_cli_catalog_is_complete() -> None:
    catalog_path = Path("src/lifeos_cli/locales/zh_Hans/LC_MESSAGES/lifeos_cli.po")
    with catalog_path.open("r", encoding="utf-8") as catalog_file:
        catalog = pofile.read_po(catalog_file)

    entries = [message for message in catalog if message.id and isinstance(message.id, str)]

    assert entries
    assert all(message.string for message in entries)
    assert all("fuzzy" not in message.flags for message in entries)
    assert all(message.string != message.id for message in entries)


def test_zh_hans_cli_catalog_keeps_internal_entity_terms_in_english() -> None:
    catalog_path = Path("src/lifeos_cli/locales/zh_Hans/LC_MESSAGES/lifeos_cli.po")
    with catalog_path.open("r", encoding="utf-8") as catalog_file:
        catalog = pofile.read_po(catalog_file)

    entries = [
        message
        for message in catalog
        if message.id and isinstance(message.id, str) and message.string
    ]
    banned_terms = (
        "领域",
        "愿景",
        "任务",
        "笔记",
        "标签",
        "事件",
        "日程",
        "时间记录",
        "习惯执行记录",
        "习惯",
        "人员",
    )

    offenders = [
        (message.id, message.string)
        for message in entries
        if isinstance(message.string, str) and any(term in message.string for term in banned_terms)
    ]

    assert offenders == []
