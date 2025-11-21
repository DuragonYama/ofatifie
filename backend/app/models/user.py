from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    """User accounts with role-based access and storage quotas"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)  # Hashed with bcrypt
    role = Column(String(20), nullable=False, default='USER')  # DEVELOPER, TESTER, USER
    display_name = Column(String(100))
    avatar_path = Column(String(500))
    bio = Column(Text)
    storage_quota_mb = Column(Integer, default=30000)  # 30GB default
    storage_used_mb = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    playlists = relationship("Playlist", back_populates="owner", cascade="all, delete-orphan")
    import_requests = relationship("ImportRequest", back_populates="user", cascade="all, delete-orphan")
    liked_songs = relationship("LikedSong", back_populates="user", cascade="all, delete-orphan")
    personal_tags = relationship("Tag", back_populates="user", cascade="all, delete-orphan")
    play_history = relationship("PlayHistory", back_populates="user", cascade="all, delete-orphan")
