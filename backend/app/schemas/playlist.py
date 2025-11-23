"""
Playlist schemas
"""
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, List

class PlaylistCreate(BaseModel):
    """Create a new playlist"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    is_collaborative: bool = False

class PlaylistUpdate(BaseModel):
    """Update playlist details"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_collaborative: Optional[bool] = None

class PlaylistBase(BaseModel):
    """Basic playlist info"""
    id: int
    name: str
    description: Optional[str] = None
    cover_path: Optional[str] = None
    is_collaborative: bool
    owner_id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class PlaylistTrackInfo(BaseModel):
    """Track info for playlist view"""
    id: int
    track_id: int
    title: str
    duration: int
    artists: List[str] = []
    cover_path: Optional[str] = None
    position: float
    added_by_id: Optional[int] = None
    added_at: datetime

class PlaylistDetails(PlaylistBase):
    """Playlist with full track list"""
    tracks: List[PlaylistTrackInfo] = []
    track_count: int = 0

class CollaboratorInfo(BaseModel):
    """Collaborator info"""
    user_id: int
    username: str
    can_edit: bool
    added_at: datetime

class AddSongRequest(BaseModel):
    """Add song to playlist"""
    track_id: int

class ReorderRequest(BaseModel):
    """Reorder song in playlist"""
    playlist_song_id: int
    new_position: float

class AddCollaboratorRequest(BaseModel):
    """Add collaborator to playlist"""
    user_id: int
    can_edit: bool = True