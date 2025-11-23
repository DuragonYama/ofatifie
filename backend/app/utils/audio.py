"""
Audio file processing utilities
- Metadata extraction using mutagen
- File hash calculation
- Audio file validation
"""
import hashlib
from pathlib import Path
from typing import Optional, Dict, Any
from mutagen import File as MutagenFile
from mutagen.mp3 import MP3
from mutagen.flac import FLAC
from mutagen.mp4 import MP4
from mutagen.oggvorbis import OggVorbis
from mutagen.wave import WAVE

def calculate_file_hash(file_path: str) -> str:
    """
    Calculate SHA256 hash of audio file for duplicate detection
    
    Args:
        file_path: Path to audio file
        
    Returns:
        Hex string of file hash
    """
    sha256_hash = hashlib.sha256()
    
    with open(file_path, "rb") as f:
        # Read file in chunks to handle large files
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    
    return sha256_hash.hexdigest()

def extract_metadata(file_path: str) -> Dict[str, Any]:
    """
    Extract metadata from audio file using mutagen
    
    Supports: MP3, FLAC, M4A, OGG, WAV
    
    Args:
        file_path: Path to audio file
        
    Returns:
        Dictionary with metadata
    """
    # Load audio file
    audio = MutagenFile(file_path)
    
    if audio is None:
        raise ValueError("Unable to read audio file metadata")
    
    metadata = {
        'title': None,
        'artist': None,
        'album': None,
        'duration_seconds': 0,
        'bitrate_kbps': None,
        'year': None,
        'genre': None
    }
    
    # Extract duration (this works for all formats)
    if hasattr(audio, 'info') and hasattr(audio.info, 'length'):
        metadata['duration_seconds'] = int(audio.info.length)
    
    # Extract bitrate (convert from bps to kbps)
    if hasattr(audio, 'info') and hasattr(audio.info, 'bitrate'):
        metadata['bitrate_kbps'] = int(audio.info.bitrate / 1000)
    
    # Try to get tags using easy mode
    try:
        easy_audio = MutagenFile(file_path, easy=True)
        if easy_audio and easy_audio.tags:
            # Title
            metadata['title'] = _get_easy_tag(easy_audio, 'title')
            # Artist
            metadata['artist'] = _get_easy_tag(easy_audio, 'artist')
            # Album
            metadata['album'] = _get_easy_tag(easy_audio, 'album')
            # Year
            metadata['year'] = _get_easy_tag(easy_audio, 'date')
            # Genre
            metadata['genre'] = _get_easy_tag(easy_audio, 'genre')
    except:
        # If easy mode fails, try raw tags
        if audio.tags:
            metadata['title'] = _get_tag(audio, ['title', 'TIT2', '\xa9nam'])
            metadata['artist'] = _get_tag(audio, ['artist', 'TPE1', '\xa9ART'])
            metadata['album'] = _get_tag(audio, ['album', 'TALB', '\xa9alb'])
            metadata['year'] = _get_tag(audio, ['date', 'TDRC', '\xa9day'])
            metadata['genre'] = _get_tag(audio, ['genre', 'TCON', '\xa9gen'])
    
    return metadata

def _get_easy_tag(audio, tag_name: str) -> Optional[str]:
    """Helper to get tag from easy mode mutagen file"""
    try:
        if tag_name in audio:
            value = audio[tag_name]
            if isinstance(value, list) and len(value) > 0:
                return str(value[0])
            elif value:
                return str(value)
    except:
        pass
    return None

def _get_tag(audio, tag_names: list) -> Optional[str]:
    """
    Helper to get tag value from audio file
    Tries multiple tag name variations
    """
    for tag_name in tag_names:
        try:
            if tag_name in audio.tags:
                value = audio.tags[tag_name]
                if isinstance(value, list) and len(value) > 0:
                    return str(value[0])
                elif value:
                    return str(value)
        except:
            continue
    return None

def validate_audio_file(filename: str) -> tuple[bool, Optional[str]]:
    """
    Validate if file is a supported audio format
    
    Args:
        filename: Name of the file
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    allowed_extensions = ['.mp3', '.flac', '.m4a', '.ogg', '.wav']
    file_ext = Path(filename).suffix.lower()
    
    if file_ext not in allowed_extensions:
        return False, f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
    
    return True, None

def get_file_size_mb(file_path: str) -> float:
    """Get file size in megabytes"""
    return Path(file_path).stat().st_size / (1024 * 1024)