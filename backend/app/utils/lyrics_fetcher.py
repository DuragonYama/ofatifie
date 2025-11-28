"""
Lyrics fetching utilities for lrclib and Genius
"""
import requests
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.music import Track, Lyrics

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
    
    Process:
    1. Search for song to get Genius song ID
    2. Scrape the lyrics page (API doesn't return lyrics directly)
    
    Returns:
        Dict with lyrics data, or None if not found
    """
    if not genius_access_token:
        logger.info("Genius access token not configured")
        return None
    
    try:
        from bs4 import BeautifulSoup
        
        # Get track info
        title = track.title
        artist_name = track.artists[0].artist.name if track.artists else "Unknown"
        
        logger.info(f"Fetching lyrics from Genius for: {artist_name} - {title}")
        
        # Step 1: Search for the song
        search_url = "https://api.genius.com/search"
        headers = {"Authorization": f"Bearer {genius_access_token}"}
        params = {"q": f"{artist_name} {title}"}
        
        search_response = requests.get(search_url, headers=headers, params=params, timeout=10)
        search_response.raise_for_status()
        search_data = search_response.json()
        
        # Get first result
        hits = search_data.get("response", {}).get("hits", [])
        if not hits:
            logger.info(f"No results found on Genius for: {artist_name} - {title}")
            return None
        
        song_info = hits[0].get("result", {})
        song_url = song_info.get("url")
        song_title = song_info.get("title")
        
        if not song_url:
            return None
        
        logger.info(f"Found on Genius: {song_title} - {song_url}")
        
        # Step 2: Scrape lyrics from the song page
        page_response = requests.get(song_url, timeout=10)
        page_response.raise_for_status()
        
        soup = BeautifulSoup(page_response.text, 'html.parser')
        
        # Genius lyrics are in div with data-lyrics-container attribute
        lyrics_divs = soup.find_all('div', attrs={'data-lyrics-container': 'true'})
        
        if not lyrics_divs:
            logger.warning(f"Could not find lyrics container on page: {song_url}")
            return None
        
        # Extract text from all lyrics divs
        lyrics_text = ""
        for div in lyrics_divs:
            lyrics_text += div.get_text(separator="\n") + "\n"
        
        lyrics_text = lyrics_text.strip()
        
        if not lyrics_text:
            return None
        
        logger.info(f"Successfully fetched lyrics from Genius for: {artist_name} - {title}")
        
        return {
            "lyrics_text": lyrics_text,
            "synced_lyrics": None,  # Genius doesn't provide synced lyrics
            "is_synced": False,
            "source": "genius",
            "source_url": song_url,
            "language": "en"  # Genius is primarily English
        }
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching from Genius: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error fetching from Genius: {e}")
        return None


def fetch_lyrics_auto(track: Track) -> Optional[Dict[str, Any]]:
    """
    Automatically fetch lyrics from available sources
    
    Tries sources in order:
    1. lrclib (has synced lyrics)
    2. Genius (plain text only)
    
    Returns:
        Dict with lyrics data, or None if not found from any source
    """
    # Try lrclib first (has synced lyrics!)
    lyrics_data = fetch_from_lrclib(track)
    if lyrics_data:
        return lyrics_data
    
    # Try Genius as fallback
    from app.config import get_settings
    settings = get_settings()
    
    if settings.genius_access_token:
        lyrics_data = fetch_from_genius(track, settings.genius_access_token)
        if lyrics_data:
            return lyrics_data
    else:
        logger.info("Genius API token not configured, skipping Genius search")
    
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