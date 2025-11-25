from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

# ============= PERSONAL TAGS =============

class TagCreate(BaseModel):
    """Create a personal tag"""
    name: str = Field(..., min_length=1, max_length=50)
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')  # Hex color validation

class TagUpdate(BaseModel):
    """Update a personal tag"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')

class TagResponse(BaseModel):
    """Personal tag response"""
    id: int
    user_id: int
    name: str
    color: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============= SONG TAGGING (Personal) =============

class SongTagCreate(BaseModel):
    """Tag a track with personal tag"""
    track_id: int
    tag_id: int

class SongTagResponse(BaseModel):
    """Song tag response"""
    id: int
    user_id: int
    track_id: int
    tag_id: int
    tagged_at: datetime
    
    class Config:
        from_attributes = True

# ============= GLOBAL TAGS =============

class GlobalTagCreate(BaseModel):
    """Create a global tag (DEVELOPER only)"""
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    tag_type: str = Field(default='genre')  # genre, mood, era, style, content, quality
    is_official: bool = Field(default=True)  # True for DEVELOPER-created

class GlobalTagUpdate(BaseModel):
    """Update a global tag"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    tag_type: Optional[str] = None
    is_official: Optional[bool] = None

class GlobalTagResponse(BaseModel):
    """Global tag response"""
    id: int
    name: str
    description: Optional[str]
    color: Optional[str]
    created_by_id: Optional[int]
    tag_type: str
    is_official: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# ============= GLOBAL SONG TAGGING =============

class GlobalSongTagCreate(BaseModel):
    """Apply global tag to track"""
    track_id: int
    global_tag_id: int

class GlobalSongTagResponse(BaseModel):
    """Global song tag response"""
    id: int
    track_id: int
    global_tag_id: int
    applied_by_id: Optional[int]
    applied_at: datetime
    
    class Config:
        from_attributes = True

# ============= DETAILED RESPONSES (with nested data) =============

class TagWithCount(BaseModel):
    """Tag with track count"""
    id: int
    user_id: int
    name: str
    color: Optional[str]
    created_at: datetime
    track_count: int  # How many tracks have this tag
    
    class Config:
        from_attributes = True

class GlobalTagWithCount(BaseModel):
    """Global tag with track count"""
    id: int
    name: str
    description: Optional[str]
    color: Optional[str]
    tag_type: str
    is_official: bool
    created_at: datetime
    track_count: int  # How many tracks have this tag
    
    class Config:
        from_attributes = True