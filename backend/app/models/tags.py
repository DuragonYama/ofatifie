from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, ForeignKeyConstraint
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
    """Links personal tags to liked songs (user can only tag songs they've liked)"""
    __tablename__ = "song_tags"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    track_id = Column(Integer, nullable=False)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), nullable=False)
    tagged_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Composite foreign key constraint to ensure user has liked the song
    __table_args__ = (
        ForeignKeyConstraint(
            ['user_id', 'track_id'],
            ['liked_songs.user_id', 'liked_songs.track_id'],
            ondelete="CASCADE"
        ),
    )
    
    # Relationships
    tag = relationship("Tag", back_populates="song_tags")

class GlobalTag(Base):
    """Global tags (visible to all users, community-driven)"""
    __tablename__ = "global_tags"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    color = Column(String(7))  # Hex color
    created_by_id = Column(Integer, ForeignKey("users.id"))
    tag_type = Column(String(20), default='genre')  # genre, mood, era, style, content, quality
    is_official = Column(Boolean, default=False)  # Curated by DEVELOPER
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    song_tags = relationship("GlobalSongTag", back_populates="global_tag", cascade="all, delete-orphan")

class GlobalSongTag(Base):
    """Links global tags to tracks (with voting for accuracy)"""
    __tablename__ = "global_song_tags"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    track_id = Column(Integer, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False)
    global_tag_id = Column(Integer, ForeignKey("global_tags.id", ondelete="CASCADE"), nullable=False)
    applied_by_id = Column(Integer, ForeignKey("users.id"))
    applied_at = Column(DateTime(timezone=True), server_default=func.now())
    votes = Column(Integer, default=1)  # Community voting for tag accuracy
    
    # Relationships
    track = relationship("Track", back_populates="global_tags")
    global_tag = relationship("GlobalTag", back_populates="song_tags")
