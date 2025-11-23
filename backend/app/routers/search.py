"""
Advanced search and filtering for tracks
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from typing import List, Optional

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.music import Track, Artist, Album, TrackArtist
from app.schemas.track import TrackResponse

router = APIRouter(prefix="/search", tags=["search"])

@router.get("/tracks", response_model=List[TrackResponse])
def search_tracks(
    query: Optional[str] = Query(None, description="Search by title or artist"),
    genre: Optional[str] = Query(None, description="Filter by genre"),
    year: Optional[int] = Query(None, description="Filter by year"),
    min_duration: Optional[int] = Query(None, description="Min duration in seconds"),
    max_duration: Optional[int] = Query(None, description="Max duration in seconds"),
    sort_by: str = Query("title", description="Sort by: title, date_added, play_count, duration"),
    sort_order: str = Query("asc", description="asc or desc"),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Advanced track search and filtering
    
    Search by:
    - Title (partial match, case-insensitive)
    - Artist name (partial match)
    
    Filter by:
    - Genre
    - Year
    - Duration range
    
    Sort by:
    - title: Alphabetical
    - date_added: When uploaded (created_at)
    - play_count: Most/least played
    - duration: Shortest/longest
    
    Returns paginated results
    """
    # Base query
    db_query = db.query(Track).filter(Track.deleted_at.is_(None))
    
    # Search by title or artist
    if query:
        # Search in track title OR artist name
        artist_subquery = db.query(TrackArtist.track_id).join(
            Artist, Artist.id == TrackArtist.artist_id
        ).filter(
            Artist.name.ilike(f"%{query}%")
        ).subquery()
        
        db_query = db_query.filter(
            or_(
                Track.title.ilike(f"%{query}%"),
                Track.id.in_(artist_subquery)
            )
        )
    
    # Filter by genre
    if genre:
        db_query = db_query.filter(Track.genre.ilike(f"%{genre}%"))
    
    # Filter by year
    if year:
        db_query = db_query.filter(Track.year == year)
    
    # Filter by duration
    if min_duration:
        db_query = db_query.filter(Track.duration >= min_duration)
    if max_duration:
        db_query = db_query.filter(Track.duration <= max_duration)
    
    # Sort
    if sort_by == "title":
        sort_column = Track.title
    elif sort_by == "date_added":
        sort_column = Track.created_at
    elif sort_by == "play_count":
        sort_column = Track.play_count
    elif sort_by == "duration":
        sort_column = Track.duration
    else:
        sort_column = Track.title  # Default
    
    if sort_order.lower() == "desc":
        db_query = db_query.order_by(sort_column.desc())
    else:
        db_query = db_query.order_by(sort_column.asc())
    
    # Paginate
    tracks = db_query.offset(skip).limit(limit).all()
    
    return tracks

@router.get("/genres")
def get_all_genres(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get list of all genres in library
    
    Returns unique genres with track counts
    """
    genres = db.query(
        Track.genre,
        func.count(Track.id).label('count')
    ).filter(
        Track.deleted_at.is_(None),
        Track.genre.isnot(None)
    ).group_by(Track.genre).all()
    
    return [
        {"genre": genre, "count": count}
        for genre, count in genres
    ]

@router.get("/years")
def get_all_years(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get list of all years in library
    
    Returns unique years with track counts
    """
    years = db.query(
        Track.year,
        func.count(Track.id).label('count')
    ).filter(
        Track.deleted_at.is_(None),
        Track.year.isnot(None)
    ).group_by(Track.year).order_by(Track.year.desc()).all()
    
    return [
        {"year": year, "count": count}
        for year, count in years
    ]

@router.get("/artists")
def search_artists(
    query: str = Query(..., description="Search artist name"),
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Search artists by name
    
    Returns artist names with track counts
    """
    artists = db.query(
        Artist.id,
        Artist.name,
        func.count(TrackArtist.track_id).label('track_count')
    ).join(
        TrackArtist, TrackArtist.artist_id == Artist.id
    ).filter(
        Artist.name.ilike(f"%{query}%")
    ).group_by(Artist.id, Artist.name).limit(limit).all()
    
    return [
        {"id": artist.id, "name": artist.name, "track_count": artist.track_count}
        for artist in artists
    ]