"""
Playlist management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_
from typing import List
from pathlib import Path
import shutil

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.music import Track, Artist, TrackArtist
from app.models.playlist import Playlist, PlaylistSong, PlaylistCollaborator
from app.schemas.playlist import (
    PlaylistCreate,
    PlaylistUpdate,
    PlaylistBase,
    PlaylistDetails,
    PlaylistTrackInfo,
    AddSongRequest,
    ReorderRequest,
    CollaboratorInfo,
    AddCollaboratorRequest
)

router = APIRouter(prefix="/playlists", tags=["playlists"])

def refactor_playlist_positions(db: Session, playlist_id: int):
    """
    Refactor all positions to whole numbers in order
    
    - Gets all songs ordered by position
    - Reassigns positions as 1, 2, 3, 4, etc.
    """
    songs = db.query(PlaylistSong).filter(
        PlaylistSong.playlist_id == playlist_id
    ).order_by(PlaylistSong.position).all()
    
    for index, song in enumerate(songs, start=1):
        song.position = float(index)
    
    db.commit()

# ============================================
# BASIC PLAYLIST OPERATIONS
# ============================================

@router.post("", response_model=PlaylistBase, status_code=status.HTTP_201_CREATED)
def create_playlist(
    playlist_data: PlaylistCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new playlist
    
    - Name is required
    - Description is optional
    - Can be collaborative or personal
    """
    new_playlist = Playlist(
        name=playlist_data.name,
        description=playlist_data.description,
        is_collaborative=playlist_data.is_collaborative,
        owner_id=current_user.id
    )
    
    db.add(new_playlist)
    db.commit()
    db.refresh(new_playlist)
    
    return new_playlist

@router.get("", response_model=List[PlaylistBase])
def get_user_playlists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all playlists owned by or shared with current user
    
    - Includes owned playlists
    - Includes collaborative playlists where user is a collaborator
    """
    # Get owned playlists
    owned = db.query(Playlist).filter(
        Playlist.owner_id == current_user.id,
        Playlist.deleted_at.is_(None)
    ).all()
    
    # Get collaborative playlists
    collab_ids = db.query(PlaylistCollaborator.playlist_id).filter(
        PlaylistCollaborator.user_id == current_user.id
    ).all()
    collab_ids = [pid[0] for pid in collab_ids]
    
    collaborative = db.query(Playlist).filter(
        Playlist.id.in_(collab_ids),
        Playlist.deleted_at.is_(None)
    ).all() if collab_ids else []
    
    # Combine and deduplicate
    all_playlists = {p.id: p for p in owned + collaborative}.values()
    
    return list(all_playlists)

@router.get("/{playlist_id}", response_model=PlaylistDetails)
def get_playlist_details(
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get playlist details with full track list
    
    - Must be owner or collaborator to view
    - Tracks ordered by position
    - Includes who added each track
    """
    playlist = db.query(Playlist).filter(
        Playlist.id == playlist_id,
        Playlist.deleted_at.is_(None)
    ).first()
    
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found"
        )
    
    # Check permissions
    is_owner = playlist.owner_id == current_user.id
    is_collaborator = db.query(PlaylistCollaborator).filter(
        PlaylistCollaborator.playlist_id == playlist_id,
        PlaylistCollaborator.user_id == current_user.id
    ).first() is not None
    
    if not (is_owner or is_collaborator):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this playlist"
        )
    
    # Get tracks with eager loading to avoid N+1 queries
    playlist_tracks = db.query(PlaylistSong).filter(
        PlaylistSong.playlist_id == playlist_id
    ).options(
        selectinload(PlaylistSong.track).selectinload(Track.artists)
    ).order_by(PlaylistSong.position).all()

    tracks_info = []
    for ps in playlist_tracks:
        track = ps.track
        # Extract artist names from the loaded relationship
        # track.artists is a direct relationship to Artist objects
        artist_names = [artist.name for artist in track.artists]

        tracks_info.append(PlaylistTrackInfo(
            id=ps.id,
            track_id=track.id,
            title=track.title,
            duration=track.duration,
            artists=artist_names,
            cover_path=track.cover_path,
            position=ps.position,
            added_by_id=ps.added_by_id,
            added_at=ps.added_at
        ))
    
    return PlaylistDetails(
        id=playlist.id,
        name=playlist.name,
        description=playlist.description,
        cover_path=playlist.cover_path,
        is_collaborative=playlist.is_collaborative,
        owner_id=playlist.owner_id,
        created_at=playlist.created_at,
        tracks=tracks_info,
        track_count=len(tracks_info)
    )

