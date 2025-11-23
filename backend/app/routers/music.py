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
from app.schemas.track import TrackUploadResponse, TrackResponse
from app.utils.audio import (
    validate_audio_file, 
    extract_metadata, 
    calculate_file_hash,
    get_file_size_mb
)

from fastapi.responses import StreamingResponse
import os
from typing import Optional
from app.auth import get_current_user
from jose import JWTError, jwt
from app.config import get_settings

settings = get_settings()
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

@router.get("/stream/{track_id}")
def stream_track(
    track_id: int,
    token: Optional[str] = None,
    range: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Stream audio file with JWT authentication via query parameter
    
    Usage: /music/stream/1?token=your_jwt_token
    """
    
    # Validate token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    try:
        # Decode JWT token
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        username: str = payload.get("sub")
        
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    # Get track from database
    track = db.query(Track).filter(Track.id == track_id).first()
    
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )
    
    # Check if file exists
    if not os.path.exists(track.audio_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio file not found on disk"
        )
    
    # Get file size
    file_size = os.path.getsize(track.audio_path)
    
    # Parse range header if present
    start = 0
    end = file_size - 1
    
    if range:
        # Range header format: "bytes=start-end"
        range_header = range.replace("bytes=", "")
        range_parts = range_header.split("-")
        
        if range_parts[0]:
            start = int(range_parts[0])
        if len(range_parts) > 1 and range_parts[1]:
            end = int(range_parts[1])
    
    # Calculate content length
    content_length = end - start + 1
    
    # Determine content type based on file extension
    content_types = {
        'mp3': 'audio/mpeg',
        'flac': 'audio/flac',
        'm4a': 'audio/mp4',
        'ogg': 'audio/ogg',
        'wav': 'audio/wav'
    }
    content_type = content_types.get(track.format, 'audio/mpeg')
    
    # Read file chunk
    def file_iterator():
        with open(track.audio_path, 'rb') as f:
            f.seek(start)
            remaining = content_length
            
            while remaining > 0:
                chunk_size = min(8192, remaining)  # 8KB chunks
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk
    
    # Set response headers
    headers = {
        'Content-Range': f'bytes {start}-{end}/{file_size}',
        'Accept-Ranges': 'bytes',
        'Content-Length': str(content_length),
        'Content-Type': content_type,
    }
    
    # Return 206 Partial Content if range requested, else 200
    status_code = 206 if range else 200
    
    return StreamingResponse(
        file_iterator(),
        status_code=status_code,
        headers=headers,
        media_type=content_type
    )

@router.get("/tracks/{track_id}", response_model=TrackResponse)
def get_track(
    track_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get track details by ID"""
    track = db.query(Track).filter(Track.id == track_id).first()
    
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )
    
    return track

@router.get("/tracks", response_model=list[TrackResponse])
def list_tracks(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all tracks
    
    - Paginated results
    - Returns up to 50 tracks per request
    """
    tracks = db.query(Track).offset(skip).limit(limit).all()
    return tracks