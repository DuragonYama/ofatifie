"""
Album schemas
"""
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List

class AlbumBase(BaseModel):
    """Base album info"""
    id: int
    name: str
    release_year: Optional[int] = None
    genre: Optional[str] = None
    cover_path: Optional[str] = None
    total_tracks: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)

class AlbumWithArtists(AlbumBase):
    """Album with artist names"""
    artists: List[str] = []  # List of artist names

class TrackMinimal(BaseModel):
    """Minimal track info for album view"""
    id: int
    title: str
    duration: int
    track_number: Optional[int] = None
    play_count: int = 0
    
    model_config = ConfigDict(from_attributes=True)

class AlbumDetails(AlbumWithArtists):
    """Album with full track list"""
    tracks: List[TrackMinimal] = []
    created_at: datetime