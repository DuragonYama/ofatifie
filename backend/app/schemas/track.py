"""
Track (song) Pydantic schemas
"""
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, List

# ✅ NEW: Artist brief schema for track responses
class ArtistBrief(BaseModel):
    """Brief artist info for track responses"""
    id: int
    name: str
    
    model_config = ConfigDict(from_attributes=True)

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
    play_count: int = 0
    
    # ✅ ADDED: Artists list (THIS IS THE KEY FIX!)
    artists: List[ArtistBrief] = []
    
    # ✅ ADDED: Album ID for reference
    album_id: Optional[int] = None
    
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

class TrackUpdate(BaseModel):
    """Schema for updating track metadata"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "New Song Title"
            }
        }
    )