@router.patch("/{playlist_id}", response_model=PlaylistBase)
def update_playlist(
    playlist_id: int,
    playlist_update: PlaylistUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update playlist details
    
    - Only owner can edit name/description
    - Only owner can enable/disable collaboration
    """
    playlist = db.query(Playlist).filter(
        Playlist.id == playlist_id,
        Playlist.deleted_at.is_(None)
    ).first()
    
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found"
        )
    
    # Only owner can edit
    if playlist.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can edit this playlist"
        )
    
    # Update fields
    if playlist_update.name is not None:
        playlist.name = playlist_update.name
    if playlist_update.description is not None:
        playlist.description = playlist_update.description
    if playlist_update.is_collaborative is not None:
        playlist.is_collaborative = playlist_update.is_collaborative
    
    db.commit()
    db.refresh(playlist)
    
    return playlist

@router.delete("/{playlist_id}")
def delete_playlist(
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete playlist (soft delete)
    
    - Only owner can delete
    """
    playlist = db.query(Playlist).filter(
        Playlist.id == playlist_id,
        Playlist.deleted_at.is_(None)
    ).first()
    
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found"
        )
    
    if playlist.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can delete this playlist"
        )
    
    # Soft delete
    from datetime import datetime
    playlist.deleted_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Playlist deleted", "playlist_id": playlist_id}

@router.post("/{playlist_id}/cover", status_code=status.HTTP_200_OK)
async def upload_playlist_cover(
    playlist_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload playlist cover art
    
    - Accepts: jpg, jpeg, png, webp
    - Only owner can upload
    """
    playlist = db.query(Playlist).filter(
        Playlist.id == playlist_id,
        Playlist.deleted_at.is_(None)
    ).first()
    
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found"
        )
    
    if playlist.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can change the cover"
        )
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Allowed: jpg, png, webp"
        )
    
    # Create covers directory
    covers_dir = Path("uploads/playlist_covers")
    covers_dir.mkdir(parents=True, exist_ok=True)
    
    # Delete old cover if exists
    if playlist.cover_path:
        old_cover = Path(playlist.cover_path)
        if old_cover.exists():
            old_cover.unlink()
    
    # Save new cover
    cover_filename = f"playlist_{playlist_id}.jpg"
    cover_path = covers_dir / cover_filename
    
    try:
        with cover_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Convert to JPEG
        from PIL import Image
        img = Image.open(cover_path)
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')
        img.save(cover_path, 'JPEG', quality=90)
        
        playlist.cover_path = str(cover_path)
        db.commit()
        
        return {"message": "Cover uploaded", "cover_path": str(cover_path)}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save cover: {str(e)}"
        )
    
# ============================================
# PLAYLIST SONGS MANAGEMENT
# ============================================

@router.post("/{playlist_id}/songs", status_code=status.HTTP_201_CREATED)
def add_song_to_playlist(
    playlist_id: int,
    song_request: AddSongRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a song to playlist
    
    - Always adds to the end of playlist
    - Position automatically increments
    - Owner can always add
    - Collaborators can add if they have edit permission
    """
    playlist = db.query(Playlist).filter(
        Playlist.id == playlist_id,
        Playlist.deleted_at.is_(None)
    ).first()
    
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found"
        )
    
    # Check permissions
    is_owner = playlist.owner_id == current_user.id
    
    collaborator = db.query(PlaylistCollaborator).filter(
        PlaylistCollaborator.playlist_id == playlist_id,
        PlaylistCollaborator.user_id == current_user.id
    ).first()
    
    can_edit = is_owner or (collaborator and collaborator.can_edit)
    
    if not can_edit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to add songs to this playlist"
        )
    
    # Check track exists
    track = db.query(Track).filter(Track.id == song_request.track_id).first()
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )
    
    # Check if already in playlist
    existing = db.query(PlaylistSong).filter(
        PlaylistSong.playlist_id == playlist_id,
        PlaylistSong.track_id == song_request.track_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Song already in playlist"
        )
    
    # Always add to end - find last position and increment
    last_song = db.query(PlaylistSong).filter(
        PlaylistSong.playlist_id == playlist_id
    ).order_by(PlaylistSong.position.desc()).first()
    
    position = (last_song.position + 1.0) if last_song else 1.0
    
    # Add song
    playlist_song = PlaylistSong(
        playlist_id=playlist_id,
        track_id=song_request.track_id,
        position=position,
        added_by_id=current_user.id
    )
    
    db.add(playlist_song)
    db.commit()
    
    return {
        "message": "Song added to playlist",
        "playlist_id": playlist_id,
        "track_id": song_request.track_id,
        "position": position
    }

