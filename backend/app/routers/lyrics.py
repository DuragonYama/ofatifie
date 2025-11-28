"""
Lyrics endpoints for fetching, viewing, and managing lyrics
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.music import Track, Lyrics
from app.schemas.lyrics import LyricsResponse, LyricsCreate, LyricsUpdate, LyricsFetchRequest
from app.utils.lyrics_fetcher import fetch_lyrics_auto, fetch_from_lrclib, fetch_from_genius

router = APIRouter(prefix="/lyrics", tags=["lyrics"])


@router.get("/track/{track_id}", response_model=Optional[LyricsResponse])
def get_lyrics(
    track_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get lyrics for a track
    
    Returns lyrics if available, null if not found
    """
    # Check if track exists
    track = db.query(Track).filter(Track.id == track_id, Track.deleted_at.is_(None)).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    # Get lyrics
    lyrics = db.query(Lyrics).filter(Lyrics.track_id == track_id).first()
    
    return lyrics


@router.post("/track/{track_id}/fetch")
def fetch_lyrics(
    track_id: int,
    request: LyricsFetchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch lyrics from a specific source (lrclib or genius)
    
    If lyrics already exist, they will be replaced with new ones
    """
    from app.config import get_settings  # ← ADD THIS
    from sqlalchemy.orm import joinedload
    from app.models.music import TrackArtist
    
    settings = get_settings()  # ← ADD THIS
    
    # Check if track exists and load relationships
    track = db.query(Track).options(
        joinedload(Track.artists).joinedload(TrackArtist.artist),
        joinedload(Track.album)
    ).filter(Track.id == track_id, Track.deleted_at.is_(None)).first()
    
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    # Fetch lyrics based on source
    if request.source == "lrclib":
        lyrics_data = fetch_from_lrclib(track)
    elif request.source == "genius":
        lyrics_data = fetch_from_genius(track, settings.genius_access_token)  # ← ADD TOKEN HERE!
    else:
        raise HTTPException(status_code=400, detail="Invalid source. Use 'lrclib' or 'genius'")
    
    if not lyrics_data:
        raise HTTPException(status_code=404, detail=f"Lyrics not found on {request.source}")
    
    # Check if lyrics already exist
    existing_lyrics = db.query(Lyrics).filter(Lyrics.track_id == track_id).first()
    
    if existing_lyrics:
        # Update existing lyrics
        for key, value in lyrics_data.items():
            setattr(existing_lyrics, key, value)
        db.commit()
        db.refresh(existing_lyrics)
        return {
            "message": "Lyrics updated successfully",
            "lyrics": existing_lyrics
        }
    else:
        # Create new lyrics
        new_lyrics = Lyrics(
            track_id=track_id,
            **lyrics_data
        )
        db.add(new_lyrics)
        db.commit()
        db.refresh(new_lyrics)
        return {
            "message": "Lyrics fetched successfully",
            "lyrics": new_lyrics
        }


@router.post("/track/{track_id}/fetch/auto")
def fetch_lyrics_auto_endpoint(
    track_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Automatically fetch lyrics from all available sources
    
    Tries lrclib first, then Genius as fallback
    """
    # Check if track exists
    track = db.query(Track).filter(Track.id == track_id, Track.deleted_at.is_(None)).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    # Try auto-fetch
    lyrics_data = fetch_lyrics_auto(track)
    
    if not lyrics_data:
        raise HTTPException(status_code=404, detail="Lyrics not found from any source")
    
    # Check if lyrics already exist
    existing_lyrics = db.query(Lyrics).filter(Lyrics.track_id == track_id).first()
    
    if existing_lyrics:
        # Update existing lyrics
        for key, value in lyrics_data.items():
            setattr(existing_lyrics, key, value)
        db.commit()
        db.refresh(existing_lyrics)
        return {
            "message": f"Lyrics updated from {lyrics_data['source']}",
            "lyrics": existing_lyrics
        }
    else:
        # Create new lyrics
        new_lyrics = Lyrics(
            track_id=track_id,
            **lyrics_data
        )
        db.add(new_lyrics)
        db.commit()
        db.refresh(new_lyrics)
        return {
            "message": f"Lyrics fetched from {lyrics_data['source']}",
            "lyrics": new_lyrics
        }


@router.post("/track/{track_id}/manual", response_model=LyricsResponse)
def add_lyrics_manually(
    track_id: int,
    lyrics_data: LyricsCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually add lyrics to a track
    
    Useful when auto-fetch doesn't find lyrics or for corrections
    """
    # Check if track exists
    track = db.query(Track).filter(Track.id == track_id, Track.deleted_at.is_(None)).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    # Check if lyrics already exist
    existing_lyrics = db.query(Lyrics).filter(Lyrics.track_id == track_id).first()
    
    if existing_lyrics:
        raise HTTPException(
            status_code=400, 
            detail="Lyrics already exist for this track. Use PUT /lyrics/{lyrics_id} to update"
        )
    
    # Determine if synced
    is_synced = bool(lyrics_data.synced_lyrics)
    
    # Create new lyrics
    new_lyrics = Lyrics(
        track_id=track_id,
        lyrics_text=lyrics_data.lyrics_text,
        synced_lyrics=lyrics_data.synced_lyrics,
        is_synced=is_synced,
        source="manual",
        language=lyrics_data.language or "en"
    )
    
    db.add(new_lyrics)
    db.commit()
    db.refresh(new_lyrics)
    
    return new_lyrics


@router.put("/{lyrics_id}", response_model=LyricsResponse)
def update_lyrics(
    lyrics_id: int,
    lyrics_data: LyricsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update existing lyrics
    
    Any user can update lyrics to fix errors
    """
    lyrics = db.query(Lyrics).filter(Lyrics.id == lyrics_id).first()
    if not lyrics:
        raise HTTPException(status_code=404, detail="Lyrics not found")
    
    # Update fields
    if lyrics_data.lyrics_text is not None:
        lyrics.lyrics_text = lyrics_data.lyrics_text
    
    if lyrics_data.synced_lyrics is not None:
        lyrics.synced_lyrics = lyrics_data.synced_lyrics
        lyrics.is_synced = bool(lyrics_data.synced_lyrics)
    
    if lyrics_data.language is not None:
        lyrics.language = lyrics_data.language
    
    db.commit()
    db.refresh(lyrics)
    
    return lyrics


@router.delete("/{lyrics_id}")
def delete_lyrics(
    lyrics_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete lyrics
    
    Any user can delete incorrect lyrics
    """
    lyrics = db.query(Lyrics).filter(Lyrics.id == lyrics_id).first()
    if not lyrics:
        raise HTTPException(status_code=404, detail="Lyrics not found")
    
    db.delete(lyrics)
    db.commit()
    
    return {"message": "Lyrics deleted successfully"}

@router.get("/test-genius-token")
def test_genius_token(
    current_user: User = Depends(get_current_user)
):
    """Test if Genius token is loaded"""
    from app.config import get_settings
    settings = get_settings()
    
    return {
        "token_configured": bool(settings.genius_access_token),
        "token_length": len(settings.genius_access_token) if settings.genius_access_token else 0
    }
@router.get("/debug-genius/{track_id}")
def debug_genius_fetch(
    track_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Debug Genius API fetch"""
    from app.utils.lyrics_fetcher import fetch_from_genius
    from app.config import get_settings
    from sqlalchemy.orm import joinedload
    from app.models.music import TrackArtist  # Import this!
    
    settings = get_settings()
    
    # Get track with relationships
    track = db.query(Track).options(
        joinedload(Track.artists).joinedload(TrackArtist.artist),  # ← Fixed!
        joinedload(Track.album)
    ).filter(Track.id == track_id).first()
    
    if not track:
        return {"error": "Track not found"}
    
    # Get track info
    title = track.title
    artist_name = track.artists[0].artist.name if track.artists else "Unknown"
    
    # Try to fetch
    result = fetch_from_genius(track, settings.genius_access_token)
    
    return {
        "track_id": track_id,
        "title": title,
        "artist": artist_name,
        "genius_token_present": bool(settings.genius_access_token),
        "fetch_result": "Found lyrics" if result else "No lyrics found",
        "result": result
    }