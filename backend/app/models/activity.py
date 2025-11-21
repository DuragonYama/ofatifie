from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class ImportRequest(Base):
    """Download requests from Spotify/YouTube URLs"""
    __tablename__ = "import_requests"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    url = Column(String(500), nullable=False)
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), nullable=False, default='PENDING')  # PENDING, DOWNLOADING, SUCCESS, FAILED
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="import_requests")

class PlayHistory(Base):
    """Track every song play for analytics (DEVELOPER only visibility)"""
    __tablename__ = "play_history"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=False)
    played_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    play_duration = Column(Integer)  # How many seconds they listened
    completed = Column(Boolean, default=False)  # Did they listen to 80%+?
    
    # Relationships
    user = relationship("User", back_populates="play_history")

class NowPlaying(Base):
    """Real-time tracking of what users are currently playing (DEVELOPER only)"""
    __tablename__ = "now_playing"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
