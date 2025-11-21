"""
Track management endpoints - deletion system
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.music import Track
from app.utils import (
    get_song_library_count,
    user_has_song,
    delete_track_from_ssd,
    remove_track_from_user_library,
    mark_track_as_orphaned,
    get_orphaned_tracks
)

router = APIRouter(prefix="/tracks", tags=["tracks"])

@router.delete("/{track_id}")
def delete_track(
    track_id: int,
    reason: str = None,
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_user)  # Will add auth later
):
    """
    User requests to delete a track
    - If only requester has it (or nobody) → DELETE from SSD immediately
    - If others have it → Just remove from requester's library
    """
    
    # TODO: Get actual user from auth
    user_id = 1  # Placeholder - will use real auth later
    
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(404, "Track not found")
    
    # Get library statistics
    stats = get_song_library_count(db, track_id)
    
    # SCENARIO 1: Nobody has it (orphaned)
    if stats['total'] == 0:
        size_freed = delete_track_from_ssd(track)
        db.delete(track)
        db.commit()
        
        return {
            "action": "deleted_from_ssd",
            "message": "Track deleted from storage (was unused)",
            "storage_freed_mb": size_freed,
            "auto_approved": True
        }
    
    # SCENARIO 2: Only requester has it
    elif stats['total'] == 1 and user_id in stats['unique_users']:
        # Remove from user's library first
        remove_track_from_user_library(db, user_id, track_id)
        
        # Then delete from SSD
        size_freed = delete_track_from_ssd(track)
        db.delete(track)
        db.commit()
        
        return {
            "action": "deleted_from_ssd",
            "message": "Track deleted from storage (you were the only one with it)",
            "storage_freed_mb": size_freed,
            "auto_approved": True
        }
    
    # SCENARIO 3: Others have it
    else:
        # Just remove from requester's library
        remove_track_from_user_library(db, user_id, track_id)
        
        # Check if it became orphaned after removal
        new_stats = get_song_library_count(db, track_id)
        if new_stats['total'] == 0:
            mark_track_as_orphaned(db, track_id)
        
        return {
            "action": "removed_from_library",
            "message": f"Removed from your library. Kept for {stats['total']-1} other user(s).",
            "globally_deleted": False,
            "others_have_it": stats['total'] - 1
        }

@router.get("/admin/orphaned")
def get_orphaned_songs_list(
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_user)
):
    """
    DEVELOPER ONLY: Get list of all orphaned songs
    These are songs not in any user's library
    """
    
    # TODO: Check if user.role == "DEVELOPER"
    
    orphaned = get_orphaned_tracks(db)
    
    # Calculate totals
    total_storage = sum(track['file_size_mb'] for track in orphaned)
    recent_count = sum(1 for track in orphaned if track['recently_orphaned'])
    
    return {
        "count": len(orphaned),
        "total_storage_mb": round(total_storage, 2),
        "recently_orphaned_count": recent_count,
        "songs": orphaned
    }

@router.post("/admin/orphaned/bulk-delete")
def bulk_delete_orphaned_tracks(
    track_ids: List[int],
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_user)
):
    """
    DEVELOPER ONLY: Bulk delete orphaned tracks from storage
    """
    
    # TODO: Check if user.role == "DEVELOPER"
    
    deleted_count = 0
    storage_freed = 0
    errors = []
    
    for track_id in track_ids:
        try:
            track = db.query(Track).filter(Track.id == track_id).first()
            
            if not track:
                errors.append(f"Track {track_id}: Not found")
                continue
            
            # Double-check it's really orphaned
            stats = get_song_library_count(db, track_id)
            if stats['total'] > 0:
                errors.append(f"{track.title}: Still in {stats['total']} libraries! Skipped.")
                continue
            
            # Delete from SSD
            size = delete_track_from_ssd(track)
            storage_freed += size
            
            # Delete from database
            db.delete(track)
            deleted_count += 1
            
        except Exception as e:
            errors.append(f"Track {track_id}: {str(e)}")
    
    db.commit()
    
    return {
        "success": True,
        "deleted_count": deleted_count,
        "storage_freed_mb": round(storage_freed, 2),
        "errors": errors if errors else None
    }
