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
from app.schemas.track import TrackUploadResponse, TrackResponse, TrackUpdate
from app.utils.audio import (
    validate_audio_file, 
    extract_metadata, 
    calculate_file_hash,
    get_file_size_mb,
    extract_cover_art
)

from fastapi.responses import StreamingResponse
import os
from typing import Optional
from app.auth import get_current_user
from jose import JWTError, jwt
from app.config import get_settings

from app.utils.spotdl import download_from_spotify, parse_spotify_url
from app.utils.ytdlp import download_from_youtube, parse_youtube_url
from app.utils.library import link_track_to_album_and_artists

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
            uploaded_by_id=current_user.id,
            year=metadata.get('year'),  
            genre=metadata.get('genre')  
        )
        
        db.add(new_track)

        # Update user's storage usage
        current_user.storage_used_mb += file_size_mb
        
        db.commit()
        db.refresh(new_track)

        link_track_to_album_and_artists(db, new_track, metadata)
        db.commit()
        
        # Extract cover art after track is created (need track.id)
        covers_dir = Path("uploads/covers")
        covers_dir.mkdir(parents=True, exist_ok=True)
        cover_filename = f"cover_{new_track.id}.jpg"
        cover_path = covers_dir / cover_filename
        
        extracted_cover = extract_cover_art(str(final_path), str(cover_path))
        if extracted_cover:
            new_track.cover_path = str(cover_path)
            db.commit()
        
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

