from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional

class Settings(BaseSettings):
    # App
    app_name: str = "MusicStreamingApp"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000
    
    # Security
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 1 week
    
    # Database
    database_url: str = "sqlite:///./music_app.db"
    
    # File Storage
    music_upload_dir: str = "/app/music/uploads"
    music_library_dir: str = "/app/music/library"
    music_temp_dir: str = "/app/music/temp"
    
    # Download Settings
    max_concurrent_downloads: int = 3
    spotdl_format: str = "mp3"
    spotdl_bitrate: str = "320"
    
    # Rate Limiting
    rate_limit_requests: int = 100
    rate_limit_period: int = 60
    
    # Genius API (optional)
    genius_access_token: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = False

@lru_cache()
def get_settings():
    return Settings()