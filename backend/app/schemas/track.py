"""
Track (song) Pydantic schemas
"""
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional

class TrackUploadResponse(BaseModel):
    """Response after uploading a track"""
    id: int
    title: str
    duration: int  # Changed from duration_seconds
    file_size_mb: float
    song_hash: str  # Changed from file_hash
    audio_path: str  # Changed from file_path
    message: str
    
    model_config = ConfigDict(from_attributes=True)

class TrackResponse(BaseModel):
    """Complete track information"""
    id: int
    title: str
    duration: int  # Changed from duration_seconds
    file_size_mb: float
    song_hash: str  # Changed from file_hash
    audio_path: str  # Changed from file_path
    cover_path: Optional[str] = None
    bitrate: Optional[int] = None  # Changed from bitrate_kbps
    uploaded_by_id: int
    created_at: datetime  # Changed from uploaded_at
    
    model_config = ConfigDict(from_attributes=True)

class TrackMetadata(BaseModel):
    """Extracted metadata from audio file"""
    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    duration_seconds: int  # Keep this for internal use
    bitrate_kbps: Optional[int] = None  # Keep this for internal use
    file_size_mb: float
    file_hash: str  # Keep this for internal use