"""
Lyrics model for storing track lyrics
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Lyrics(Base):
    __tablename__ = "lyrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    track_id = Column(Integer, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Lyrics content
    lyrics_text = Column(Text, nullable=True)  # Plain text lyrics
    synced_lyrics = Column(Text, nullable=True)  # LRC format with timestamps
    is_synced = Column(Boolean, default=False)  # Quick check if synced lyrics available
    
    # Metadata
    source = Column(String(50), nullable=True)  # 'lrclib', 'genius', 'manual'
    source_url = Column(String(500), nullable=True)  # Original source URL
    language = Column(String(10), nullable=True)  # 'en', 'nl', etc.
    
    # Timestamps
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    track = relationship("Track", back_populates="lyrics")