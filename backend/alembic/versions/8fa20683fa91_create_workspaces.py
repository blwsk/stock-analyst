"""create workspaces

Revision ID: 8fa20683fa91
Revises:
Create Date: 2026-10-12 13:19:56.884723

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8fa20683fa91"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
        CREATE TABLE workspaces (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            tickers TEXT[] NOT NULL DEFAULT '{}',
            -- Range, timeframe and custom window for the workspace's chart; NULL means the frontend defaults.
            chart JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TABLE workspaces")
