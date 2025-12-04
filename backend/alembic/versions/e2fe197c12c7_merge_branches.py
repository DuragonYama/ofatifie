"""merge branches

Revision ID: e2fe197c12c7
Revises: 2c220574cdd3, 38d216f3b7c8
Create Date: 2025-12-04 12:25:39.802494

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2fe197c12c7'
down_revision: Union[str, Sequence[str], None] = ('2c220574cdd3', '38d216f3b7c8')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
