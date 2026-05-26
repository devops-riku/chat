"""Add blocked to friendshipstatus enum.

Revision ID: 0004
Revises: 0003
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE friendshipstatus ADD VALUE IF NOT EXISTS 'blocked'")


def downgrade() -> None:
    pass  # Postgres does not support removing enum values
