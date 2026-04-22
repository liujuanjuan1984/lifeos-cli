"""Builder helpers for task write commands."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser
from lifeos_cli.cli_support.resources.task.handlers import (
    handle_task_add_async,
    handle_task_delete_async,
    handle_task_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import cli_message as _


def build_task_add_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task add command."""
    add_parser = add_documented_parser(
        task_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("messages.create_a_task_c071049b"),
            description=(
                _("messages.create_a_new_task_for_a_vision_10c32750")
                + "\n\n"
                + _("messages.tasks_can_be_root_tasks_or_child_tasks_under_another_tas_b5b055a8")
                + " "
                + _("messages.planning_cycle_fields_describe_the_enclosing_timebox_for_1bc9d464")
            ),
            examples=(
                'lifeos task add "Draft the release checklist" '
                "--vision-id 11111111-1111-1111-1111-111111111111",
                'lifeos task add "Write changelog" '
                "--vision-id 11111111-1111-1111-1111-111111111111 "
                "--parent-task-id 22222222-2222-2222-2222-222222222222",
                'lifeos task add "Prepare family meeting" '
                "--vision-id 11111111-1111-1111-1111-111111111111 "
                "--person-id 33333333-3333-3333-3333-333333333333",
                'lifeos task add "Plan shared trip" '
                "--vision-id 11111111-1111-1111-1111-111111111111 "
                "--person-id 33333333-3333-3333-3333-333333333333 "
                "--person-id 44444444-4444-4444-4444-444444444444",
                'lifeos task add "Draft sprint backlog" '
                "--vision-id 11111111-1111-1111-1111-111111111111 "
                "--planning-cycle-type week --planning-cycle-days 7 "
                "--planning-cycle-start-date 2026-04-14",
            ),
            notes=(
                _("messages.planning_cycle_flags_must_be_supplied_as_a_complete_set_b70f2ac9"),
                _("messages.use_planning_cycle_fields_for_the_broader_year_month_wee_29ef599d"),
                _("messages.use_lifeos_event_add_task_id_task_id_if_the_task_also_ne_318baeeb"),
                _("messages.repeat_the_same_person_id_flag_to_associate_multiple_peo_648ea09d"),
                _("messages.when_an_agent_creates_tasks_on_behalf_of_a_human_use_per_5b6b0e90"),
            ),
        ),
    )
    add_parser.add_argument("content", help=_("messages.task_content_7baf7d11"))
    add_parser.add_argument(
        "--vision-id",
        required=True,
        type=UUID,
        help=_("messages.owning_vision_identifier_4e7e119c"),
    )
    add_parser.add_argument("--description", help=_("messages.optional_task_description_58d58247"))
    add_parser.add_argument(
        "--parent-task-id", type=UUID, help=_("messages.optional_parent_task_identifier_f5f58a25")
    )
    add_parser.add_argument("--status", default="todo", help=_("messages.task_status_7dbc579e"))
    add_parser.add_argument(
        "--priority", type=int, default=0, help=_("messages.task_priority_37e4e62c")
    )
    add_parser.add_argument(
        "--display-order", type=int, default=0, help=_("messages.display_order_5f1293a2")
    )
    add_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_associate_one_or_more_people_cf6b79d8"),
    )
    add_parser.add_argument(
        "--estimated-effort", type=int, help=_("messages.estimated_effort_in_minutes_98e10372")
    )
    add_parser.add_argument(
        "--planning-cycle-type",
        help=_("messages.planning_cycle_type_year_month_week_or_day_bb4f7e82"),
    )
    add_parser.add_argument(
        "--planning-cycle-days",
        type=int,
        help=_("messages.planning_cycle_duration_in_days_for_the_enclosing_timebo_8267754c"),
    )
    add_parser.add_argument(
        "--planning-cycle-start-date",
        help=_("messages.start_date_of_the_enclosing_planning_cycle_window_in_yyy_1e2d2ad2"),
    )
    add_parser.set_defaults(handler=make_sync_handler(handle_task_add_async))


