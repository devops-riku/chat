"""Friends, message replies, group rooms.

Revision ID: 0002
Revises: 0001
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

friendship_status = postgresql.ENUM(
    "pending", "accepted", "rejected", name="friendshipstatus", create_type=False
)


def upgrade() -> None:
    op.execute("ALTER TYPE roomtype ADD VALUE IF NOT EXISTS 'group'")

    friendship_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "friendships",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("addressee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            friendship_status,
            nullable=False,
            server_default="pending",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["addressee_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("requester_id", "addressee_id", name="uq_friendship_pair"),
    )
    op.create_index("ix_friendships_addressee", "friendships", ["addressee_id"])
    op.create_index("ix_friendships_requester", "friendships", ["requester_id"])

    op.add_column(
        "messages",
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_messages_parent_id",
        "messages",
        "messages",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_messages_parent_id", "messages", ["parent_id"])


def downgrade() -> None:
    op.drop_index("ix_messages_parent_id", table_name="messages")
    op.drop_constraint("fk_messages_parent_id", "messages", type_="foreignkey")
    op.drop_column("messages", "parent_id")

    op.drop_index("ix_friendships_requester", table_name="friendships")
    op.drop_index("ix_friendships_addressee", table_name="friendships")
    op.drop_table("friendships")
    friendship_status.drop(op.get_bind(), checkfirst=True)
    # PostgreSQL cannot easily remove enum values; leave 'group' on roomtype
