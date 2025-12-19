"""
Download Queue API Endpoints

Provides queue-based download management to prevent server overload.
"""

import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.queue_manager import (
    queue_manager,
    DownloadJob,
    DownloadType,
    DownloadStatus
)

# Import download executors
from app.routers import music as music_router

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/downloads", tags=["downloads"])


async def execute_spotify_download(job: DownloadJob, db: Session):
    """
    Execute Spotify download for a queued job

    Args:
        job: Download job to execute
        db: Database session
    """
    try:
        # Get the user from database
        user = db.query(User).filter(User.id == job.user_id).first()
        if not user:
            raise Exception(f"User {job.user_id} not found")

        # Import here to avoid circular dependency
        from app.routers.music import download_from_spotify as spotify_download_impl

        # Call the original download function
        # We need to extract the logic or call it directly
        result = await _execute_spotify_download_logic(
            spotify_url=job.url,
            tag_id=job.tag_id,
            global_tag_id=job.global_tag_id,
            user=user,
            db=db
        )

        # Mark job as completed
        await queue_manager.mark_job_completed(job.id, result)

    except Exception as e:
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        logger.error(f"Spotify download failed for job {job.id}: {error_msg}")
        await queue_manager.mark_job_failed(job.id, str(e))


async def execute_youtube_download(job: DownloadJob, db: Session):
    """
    Execute YouTube download for a queued job

    Args:
        job: Download job to execute
        db: Database session
    """
    try:
        # Get the user from database
        user = db.query(User).filter(User.id == job.user_id).first()
        if not user:
            raise Exception(f"User {job.user_id} not found")

        # Call the YouTube download logic
        result = await _execute_youtube_download_logic(
            youtube_url=job.url,
            tag_id=job.tag_id,
            global_tag_id=job.global_tag_id,
            user=user,
            db=db
        )

        # Mark job as completed
        await queue_manager.mark_job_completed(job.id, result)

    except Exception as e:
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        logger.error(f"YouTube download failed for job {job.id}: {error_msg}")
        await queue_manager.mark_job_failed(job.id, str(e))


