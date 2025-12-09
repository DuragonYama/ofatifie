"""
Advanced FTS5-powered search for tracks, artists, and albums
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import text, and_, func
from typing import List, Optional

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.music import Track, Artist, Album
from app.schemas.track import TrackResponse

router = APIRouter(prefix="/search", tags=["search"])

@router.get("/tracks", response_model=List[TrackResponse])
def search_tracks(
    query: Optional[str] = Query(None, description="Search by title, artist, album, or genre"),
    genre: Optional[str] = Query(None, description="Filter by genre"),
    year: Optional[int] = Query(None, description="Filter by year"),
    min_duration: Optional[int] = Query(None, description="Min duration in seconds"),
    max_duration: Optional[int] = Query(None, description="Max duration in seconds"),
    sort_by: str = Query("relevance", description="Sort by: relevance, title, date_added, play_count, duration"),
    sort_order: str = Query("desc", description="asc or desc"),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    PRIMARY SEARCH ENDPOINT - Search tracks across your entire library
    
    What it does:
    - Searches track titles, artist names, album names, and genres using FTS5
    - Returns results ranked by relevance (best matches first)
    - Can filter results by genre, year, and duration
    - Can sort by relevance, title, date, play count, or duration
    
    How it works:
    1. If you provide a query: Uses FTS5 full-text search (FAST!)
    2. If no query: Returns all tracks with optional filters (browse mode)
    
    Examples:
    - /search/tracks?query=beatles           → Find all Beatles tracks
    - /search/tracks?genre=rock&year=2000    → Browse rock from 2000
    - /search/tracks?query=love&sort_by=play_count → Most played love songs
    """
    
    # If there's a search query, use FTS5
    if query:
        # FTS5 search with ranking
        fts_query = text("""
            SELECT 
                t.id,
                t.title,
                t.album_id,
                t.duration,
                t.track_number,
                t.disc_number,
                t.year,
                t.genre,
                t.song_hash,
                t.audio_path,
                t.cover_path,
                t.file_size_mb,
                t.bitrate,
                t.format,
                t.play_count,
                t.imported_from_id,
                t.uploaded_by_id,
                t.created_at,
                t.updated_at,
                t.deleted_at,
                t.last_in_library,
                fts.rank as relevance,
                GROUP_CONCAT(ar.name, ', ') as artist_names
            FROM tracks_fts fts
            JOIN tracks t ON fts.rowid = t.id
            LEFT JOIN track_artists ta ON t.id = ta.track_id
            LEFT JOIN artists ar ON ta.artist_id = ar.id
            WHERE tracks_fts MATCH :search_query
            AND t.deleted_at IS NULL
            GROUP BY t.id
        """)
        
        # Escape FTS5 special characters by wrapping in quotes
        # This prevents issues with hyphens, quotes, etc.
        search_param = f'"{query.strip()}"'
        
        # Execute FTS search
        result = db.execute(fts_query, {"search_query": search_param})
        track_ids_with_rank = [(row.id, row.relevance) for row in result]
        
        if not track_ids_with_rank:
            return []  # No matches
        
        track_ids = [tid for tid, _ in track_ids_with_rank]
        rank_map = {tid: rank for tid, rank in track_ids_with_rank}
        
        # Get full track objects with relationships loaded
        tracks_query = db.query(Track).options(
            selectinload(Track.artists),  # ✅ Load artists
            selectinload(Track.album)     # ✅ Load album
        ).filter(
            Track.id.in_(track_ids),
            Track.deleted_at.is_(None)
        )
        
        # Apply additional filters
        if genre:
            tracks_query = tracks_query.filter(Track.genre.ilike(f"%{genre}%"))
        if year:
            tracks_query = tracks_query.filter(Track.year == year)
        if min_duration:
            tracks_query = tracks_query.filter(Track.duration >= min_duration)
        if max_duration:
            tracks_query = tracks_query.filter(Track.duration <= max_duration)
        
        tracks = tracks_query.all()
        
        # Sort by relevance (FTS5 rank) or other criteria
        if sort_by == "relevance":
            # Sort by FTS5 rank (lower is better in FTS5, so ascending)
            tracks.sort(key=lambda t: rank_map.get(t.id, 0))
        elif sort_by == "title":
            tracks.sort(key=lambda t: t.title.lower(), reverse=(sort_order.lower() == "desc"))
        elif sort_by == "date_added":
            tracks.sort(key=lambda t: t.created_at, reverse=(sort_order.lower() == "desc"))
        elif sort_by == "play_count":
            tracks.sort(key=lambda t: t.play_count or 0, reverse=(sort_order.lower() == "desc"))
        elif sort_by == "duration":
            tracks.sort(key=lambda t: t.duration or 0, reverse=(sort_order.lower() == "desc"))
        
        # Paginate
        paginated_tracks = tracks[skip:skip + limit]
        return paginated_tracks
    
    else:
        # No search query - return all tracks with filters (browse mode)
        # ✅ FIXED: Load artists and album relationships
        tracks_query = db.query(Track).options(
            selectinload(Track.artists),  # ✅ Load artists eagerly
            selectinload(Track.album)     # ✅ Load album eagerly
        ).filter(Track.deleted_at.is_(None))
        
        # Apply filters
        if genre:
            tracks_query = tracks_query.filter(Track.genre.ilike(f"%{genre}%"))
        if year:
            tracks_query = tracks_query.filter(Track.year == year)
        if min_duration:
            tracks_query = tracks_query.filter(Track.duration >= min_duration)
        if max_duration:
            tracks_query = tracks_query.filter(Track.duration <= max_duration)
        
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
            sort_column = Track.created_at  # Default to recent
        
        if sort_order.lower() == "desc":
            tracks_query = tracks_query.order_by(sort_column.desc())
        else:
            tracks_query = tracks_query.order_by(sort_column.asc())
        
        # Paginate
        tracks = tracks_query.offset(skip).limit(limit).all()
        return tracks