@router.post("/download/spotify", status_code=status.HTTP_202_ACCEPTED)
async def download_from_spotify(
    spotify_url: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Download from Spotify URL (track, album, or playlist)
    
    - Single tracks: Downloads and auto-likes
    - Playlists: Creates matching playlist with all tracks
    - Albums: Downloads all tracks and saves to library
    
    Returns:
    - tracks: List of successfully downloaded tracks
    - skipped_tracks: List of tracks that were duplicates
    - playlist: Created playlist info (if URL was playlist)
    - album: Saved album info (if URL was album)
    """
    import subprocess
    import json
    import hashlib
    from pathlib import Path
    from mutagen import File as MutagenFile
    from app.utils.library import link_track_to_album_and_artists
    from app.models.playlist import Playlist, PlaylistSong, LikedSong, UserLibraryItem
    from app.models.music import Album
    
    # Check storage quota
    if current_user.storage_used_mb >= current_user.storage_quota_mb:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Storage quota exceeded"
        )
    
    # Detect URL type (track, playlist, album)
    is_playlist = '/playlist/' in spotify_url
    is_album = '/album/' in spotify_url
    is_track = '/track/' in spotify_url
    
    # Create temp directory
    temp_dir = Path("uploads/temp_downloads")
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Get metadata using spotdl
        result = subprocess.run(
            ['spotdl', spotify_url, '--output', str(temp_dir)],
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"spotdl failed: {result.stderr}"
            )
        
        # Get playlist metadata if it's a playlist
        playlist_name = None
        playlist_description = None
        created_playlist = None
        
        if is_playlist:
            # Extract playlist info from spotdl output or URL
            # spotdl saves playlists with their name, we can parse from files or use spotify API
            # For now, let's use a simple approach with the URL
            try:
                # Get playlist name from spotdl's output directory structure
                # or extract from metadata
                playlist_result = subprocess.run(
                    ['spotdl', spotify_url, '--save-file', str(temp_dir / 'playlist_info.json'), '--format', 'json'],
                    capture_output=True,
                    text=True,
                    timeout=60
                )
                
                # Parse playlist name from URL as fallback
                playlist_name = spotify_url.split('/playlist/')[-1].split('?')[0]
                playlist_name = f"Spotify Playlist {playlist_name[:8]}"  # Fallback name
                
            except:
                playlist_name = "Imported Spotify Playlist"
            
            # Create playlist in database
            created_playlist = Playlist(
                name=playlist_name,
                description=f"Imported from Spotify: {spotify_url}",
                owner_id=current_user.id,
                is_collaborative=False
            )
            db.add(created_playlist)
            db.commit()
            db.refresh(created_playlist)
        
        # Process downloaded files
        downloaded_files = sorted(list(temp_dir.glob("*.mp3")), key=lambda x: x.name)
        
        if not downloaded_files:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No files downloaded"
            )
        
        processed_tracks = []
        skipped_tracks = []
        position = 1.0
        
        for audio_file in downloaded_files:
            try:
                # Extract metadata
                audio = MutagenFile(audio_file, easy=True)
                
                title = audio.get('title', [audio_file.stem])[0] if audio else audio_file.stem
                
                metadata = {
                    'title': title,
                    'artist': audio.get('artist', ['Unknown'])[0] if audio else 'Unknown',
                    'album': audio.get('album', ['Unknown'])[0] if audio else 'Unknown',
                    'year': audio.get('date', [None])[0] if audio else None,
                    'genre': audio.get('genre', [None])[0] if audio else None,
                    'duration_seconds': int(audio.info.length) if audio and hasattr(audio, 'info') else 0,
                    'bitrate_kbps': int(audio.info.bitrate / 1000) if audio and hasattr(audio, 'info') and hasattr(audio.info, 'bitrate') else None
                }
                
                # Calculate hash
                hasher = hashlib.sha256()
                with open(audio_file, 'rb') as f:
                    hasher.update(f.read())
                file_hash = hasher.hexdigest()
                
                # Check for duplicates
                existing = db.query(Track).filter(Track.song_hash == file_hash).first()
                if existing:
                    skipped_tracks.append({
                        'title': title,
                        'reason': 'Already in library'
                    })
                    audio_file.unlink()
                    
                    # Still add to playlist if this was a playlist download
                    if created_playlist:
                        # Check if already in this playlist
                        already_in_playlist = db.query(PlaylistSong).filter(
                            PlaylistSong.playlist_id == created_playlist.id,
                            PlaylistSong.track_id == existing.id
                        ).first()
                        
                        if not already_in_playlist:
                            playlist_song = PlaylistSong(
                                playlist_id=created_playlist.id,
                                track_id=existing.id,
                                position=position,
                                added_by_id=current_user.id
                            )
                            db.add(playlist_song)
                            position += 1.0
                            db.commit()
                    
                    continue
                
                # Move to permanent storage
                music_dir = Path("uploads/music")
                music_dir.mkdir(parents=True, exist_ok=True)
                
                final_filename = f"{file_hash[:12]}_{title[:50]}.mp3"
                final_path = music_dir / final_filename
                
                audio_file.rename(final_path)
                
                # Calculate file size
                file_size_mb = final_path.stat().st_size / (1024 * 1024)
                
                # Create track in database
                new_track = Track(
                    title=title,
                    duration=metadata.get('duration_seconds', 0),
                    file_size_mb=file_size_mb,
                    song_hash=file_hash,
                    audio_path=str(final_path),
                    bitrate=metadata.get('bitrate_kbps'),
                    format='mp3',
                    uploaded_by_id=current_user.id,
                    year=metadata.get('year'),
                    genre=metadata.get('genre')
                )
                
                db.add(new_track)
                
                # Update user's storage
                current_user.storage_used_mb += file_size_mb
                
                # Commit to get track ID, then extract cover
                db.flush()
                
                # Link to album and artists
                link_track_to_album_and_artists(db, new_track, metadata)
                
                # Extract cover art
                covers_dir = Path("uploads/covers")
                covers_dir.mkdir(parents=True, exist_ok=True)
                cover_filename = f"cover_{new_track.id}.jpg"
                cover_path = covers_dir / cover_filename
                
                extracted_cover = extract_cover_art(str(final_path), str(cover_path))
                if extracted_cover:
                    new_track.cover_path = str(cover_path)
                
                db.commit()
                db.refresh(new_track)
                
                # Add to playlist if this was a playlist download
                if created_playlist:
                    playlist_song = PlaylistSong(
                        playlist_id=created_playlist.id,
                        track_id=new_track.id,
                        position=position,
                        added_by_id=current_user.id
                    )
                    db.add(playlist_song)
                    position += 1.0
                
                # Auto-like if single track download
                elif is_track:
                    liked_song = LikedSong(
                        user_id=current_user.id,
                        track_id=new_track.id
                    )
                    db.add(liked_song)
                
                db.commit()
                
                processed_tracks.append({
                    'id': new_track.id,
                    'title': title,
                    'file_size_mb': round(file_size_mb, 2)
                })
                
            except Exception as e:
                print(f"Error processing {audio_file}: {e}")
                if audio_file.exists():
                    audio_file.unlink()
                continue
        
        # Save album to user's library if this was an album download
        if is_album and processed_tracks:
            # Get the album ID from the first processed track
            first_track = db.query(Track).filter(Track.id == processed_tracks[0]['id']).first()
            if first_track and first_track.album_id:
                # Check if already in library
                existing_lib_item = db.query(UserLibraryItem).filter(
                    UserLibraryItem.user_id == current_user.id,
                    UserLibraryItem.item_type == 'album',
                    UserLibraryItem.item_id == first_track.album_id
                ).first()
                
                if not existing_lib_item:
                    library_item = UserLibraryItem(
                        user_id=current_user.id,
                        item_type='album',
                        item_id=first_track.album_id
                    )
                    db.add(library_item)
                    db.commit()
        
        # Clean up temp directory
        for file in temp_dir.iterdir():
            if file.is_file():
                file.unlink()
        
        # Build response
        response = {
            'message': 'Download completed',
            'spotify_url': spotify_url,
            'type': 'playlist' if is_playlist else 'album' if is_album else 'track',
            'processed': len(processed_tracks),
            'skipped': len(skipped_tracks),
            'tracks': processed_tracks,
            'skipped_tracks': skipped_tracks
        }
        
        # Add playlist info if applicable
        if created_playlist:
            response['playlist'] = {
                'id': created_playlist.id,
                'name': created_playlist.name,
                'track_count': len(processed_tracks)
            }
        
        # Add album info if applicable
        if is_album and processed_tracks:
            first_track = db.query(Track).filter(Track.id == processed_tracks[0]['id']).first()
            if first_track and first_track.album_id:
                album = db.query(Album).filter(Album.id == first_track.album_id).first()
                if album:
                    response['album_saved'] = True
                    response['album'] = {
                        'id': album.id,
                        'name': album.name
                    }
        
        # Add auto-like info if applicable
        if is_track and processed_tracks:
            response['auto_liked'] = True
        
        return response
        
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Download timed out"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    
@router.get("/cover/{track_id}")
def get_cover_art(
    track_id: int,
    db: Session = Depends(get_db)
):
    """
    Get track cover art image
    
    Returns the cover image file or 404 if not found
    No authentication required for cover images
    """
    from fastapi.responses import FileResponse
    
    # Get track
    track = db.query(Track).filter(Track.id == track_id).first()
    
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )
    
    # Check if track has cover
    if not track.cover_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track has no cover art"
        )
    
    # Check if file exists
    cover_path = Path(track.cover_path)
    if not cover_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cover art file not found"
        )
    
    # Return the image
    return FileResponse(cover_path, media_type="image/jpeg")

@router.post("/download/youtube", status_code=status.HTTP_202_ACCEPTED)
async def download_from_youtube(
    youtube_url: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Download from YouTube URL (video or playlist)
    
    - Single videos: Downloads and auto-likes
    - Playlists: Creates matching playlist with all tracks
    
    Returns:
    - tracks: List of successfully downloaded tracks
    - skipped_tracks: List of tracks that were duplicates
    - playlist: Created playlist info (if URL was playlist)
    """
    import subprocess
    import json
    import hashlib
    from pathlib import Path
    from mutagen import File as MutagenFile
    from app.utils.library import link_track_to_album_and_artists
    from app.models.playlist import Playlist, PlaylistSong, LikedSong
    
    # Check storage quota
    if current_user.storage_used_mb >= current_user.storage_quota_mb:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Storage quota exceeded"
        )
    
    # Detect if playlist or single video
    is_playlist = 'playlist' in youtube_url or 'list=' in youtube_url
    
    # Create temp directory
    temp_dir = Path("uploads/temp_downloads")
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Download with yt-dlp
        command = [
            'yt-dlp',
            '-x',  # Extract audio
            '--audio-format', 'mp3',
            '--audio-quality', '0',  # Best quality
            '--embed-thumbnail',
            '--add-metadata',
            '-o', str(temp_dir / '%(title)s.%(ext)s'),
            youtube_url
        ]
        
        if is_playlist:
            command.insert(1, '--yes-playlist')
        else:
            command.insert(1, '--no-playlist')
        
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"yt-dlp failed: {result.stderr}"
            )
        
        # Get playlist name if it's a playlist
        created_playlist = None
        playlist_name = None
        
        if is_playlist:
            # Extract playlist title using yt-dlp
            try:
                playlist_info_result = subprocess.run(
                    ['yt-dlp', '--dump-json', '--playlist-items', '1', youtube_url],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if playlist_info_result.returncode == 0:
                    info = json.loads(playlist_info_result.stdout.split('\n')[0])
                    playlist_name = info.get('playlist_title', 'YouTube Playlist')
                else:
                    playlist_name = "YouTube Playlist"
                    
            except:
                playlist_name = "YouTube Playlist"
            
            # Create playlist in database
            created_playlist = Playlist(
                name=playlist_name,
                description=f"Imported from YouTube: {youtube_url}",
                owner_id=current_user.id,
                is_collaborative=False
            )
            db.add(created_playlist)
            db.commit()
            db.refresh(created_playlist)
        
        # Process downloaded files
        downloaded_files = sorted(list(temp_dir.glob("*.mp3")), key=lambda x: x.name)
        
        if not downloaded_files:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No files downloaded"
            )
        
        processed_tracks = []
        skipped_tracks = []
        position = 1.0
        
        for audio_file in downloaded_files:
            try:
                # Extract metadata
                audio = MutagenFile(audio_file, easy=True)
                
                title = audio.get('title', [audio_file.stem])[0] if audio else audio_file.stem
                
                metadata = {
                    'title': title,
                    'artist': audio.get('artist', ['Unknown'])[0] if audio else 'Unknown',
                    'album': audio.get('album', [None])[0] if audio else None,
                    'year': audio.get('date', [None])[0] if audio else None,
                    'genre': audio.get('genre', [None])[0] if audio else None,
                    'duration_seconds': int(audio.info.length) if audio and hasattr(audio, 'info') else 0,
                    'bitrate_kbps': int(audio.info.bitrate / 1000) if audio and hasattr(audio, 'info') and hasattr(audio.info, 'bitrate') else None
                }
                
                # Calculate hash
                hasher = hashlib.sha256()
                with open(audio_file, 'rb') as f:
                    hasher.update(f.read())
                file_hash = hasher.hexdigest()
                
                # Check for duplicates
                existing = db.query(Track).filter(Track.song_hash == file_hash).first()
                if existing:
                    skipped_tracks.append({
                        'title': title,
                        'reason': 'Already in library'
                    })
                    audio_file.unlink()
                    
                    # Still add to playlist if this was a playlist download
                    if created_playlist:
                        # Check if already in this playlist
                        already_in_playlist = db.query(PlaylistSong).filter(
                            PlaylistSong.playlist_id == created_playlist.id,
                            PlaylistSong.track_id == existing.id
                        ).first()
                        
                        if not already_in_playlist:
                            playlist_song = PlaylistSong(
                                playlist_id=created_playlist.id,
                                track_id=existing.id,
                                position=position,
                                added_by_id=current_user.id
                            )
                            db.add(playlist_song)
                            position += 1.0
                            db.commit()
                    
                    continue
                
                # Move to permanent storage
                music_dir = Path("uploads/music")
                music_dir.mkdir(parents=True, exist_ok=True)
                
                final_filename = f"{file_hash[:12]}_{title[:50]}.mp3"
                final_path = music_dir / final_filename
                
                audio_file.rename(final_path)
                
                # Calculate file size
                file_size_mb = final_path.stat().st_size / (1024 * 1024)
                
                # Create track in database
                new_track = Track(
                    title=title,
                    duration=metadata.get('duration_seconds', 0),
                    file_size_mb=file_size_mb,
                    song_hash=file_hash,
                    audio_path=str(final_path),
                    bitrate=metadata.get('bitrate_kbps'),
                    format='mp3',
                    uploaded_by_id=current_user.id,
                    year=metadata.get('year'),
                    genre=metadata.get('genre')
                )
                
                db.add(new_track)
                
                # Update user's storage
                current_user.storage_used_mb += file_size_mb
                
                db.commit()
                db.refresh(new_track)
                
                # Link to album and artists
                link_track_to_album_and_artists(db, new_track, metadata)
                db.commit()
                
                # Extract cover art
                covers_dir = Path("uploads/covers")
                covers_dir.mkdir(parents=True, exist_ok=True)
                cover_filename = f"cover_{new_track.id}.jpg"
                cover_path = covers_dir / cover_filename
                
                if audio and hasattr(audio, 'pictures') and audio.pictures:
                    with open(cover_path, 'wb') as img_file:
                        img_file.write(audio.pictures[0].data)
                    new_track.cover_path = str(cover_path)
                    db.commit()
                
                # Add to playlist if this was a playlist download
                if created_playlist:
                    playlist_song = PlaylistSong(
                        playlist_id=created_playlist.id,
                        track_id=new_track.id,
                        position=position,
                        added_by_id=current_user.id
                    )
                    db.add(playlist_song)
                    position += 1.0
                
                # Auto-like if single video download
                elif not is_playlist:
                    liked_song = LikedSong(
                        user_id=current_user.id,
                        track_id=new_track.id
                    )
                    db.add(liked_song)
                
                db.commit()
                
                processed_tracks.append({
                    'id': new_track.id,
                    'title': title,
                    'file_size_mb': round(file_size_mb, 2)
                })
                
            except Exception as e:
                print(f"Error processing {audio_file}: {e}")
                if audio_file.exists():
                    audio_file.unlink()
                continue
        
        # Clean up temp directory
        for file in temp_dir.iterdir():
            if file.is_file():
                file.unlink()
        
        response = {
            'message': 'Download completed',
            'youtube_url': youtube_url,
            'type': 'playlist' if is_playlist else 'video',
            'processed': len(processed_tracks),
            'skipped': len(skipped_tracks),
            'tracks': processed_tracks,
            'skipped_tracks': skipped_tracks
        }
        
        if created_playlist:
            response['playlist'] = {
                'id': created_playlist.id,
                'name': created_playlist.name,
                'track_count': len(processed_tracks)
            }
        
        if not is_playlist and processed_tracks:
            response['auto_liked'] = True
        
        return response
        
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Download timed out"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    
@router.patch("/tracks/{track_id}", response_model=TrackResponse)
def update_track(
    track_id: int,
    track_update: TrackUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update track metadata (title only)
    
    - Only track owner or DEVELOPER can edit
    """
    # Get track
    track = db.query(Track).filter(Track.id == track_id).first()
    
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )
    
    # Check permissions (owner or developer)
    if track.uploaded_by_id != current_user.id and current_user.role != "DEVELOPER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own tracks"
        )
    
    # Update title if provided
    if track_update.title:
        track.title = track_update.title
    
    db.commit()
    db.refresh(track)
    
    return track

@router.post("/tracks/{track_id}/cover", status_code=status.HTTP_200_OK)
async def upload_track_cover(
    track_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload or replace track cover art
    
    - Accepts: jpg, jpeg, png, webp
    - Max size: 5MB (FastAPI default)
    - Only track owner or DEVELOPER can edit
    """
    # Get track
    track = db.query(Track).filter(Track.id == track_id).first()
    
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )
    
    # Check permissions
    if track.uploaded_by_id != current_user.id and current_user.role != "DEVELOPER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own tracks"
        )
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Allowed: jpg, png, webp"
        )
    
    # Create covers directory
    covers_dir = Path("uploads/covers")
    covers_dir.mkdir(parents=True, exist_ok=True)
    
    # Delete old cover if exists
    if track.cover_path:
        old_cover = Path(track.cover_path)
        if old_cover.exists():
            old_cover.unlink()
    
    # Save new cover as cover_{track_id}.jpg
    cover_filename = f"cover_{track_id}.jpg"
    cover_path = covers_dir / cover_filename
    
    try:
        # Save uploaded file
        with cover_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Convert to JPEG if needed (using PIL)
        from PIL import Image
        img = Image.open(cover_path)
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')
        img.save(cover_path, 'JPEG', quality=90)
        
        # Update track
        track.cover_path = str(cover_path)
        db.commit()
        
        return {
            "message": "Cover art updated successfully",
            "cover_path": str(cover_path)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save cover art: {str(e)}"
        )