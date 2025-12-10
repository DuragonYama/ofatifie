"""
Album management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_
from typing import List, Optional

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.music import Album, Artist, AlbumArtist, Track
from app.schemas.album import AlbumWithArtists, AlbumDetails

router = APIRouter(prefix="/albums", tags=["albums"])

@router.get("", response_model=List[AlbumWithArtists])
def list_albums(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all albums
    
    - Paginated results
    - Optional search by album name
    - Includes artist names
    - ✅ NEW: Includes first_track_id for cover images
    """
    query = db.query(Album).filter(Album.deleted_at.is_(None))
    
    # Search filter
    if search:
        query = query.filter(Album.name.ilike(f"%{search}%"))
    
    albums = query.order_by(Album.name).offset(skip).limit(limit).all()
    
    # Add artist names and first track ID for cover
    result = []
    for album in albums:
        # Get artists for this album
        artists = db.query(Artist).join(
            AlbumArtist, AlbumArtist.artist_id == Artist.id
        ).filter(
            AlbumArtist.album_id == album.id
        ).order_by(AlbumArtist.artist_order).all()
        
        # ✅ NEW: Get first track ID for cover image
        first_track = db.query(Track).filter(
            Track.album_id == album.id,
            Track.deleted_at.is_(None)
        ).order_by(Track.track_number).first()
        
        # Build dict with all fields including first_track_id
        album_dict = {
            "id": album.id,
            "name": album.name,
            "release_year": album.release_year,
            "genre": album.genre,
            "cover_path": album.cover_path,
            "total_tracks": album.total_tracks,
            "artists": [artist.name for artist in artists],
            "first_track_id": first_track.id if first_track else None
        }
        
        result.append(AlbumWithArtists(**album_dict))
    
    return result

@router.get("/{album_id}", response_model=AlbumDetails)
def get_album(
    album_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get album details with track list
    
    - Includes all tracks in album
    - Ordered by track number
    - ✅ FIXED: Tracks now include artist information
    """
    album = db.query(Album).filter(
        Album.id == album_id,
        Album.deleted_at.is_(None)
    ).first()
    
    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found"
        )
    
    # Get artists
    artists = db.query(Artist).join(
        AlbumArtist, AlbumArtist.artist_id == Artist.id
    ).filter(
        AlbumArtist.album_id == album.id
    ).order_by(AlbumArtist.artist_order).all()
    
    # Get tracks with artists loaded
    # ✅ FIXED: Added selectinload to eagerly load artists for each track
    tracks = db.query(Track).options(
        selectinload(Track.artists),  # ✅ Load track artists
        selectinload(Track.album)     # ✅ Load album info
    ).filter(
        Track.album_id == album_id,
        Track.deleted_at.is_(None)
    ).order_by(Track.track_number).all()
    
    return AlbumDetails(
        id=album.id,
        name=album.name,
        release_year=album.release_year,
        genre=album.genre,
        cover_path=album.cover_path,
        total_tracks=len(tracks),
        artists=[artist.name for artist in artists],
        tracks=tracks,
        created_at=album.created_at
    )

@router.get("/search/{query}", response_model=List[AlbumWithArtists])
def search_albums(
    query: str,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Search albums by name
    
    - Case-insensitive search
    - Returns up to 20 results
    - ✅ NEW: Includes first_track_id for cover images
    """
    albums = db.query(Album).filter(
        Album.name.ilike(f"%{query}%"),
        Album.deleted_at.is_(None)
    ).limit(limit).all()
    
    result = []
    for album in albums:
        artists = db.query(Artist).join(
            AlbumArtist, AlbumArtist.artist_id == Artist.id
        ).filter(
            AlbumArtist.album_id == album.id
        ).all()
        
        # ✅ NEW: Get first track ID for cover image
        first_track = db.query(Track).filter(
            Track.album_id == album.id,
            Track.deleted_at.is_(None)
        ).order_by(Track.track_number).first()
        
        # Build dict with all fields including first_track_id
        album_dict = {
            "id": album.id,
            "name": album.name,
            "release_year": album.release_year,
            "genre": album.genre,
            "cover_path": album.cover_path,
            "total_tracks": album.total_tracks,
            "artists": [artist.name for artist in artists],
            "first_track_id": first_track.id if first_track else None
        }
        
        result.append(AlbumWithArtists(**album_dict))
    
    return result