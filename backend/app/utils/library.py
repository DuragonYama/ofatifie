"""
Utility functions for music library management
"""
import os
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.music import Track
from app.models.playlist import LikedSong, PlaylistSong, UserLibraryItem

def get_song_library_count(db: Session, track_id: int):
    """
    Count how many users have this song in their library
    Returns detailed breakdown and total count
    """
    # Count in liked_songs
    liked_count = db.query(LikedSong).filter(
        LikedSong.track_id == track_id
    ).count()
    
    # Count in playlists
    playlist_count = db.query(PlaylistSong).filter(
        PlaylistSong.track_id == track_id
    ).distinct(PlaylistSong.playlist_id).count()
    
    # Get unique user IDs who have it
    liked_users = {ls.user_id for ls in db.query(LikedSong.user_id).filter(
        LikedSong.track_id == track_id
    ).all()}
    
    playlist_users = {ps.added_by_id for ps in db.query(PlaylistSong.added_by_id).filter(
        PlaylistSong.track_id == track_id,
        PlaylistSong.added_by_id.isnot(None)
    ).all()}
    
    unique_users = liked_users | playlist_users
    
    return {
        'total': len(unique_users),
        'liked_by': liked_count,
        'in_playlists': playlist_count,
        'unique_users': list(unique_users)
    }

def user_has_song(db: Session, track_id: int, user_id: int):
    """Check if a specific user has this song in their library"""
    stats = get_song_library_count(db, track_id)
    return user_id in stats['unique_users']

def delete_track_from_ssd(track: Track):
    """
    Delete the actual audio file and cover from storage
    Returns size freed in MB
    """
    size_freed = 0
    
    # Delete audio file
    if track.audio_path and os.path.exists(track.audio_path):
        size_freed += os.path.getsize(track.audio_path) / (1024 * 1024)  # Convert to MB
        os.remove(track.audio_path)
    
    # Delete cover image
    if track.cover_path and os.path.exists(track.cover_path):
        os.remove(track.cover_path)
    
    return round(size_freed, 2)

def remove_track_from_user_library(db: Session, user_id: int, track_id: int):
    """Remove track from all of user's collections"""
    
    # Remove from liked songs
    db.query(LikedSong).filter(
        LikedSong.user_id == user_id,
        LikedSong.track_id == track_id
    ).delete()
    
    # Remove from all playlists owned by user
    db.query(PlaylistSong).filter(
        PlaylistSong.track_id == track_id,
        PlaylistSong.added_by_id == user_id
    ).delete()
    
    db.commit()

def mark_track_as_orphaned(db: Session, track_id: int):
    """Mark when track became orphaned (no users have it)"""
    track = db.query(Track).get(track_id)
    if track:
        track.last_in_library = datetime.now()
        db.commit()

def get_orphaned_tracks(db: Session):
    """
    Get all tracks that are not in any user's library
    Returns list with details including days orphaned
    """
    from sqlalchemy import and_, not_, exists
    
    # Subquery: tracks in liked_songs
    liked_subq = db.query(LikedSong.track_id).distinct()
    
    # Subquery: tracks in playlists
    playlist_subq = db.query(PlaylistSong.track_id).distinct()
    
    # Get tracks not in either
    orphaned = db.query(Track).filter(
        and_(
            ~Track.id.in_(liked_subq),
            ~Track.id.in_(playlist_subq),
            Track.deleted_at.is_(None)  # Not soft-deleted
        )
    ).all()
    
    result = []
    for track in orphaned:
        days_orphaned = None
        if track.last_in_library:
            days_orphaned = (datetime.now() - track.last_in_library).days
        
        result.append({
            'id': track.id,
            'title': track.title,
            'file_size_mb': float(track.file_size_mb) if track.file_size_mb else 0,
            'days_orphaned': days_orphaned,
            'last_in_library': track.last_in_library,
            'audio_path': track.audio_path,
            'recently_orphaned': days_orphaned is not None and days_orphaned < 7
        })
    
    return result

def get_or_create_artist(db: Session, artist_name: str):
    """
    Get existing artist or create new one
    
    Args:
        db: Database session
        artist_name: Artist name from metadata
        
    Returns:
        Artist object or None
    """
    from app.models.music import Artist
    
    if not artist_name:
        return None
    
    # Clean up artist name
    artist_name = artist_name.strip()
    
    # Check if artist exists (case-insensitive)
    artist = db.query(Artist).filter(
        Artist.name.ilike(artist_name)
    ).first()
    
    if not artist:
        # Create new artist
        artist = Artist(name=artist_name)
        db.add(artist)
        db.flush()  # Get ID without committing
    
    return artist

def get_or_create_album(
    db: Session,
    album_title: str,
    year: int = None,
    artist_name: str = None
):
    """
    Get existing album or create new one
    
    Args:
        db: Database session
        album_title: Album name from metadata
        year: Release year
        artist_name: Primary artist name (for matching)
        
    Returns:
        Album object or None
    """
    from app.models.music import Album, AlbumArtist
    
    if not album_title:
        return None
    
    # Clean up album title
    album_title = album_title.strip()
    
    # Check if album exists (by name, case-insensitive)
    album = db.query(Album).filter(
        Album.name.ilike(album_title)  # Changed from title to name
    ).first()
    
    if not album:
        # Create new album
        album = Album(
            name=album_title,  # Changed from title to name
            release_year=year
        )
        db.add(album)
        db.flush()  # Get ID without committing
        
        # Link artist to album if provided
        if artist_name:
            artist = get_or_create_artist(db, artist_name)
            if artist:
                album_artist = AlbumArtist(
                    album_id=album.id,
                    artist_id=artist.id
                )
                db.add(album_artist)
    
    return album

def link_track_to_album_and_artists(
    db: Session,
    track: Track,
    metadata: dict
) -> None:
    """
    Link track to album and artists based on metadata
    
    Args:
        db: Database session
        track: Track object
        metadata: Metadata dict with 'album', 'artist', 'year'
    """
    from app.models.music import TrackArtist
    
    album_title = metadata.get('album')
    artist_name = metadata.get('artist')
    year = metadata.get('year')
    
    # Convert year string to int if needed
    if year and isinstance(year, str):
        try:
            year = int(year[:4])  # Take first 4 digits
        except:
            year = None
    
    # Create/link album
    if album_title:
        album = get_or_create_album(db, album_title, year, artist_name)
        if album:
            track.album_id = album.id
    
    # Create/link artist
    if artist_name:
        artist = get_or_create_artist(db, artist_name)
        if artist:
            # Check if track-artist link already exists
            existing = db.query(TrackArtist).filter(
                TrackArtist.track_id == track.id,
                TrackArtist.artist_id == artist.id
            ).first()
            
            if not existing:
                track_artist = TrackArtist(
                    track_id=track.id,
                    artist_id=artist.id
                )
                db.add(track_artist)