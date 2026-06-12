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
    isolated_runtime_locale,
    _use_stable_note_timezone,
    configured_time_preferences,
    inherit_cache,
    _compile_add_days_default,
    _compile_add_days_sqlite,
    _clear_sqlite_runtime,
    _allow_postgres_url_logic_tests_without_driver,
    list_actions_by_date,
    list_actions_for_habit,
    get_habit_task_associations,
    list_dimensions,
    get_dimension_order,
    set_dimension_order,
    reset_dimension_order,
    get_dimension,
    create_dimension,
    update_dimension,
    delete_dimension,
    activate_dimension,
    list_planned_events,
    list_raw_planned_events,
    list_planned_events_by_task,
    get_planned_event,
    create_planned_event,
    update_planned_event,
    delete_planned_event,
    list_daily_dimensions,
    get_day_breakdown,
    list_aggregated_dimensions,
    recompute_daily_dimensions,
    list_persons,
    search_persons_by_tag,
    get_person,
    create_person,
    update_person,
    delete_person,
    list_person_activities,
    list_person_anniversaries,
    get_vision_hierarchy,
    replace_task,
    replace_vision,
    update_action,
    update_action_by_date,
    get_preference,
    set_preference,
    list_tag_entity_types,
    list_tag_categories,
    update_task_status,
    pagination,
    timestamp,
)
