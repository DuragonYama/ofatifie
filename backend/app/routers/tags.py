from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.music import Track
from app.models.tags import Tag, SongTag, GlobalTag, GlobalSongTag
from app.schemas.tag import (
    TagCreate, TagUpdate, TagResponse, TagWithCount,
    SongTagCreate, SongTagResponse,
    GlobalTagCreate, GlobalTagUpdate, GlobalTagResponse, GlobalTagWithCount,
    GlobalSongTagCreate, GlobalSongTagResponse
)
from app.routers.auth import get_current_user

router = APIRouter(prefix="/tags", tags=["tags"])

# ============= PERSONAL TAGS =============

@router.get("/", response_model=List[TagWithCount])
def get_my_tags(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all personal tags for current user with track counts"""
    tags = db.query(
        Tag,
        func.count(SongTag.id).label('track_count')
    ).outerjoin(
        SongTag, (SongTag.tag_id == Tag.id) & (SongTag.user_id == current_user.id)
    ).filter(
        Tag.user_id == current_user.id
    ).group_by(Tag.id).all()
    
    return [
        TagWithCount(
            id=tag.id,
            user_id=tag.user_id,
            name=tag.name,
            color=tag.color,
            created_at=tag.created_at,
            track_count=count
        )
        for tag, count in tags
    ]

@router.post("/", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
def create_tag(
    tag_data: TagCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new personal tag"""
    # Check for duplicate tag name for this user
    existing = db.query(Tag).filter(
        Tag.user_id == current_user.id,
        Tag.name == tag_data.name
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You already have a tag named '{tag_data.name}'"
        )
    
    new_tag = Tag(
        user_id=current_user.id,
        name=tag_data.name,
        color=tag_data.color
    )
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    return new_tag

@router.put("/{tag_id}", response_model=TagResponse)
def update_tag(
    tag_id: int,
    tag_data: TagUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a personal tag"""
    tag = db.query(Tag).filter(
        Tag.id == tag_id,
        Tag.user_id == current_user.id
    ).first()
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    # Check for duplicate name if changing name
    if tag_data.name and tag_data.name != tag.name:
        existing = db.query(Tag).filter(
            Tag.user_id == current_user.id,
            Tag.name == tag_data.name
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You already have a tag named '{tag_data.name}'"
            )
    
    if tag_data.name is not None:
        tag.name = tag_data.name
    if tag_data.color is not None:
        tag.color = tag_data.color
    
    db.commit()
    db.refresh(tag)
    return tag

@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(
    tag_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a personal tag (also removes all song associations)"""
    tag = db.query(Tag).filter(
        Tag.id == tag_id,
        Tag.user_id == current_user.id
    ).first()
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    db.delete(tag)
    db.commit()
    return None

# ============= TAG TRACKS (Personal) =============

@router.post("/{tag_id}/tracks/{track_id}", response_model=SongTagResponse, status_code=status.HTTP_201_CREATED)
def tag_track(
    tag_id: int,
    track_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Tag a track with a personal tag"""
    # Verify tag belongs to user
    tag = db.query(Tag).filter(
        Tag.id == tag_id,
        Tag.user_id == current_user.id
    ).first()
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    # Verify track exists
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )
    
    # Check if already tagged
    existing = db.query(SongTag).filter(
        SongTag.user_id == current_user.id,
        SongTag.track_id == track_id,
        SongTag.tag_id == tag_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Track already has this tag"
        )
    
    # Create song tag
    song_tag = SongTag(
        user_id=current_user.id,
        track_id=track_id,
        tag_id=tag_id
    )
    db.add(song_tag)
    db.commit()
    db.refresh(song_tag)
    return song_tag

@router.delete("/{tag_id}/tracks/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
def untag_track(
    tag_id: int,
    track_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a personal tag from a track"""
    song_tag = db.query(SongTag).filter(
        SongTag.user_id == current_user.id,
        SongTag.track_id == track_id,
        SongTag.tag_id == tag_id
    ).first()
    
    if not song_tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not applied to this track"
        )
    
    db.delete(song_tag)
    db.commit()
    return None

@router.get("/{tag_id}/tracks")
def get_tracks_by_tag(
    tag_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tracks with this personal tag"""
    # Verify tag belongs to user
    tag = db.query(Tag).filter(
        Tag.id == tag_id,
        Tag.user_id == current_user.id
    ).first()
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    # Get all tracks with this tag
    tracks = db.query(Track).join(
        SongTag, (SongTag.track_id == Track.id) & (SongTag.user_id == current_user.id)
    ).filter(
        SongTag.tag_id == tag_id
    ).all()
    
    # Use existing track formatter from music router if available
    # For now, return basic track info
    return {"tag": TagResponse.from_orm(tag), "tracks": tracks}

# ============= GLOBAL TAGS =============

@router.get("/global", response_model=List[GlobalTagWithCount])
def get_global_tags(
    db: Session = Depends(get_db),
    tag_type: Optional[str] = None
):
    """Get all global tags (public endpoint) with track counts"""
    query = db.query(
        GlobalTag,
        func.count(GlobalSongTag.id).label('track_count')
    ).outerjoin(
        GlobalSongTag, GlobalSongTag.global_tag_id == GlobalTag.id
    )
    
    if tag_type:
        query = query.filter(GlobalTag.tag_type == tag_type)
    
    tags = query.group_by(GlobalTag.id).all()
    
    return [
        GlobalTagWithCount(
            id=tag.id,
            name=tag.name,
            description=tag.description,
            color=tag.color,
            tag_type=tag.tag_type,
            is_official=tag.is_official,
            created_at=tag.created_at,
            track_count=count
        )
        for tag, count in tags
    ]

@router.post("/global", response_model=GlobalTagResponse, status_code=status.HTTP_201_CREATED)
def create_global_tag(
    tag_data: GlobalTagCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a global tag (DEVELOPER only)"""
    if current_user.role != "DEVELOPER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only developers can create global tags"
        )
    
    # Check for duplicate name
    existing = db.query(GlobalTag).filter(GlobalTag.name == tag_data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Global tag '{tag_data.name}' already exists"
        )
    
    new_tag = GlobalTag(
        name=tag_data.name,
        description=tag_data.description,
        color=tag_data.color,
        created_by_id=current_user.id,
        tag_type=tag_data.tag_type,
        is_official=tag_data.is_official
    )
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    return new_tag

@router.put("/global/{tag_id}", response_model=GlobalTagResponse)
def update_global_tag(
    tag_id: int,
    tag_data: GlobalTagUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a global tag (DEVELOPER only)"""
    if current_user.role != "DEVELOPER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only developers can update global tags"
        )
    
    tag = db.query(GlobalTag).filter(GlobalTag.id == tag_id).first()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global tag not found"
        )
    
    # Check for duplicate name if changing
    if tag_data.name and tag_data.name != tag.name:
        existing = db.query(GlobalTag).filter(GlobalTag.name == tag_data.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Global tag '{tag_data.name}' already exists"
            )
    
    if tag_data.name is not None:
        tag.name = tag_data.name
    if tag_data.description is not None:
        tag.description = tag_data.description
    if tag_data.color is not None:
        tag.color = tag_data.color
    if tag_data.tag_type is not None:
        tag.tag_type = tag_data.tag_type
    if tag_data.is_official is not None:
        tag.is_official = tag_data.is_official
    
    db.commit()
    db.refresh(tag)
    return tag

@router.delete("/global/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_global_tag(
    tag_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a global tag (DEVELOPER only)"""
    if current_user.role != "DEVELOPER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only developers can delete global tags"
        )
    
    tag = db.query(GlobalTag).filter(GlobalTag.id == tag_id).first()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global tag not found"
        )
    
    db.delete(tag)
    db.commit()
    return None

# ============= APPLY GLOBAL TAGS TO TRACKS =============

@router.post("/global/{tag_id}/tracks/{track_id}", response_model=GlobalSongTagResponse, status_code=status.HTTP_201_CREATED)
def apply_global_tag(
    tag_id: int,
    track_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Apply a global tag to a track (any user can do this)"""
    # Verify global tag exists
    tag = db.query(GlobalTag).filter(GlobalTag.id == tag_id).first()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global tag not found"
        )
    
    # Verify track exists
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )
    
    # Check if already applied
    existing = db.query(GlobalSongTag).filter(
        GlobalSongTag.track_id == track_id,
        GlobalSongTag.global_tag_id == tag_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Track already has this global tag"
        )
    
    # Apply global tag
    global_song_tag = GlobalSongTag(
        track_id=track_id,
        global_tag_id=tag_id,
        applied_by_id=current_user.id
    )
    db.add(global_song_tag)
    db.commit()
    db.refresh(global_song_tag)
    return global_song_tag

@router.delete("/global/{tag_id}/tracks/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_global_tag(
    tag_id: int,
    track_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a global tag from a track"""
    global_song_tag = db.query(GlobalSongTag).filter(
        GlobalSongTag.track_id == track_id,
        GlobalSongTag.global_tag_id == tag_id
    ).first()
    
    if not global_song_tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global tag not applied to this track"
        )
    
    # Only DEVELOPER or the person who applied it can remove it
    if current_user.role != "DEVELOPER" and global_song_tag.applied_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only remove global tags you applied (unless you're a developer)"
        )
    
    db.delete(global_song_tag)
    db.commit()
    return None

@router.get("/global/{tag_id}/tracks")
def get_tracks_by_global_tag(
    tag_id: int,
    db: Session = Depends(get_db)
):
    """Get all tracks with this global tag (public endpoint)"""
    # Verify tag exists
    tag = db.query(GlobalTag).filter(GlobalTag.id == tag_id).first()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global tag not found"
        )
    
    # Get all tracks with this tag
    tracks = db.query(Track).join(
        GlobalSongTag, GlobalSongTag.track_id == Track.id
    ).filter(
        GlobalSongTag.global_tag_id == tag_id
    ).all()
    
    return {"tag": GlobalTagResponse.from_orm(tag), "tracks": tracks}