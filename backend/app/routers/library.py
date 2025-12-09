"""
User library management (liked songs, saved albums)
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.music import Track, Album, Artist, TrackArtist
from app.models.playlist import LikedSong, UserLibraryItem
from app.schemas.track import TrackResponse
from app.schemas.album import AlbumWithArtists

router = APIRouter(prefix="/library", tags=["library"])

@router.post("/like/{track_id}", status_code=status.HTTP_201_CREATED)
def like_song(
    track_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Like a song
    
    - Adds to user's liked songs
    - Idempotent (won't fail if already liked)
    """
    # Check track exists
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )
    
    # Check if already liked
    existing = db.query(LikedSong).filter(
        LikedSong.user_id == current_user.id,
        LikedSong.track_id == track_id
    ).first()
    
    if existing:
        return {"message": "Song already liked", "track_id": track_id}
    
    # Like the song
    liked_song = LikedSong(
        user_id=current_user.id,
        track_id=track_id
    )
    db.add(liked_song)
    db.commit()
    
    return {"message": "Song liked", "track_id": track_id}

@router.delete("/like/{track_id}")
def unlike_song(
    track_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Unlike a song
    
    - Removes from user's liked songs
    """
    deleted = db.query(LikedSong).filter(
        LikedSong.user_id == current_user.id,
        LikedSong.track_id == track_id
    ).delete()
    
    db.commit()
    
    if deleted == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Song not in liked songs"
        )
    
    return {"message": "Song unliked", "track_id": track_id}

@router.get("/liked-songs", response_model=List[TrackResponse])
def get_liked_songs(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user's liked songs
    
    - Ordered by most recently liked
    - Paginated
    - Includes artist information
    """
    from sqlalchemy.orm import selectinload
    
    liked_songs = db.query(Track).options(
        selectinload(Track.artists),  # ✅ Load artists eagerly
        selectinload(Track.album)     # ✅ Load album eagerly
    ).join(
        LikedSong, LikedSong.track_id == Track.id
    ).filter(
        LikedSong.user_id == current_user.id
    ).order_by(
        LikedSong.liked_at.desc()
    ).offset(skip).limit(limit).all()
    
    return liked_songs

@router.post("/albums/{album_id}", status_code=status.HTTP_201_CREATED)
def save_album(
    album_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save album to library
    
    - Adds to user's saved albums
    """
    # Check album exists
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found"
        )
    
    # Check if already saved
    existing = db.query(UserLibraryItem).filter(
        UserLibraryItem.user_id == current_user.id,
        UserLibraryItem.item_type == 'album',
        UserLibraryItem.item_id == album_id
    ).first()
    
    if existing:
        return {"message": "Album already in library", "album_id": album_id}
    
    # Save album
    library_item = UserLibraryItem(
        user_id=current_user.id,
        item_type='album',
        item_id=album_id
    )
    db.add(library_item)
    db.commit()
    
    return {"message": "Album saved to library", "album_id": album_id}

@router.delete("/albums/{album_id}")
def remove_album(
    album_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove album from library
    """
    deleted = db.query(UserLibraryItem).filter(
        UserLibraryItem.user_id == current_user.id,
        UserLibraryItem.item_type == 'album',
        UserLibraryItem.item_id == album_id
    ).delete()
    
    db.commit()
    
    if deleted == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not in library"
        )
    
    return {"message": "Album removed from library", "album_id": album_id}

@router.get("/stats")
def get_library_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user's library statistics
    """
    liked_songs_count = db.query(LikedSong).filter(
        LikedSong.user_id == current_user.id
    ).count()
    
    saved_albums_count = db.query(UserLibraryItem).filter(
        UserLibraryItem.user_id == current_user.id,
        UserLibraryItem.item_type == 'album'
    ).count()
    
    return {
        "liked_songs": liked_songs_count,
        "saved_albums": saved_albums_count,
        "storage_used_mb": float(current_user.storage_used_mb),
        "storage_quota_mb": current_user.storage_quota_mb
    }

@router.get("/items")
def get_library_items(
    skip: int = 0,
    limit: int = 50,
    item_type: Optional[str] = Query(None, description="Filter by: songs, albums, or all"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user's complete library (liked songs + saved albums)
    
    - item_type: 'songs', 'albums', or None for all
    - Returns combined list with type indicator
    - Ordered by most recently added
    """
    from app.models.music import Artist, AlbumArtist
    
    result = []
    
    # Get liked songs
    if item_type in [None, 'songs']:
        liked_songs = db.query(LikedSong, Track).join(
            Track, LikedSong.track_id == Track.id
        ).filter(
            LikedSong.user_id == current_user.id
        ).order_by(
            LikedSong.liked_at.desc()
        ).all()
        
        for liked, track in liked_songs:
            # Get artists for this track
            artists = db.query(Artist).join(
                TrackArtist, TrackArtist.artist_id == Artist.id
            ).filter(
                TrackArtist.track_id == track.id
            ).all()
            
            result.append({
                'type': 'song',
                'id': track.id,
                'title': track.title,
                'artists': [artist.name for artist in artists],
                'duration': track.duration,
                'cover_path': track.cover_path,
                'added_at': liked.liked_at,
                'play_count': track.play_count
            })
    
    # Get saved albums
    if item_type in [None, 'albums']:
        saved_albums = db.query(UserLibraryItem, Album).join(
            Album, UserLibraryItem.item_id == Album.id
        ).filter(
            UserLibraryItem.user_id == current_user.id,
            UserLibraryItem.item_type == 'album'
        ).order_by(
            UserLibraryItem.added_at.desc()
        ).all()
        
        for lib_item, album in saved_albums:
            # Get artists for this album
            artists = db.query(Artist).join(
                AlbumArtist, AlbumArtist.artist_id == Artist.id
            ).filter(
                AlbumArtist.album_id == album.id
            ).all()
            
            result.append({
                'type': 'album',
                'id': album.id,
                'title': album.name,
                'artists': [artist.name for artist in artists],
                'release_year': album.release_year,
                'cover_path': album.cover_path,
                'added_at': lib_item.added_at,
                'total_tracks': album.total_tracks
            })
    
    # Sort all items by added_at (most recent first)
    result.sort(key=lambda x: x['added_at'], reverse=True)
    
    # Paginate
    paginated = result[skip:skip + limit]
    
    return {
        'total': len(result),
        'items': paginated
    }