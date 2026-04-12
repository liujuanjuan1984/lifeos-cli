"""Framework-driven symbols that must stay alive for static analysis."""


def _keep(*_symbols: object) -> None:
    """Reference framework-driven symbols so Vulture treats them as used."""


_keep(
    type_annotation_map,
    ARGPARSE_MESSAGE_IDS,
    isolated_runtime_locale,
    _use_stable_note_timezone,
    configured_time_preferences,
)
