"""Framework-driven symbols that must stay alive for static analysis.

Name-only framework entrypoints that Vulture cannot resolve at all, such as Alembic revision
metadata and module-level ``pytestmark``, are handled in ``scripts/dead_code_check.sh`` through the
``--ignore-names`` list. This file is for importable symbols that should remain reachable even when
generic static analysis cannot follow the framework integration path.
"""


def _keep(*_symbols: object) -> None:
    """Reference framework-driven symbols so Vulture treats them as used."""


_keep(
    type_annotation_map,
    ARGPARSE_MESSAGE_IDS,
    isolated_runtime_locale,
    _use_stable_note_timezone,
    configured_time_preferences,
)