def build_task_update_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task update command."""
    update_parser = add_documented_parser(
        task_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("messages.update_a_task_1215413b"),
            description=(
                _("messages.update_mutable_task_fields_1bc4e36b")
                + "\n\n"
                + _("messages.only_explicitly_provided_flags_are_changed_omitted_field_0644c34c")
            ),
            examples=(
                "lifeos task update 11111111-1111-1111-1111-111111111111 --status in_progress",
                "lifeos task update 11111111-1111-1111-1111-111111111111 "
                "--priority 3 --display-order 20",
                "lifeos task update 11111111-1111-1111-1111-111111111111 "
                "--person-id 33333333-3333-3333-3333-333333333333",
                "lifeos task update 11111111-1111-1111-1111-111111111111 "
                "--person-id 33333333-3333-3333-3333-333333333333 "
                "--person-id 44444444-4444-4444-4444-444444444444",
                "lifeos task update 11111111-1111-1111-1111-111111111111 "
                "--clear-description --clear-estimated-effort",
                "lifeos task update 11111111-1111-1111-1111-111111111111 "
                "--planning-cycle-type month --planning-cycle-days 30 "
                "--planning-cycle-start-date 2026-04-01",
                "lifeos task update 11111111-1111-1111-1111-111111111111 --clear-parent",
                "lifeos task update 11111111-1111-1111-1111-111111111111 --clear-planning-cycle",
            ),
            notes=(
                _("messages.parent_task_references_must_stay_within_the_same_vision_5161a1dc"),
                _("messages.use_clear_parent_to_move_a_child_task_back_to_the_root_l_57221cab"),
                _("messages.updated_planning_cycle_fields_still_describe_the_enclosi_f34b4fb4"),
                _("messages.use_clear_flags_to_remove_optional_values_such_as_descri_205dc5c6"),
                _("messages.use_repeated_person_id_to_keep_human_only_agent_only_and_4359aefb"),
            ),
        ),
    )
    update_parser.add_argument("task_id", type=UUID, help=_("messages.task_identifier_b5d5c4ca"))
    update_parser.add_argument("--content", help=_("messages.updated_task_content_6cfba441"))
    update_parser.add_argument("--description", help=_("messages.updated_description_ce962f11"))
    update_parser.add_argument(
        "--clear-description",
        action="store_true",
        help=_("messages.clear_the_optional_task_description_dd24976c"),
    )
    update_parser.add_argument(
        "--parent-task-id", type=UUID, help=_("messages.updated_parent_task_identifier_dea0eedf")
    )
    update_parser.add_argument(
        "--clear-parent",
        action="store_true",
        help=_("messages.move_the_task_to_the_root_level_by_clearing_its_parent_t_d2a99765"),
    )
    update_parser.add_argument("--status", help=_("messages.updated_task_status_8a82e91d"))
    update_parser.add_argument("--priority", type=int, help=_("messages.updated_priority_596c81d7"))
    update_parser.add_argument(
        "--display-order", type=int, help=_("messages.updated_display_order_6dbf2e30")
    )
    update_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_replace_people_with_one_or_more_identifiers_3ec3c70d"),
    )
    update_parser.add_argument(
        "--clear-people", action="store_true", help=_("messages.remove_all_people_d2c07476")
    )
    update_parser.add_argument(
        "--estimated-effort", type=int, help=_("messages.updated_estimated_effort_f496f004")
    )
    update_parser.add_argument(
        "--clear-estimated-effort",
        action="store_true",
        help=_("messages.clear_the_optional_estimated_effort_value_a9f16ec2"),
    )
    update_parser.add_argument(
        "--planning-cycle-type",
        help=_("messages.updated_planning_cycle_type_year_month_week_or_day_d2dbf991"),
    )
    update_parser.add_argument(
        "--planning-cycle-days",
        type=int,
        help=_("messages.updated_planning_cycle_duration_in_days_for_the_enclosin_9939bda0"),
    )
    update_parser.add_argument(
        "--planning-cycle-start-date",
        help=_("messages.updated_start_date_of_the_enclosing_planning_cycle_windo_f766bd8f"),
    )
    update_parser.add_argument(
        "--clear-planning-cycle",
        action="store_true",
        help=_("messages.clear_all_planning_cycle_fields_c406e56d"),
    )
    update_parser.set_defaults(handler=make_sync_handler(handle_task_update_async))


def build_task_delete_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task delete command."""
    delete_parser = add_documented_parser(
        task_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("messages.delete_a_task_51496d63"),
            description=_("messages.delete_a_task_e630d5bc"),
            examples=("lifeos task delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("task_id", type=UUID, help=_("messages.task_identifier_b5d5c4ca"))
    delete_parser.set_defaults(handler=make_sync_handler(handle_task_delete_async))
