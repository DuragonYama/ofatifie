"""
Schemas for lyrics operations
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class LyricsBase(BaseModel):
    """Base schema for lyrics"""
    lyrics_text: Optional[str] = None
    synced_lyrics: Optional[str] = None
    is_synced: bool = False
    source: Optional[str] = None
    source_url: Optional[str] = None
    language: Optional[str] = None


class LyricsCreate(BaseModel):
    """Schema for manually creating lyrics"""
    lyrics_text: Optional[str] = Field(None, description="Plain text lyrics")
    synced_lyrics: Optional[str] = Field(None, description="LRC format lyrics with timestamps")
    language: Optional[str] = Field("en", description="Language code (en, nl, etc.)")


class LyricsUpdate(BaseModel):
    """Schema for updating lyrics"""
    lyrics_text: Optional[str] = None
    synced_lyrics: Optional[str] = None
    language: Optional[str] = None


class LyricsResponse(LyricsBase):
    """Schema for lyrics response"""
    id: int
    track_id: int
    created_at: datetime
    updated_at: datetime
    fetched_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LyricsFetchRequest(BaseModel):
    """Schema for fetch request"""
    source: str = Field(..., description="Source to fetch from: 'lrclib' or 'genius'")