async def _execute_spotify_download_logic(
    spotify_url: str,
    tag_id: Optional[int],
    global_tag_id: Optional[int],
    user: User,
    db: Session
):
    """
    Execute the actual Spotify download logic
    This is extracted from the music router to be reusable
    """
    import asyncio
    import hashlib
    from pathlib import Path
    from mutagen import File as MutagenFile
    from app.utils.library import link_track_to_album_and_artists
    from app.models.playlist import Playlist, PlaylistSong, LikedSong, UserLibraryItem
    from app.models.music import Album, Track
    from app.utils.tagging import apply_tag_to_track, apply_global_tag_to_track
    from app.utils.audio import get_file_size_mb, extract_cover_art

    logger.info(f"Starting Spotify download for user {user.id}: {spotify_url}")

    # Check storage quota
    if user.storage_used_mb >= user.storage_quota_mb:
        raise Exception("Storage quota exceeded")

    # Detect URL type
    is_playlist = '/playlist/' in spotify_url
    is_album = '/album/' in spotify_url
    is_track = '/track/' in spotify_url

    # Create temp directory
    temp_dir = Path(f"uploads/temp_downloads/user_{user.id}_{hash(spotify_url) % 100000}")
    temp_dir.mkdir(parents=True, exist_ok=True)

    try:
        # Run spotdl in thread pool (non-blocking, Windows-compatible)
        import subprocess
        import os

        # Set UTF-8 encoding for subprocess to handle Unicode characters
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'

        result = await asyncio.to_thread(
            subprocess.run,
            ['spotdl', spotify_url, '--output', str(temp_dir)],
            capture_output=True,
            text=True,
            timeout=300,
            env=env
        )

        if result.returncode != 0:
            raise Exception(f"spotdl failed: {result.stderr}")

        # Process downloaded files
        mp3_files = list(temp_dir.glob("*.mp3"))

        if not mp3_files:
            raise Exception("No MP3 files were downloaded")

        processed_tracks = []
        skipped_tracks = []
        created_playlist = None
        saved_album = None

        # Create playlist if needed
        if is_playlist:
            playlist_name = f"Imported from Spotify"
            created_playlist = Playlist(
                name=playlist_name,
                owner_id=user.id,
                description=f"Imported from {spotify_url}"
            )
            db.add(created_playlist)
            db.commit()
            db.refresh(created_playlist)

        # Process each downloaded file
        position = 1
        for mp3_file in mp3_files:
            try:
                # Extract metadata
                audio = MutagenFile(str(mp3_file), easy=True)
                if audio is None:
                    logger.warning(f"Could not read metadata from {mp3_file}")
                    continue

                title = audio.get('title', [mp3_file.stem])[0]
                artist_name = audio.get('artist', ['Unknown Artist'])[0]
                album_title = audio.get('album', ['Unknown Album'])[0]
                duration = int(audio.info.length) if hasattr(audio, 'info') else 0

                # Calculate hash
                with open(mp3_file, 'rb') as f:
                    file_hash = hashlib.sha256(f.read()).hexdigest()

                # Check for duplicate
                existing_track = db.query(Track).filter(Track.song_hash == file_hash).first()

                if existing_track:
                    logger.info(f"Track already exists: {title}")
                    skipped_tracks.append({
                        "title": title,
                        "reason": "Already in library",
                        "id": existing_track.id
                    })

                    # Apply tags to duplicate
                    if tag_id:
                        apply_tag_to_track(db, existing_track.id, tag_id, user.id)
                    if global_tag_id:
                        apply_global_tag_to_track(db, existing_track.id, global_tag_id, user.id)

                    # Add to playlist if playlist download
                    if created_playlist:
                        playlist_song = PlaylistSong(
                            playlist_id=created_playlist.id,
                            track_id=existing_track.id,
                            position=position,
                            added_by_id=user.id
                        )
                        db.add(playlist_song)

                    position += 1
                    continue

                # Get file size
                file_size_mb = get_file_size_mb(str(mp3_file))

                # Check quota again
                if user.storage_used_mb + file_size_mb > user.storage_quota_mb:
                    logger.warning(f"Storage quota exceeded, skipping {title}")
                    continue

                # Save file - sanitize filename for Windows
                import re
                # Remove invalid Windows filename characters: < > : " / \ | ? *
                sanitized_title = re.sub(r'[<>:"/\\|?*]', '', title)
                # Also remove any leading/trailing whitespace and dots
                sanitized_title = sanitized_title.strip('. ')
                final_filename = f"{file_hash[:12]}_{sanitized_title}.mp3"
                final_path = Path("uploads/music") / final_filename
                final_path.parent.mkdir(parents=True, exist_ok=True)

                mp3_file.rename(final_path)

                # Create track record
                track = Track(
                    title=title,
                    duration=duration,
                    audio_path=str(final_path),
                    file_size_mb=file_size_mb,
                    song_hash=file_hash,
                    uploaded_by_id=user.id,
                    format="mp3"
                )

                db.add(track)
                db.flush()

                # Link to album and artists
                metadata = {
                    'title': title,
                    'artist': artist_name,
                    'album': album_title
                }
                link_track_to_album_and_artists(db, track, metadata)

                # Extract cover art
                try:
                    from pathlib import Path as PathLib
                    cover_path = PathLib("uploads/covers") / f"cover_{track.id}.jpg"
                    cover_path.parent.mkdir(parents=True, exist_ok=True)

                    extracted_cover = extract_cover_art(str(final_path), str(cover_path))
                    if extracted_cover:
                        track.cover_path = str(cover_path)
                except Exception as e:
                    logger.warning(f"Failed to extract cover art: {e}")

                # Auto-fetch lyrics (silent fail - doesn't block download)
                try:
                    from app.utils.lyrics_fetcher import save_lyrics_for_track
                    save_lyrics_for_track(db, track)
                    logger.info(f"  -> Fetched lyrics for {title}")
                except Exception as e:
                    logger.warning(f"  -> Failed to fetch lyrics: {e}")

                # Update user storage
                user.storage_used_mb += file_size_mb

                # Apply tags
                if tag_id:
                    apply_tag_to_track(db, track.id, tag_id, user.id)
                if global_tag_id:
                    apply_global_tag_to_track(db, track.id, global_tag_id, user.id)

                # Add to playlist if needed
                if created_playlist:
                    playlist_song = PlaylistSong(
                        playlist_id=created_playlist.id,
                        track_id=track.id,
                        position=position,
                        added_by_id=user.id
                    )
                    db.add(playlist_song)

                # Auto-like single tracks
                if is_track:
                    liked = LikedSong(user_id=user.id, track_id=track.id)
                    db.add(liked)

                # Save album to library if album download
                if is_album and track.album_id:
                    existing_lib_item = db.query(UserLibraryItem).filter(
                        UserLibraryItem.user_id == user.id,
                        UserLibraryItem.item_type == 'album',
                        UserLibraryItem.item_id == track.album_id
                    ).first()

                    if not existing_lib_item:
                        lib_item = UserLibraryItem(
                            user_id=user.id,
                            item_type='album',
                            item_id=track.album_id
                        )
                        db.add(lib_item)
                        saved_album = track.album_id

                processed_tracks.append({
                    "id": track.id,
                    "title": track.title,
                    "file_size_mb": track.file_size_mb
                })

                position += 1
                db.commit()

            except Exception as e:
                logger.error(f"Error processing {mp3_file}: {e}")
                db.rollback()
                continue

        # Commit all changes
        db.commit()

        # Cleanup temp directory
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

        # Return result
        return {
            "message": "Download completed",
            "spotify_url": spotify_url,
            "type": "playlist" if is_playlist else "album" if is_album else "track",
            "processed": len(processed_tracks),
            "skipped": len(skipped_tracks),
            "tracks": processed_tracks,
            "skipped_tracks": skipped_tracks,
            "playlist": {
                "id": created_playlist.id,
                "name": created_playlist.name,
                "track_count": len(processed_tracks) + len(skipped_tracks)
            } if created_playlist else None,
            "auto_liked": is_track,
            "album_saved": saved_album is not None
        }

    except Exception as e:
        # Cleanup on error
        import shutil
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
        raise e