@router.get("/suggest")
def search_suggestions(
    query: str = Query(..., min_length=2, description="Search query for suggestions"),
    limit: int = Query(10, le=20, description="Max suggestions to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    AUTOCOMPLETE ENDPOINT - Get search suggestions as user types
    
    What it does:
    - Returns quick suggestions for tracks, artists, and albums
    - Used for autocomplete/dropdown in search bars
    - Fast results (only returns IDs and names)
    
    How it works:
    - Takes partial input (minimum 2 characters)
    - Searches across tracks, artists, and albums simultaneously
    - Returns up to 10 matches of each type
    
    Example:
    - User types "beat" → Returns:
      {
        "tracks": [{"id": 1, "title": "Beat It"}, ...],
        "artists": [{"id": 5, "name": "The Beatles"}, ...],
        "albums": [{"id": 3, "name": "Beatmania"}, ...]
      }
    
    Frontend use:
    - Show dropdown with "Tracks", "Artists", "Albums" sections
    - User clicks suggestion → navigate to that item or search with full query
    """
    
    # Escape FTS5 special characters: - " * ( ) AND OR NOT
    # Wrap query in quotes to treat as literal phrase
    escaped_query = f'"{query}"'
    
    results = {
        "tracks": [],
        "artists": [],
        "albums": []
    }
    
    # Search tracks
    track_query = text("""
        SELECT t.id, t.title, fts.rank
        FROM tracks_fts fts
        JOIN tracks t ON fts.rowid = t.id
        WHERE tracks_fts MATCH :query
        AND t.deleted_at IS NULL
        ORDER BY fts.rank
        LIMIT :limit
    """)
    
    track_results = db.execute(track_query, {"query": escaped_query, "limit": limit})
    results["tracks"] = [
        {"id": row.id, "title": row.title}
        for row in track_results
    ]
    
    # Search artists
    artist_query = text("""
        SELECT a.id, a.name, fts.rank
        FROM artists_fts fts
        JOIN artists a ON fts.rowid = a.id
        WHERE artists_fts MATCH :query
        ORDER BY fts.rank
        LIMIT :limit
    """)
    
    artist_results = db.execute(artist_query, {"query": escaped_query, "limit": limit})
    results["artists"] = [
        {"id": row.id, "name": row.name}
        for row in artist_results
    ]
    
    # Search albums
    album_query = text("""
        SELECT a.id, a.name, fts.rank
        FROM albums_fts fts
        JOIN albums a ON fts.rowid = a.id
        WHERE albums_fts MATCH :query
        AND a.deleted_at IS NULL
        ORDER BY fts.rank
        LIMIT :limit
    """)
    
    album_results = db.execute(album_query, {"query": escaped_query, "limit": limit})
    results["albums"] = [
        {"id": row.id, "name": row.name}
        for row in album_results
    ]
    
    return results


@router.get("/genres")
def get_all_genres(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    GENRE BROWSER - Get all genres in your library
    
    What it does:
    - Returns list of all unique genres
    - Shows how many tracks are in each genre
    - Sorted by popularity (most tracks first)
    
    How it works:
    - Aggregates all non-null genre values from tracks
    - Counts tracks per genre
    
    Example response:
    [
      {"genre": "Rock", "count": 1523},
      {"genre": "Pop", "count": 892},
      {"genre": "Electronic", "count": 445}
    ]
    
    Frontend use:
    - Show genre browser/filter
    - Click genre → /search/tracks?genre=Rock
    """
    genres = db.query(
        Track.genre,
        func.count(Track.id).label('count')
    ).filter(
        Track.deleted_at.is_(None),
        Track.genre.isnot(None)
    ).group_by(Track.genre).order_by(func.count(Track.id).desc()).all()
    
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
    YEAR BROWSER - Get all years in your library
    
    What it does:
    - Returns list of all unique years
    - Shows how many tracks from each year
    - Sorted by year (newest first)
    
    How it works:
    - Aggregates all non-null year values from tracks
    - Counts tracks per year
    
    Example response:
    [
      {"year": 2024, "count": 145},
      {"year": 2023, "count": 203},
      {"year": 2022, "count": 178}
    ]
    
    Frontend use:
    - Show year timeline/filter
    - Click year → /search/tracks?year=2024
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
    ARTIST SEARCH - Search for artists specifically
    
    What it does:
    - Searches only artist names using FTS5
    - Returns matching artists with track counts
    - Ranked by relevance
    
    How it works:
    - Uses FTS5 artist search
    - Joins with track_artists to count tracks per artist
    - Returns top 20 matches
    
    Example:
    - /search/artists?query=beatles → Returns Beatles + similar artists
    
    Response:
    [
      {"id": 5, "name": "The Beatles", "track_count": 243},
      {"id": 12, "name": "Beatles Revival Band", "track_count": 15}
    ]
    
    Frontend use:
    - Artist-specific search
    - Show artist page with all their tracks
    """
    # Escape FTS5 special characters
    escaped_query = f'"{query}"'
    
    artist_query = text("""
        SELECT 
            a.id,
            a.name,
            fts.rank,
            COUNT(ta.track_id) as track_count
        FROM artists_fts fts
        JOIN artists a ON fts.rowid = a.id
        LEFT JOIN track_artists ta ON a.id = ta.artist_id
        WHERE artists_fts MATCH :query
        GROUP BY a.id, a.name, fts.rank
        ORDER BY fts.rank
        LIMIT :limit
    """)
    
    results = db.execute(artist_query, {"query": escaped_query, "limit": limit})
    
    return [
        {"id": row.id, "name": row.name, "track_count": row.track_count}
        for row in results
    ]