@router.delete("/{playlist_id}/songs/{playlist_song_id}")
def remove_song_from_playlist(
    playlist_id: int,
    playlist_song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove a song from playlist
    
    - Owner can always remove
    - Collaborators can remove if they have edit permission
    - Users can remove songs they added
    """
    playlist = db.query(Playlist).filter(
        Playlist.id == playlist_id,
        Playlist.deleted_at.is_(None)
    ).first()
    
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found"
        )
    
    playlist_song = db.query(PlaylistSong).filter(
        PlaylistSong.id == playlist_song_id,
        PlaylistSong.playlist_id == playlist_id
    ).first()
    
    if not playlist_song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Song not in playlist"
        )
    
    # Check permissions
    is_owner = playlist.owner_id == current_user.id
    added_by_self = playlist_song.added_by_id == current_user.id
    
    collaborator = db.query(PlaylistCollaborator).filter(
        PlaylistCollaborator.playlist_id == playlist_id,
        PlaylistCollaborator.user_id == current_user.id
    ).first()
    
    can_remove = is_owner or added_by_self or (collaborator and collaborator.can_edit)
    
    if not can_remove:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to remove this song"
        )
    
    db.delete(playlist_song)
    db.commit()
    
    return {"message": "Song removed from playlist", "playlist_song_id": playlist_song_id}

@router.put("/{playlist_id}/songs/reorder")
def reorder_song(
    playlist_id: int,
    reorder_request: ReorderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reorder a song in the playlist with smart positioning
    
    - Inserts at new_position + 0.5 temporarily
    - Then refactors all positions to whole numbers
    
    Example: Move to position 2 in playlist [1,2,3,4]
    1. Song becomes position 2.5 (between 2 and 3)
    2. Refactor shifts everything: [1,2,3,4] with moved song at position 3
    """
    playlist = db.query(Playlist).filter(
        Playlist.id == playlist_id,
        Playlist.deleted_at.is_(None)
    ).first()
    
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found"
        )
    
    # Check permissions
    is_owner = playlist.owner_id == current_user.id
    
    collaborator = db.query(PlaylistCollaborator).filter(
        PlaylistCollaborator.playlist_id == playlist_id,
        PlaylistCollaborator.user_id == current_user.id
    ).first()
    
    can_edit = is_owner or (collaborator and collaborator.can_edit)
    
    if not can_edit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to reorder songs"
        )
    
    # Get the song
    playlist_song = db.query(PlaylistSong).filter(
        PlaylistSong.id == reorder_request.playlist_song_id,
        PlaylistSong.playlist_id == playlist_id
    ).first()
    
    if not playlist_song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Song not in playlist"
        )
    
    # Set temporary position (target + 0.5)
    playlist_song.position = reorder_request.new_position + 0.5
    db.commit()
    
    # Refactor all positions to whole numbers
    refactor_playlist_positions(db, playlist_id)
    db.refresh(playlist_song)
    
    return {
        "message": "Song reordered and positions refactored",
        "playlist_song_id": playlist_song.id,
        "new_position": playlist_song.position
    }

# ============================================
# COLLABORATIVE PLAYLISTS
# ============================================

