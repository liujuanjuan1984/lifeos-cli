from __future__ import annotations

from tests.cli_integration_support import (
    INTEGRATION_PYTESTMARK,
    IntegrationContext,
    assert_missing,
    assert_ok,
    extract_created_id,
    init_context,
    integration_context,
    run_lifeos,
)

pytestmark = INTEGRATION_PYTESTMARK


def test_real_cli_note_workflow(integration_context: IntegrationContext) -> None:
    init_context(integration_context)

    first_add_result = run_lifeos(integration_context, "note", "add", "integration note")
    assert_ok(first_add_result)
    first_note_id = extract_created_id(first_add_result.stdout)

    second_add_result = run_lifeos(
        integration_context,
        "note",
        "add",
        "--stdin",
        input_text="first line\nsecond line\n",
    )
    assert_ok(second_add_result)
    second_note_id = extract_created_id(second_add_result.stdout)

    list_result = run_lifeos(integration_context, "note", "list")
    assert_ok(list_result)
    assert first_note_id in list_result.stdout
    assert second_note_id in list_result.stdout

    show_result = run_lifeos(integration_context, "note", "show", second_note_id)
    assert_ok(show_result)
    assert f"id: {second_note_id}" in show_result.stdout
    assert "content:\nfirst line\nsecond line" in show_result.stdout

    update_result = run_lifeos(
        integration_context,
        "note",
        "update",
        first_note_id,
        "integration note updated",
    )
    assert_ok(update_result)
    assert f"Updated note {first_note_id}" in update_result.stdout

    search_result = run_lifeos(integration_context, "note", "search", "integration")
    assert_ok(search_result)
    assert first_note_id in search_result.stdout

    batch_update_result = run_lifeos(
        integration_context,
        "note",
        "batch",
        "update-content",
        "--ids",
        first_note_id,
        second_note_id,
        "--find-text",
        "line",
        "--replace-text",
        "entry",
    )
    assert_ok(batch_update_result)
    assert "Updated notes: 1" in batch_update_result.stdout

    updated_multiline_result = run_lifeos(integration_context, "note", "show", second_note_id)
    assert_ok(updated_multiline_result)
    assert "content:\nfirst entry\nsecond entry" in updated_multiline_result.stdout

    delete_result = run_lifeos(integration_context, "note", "delete", first_note_id)
    assert_ok(delete_result)
    assert f"Soft-deleted note {first_note_id}" in delete_result.stdout

    batch_delete_result = run_lifeos(
        integration_context,
        "note",
        "batch",
        "delete",
        "--ids",
        second_note_id,
    )
    assert_ok(batch_delete_result)
    assert "Deleted notes: 1" in batch_delete_result.stdout

    deleted_list_result = run_lifeos(integration_context, "note", "list", "--include-deleted")
    assert_ok(deleted_list_result)
    assert first_note_id in deleted_list_result.stdout
    assert second_note_id in deleted_list_result.stdout
    assert "deleted" in deleted_list_result.stdout

    missing_show_result = run_lifeos(
        integration_context,
        "note",
        "show",
        "00000000-0000-0000-0000-000000000000",
    )
    assert_missing(missing_show_result, "00000000-0000-0000-0000-000000000000")
