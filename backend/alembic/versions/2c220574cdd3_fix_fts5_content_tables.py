"""fix fts5 content tables

Revision ID: 2c220574cdd3
Revises: 02fa1f12e780
Create Date: 2025-11-30 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2c220574cdd3'
down_revision: Union[str, None] = '02fa1f12e780'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix FTS5 tables - remove content linkage"""
    
    # Drop all existing triggers and FTS tables
    op.execute("DROP TRIGGER IF EXISTS tracks_fts_insert")
    op.execute("DROP TRIGGER IF EXISTS tracks_fts_update")
    op.execute("DROP TRIGGER IF EXISTS tracks_fts_delete")
    op.execute("DROP TRIGGER IF EXISTS tracks_fts_artist_update")
    op.execute("DROP TABLE IF EXISTS tracks_fts")
    
    # Recreate tracks_fts WITHOUT content linkage
    op.execute("""
        CREATE VIRTUAL TABLE tracks_fts USING fts5(
            title,
            album_name,
            artist_names,
            genre
        )
    """)
    
    # Repopulate with existing data
    op.execute("""
        INSERT INTO tracks_fts(rowid, title, album_name, artist_names, genre)
        SELECT 
            t.id,
            t.title,
            COALESCE(a.name, ''),
            COALESCE(GROUP_CONCAT(ar.name, ' '), ''),
            COALESCE(t.genre, '')
        FROM tracks t
        LEFT JOIN albums a ON t.album_id = a.id
        LEFT JOIN track_artists ta ON t.id = ta.track_id
        LEFT JOIN artists ar ON ta.artist_id = ar.id
        WHERE t.deleted_at IS NULL
        GROUP BY t.id
    """)
    
    # Recreate triggers
    op.execute("""
        CREATE TRIGGER tracks_fts_insert AFTER INSERT ON tracks
        WHEN NEW.deleted_at IS NULL
        BEGIN
            INSERT INTO tracks_fts(rowid, title, album_name, artist_names, genre)
            SELECT 
                NEW.id,
                NEW.title,
                COALESCE(a.name, ''),
                COALESCE(GROUP_CONCAT(ar.name, ' '), ''),
                COALESCE(NEW.genre, '')
            FROM tracks t
            LEFT JOIN albums a ON t.album_id = a.id
            LEFT JOIN track_artists ta ON t.id = ta.track_id
            LEFT JOIN artists ar ON ta.artist_id = ar.id
            WHERE t.id = NEW.id
            GROUP BY t.id;
        END
    """)
    
    op.execute("""
        CREATE TRIGGER tracks_fts_update AFTER UPDATE ON tracks
        BEGIN
            DELETE FROM tracks_fts WHERE rowid = OLD.id;
            INSERT INTO tracks_fts(rowid, title, album_name, artist_names, genre)
            SELECT 
                NEW.id,
                NEW.title,
                COALESCE(a.name, ''),
                COALESCE(GROUP_CONCAT(ar.name, ' '), ''),
                COALESCE(NEW.genre, '')
            FROM tracks t
            LEFT JOIN albums a ON t.album_id = a.id
            LEFT JOIN track_artists ta ON t.id = ta.track_id
            LEFT JOIN artists ar ON ta.artist_id = ar.id
            WHERE t.id = NEW.id AND t.deleted_at IS NULL
            GROUP BY t.id;
        END
    """)
    
    op.execute("""
        CREATE TRIGGER tracks_fts_delete AFTER DELETE ON tracks
        BEGIN
            DELETE FROM tracks_fts WHERE rowid = OLD.id;
        END
    """)
    
    op.execute("""
        CREATE TRIGGER tracks_fts_artist_update AFTER INSERT ON track_artists
        BEGIN
            DELETE FROM tracks_fts WHERE rowid = NEW.track_id;
            INSERT INTO tracks_fts(rowid, title, album_name, artist_names, genre)
            SELECT 
                t.id,
                t.title,
                COALESCE(a.name, ''),
                COALESCE(GROUP_CONCAT(ar.name, ' '), ''),
                COALESCE(t.genre, '')
            FROM tracks t
            LEFT JOIN albums a ON t.album_id = a.id
            LEFT JOIN track_artists ta ON t.id = ta.track_id
            LEFT JOIN artists ar ON ta.artist_id = ar.id
            WHERE t.id = NEW.track_id AND t.deleted_at IS NULL
            GROUP BY t.id;
        END
    """)


def downgrade() -> None:
    """Revert FTS5 fix"""
    op.execute("DROP TRIGGER IF EXISTS tracks_fts_insert")
    op.execute("DROP TRIGGER IF EXISTS tracks_fts_update")
    op.execute("DROP TRIGGER IF EXISTS tracks_fts_delete")
    op.execute("DROP TRIGGER IF EXISTS tracks_fts_artist_update")
    op.execute("DROP TABLE IF EXISTS tracks_fts")