"""Transaction helpers for database services."""

from __future__ import annotations

from sqlalchemy.orm import Session


def commit_or_rollback(session: Session) -> None:
    """Commit the current transaction or roll it back when the commit fails."""
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise
