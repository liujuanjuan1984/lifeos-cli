"""Cross-backend SQL expression helpers."""

from __future__ import annotations

from sqlalchemy import Date
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql import expression


class AddDaysToDate(expression.FunctionElement):
    """Add one integer day offset to one date expression."""

    type = Date()
    inherit_cache = True


@compiles(AddDaysToDate)
def _compile_add_days_default(element, compiler, **kwargs) -> str:
    start_sql, offset_sql = (
        compiler.process(clause, **kwargs) for clause in element.clauses.clauses
    )
    return f"({start_sql} + {offset_sql})"


@compiles(AddDaysToDate, "sqlite")
def _compile_add_days_sqlite(element, compiler, **kwargs) -> str:
    start_sql, offset_sql = (
        compiler.process(clause, **kwargs) for clause in element.clauses.clauses
    )
    return f"date({start_sql}, printf('%+d days', {offset_sql}))"