async def _execute_youtube_download_logic(
    youtube_url: str,
    tag_id: Optional[int],
    global_tag_id: Optional[int],
    user: User,
    db: Session
):
    """
    Execute the actual YouTube download logic
    This is extracted from the music router to be reusable
    """
    import asyncio
    import hashlib
    from pathlib import Path
    from mutagen import File as MutagenFile
    from app.utils.library import link_track_to_album_and_artists
    from app.models.playlist import Playlist, PlaylistSong, LikedSong
    from app.models.music import Track
    from app.utils.tagging import apply_tag_to_track, apply_global_tag_to_track
    from app.utils.audio import get_file_size_mb, extract_cover_art

    logger.info(f"Starting YouTube download for user {user.id}: {youtube_url}")

    # Check storage quota
    if user.storage_used_mb >= user.storage_quota_mb:
        raise Exception("Storage quota exceeded")

    # Detect if playlist
    is_playlist = 'playlist' in youtube_url or 'list=' in youtube_url

    # Create temp directory
    temp_dir = Path(f"uploads/temp_downloads/user_{user.id}_{hash(youtube_url) % 100000}")
    temp_dir.mkdir(parents=True, exist_ok=True)

    try:
        # Run yt-dlp in thread pool (non-blocking, Windows-compatible)
        import subprocess
        cmd = [
            'yt-dlp',
            '-x',  # Extract audio
            '--audio-format', 'mp3',
            '--audio-quality', '0',  # Best quality
            '-o', str(temp_dir / '%(title)s.%(ext)s'),
            youtube_url
        ]

        result = await asyncio.to_thread(
            subprocess.run,
            cmd,
            capture_output=True,
            text=True,
            timeout=600
        )

        if result.returncode != 0:
            raise Exception(f"yt-dlp failed: {result.stderr}")

        # Process downloaded files
        mp3_files = list(temp_dir.glob("*.mp3"))

        if not mp3_files:
            raise Exception("No MP3 files were downloaded")

        processed_tracks = []
        skipped_tracks = []
        created_playlist = None

        # Create playlist if needed
        if is_playlist:
            playlist_name = "Imported from YouTube"
            created_playlist = Playlist(
                name=playlist_name,
                owner_id=user.id,
                description=f"Imported from {youtube_url}"
            )
            db.add(created_playlist)
            db.commit()
            db.refresh(created_playlist)

        # Process each file
        position = 1
        for mp3_file in mp3_files:
            try:
                # Extract metadata
                audio = MutagenFile(str(mp3_file), easy=True)
                title = mp3_file.stem if audio is None else audio.get('title', [mp3_file.stem])[0]
                artist_name = 'Unknown Artist' if audio is None else audio.get('artist', ['Unknown Artist'])[0]
                duration = int(audio.info.length) if audio and hasattr(audio, 'info') else 0

                # Calculate hash
                with open(mp3_file, 'rb') as f:
                    file_hash = hashlib.sha256(f.read()).hexdigest()

                # Check for duplicate
                existing_track = db.query(Track).filter(Track.song_hash == file_hash).first()

                if existing_track:
                    logger.info(f"Track already exists: {title}")
                    skipped_tracks.append({
                        "title": title,
                        "reason": "Already in library",
                        "id": existing_track.id
                    })

                    # Apply tags
                    if tag_id:
                        apply_tag_to_track(db, existing_track.id, tag_id, user.id)
                    if global_tag_id:
                        apply_global_tag_to_track(db, existing_track.id, global_tag_id, user.id)

                    # Add to playlist
                    if created_playlist:
                        playlist_song = PlaylistSong(
                            playlist_id=created_playlist.id,
                            track_id=existing_track.id,
                            position=position,
                            added_by_id=user.id
                        )
                        db.add(playlist_song)

                    position += 1
                    continue

                # Get file size
                file_size_mb = get_file_size_mb(str(mp3_file))

                # Check quota
                if user.storage_used_mb + file_size_mb > user.storage_quota_mb:
                    logger.warning(f"Storage quota exceeded, skipping {title}")
                    continue

                # Save file - sanitize filename for Windows
                import re
                # Remove invalid Windows filename characters: < > : " / \ | ? *
                sanitized_title = re.sub(r'[<>:"/\\|?*]', '', title)
                # Also remove any leading/trailing whitespace and dots
                sanitized_title = sanitized_title.strip('. ')
                final_filename = f"{file_hash[:12]}_{sanitized_title}.mp3"
                final_path = Path("uploads/music") / final_filename
                final_path.parent.mkdir(parents=True, exist_ok=True)

                mp3_file.rename(final_path)

                # Create track
                track = Track(
                    title=title,
                    duration=duration,
                    audio_path=str(final_path),
                    file_size_mb=file_size_mb,
                    song_hash=file_hash,
                    uploaded_by_id=user.id,
                    format="mp3"
                )

                db.add(track)
                db.flush()

                # Link to album/artists
                metadata = {'title': title, 'artist': artist_name}
                link_track_to_album_and_artists(db, track, metadata)

                # Extract cover
                try:
                    from pathlib import Path as PathLib
                    cover_path = PathLib("uploads/covers") / f"cover_{track.id}.jpg"
                    cover_path.parent.mkdir(parents=True, exist_ok=True)

                    extracted_cover = extract_cover_art(str(final_path), str(cover_path))
                    if extracted_cover:
                        track.cover_path = str(cover_path)
                except Exception as e:
                    logger.warning(f"Failed to extract cover art: {e}")

                # Auto-fetch lyrics (silent fail - doesn't block download)
                try:
                    from app.utils.lyrics_fetcher import save_lyrics_for_track
                    save_lyrics_for_track(db, track)
                    logger.info(f"  -> Fetched lyrics for {title}")
                except Exception as e:
                    logger.warning(f"  -> Failed to fetch lyrics: {e}")

                # Update storage
                user.storage_used_mb += file_size_mb

                # Apply tags
                if tag_id:
                    apply_tag_to_track(db, track.id, tag_id, user.id)
                if global_tag_id:
                    apply_global_tag_to_track(db, track.id, global_tag_id, user.id)

                # Add to playlist
                if created_playlist:
                    playlist_song = PlaylistSong(
                        playlist_id=created_playlist.id,
                        track_id=track.id,
                        position=position,
                        added_by_id=user.id
                    )
                    db.add(playlist_song)

                # Auto-like single videos
                if not is_playlist:
                    liked = LikedSong(user_id=user.id, track_id=track.id)
                    db.add(liked)

                processed_tracks.append({
                    "id": track.id,
                    "title": track.title,
                    "file_size_mb": track.file_size_mb
                })

                position += 1
                db.commit()

            except Exception as e:
                logger.error(f"Error processing {mp3_file}: {e}")
                db.rollback()
                continue

        # Commit all
        db.commit()

        # Cleanup
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

        return {
            "message": "Download completed",
            "youtube_url": youtube_url,
            "type": "playlist" if is_playlist else "video",
            "processed": len(processed_tracks),
            "skipped": len(skipped_tracks),
            "tracks": processed_tracks,
            "skipped_tracks": skipped_tracks,
            "playlist": {
                "id": created_playlist.id,
                "name": created_playlist.name,
                "track_count": len(processed_tracks) + len(skipped_tracks)
            } if created_playlist else None,
            "auto_liked": not is_playlist
        }

    except Exception as e:
        # Cleanup on error
        import shutil
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
        raise e


