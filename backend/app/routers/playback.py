"""
Playback tracking endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.music import Track
from app.models.activity import PlayHistory, NowPlaying
from app.schemas.playback import (
    PlayStart, 
    PlayUpdate, 
    PlayHistoryResponse,
    NowPlayingResponse
)

router = APIRouter(prefix="/playback", tags=["playback"])

@router.post("/start", status_code=status.HTTP_201_CREATED)
def start_playback(
    play_start: PlayStart,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Start playing a track
    
    - Creates PlayHistory record
    - Updates NowPlaying
    - Returns play_history_id for progress updates
    """
    # Verify track exists
    track = db.query(Track).filter(Track.id == play_start.track_id).first()
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )
    
    # Create play history record
    play_history = PlayHistory(
        user_id=current_user.id,
        track_id=play_start.track_id,
        play_duration=0,
        completed=False
    )
    db.add(play_history)
    
    # Update or create now playing
    now_playing = db.query(NowPlaying).filter(
        NowPlaying.user_id == current_user.id
    ).first()
    
    if now_playing:
        now_playing.track_id = play_start.track_id
        now_playing.started_at = datetime.utcnow()
        now_playing.updated_at = datetime.utcnow()
    else:
        now_playing = NowPlaying(
            user_id=current_user.id,
            track_id=play_start.track_id
        )
        db.add(now_playing)
    
    db.commit()
    db.refresh(play_history)
    
    return {
        "message": "Playback started",
        "play_history_id": play_history.id,
        "track_id": track.id,
        "track_title": track.title
    }

@router.put("/update")
def update_playback(
    play_update: PlayUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update play progress (heartbeat from client)
    
    - Updates play_duration
    - Marks as completed if 80%+ played
    - Increments track play_count when completed
    """
    # Get play history record
    play_history = db.query(PlayHistory).filter(
        PlayHistory.id == play_update.play_history_id,
        PlayHistory.user_id == current_user.id
    ).first()
    
    if not play_history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Play history not found"
        )
    
    # Update duration
    play_history.play_duration = play_update.duration_played
    
    # Mark as completed and increment play count (only once)
    if play_update.completed and not play_history.completed:
        play_history.completed = True
        
        # Increment track play count
        track = db.query(Track).filter(Track.id == play_history.track_id).first()
        if track:
            track.play_count += 1
    
    db.commit()
    
    return {
        "message": "Playback updated",
        "duration_played": play_history.play_duration,
        "completed": play_history.completed
    }

@router.get("/history", response_model=List[PlayHistoryResponse])
def get_play_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user's play history
    
    - Returns most recent plays
    - Includes track info
    """
    history = db.query(PlayHistory, Track).join(
        Track, PlayHistory.track_id == Track.id
    ).filter(
        PlayHistory.user_id == current_user.id
    ).order_by(
        PlayHistory.played_at.desc()  # Fixed: use played_at
    ).limit(limit).all()
    
    result = []
    for play, track in history:
        result.append(PlayHistoryResponse(
            id=play.id,
            track_id=track.id,
            track_title=track.title,
            started_at=play.played_at,  # Fixed: use played_at
            duration_played=play.play_duration,  # Fixed: use play_duration
            completed=play.completed
        ))
    
    return result

@router.get("/now-playing", response_model=List[NowPlayingResponse])
def get_now_playing(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get what users are currently playing
    
    DEVELOPER only - see all users
    Regular users - see only themselves
    """
    if current_user.role == "DEVELOPER":
        # Show all users
        now_playing = db.query(NowPlaying, Track).join(
            Track, NowPlaying.track_id == Track.id
        ).all()
    else:
        # Show only current user
        now_playing = db.query(NowPlaying, Track).join(
            Track, NowPlaying.track_id == Track.id
        ).filter(
            NowPlaying.user_id == current_user.id
        ).all()
    
    result = []
    for np, track in now_playing:
        result.append(NowPlayingResponse(
            user_id=np.user_id,
            track_id=track.id,
            track_title=track.title,
            started_at=np.started_at
        ))
    
    return result