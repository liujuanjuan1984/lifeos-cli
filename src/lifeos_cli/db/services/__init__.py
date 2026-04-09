"""Database-backed services for lifeos_cli."""

from .notes import (
    NoteBatchDeleteResult,
    NoteBatchUpdateResult,
    NoteNotFoundError,
    batch_delete_notes,
    batch_update_note_content,
    create_note,
    delete_note,
    get_note,
    list_notes,
    search_notes,
    update_note,
)

__all__ = [
    "NoteBatchDeleteResult",
    "NoteBatchUpdateResult",
    "NoteNotFoundError",
    "batch_delete_notes",
    "batch_update_note_content",
    "create_note",
    "delete_note",
    "get_note",
    "list_notes",
    "search_notes",
    "update_note",
]
