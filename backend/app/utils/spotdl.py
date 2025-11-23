"""
Spotify download utilities using spotdl
"""
import subprocess
import json
from pathlib import Path
from typing import Dict, Any, Optional, List
import tempfile
import os

def parse_spotify_url(url: str) -> Dict[str, Any]:
    """
    Parse Spotify URL to determine type and ID
    
    Supports:
    - Track: https://open.spotify.com/track/ID
    - Album: https://open.spotify.com/album/ID
    - Playlist: https://open.spotify.com/playlist/ID
    
    Returns:
        {
            'type': 'track' | 'album' | 'playlist',
            'id': 'spotify_id',
            'url': 'original_url'
        }
    """
    if not url or 'spotify.com' not in url:
        raise ValueError("Invalid Spotify URL")
    
    # Extract type and ID
    if '/track/' in url:
        spotify_type = 'track'
        spotify_id = url.split('/track/')[-1].split('?')[0]
    elif '/album/' in url:
        spotify_type = 'album'
        spotify_id = url.split('/album/')[-1].split('?')[0]
    elif '/playlist/' in url:
        spotify_type = 'playlist'
        spotify_id = url.split('/playlist/')[-1].split('?')[0]
    else:
        raise ValueError("Unsupported Spotify URL type")
    
    return {
        'type': spotify_type,
        'id': spotify_id,
        'url': url
    }

def download_from_spotify(
    spotify_url: str,
    output_dir: str,
    format: str = 'mp3'
) -> List[Dict[str, Any]]:
    """
    Download audio from Spotify URL using spotdl
    """
    # Validate and parse URL
    parsed = parse_spotify_url(spotify_url)
    
    # Create output directory if it doesn't exist
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Build spotdl command - most basic version
    # spotdl downloads as mp3 by default
    cmd = [
        'spotdl',
        spotify_url,
        '--output', str(output_path)
    ]
    
    try:
        # Run spotdl
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode != 0:
            raise Exception(f"spotdl error: {result.stderr}")
        
        # Find downloaded files (spotdl uses mp3 by default)
        downloaded_files = []
        
        for file_path in output_path.glob('*.mp3'):
            downloaded_files.append({
                'file_path': str(file_path),
                'title': file_path.stem,
                'spotify_url': spotify_url
            })
        
        return downloaded_files
        
    except subprocess.TimeoutExpired:
        raise Exception("Download timeout")
    except Exception as e:
        raise Exception(f"Download failed: {str(e)}")