@router.get("/{playlist_id}/collaborators", response_model=List[CollaboratorInfo])
def get_collaborators(
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all collaborators for a playlist
    
    - Must be owner or collaborator to view
    """
    playlist = db.query(Playlist).filter(
        Playlist.id == playlist_id,
        Playlist.deleted_at.is_(None)
    ).first()
    
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found"
        )
    
    # Check permissions
    is_owner = playlist.owner_id == current_user.id
    is_collaborator = db.query(PlaylistCollaborator).filter(
        PlaylistCollaborator.playlist_id == playlist_id,
        PlaylistCollaborator.user_id == current_user.id
    ).first() is not None
    
    if not (is_owner or is_collaborator):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this playlist"
        )
    
    # Get collaborators
    collaborators = db.query(PlaylistCollaborator, User).join(
        User, PlaylistCollaborator.user_id == User.id
    ).filter(
        PlaylistCollaborator.playlist_id == playlist_id
    ).all()
    
    result = []
    for collab, user in collaborators:
        result.append(CollaboratorInfo(
            user_id=user.id,
            username=user.username,
            can_edit=collab.can_edit,
            added_at=collab.added_at
        ))
    
    return result

@router.post("/{playlist_id}/collaborators", status_code=status.HTTP_201_CREATED)
def add_collaborator(
    playlist_id: int,
    collab_request: AddCollaboratorRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a collaborator to playlist
    
    - Only owner can add collaborators
    - Playlist must be collaborative
    """
    playlist = db.query(Playlist).filter(
        Playlist.id == playlist_id,
        Playlist.deleted_at.is_(None)
    ).first()
    
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found"
        )
    
    # Only owner can add collaborators
    if playlist.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can add collaborators"
        )
    
    # Must be collaborative
    if not playlist.is_collaborative:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Playlist is not collaborative. Enable collaboration first."
        )
    
    # Check user exists
    user = db.query(User).filter(User.id == collab_request.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Can't add owner as collaborator
    if user.id == playlist.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owner is already a collaborator by default"
        )
    
    # Check if already collaborator
    existing = db.query(PlaylistCollaborator).filter(
        PlaylistCollaborator.playlist_id == playlist_id,
        PlaylistCollaborator.user_id == collab_request.user_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a collaborator"
        )
    
    # Add collaborator
    collaborator = PlaylistCollaborator(
        playlist_id=playlist_id,
        user_id=collab_request.user_id,
        can_edit=collab_request.can_edit
    )
    
    db.add(collaborator)
    db.commit()
    
    return {
        "message": "Collaborator added",
        "user_id": collab_request.user_id,
        "username": user.username,
        "can_edit": collab_request.can_edit
    }

@router.patch("/{playlist_id}/collaborators/{user_id}")
def update_collaborator_permissions(
    playlist_id: int,
    user_id: int,
    can_edit: bool,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update collaborator permissions
    
    - Only owner can edit permissions
    - Toggle can_edit on/off
    """
    playlist = db.query(Playlist).filter(
        Playlist.id == playlist_id,
        Playlist.deleted_at.is_(None)
    ).first()
    
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found"
        )
    
    if playlist.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can edit permissions"
        )
    
    collaborator = db.query(PlaylistCollaborator).filter(
        PlaylistCollaborator.playlist_id == playlist_id,
        PlaylistCollaborator.user_id == user_id
    ).first()
    
    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a collaborator"
        )
    
    collaborator.can_edit = can_edit
    db.commit()
    
    return {
        "message": "Permissions updated",
        "user_id": user_id,
        "can_edit": can_edit
    }

@router.delete("/{playlist_id}/collaborators/{user_id}")
def remove_collaborator(
    playlist_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove a collaborator from playlist
    
    - Only owner can remove collaborators
    """
    playlist = db.query(Playlist).filter(
        Playlist.id == playlist_id,
        Playlist.deleted_at.is_(None)
    ).first()
    
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found"
        )
    
    if playlist.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can remove collaborators"
        )
    
    collaborator = db.query(PlaylistCollaborator).filter(
        PlaylistCollaborator.playlist_id == playlist_id,
        PlaylistCollaborator.user_id == user_id
    ).first()
    
    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a collaborator"
        )
    
    db.delete(collaborator)
    db.commit()
    
    return {
        "message": "Collaborator removed",
        "user_id": user_id
    }