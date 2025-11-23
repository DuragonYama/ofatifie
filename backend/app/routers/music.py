"""
Music upload and management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from pathlib import Path
import shutil

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.music import Track
from app.schemas.track import TrackUploadResponse
from app.utils.audio import (
    validate_audio_file, 
    extract_metadata, 
    calculate_file_hash,
    get_file_size_mb
)

router = APIRouter(prefix="/music", tags=["music"])

@router.post("/upload", response_model=TrackUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_track(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload an audio file
    
    - Validates audio format (mp3, flac, m4a, ogg, wav)
    - Extracts metadata (title, artist, album, duration)
    - Checks for duplicates via file hash
    - Enforces storage quota
    - Saves to filesystem and database
    """
    
    # Validate file type
    is_valid, error_msg = validate_audio_file(file.filename)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Create upload directory if it doesn't exist
    upload_dir = Path("uploads/music")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Create temporary file path
    temp_path = upload_dir / f"temp_{file.filename}"
    
    try:
        # Save uploaded file temporarily
        with temp_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Get file size
        file_size_mb = get_file_size_mb(str(temp_path))
        
        # Check storage quota
        if current_user.storage_used_mb + file_size_mb > current_user.storage_quota_mb:
            temp_path.unlink()  # Delete temp file
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Storage quota exceeded. Used: {current_user.storage_used_mb}MB / {current_user.storage_quota_mb}MB"
            )
        
        # Calculate file hash for duplicate detection
        file_hash = calculate_file_hash(str(temp_path))
        
        # Check if file already exists
        existing_track = db.query(Track).filter(Track.song_hash == file_hash).first()
        if existing_track:
            temp_path.unlink()  # Delete temp file
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"This file already exists: {existing_track.title}"
            )
        
        # Extract metadata
        metadata = extract_metadata(str(temp_path))
        
        # Use filename as title if metadata doesn't have one
        title = metadata.get('title') or Path(file.filename).stem
        
        # Generate final filename: {hash[:12]}_{sanitized_title}.{ext}
        file_ext = Path(file.filename).suffix
        sanitized_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip()
        final_filename = f"{file_hash[:12]}_{sanitized_title}{file_ext}"
        final_path = upload_dir / final_filename
        
        # Rename temp file to final name
        temp_path.rename(final_path)
        
        # Get duration and bitrate from metadata
        duration_sec = metadata.get('duration_seconds', 0)
        bitrate_val = metadata.get('bitrate_kbps')
        
        # Create track in database
        new_track = Track(
            title=title,
            duration=duration_sec,
            file_size_mb=file_size_mb,
            song_hash=file_hash,
            audio_path=str(final_path),
            bitrate=bitrate_val,
            format=file_ext[1:].lower() if file_ext else None,
            uploaded_by_id=current_user.id
        )
        
        db.add(new_track)
        
        # Update user's storage usage
        current_user.storage_used_mb += file_size_mb
        
        db.commit()
        db.refresh(new_track)
        
        # Build response manually to avoid any attribute issues
        response = TrackUploadResponse(
            id=new_track.id,
            title=new_track.title,
            duration=new_track.duration,
            file_size_mb=float(new_track.file_size_mb),
            song_hash=new_track.song_hash,
            audio_path=new_track.audio_path,
            message="Track uploaded successfully"
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        # Clean up on error
        if temp_path.exists():
            temp_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process audio file: {str(e)}"
        )