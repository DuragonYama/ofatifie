from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Artist(Base):
    """Music artists"""
    __tablename__ = "artists"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    bio = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    # ✅ FIXED: Direct relationship to Track through junction table
    tracks = relationship(
        "Track",
        secondary="track_artists",
        back_populates="artists",
        lazy="selectin"
    )
    # Keep junction table relationship for accessing metadata
    track_associations = relationship("TrackArtist", back_populates="artist")
    album_associations = relationship("AlbumArtist", back_populates="artist")

class Album(Base):
    """Music albums"""
    __tablename__ = "albums"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    artist_id = Column(Integer, ForeignKey("artists.id"))
    cover_path = Column(String(500))
    release_year = Column(Integer)
    genre = Column(String(100))
    total_tracks = Column(Integer)
    album_type = Column(String(20), default='album')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Relationships
    artist_associations = relationship("AlbumArtist", back_populates="album")
    tracks = relationship("Track", back_populates="album")

class AlbumArtist(Base):
    """Junction table: Albums can have multiple artists"""
    __tablename__ = "album_artists"
    
    album_id = Column(Integer, ForeignKey("albums.id", ondelete="CASCADE"), primary_key=True)
    artist_id = Column(Integer, ForeignKey("artists.id"), primary_key=True)
    artist_order = Column(Integer, default=0)  # 0=primary, 1+=featured
    
    # Relationships
    album = relationship("Album", back_populates="artist_associations")
    artist = relationship("Artist", back_populates="album_associations")

class Track(Base):
    """Individual songs/tracks"""
    __tablename__ = "tracks"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False, index=True)
    album_id = Column(Integer, ForeignKey("albums.id"))
    duration = Column(Integer)
    track_number = Column(Integer)
    disc_number = Column(Integer, default=1)
    year = Column(Integer, index=True)
    genre = Column(String(100), index=True)
    song_hash = Column(String(64), unique=True, nullable=False, index=True)
    audio_path = Column(String(500), nullable=False)
    cover_path = Column(String(500))
    file_size_mb = Column(Numeric(10, 2))
    bitrate = Column(Integer)
    format = Column(String(10))
    play_count = Column(Integer, default=0, index=True)
    imported_from_id = Column(Integer, ForeignKey("import_requests.id"))
    uploaded_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    last_in_library = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    album = relationship("Album", back_populates="tracks", lazy="selectin")
    
    # ✅ FIXED: Direct relationship to Artist through junction table
    # This is what TrackResponse.artists will use
    artists = relationship(
        "Artist",
        secondary="track_artists",
        back_populates="tracks",
        lazy="selectin",  # Eagerly load by default
        order_by="TrackArtist.artist_order"
    )
    
    # Keep junction table relationship for accessing metadata (artist_order, role)
    artist_associations = relationship("TrackArtist", back_populates="track")
    
    lyrics = relationship("Lyrics", back_populates="track", uselist=False)
    playlists = relationship("PlaylistSong", back_populates="track")
    liked_by = relationship("LikedSong", back_populates="track")
    personal_tags = relationship("SongTag", back_populates="track")
    global_tags = relationship("GlobalSongTag", back_populates="track")

class TrackArtist(Base):
    """Junction table: Tracks can have multiple artists (features, etc)"""
    __tablename__ = "track_artists"
    
    track_id = Column(Integer, ForeignKey("tracks.id", ondelete="CASCADE"), primary_key=True)
    artist_id = Column(Integer, ForeignKey("artists.id"), primary_key=True)
    artist_order = Column(Integer, default=0)
    role = Column(String(20), default='primary')  # primary, featured, composer, producer
    
    # Relationships
    track = relationship("Track", back_populates="artist_associations")
    artist = relationship("Artist", back_populates="track_associations")

class Lyrics(Base):
    """Song lyrics (plain text and synced LRC format)"""
    __tablename__ = "lyrics"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    track_id = Column(Integer, ForeignKey("tracks.id", ondelete="CASCADE"), unique=True, nullable=False)
    lyrics_text = Column(Text)
    is_synced = Column(Boolean, default=False)
    synced_lyrics = Column(Text)  # LRC format with timestamps
    source = Column(String(50))  # genius, lrclib, manual
    source_url = Column(String(500))
    language = Column(String(10), default='en')
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    track = relationship("Track", back_populates="lyrics")