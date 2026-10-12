"""create notes

Revision ID: d9d48764fbde
Revises: 8fa20683fa91
Create Date: 2026-10-12 13:56:32.629380

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d9d48764fbde"
down_revision: str | Sequence[str] | None = "8fa20683fa91"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
        CREATE TABLE notes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            workspace_id UUID NOT NULL REFERENCES workspaces(id),
            content TEXT NOT NULL,
            -- The time of the bar the note was placed on; the chart draws it as a vertical line there.
            at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    # A workspace's notes are always listed in time order.
    op.execute("CREATE INDEX notes_workspace_id_at_idx ON notes (workspace_id, at)")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TABLE notes")
