"""
Database models for the Music Streaming App
Organized by domain for maintainability
"""

from app.database import Base

# Import all models so SQLAlchemy can create tables
from app.models.user import User
from app.models.music import Artist, Album, AlbumArtist, Track, TrackArtist, Lyrics
from app.models.playlist import Playlist, PlaylistCollaborator, PlaylistSong, UserLibraryItem, LikedSong
from app.models.tags import Tag, SongTag, GlobalTag, GlobalSongTag
from app.models.activity import ImportRequest, PlayHistory, NowPlaying

# Export all models
__all__ = [
    "Base",
    "User",
    "Artist",
    "Album",
    "AlbumArtist",
    "Track",
    "TrackArtist",
    "Lyrics",
    "Playlist",
    "PlaylistCollaborator",
    "PlaylistSong",
    "UserLibraryItem",
    "LikedSong",
    "Tag",
    "SongTag",
    "GlobalTag",
    "GlobalSongTag",
    "ImportRequest",
    "PlayHistory",
    "NowPlaying"
]