# Background task to process jobs from queue
async def process_job_task(job_id: str):
    """
    Background task to process a download job

    Waits until the queue manager allows this job to execute,
    then performs the download and updates the job status.
    """
    from app.database import SessionLocal

    try:
        # Wait until the queue manager moves this job to processing
        is_ready = await queue_manager.wait_until_processing(job_id, timeout=3600)

        if not is_ready:
            logger.warning(f"Job {job_id} never reached processing state")
            return

        # Get job details
        job = queue_manager.get_job(job_id)
        if not job:
            logger.error(f"Job {job_id} not found after becoming ready")
            return

        # Create new database session for this task
        db = SessionLocal()

        try:
            # Execute based on type
            if job.type == DownloadType.SPOTIFY:
                await execute_spotify_download(job, db)
            elif job.type == DownloadType.YOUTUBE:
                await execute_youtube_download(job, db)
            else:
                logger.error(f"Unknown job type: {job.type}")
                await queue_manager.mark_job_failed(job_id, f"Unknown job type: {job.type}")

        except Exception as e:
            logger.error(f"Error processing job {job_id}: {e}")
            # Job will be marked as failed by the execute functions

        finally:
            db.close()

    except Exception as e:
        logger.error(f"Critical error in process_job_task for {job_id}: {e}")
        await queue_manager.mark_job_failed(job_id, str(e))


