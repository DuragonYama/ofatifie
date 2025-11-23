"""
YouTube download utilities using yt-dlp
"""
import subprocess
import json
from pathlib import Path
from typing import Dict, Any, Optional, List

def parse_youtube_url(url: str) -> Dict[str, Any]:
    """
    Parse YouTube URL to validate and extract video ID
    
    Supports:
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    - https://music.youtube.com/watch?v=VIDEO_ID
    
    Returns:
        {
            'video_id': 'youtube_video_id',
            'url': 'original_url'
        }
    """
    if not url or ('youtube.com' not in url and 'youtu.be' not in url):
        raise ValueError("Invalid YouTube URL")
    
    # Extract video ID
    video_id = None
    
    if 'watch?v=' in url:
        video_id = url.split('watch?v=')[-1].split('&')[0]
    elif 'youtu.be/' in url:
        video_id = url.split('youtu.be/')[-1].split('?')[0]
    
    if not video_id:
        raise ValueError("Could not extract video ID from URL")
    
    return {
        'video_id': video_id,
        'url': url
    }

def download_from_youtube(
    youtube_url: str,
    output_dir: str,
    format: str = 'mp3'
) -> Dict[str, Any]:
    """
    Download audio from YouTube URL using yt-dlp
    
    Args:
        youtube_url: YouTube video URL
        output_dir: Directory to save download
        format: Audio format (mp3, m4a, opus)
    
    Returns:
        {
            'file_path': 'path/to/downloaded.mp3',
            'title': 'Video Title',
            'youtube_url': 'original_url'
        }
    """
    # Validate URL
    parsed = parse_youtube_url(youtube_url)
    
    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Output template
    output_template = str(output_path / '%(title)s.%(ext)s')
    
    # Build yt-dlp command
    cmd = [
        'yt-dlp',
        youtube_url,
        '--extract-audio',
        '--audio-format', format,
        '--audio-quality', '0',  # Best quality
        '--output', output_template,
        '--no-playlist',  # Only download single video
        '--quiet',
        '--no-warnings'
    ]
    
    try:
        # Run yt-dlp
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode != 0:
            raise Exception(f"yt-dlp failed: {result.stderr}")
        
        # Find downloaded file
        downloaded_files = list(output_path.glob(f'*.{format}'))
        
        if not downloaded_files:
            raise Exception("No file downloaded")
        
        # Get the most recently created file
        downloaded_file = max(downloaded_files, key=lambda p: p.stat().st_ctime)
        
        return {
            'file_path': str(downloaded_file),
            'title': downloaded_file.stem,
            'youtube_url': youtube_url
        }
        
    except subprocess.TimeoutExpired:
        raise Exception("Download timeout")
    except Exception as e:
        raise Exception(f"Download failed: {str(e)}")

def get_youtube_metadata(youtube_url: str) -> Dict[str, Any]:
    """
    Get metadata about YouTube video without downloading
    
    Returns title, duration, uploader, etc.
    """
    try:
        cmd = [
            'yt-dlp',
            youtube_url,
            '--dump-json',
            '--no-playlist'
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            return {'error': 'Failed to fetch metadata'}
        
        metadata = json.loads(result.stdout)
        return {
            'title': metadata.get('title'),
            'duration': metadata.get('duration'),
            'uploader': metadata.get('uploader'),
            'thumbnail': metadata.get('thumbnail')
        }
        
    except Exception as e:
        return {'error': str(e)}