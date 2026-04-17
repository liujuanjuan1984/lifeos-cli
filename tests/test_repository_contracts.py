from pathlib import Path
from typing import Any, cast

import yaml  # type: ignore[import-untyped]
from babel.messages import pofile

GITIGNORE_TEXT = Path(".gitignore").read_text()
DEPENDABOT_CONFIG = yaml.safe_load(Path(".github/dependabot.yml").read_text())
DOCTOR_TEXT = Path("scripts/doctor.sh").read_text()
DEPENDENCY_HEALTH_TEXT = Path("scripts/dependency_health.sh").read_text()
PRE_COMMIT_CONFIG = yaml.safe_load(Path(".pre-commit-config.yaml").read_text())
VALIDATE_WORKFLOW = yaml.safe_load(Path(".github/workflows/validate.yml").read_text())
VULTURE_WHITELIST_TEXT = Path("scripts/vulture_whitelist.py").read_text()


def _non_comment_shell_lines(text: str) -> list[str]:
    return [
        line.strip()
        for line in text.splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]


def _workflow_job_steps(workflow: dict[str, Any], job_name: str) -> list[dict[str, Any]]:
    jobs = cast(dict[str, Any], workflow["jobs"])
    steps = cast(list[dict[str, Any]], jobs[job_name]["steps"])
    assert isinstance(steps, list)
    return steps


DOCTOR_COMMANDS = _non_comment_shell_lines(DOCTOR_TEXT)
DEPENDENCY_HEALTH_COMMANDS = _non_comment_shell_lines(DEPENDENCY_HEALTH_TEXT)
QUALITY_GATE_STEPS = _workflow_job_steps(VALIDATE_WORKFLOW, "quality-gate")
INTEGRATION_JOB_STEPS = _workflow_job_steps(VALIDATE_WORKFLOW, "integration-postgres")


def test_dependabot_configuration_prefers_a_single_grouped_uv_pr() -> None:
    updates = DEPENDABOT_CONFIG["updates"]
    assert isinstance(updates, list)
    ecosystems = {entry["package-ecosystem"] for entry in updates}
    assert ecosystems == {"uv"}
    uv_entry = updates[0]
    assert uv_entry["open-pull-requests-limit"] == 1
    assert uv_entry["groups"]["uv-all-updates"]["patterns"] == ["*"]


def test_dependency_scripts_keep_separate_scopes() -> None:
    assert 'LOCAL_ENV_FILE="${REPO_ROOT}/.env"' in DOCTOR_TEXT
    assert any("uv sync --all-extras --frozen" in line for line in DOCTOR_COMMANDS)
    assert any('uv run pytest -m "not integration"' in line for line in DOCTOR_COMMANDS)
    assert not any("uv pip list --outdated" in line for line in DOCTOR_COMMANDS)
    assert any("uv run pip-audit" in line for line in DOCTOR_COMMANDS)
    assert any("uv build --no-sources" in line for line in DOCTOR_COMMANDS)
    assert any("uv pip list --outdated" in line for line in DEPENDENCY_HEALTH_COMMANDS)
    assert any("uv run pip-audit" in line for line in DEPENDENCY_HEALTH_COMMANDS)
    assert not any("uv run pytest" in line for line in DEPENDENCY_HEALTH_COMMANDS)


def test_dead_code_scan_is_part_of_the_default_validation_gate() -> None:
    repo_hooks = PRE_COMMIT_CONFIG["repos"]
    assert isinstance(repo_hooks, list)
    local_repo = next(repo for repo in repo_hooks if repo["repo"] == "local")
    hook_ids = {hook["id"] for hook in local_repo["hooks"]}
    assert "dead-code" in hook_ids
    assert any("uv run pre-commit run --all-files" in line for line in DOCTOR_COMMANDS)
    assert any('uv run pytest -m "not integration"' in line for line in DOCTOR_COMMANDS)
    assert any("bash ./scripts/integration_tests.sh" in line for line in DOCTOR_COMMANDS)


def test_locale_catalog_sync_is_part_of_the_default_validation_gate() -> None:
    repo_hooks = PRE_COMMIT_CONFIG["repos"]
    assert isinstance(repo_hooks, list)
    local_repo = next(repo for repo in repo_hooks if repo["repo"] == "local")
    hook_entries = {hook["id"]: hook["entry"] for hook in local_repo["hooks"]}
    assert hook_entries["locale-catalog-sync"] == "uv run python scripts/check_locale_catalog.py"


def test_validate_workflow_runs_real_cli_integration_tests() -> None:
    quality_gate_run_steps = [
        step["run"] for step in QUALITY_GATE_STEPS if isinstance(step, dict) and "run" in step
    ]
    assert any("bash ./scripts/doctor.sh" in run for run in quality_gate_run_steps)

    integration_run_step = next(
        step for step in INTEGRATION_JOB_STEPS if step.get("name") == "Run CLI integration tests"
    )
    integration_env = integration_run_step["env"]
    assert "LIFEOS_TEST_DATABASE_URL" in integration_env
    database_url = integration_env["LIFEOS_TEST_DATABASE_URL"]
    assert "127.0.0.1:5432" in database_url
    assert "lifeos_test" in database_url
    assert integration_run_step["run"] == "bash ./scripts/integration_tests.sh"


def test_integration_tests_require_an_explicit_test_database_url() -> None:
    script_text = Path("scripts/integration_tests.sh").read_text()
    assert "LIFEOS_RUN_INTEGRATION" not in script_text
    assert 'LOCAL_ENV_FILE="${REPO_ROOT}/.env"' in script_text
    assert "LIFEOS_TEST_DATABASE_URL:-" in script_text
    assert "exit 3" in script_text
    assert "uv run pytest -m integration tests/test_cli_integration_*.py" in script_text
    support_text = Path("tests/cli_integration_support.py").read_text()
    assert 'INTEGRATION_DATABASE_URL = os.environ.get("LIFEOS_TEST_DATABASE_URL")' in support_text
    assert "DatabaseSettings.from_env" not in support_text
    assert 'schema = f"lifeos_test_{uuid4().hex[:12]}"' in Path("tests/conftest.py").read_text()


def test_gitignore_keeps_local_env_files_untracked() -> None:
    assert "\n.env\n" in GITIGNORE_TEXT
    assert "\n.env.local\n" in GITIGNORE_TEXT


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
