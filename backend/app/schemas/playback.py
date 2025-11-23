"""
Playback tracking schemas
"""
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

class PlayStart(BaseModel):
    """Start playing a track"""
    track_id: int

class PlayUpdate(BaseModel):
    """Update play progress"""
    play_history_id: int
    duration_played: int  # Seconds played so far
    completed: bool = False  # Set to True if played 80%+

class PlayHistoryResponse(BaseModel):
    """Play history record"""
    id: int
    track_id: int
    track_title: str
    started_at: datetime
    duration_played: int
    completed: bool
    
    model_config = ConfigDict(from_attributes=True)

class NowPlayingResponse(BaseModel):
    """Currently playing track"""
    user_id: int
    track_id: int
    track_title: str
    started_at: datetime
    
    model_config = ConfigDict(from_attributes=True)