@router.post("/queue", status_code=status.HTTP_202_ACCEPTED)
async def add_to_queue(
    url: str,
    download_type: str,  # "spotify" or "youtube"
    tag_id: Optional[int] = None,
    global_tag_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a download to the queue

    Args:
        url: Spotify or YouTube URL
        download_type: "spotify" or "youtube"
        tag_id: Optional personal tag ID
        global_tag_id: Optional global tag ID

    Returns:
        Job information with queue position
    """
    # Validate download type
    if download_type not in ["spotify", "youtube"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="download_type must be 'spotify' or 'youtube'"
        )

    # Convert to enum
    dl_type = DownloadType.SPOTIFY if download_type == "spotify" else DownloadType.YOUTUBE

    # Add to queue
    job = await queue_manager.add_job(
        user_id=current_user.id,
        download_type=dl_type,
        url=url,
        tag_id=tag_id,
        global_tag_id=global_tag_id
    )

    # Start background processing for this job when it's its turn
    # The queue manager will handle scheduling
    asyncio.create_task(process_job_task(job.id))

    return job.to_dict()


@router.get("/my-jobs")
async def get_my_jobs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all download jobs for the current user

    Returns jobs sorted by creation time (newest first)
    """
    jobs = queue_manager.get_user_jobs(current_user.id)

    return {
        "jobs": [job.to_dict() for job in jobs]
    }


@router.get("/status/{job_id}")
async def get_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get status of a specific download job

    Args:
        job_id: Job ID

    Returns:
        Job information
    """
    job = queue_manager.get_job(job_id)

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )

    # Verify user owns this job
    if job.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this job"
        )

    return job.to_dict()


@router.get("/queue-info")
async def get_queue_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get overall queue statistics

    Returns:
        Queue information (length, processing count, etc.)
    """
    return queue_manager.get_queue_info()
