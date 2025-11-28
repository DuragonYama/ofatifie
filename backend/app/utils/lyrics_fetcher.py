"""
Lyrics fetching utilities for lrclib and Genius
"""
import requests
from typing import Optional, Dict, Any
from app.models.music import Track
import logging

logger = logging.getLogger(__name__)


class LyricsNotFoundError(Exception):
    """Raised when lyrics are not found"""
    pass


def fetch_from_lrclib(track: Track) -> Optional[Dict[str, Any]]:
    """
    Fetch lyrics from lrclib.net
    
    Returns:
        Dict with 'plainLyrics' and 'syncedLyrics' keys, or None if not found
    """
    try:
        # Get track info
        title = track.title
        artist_name = track.artists[0].artist.name if track.artists else "Unknown"
        album_name = track.album.name if track.album else ""
        duration = track.duration  # in seconds
        
        # Build request URL
        url = "https://lrclib.net/api/get"
        params = {
            "artist_name": artist_name,
            "track_name": title,
            "album_name": album_name,
            "duration": duration
        }
        
        logger.info(f"Fetching lyrics from lrclib for: {artist_name} - {title}")
        
        # Make request
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 404:
            logger.info(f"No lyrics found on lrclib for: {artist_name} - {title}")
            return None
        
        response.raise_for_status()
        data = response.json()
        
        # lrclib returns:
        # - plainLyrics: plain text lyrics
        # - syncedLyrics: LRC format with timestamps
        
        if not data.get("plainLyrics") and not data.get("syncedLyrics"):
            return None
        
        logger.info(f"Successfully fetched lyrics from lrclib for: {artist_name} - {title}")
        
        return {
            "lyrics_text": data.get("plainLyrics"),
            "synced_lyrics": data.get("syncedLyrics"),
            "is_synced": bool(data.get("syncedLyrics")),
            "source": "lrclib",
            "source_url": f"https://lrclib.net/api/get?track_name={title}&artist_name={artist_name}",
            "language": "en"  # lrclib doesn't specify language, assume English
        }
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching from lrclib: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error fetching from lrclib: {e}")
        return None


def fetch_from_genius(track: Track, genius_access_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Fetch lyrics from Genius API
    
    NOTE: This is a placeholder. Genius requires API key + web scraping.
    We'll implement this in Phase 9.2
    
    Returns:
        Dict with lyrics data, or None if not found
    """
    logger.info("Genius fetcher not yet implemented")
    return None


def fetch_lyrics_auto(track: Track) -> Optional[Dict[str, Any]]:
    """
    Automatically fetch lyrics from available sources
    
    Tries sources in order:
    1. lrclib (has synced lyrics)
    2. Genius (plain text only - TODO)
    
    Returns:
        Dict with lyrics data, or None if not found from any source
    """
    # Try lrclib first (has synced lyrics!)
    lyrics_data = fetch_from_lrclib(track)
    if lyrics_data:
        return lyrics_data
    
    # Try Genius as fallback (TODO: implement)
    lyrics_data = fetch_from_genius(track)
    if lyrics_data:
        return lyrics_data
    
    # No lyrics found from any source
    logger.info(f"No lyrics found from any source for track: {track.title}")
    return None
def save_lyrics_for_track(db: Session, track: Track) -> bool:
    """
    Fetch and save lyrics for a track (used during auto-fetch)
    
    Returns:
        True if lyrics were fetched and saved, False otherwise
    """
    try:
        # Check if lyrics already exist
        existing = db.query(Lyrics).filter(Lyrics.track_id == track.id).first()
        if existing:
            logger.info(f"Lyrics already exist for track {track.id}, skipping")
            return False
        
        # Try to fetch lyrics
        lyrics_data = fetch_lyrics_auto(track)
        
        if not lyrics_data:
            logger.info(f"No lyrics found for track: {track.title}")
            return False
        
        # Save lyrics
        new_lyrics = Lyrics(
            track_id=track.id,
            **lyrics_data
        )
        db.add(new_lyrics)
        db.commit()
        
        logger.info(f"Successfully saved lyrics for track: {track.title} from {lyrics_data['source']}")
        return True
        
    except Exception as e:
        logger.error(f"Error auto-fetching lyrics for track {track.id}: {e}")
        db.rollback()
        return False