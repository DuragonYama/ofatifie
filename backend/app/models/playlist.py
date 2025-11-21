from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Playlist(Base):
    """User-created playlists"""
    __tablename__ = "playlists"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    cover_path = Column(String(500))
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_collaborative = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)  # Soft delete
    
    # Relationships
    owner = relationship("User", back_populates="playlists")
    collaborators = relationship("PlaylistCollaborator", back_populates="playlist", cascade="all, delete-orphan")
    songs = relationship("PlaylistSong", back_populates="playlist", cascade="all, delete-orphan")

class PlaylistCollaborator(Base):
    """Users who can edit a collaborative playlist"""
    __tablename__ = "playlist_collaborators"
    
    playlist_id = Column(Integer, ForeignKey("playlists.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    can_edit = Column(Boolean, default=True)
    added_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    playlist = relationship("Playlist", back_populates="collaborators")

class PlaylistSong(Base):
    """Songs in playlists with custom ordering"""
    __tablename__ = "playlist_songs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=False)
    position = Column(Float, nullable=False)  # Use floats for easy reordering
    added_by_id = Column(Integer, ForeignKey("users.id"))
    added_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    playlist = relationship("Playlist", back_populates="songs")
    track = relationship("Track", back_populates="playlists")

class UserLibraryItem(Base):
    """Albums and playlists saved to user's library"""
    __tablename__ = "user_library_items"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    item_type = Column(String(20), nullable=False)  # 'album' or 'playlist'
    item_id = Column(Integer, nullable=False)  # album.id or playlist.id
    added_at = Column(DateTime(timezone=True), server_default=func.now())

class LikedSong(Base):
    """Individual songs liked by users"""
    __tablename__ = "liked_songs"
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    track_id = Column(Integer, ForeignKey("tracks.id", ondelete="CASCADE"), primary_key=True)
    liked_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="liked_songs")
    track = relationship("Track", back_populates="liked_by")
    song_tags = relationship("SongTag", back_populates="liked_song", cascade="all, delete-orphan")
