from enum import Enum as PyEnum

from sqlalchemy import Enum


def pg_enum(enum_class: type[PyEnum], name: str) -> Enum:
    """PostgreSQL enum using member values (e.g. 'global'), not names ('GLOBAL')."""
    return Enum(
        enum_class,
        name=name,
        values_callable=lambda members: [member.value for member in members],
    )
