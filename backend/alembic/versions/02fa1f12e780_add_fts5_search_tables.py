"""add fts5 search tables

Revision ID: 02fa1f12e780
Revises: e4228fc45e1f
Create Date: 2025-11-27 22:17:53.941353

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '02fa1f12e780'
down_revision: Union[str, Sequence[str], None] = 'e4228fc45e1f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add FTS5 search tables and triggers."""
    
    # Create FTS5 virtual table for tracks
    op.execute("""
        CREATE VIRTUAL TABLE tracks_fts USING fts5(
            title,
            album_name,
            artist_names,
            genre,
            content='tracks',
            content_rowid='id'
        )
    """)
    
    # Create FTS5 virtual table for artists
    op.execute("""
        CREATE VIRTUAL TABLE artists_fts USING fts5(
            name,
            content='artists',
            content_rowid='id'
        )
    """)
    
    # Create FTS5 virtual table for albums
    op.execute("""
        CREATE VIRTUAL TABLE albums_fts USING fts5(
            name,
            content='albums',
            content_rowid='id'
        )
    """)
    
    # Populate FTS tables with existing data
    # Note: This works even if tables are empty (pre-launch)
    
    # Populate tracks_fts (with artist names concatenated)
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
    
    # Populate artists_fts
    op.execute("""
        INSERT INTO artists_fts(rowid, name)
        SELECT id, name FROM artists
    """)
    
    # Populate albums_fts
    op.execute("""
        INSERT INTO albums_fts(rowid, name)
        SELECT id, name FROM albums WHERE deleted_at IS NULL
    """)
    
    # ========== TRIGGERS FOR TRACKS ==========
    
    # Trigger: After INSERT on tracks
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
    
    # Trigger: After UPDATE on tracks
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
    
    # Trigger: After DELETE on tracks
    op.execute("""
        CREATE TRIGGER tracks_fts_delete AFTER DELETE ON tracks
        BEGIN
            DELETE FROM tracks_fts WHERE rowid = OLD.id;
        END
    """)
    
    # Trigger: Update tracks_fts when track_artists changes
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
    
    # ========== TRIGGERS FOR ARTISTS ==========
    
    # Trigger: After INSERT on artists
    op.execute("""
        CREATE TRIGGER artists_fts_insert AFTER INSERT ON artists
        BEGIN
            INSERT INTO artists_fts(rowid, name) VALUES (NEW.id, NEW.name);
        END
    """)
    
    # Trigger: After UPDATE on artists
    op.execute("""
        CREATE TRIGGER artists_fts_update AFTER UPDATE ON artists
        BEGIN
            UPDATE artists_fts SET name = NEW.name WHERE rowid = OLD.id;
        END
    """)
    
    # Trigger: After DELETE on artists
    op.execute("""
        CREATE TRIGGER artists_fts_delete AFTER DELETE ON artists
        BEGIN
            DELETE FROM artists_fts WHERE rowid = OLD.id;
        END
    """)
    
    # ========== TRIGGERS FOR ALBUMS ==========
    
    # Trigger: After INSERT on albums
    op.execute("""
        CREATE TRIGGER albums_fts_insert AFTER INSERT ON albums
        WHEN NEW.deleted_at IS NULL
        BEGIN
            INSERT INTO albums_fts(rowid, name) VALUES (NEW.id, NEW.name);
        END
    """)
    
    # Trigger: After UPDATE on albums
    op.execute("""
        CREATE TRIGGER albums_fts_update AFTER UPDATE ON albums
        BEGIN
            DELETE FROM albums_fts WHERE rowid = OLD.id;
            INSERT INTO albums_fts(rowid, name) 
            SELECT NEW.id, NEW.name WHERE NEW.deleted_at IS NULL;
        END
    """)
    
    # Trigger: After DELETE on albums
    op.execute("""
        CREATE TRIGGER albums_fts_delete AFTER DELETE ON albums
        BEGIN
            DELETE FROM albums_fts WHERE rowid = OLD.id;
        END
    """)


def downgrade() -> None:
    """Downgrade schema - Remove FTS5 tables and triggers."""
    
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS tracks_fts_insert")
    op.execute("DROP TRIGGER IF EXISTS tracks_fts_update")
    op.execute("DROP TRIGGER IF EXISTS tracks_fts_delete")
    op.execute("DROP TRIGGER IF EXISTS tracks_fts_artist_update")
    op.execute("DROP TRIGGER IF EXISTS artists_fts_insert")
    op.execute("DROP TRIGGER IF EXISTS artists_fts_update")
    op.execute("DROP TRIGGER IF EXISTS artists_fts_delete")
    op.execute("DROP TRIGGER IF EXISTS albums_fts_insert")
    op.execute("DROP TRIGGER IF EXISTS albums_fts_update")
    op.execute("DROP TRIGGER IF EXISTS albums_fts_delete")
    
    # Drop FTS tables
    op.execute("DROP TABLE IF EXISTS tracks_fts")
    op.execute("DROP TABLE IF EXISTS artists_fts")
    op.execute("DROP TABLE IF EXISTS albums_fts")