from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Tag(Base):
    """Personal tags (user-specific, private)"""
    __tablename__ = "tags"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(50), nullable=False)
    color = Column(String(7))  # Hex color like #FF5733
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="personal_tags")
    song_tags = relationship("SongTag", back_populates="tag", cascade="all, delete-orphan")

class SongTag(Base):
    """Links personal tags to ANY track (not restricted to liked songs)"""
    __tablename__ = "song_tags"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    track_id = Column(Integer, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), nullable=False)
    tagged_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User")
    track = relationship("Track")
    tag = relationship("Tag", back_populates="song_tags")

class GlobalTag(Base):
    """Global tags (visible to all users, created by DEVELOPER)"""
    __tablename__ = "global_tags"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    color = Column(String(7))  # Hex color
    created_by_id = Column(Integer, ForeignKey("users.id"))
    tag_type = Column(String(20), default='genre')  # genre, mood, era, style, content, quality
    is_official = Column(Boolean, default=False)  # True for DEVELOPER-created tags
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    created_by = relationship("User")
    song_tags = relationship("GlobalSongTag", back_populates="global_tag", cascade="all, delete-orphan")

class GlobalSongTag(Base):
    """Links global tags to tracks"""
    __tablename__ = "global_song_tags"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    track_id = Column(Integer, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False)
    global_tag_id = Column(Integer, ForeignKey("global_tags.id", ondelete="CASCADE"), nullable=False)
    applied_by_id = Column(Integer, ForeignKey("users.id"))
    applied_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    track = relationship("Track", back_populates="global_tags")
    global_tag = relationship("GlobalTag", back_populates="song_tags")
    applied_by = relationship("User")