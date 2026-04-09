from pathlib import Path

DEPENDABOT_TEXT = Path(".github/dependabot.yml").read_text()
README_TEXT = Path("README.md").read_text()
DOCTOR_TEXT = Path("scripts/doctor.sh").read_text()
DEPENDENCY_HEALTH_TEXT = Path("scripts/dependency_health.sh").read_text()


def test_dependabot_configuration_covers_uv_and_github_actions() -> None:
    assert 'package-ecosystem: "uv"' in DEPENDABOT_TEXT
    assert 'package-ecosystem: "github-actions"' in DEPENDABOT_TEXT
    assert "open-pull-requests-limit: 5" in DEPENDABOT_TEXT
    assert "open-pull-requests-limit: 3" in DEPENDABOT_TEXT
    assert "uv-minor-and-patch" in DEPENDABOT_TEXT


def test_readme_documents_dependabot_and_dependency_audit_split() -> None:
    assert "weekly grouped version-update PRs" in README_TEXT
    assert "bash ./scripts/dependency_health.sh" in README_TEXT


def test_dependency_scripts_keep_separate_scopes() -> None:
    assert "uv run pytest" in DOCTOR_TEXT
    assert "uv pip list --outdated" not in DOCTOR_TEXT
    assert "uv pip list --outdated" in DEPENDENCY_HEALTH_TEXT
    assert "uv run pip-audit" in DEPENDENCY_HEALTH_TEXT
    assert "uv run pytest" not in DEPENDENCY_HEALTH_TEXT
