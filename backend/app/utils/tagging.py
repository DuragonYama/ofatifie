"""
Utility functions for tagging tracks
"""
from sqlalchemy.orm import Session
from app.models.tags import Tag, SongTag, GlobalTag, GlobalSongTag
from typing import Optional

def apply_tag_to_track(
    db: Session,
    track_id: int,
    tag_id: int,
    user_id: int
) -> bool:
    """
    Apply a personal tag to a track
    
    Args:
        db: Database session
        track_id: Track to tag
        tag_id: Personal tag to apply
        user_id: User applying the tag
    
    Returns:
        True if tag was applied, False if already tagged
    """
    # Verify tag belongs to user
    tag = db.query(Tag).filter(
        Tag.id == tag_id,
        Tag.user_id == user_id
    ).first()
    
    if not tag:
        return False
    
    # Check if already tagged
    existing = db.query(SongTag).filter(
        SongTag.user_id == user_id,
        SongTag.track_id == track_id,
        SongTag.tag_id == tag_id
    ).first()
    
    if existing:
        return False  # Already tagged, skip
    
    # Create song tag
    song_tag = SongTag(
        user_id=user_id,
        track_id=track_id,
        tag_id=tag_id
    )
    db.add(song_tag)
    db.commit()
    
    return True


def apply_global_tag_to_track(
    db: Session,
    track_id: int,
    global_tag_id: int,
    user_id: int
) -> bool:
    """
    Apply a global tag to a track
    
    Args:
        db: Database session
        track_id: Track to tag
        global_tag_id: Global tag to apply
        user_id: User applying the tag
    
    Returns:
        True if tag was applied, False if already tagged
    """
    # Verify global tag exists
    global_tag = db.query(GlobalTag).filter(
        GlobalTag.id == global_tag_id
    ).first()
    
    if not global_tag:
        return False
    
    # Check if already tagged
    existing = db.query(GlobalSongTag).filter(
        GlobalSongTag.track_id == track_id,
        GlobalSongTag.global_tag_id == global_tag_id
    ).first()
    
    if existing:
        return False  # Already tagged, skip
    
    # Create global song tag
    global_song_tag = GlobalSongTag(
        track_id=track_id,
        global_tag_id=global_tag_id,
        applied_by_id=user_id
    )
    db.add(global_song_tag)
    db.commit()
    
    return True