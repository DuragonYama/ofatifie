"""add_play_count_to_tracks

Revision ID: 38d216f3b7c8
Revises: e4228fc45e1f
Create Date: 2025-11-24 15:16:12.883720
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '38d216f3b7c8'
down_revision: Union[str, Sequence[str], None] = 'e4228fc45e1f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # play_count already exists in the initial schema
    pass


def downgrade() -> None:
    # no changes to reverse
    pass
