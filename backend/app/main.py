"""
Main FastAPI application
ofatifie - Music Streaming App Backend
"""
import logging
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import tracks, auth, admin, music, playback, albums, library, search, playlists, tags, lyrics, downloads

# Configure logging filter to exclude noisy polling endpoints
class EndpointFilter(logging.Filter):
    """Filter out health check and polling endpoints from access logs"""
    def filter(self, record: logging.LogRecord) -> bool:
        # List of endpoints to exclude from logs (polling endpoints that spam logs)
        excluded_endpoints = [
            "/downloads/my-jobs",
            "/downloads/queue-info",
            "/health",
            "/playback/now-playing"
        ]
        # Check if any excluded endpoint is in the log message
        return not any(endpoint in record.getMessage() for endpoint in excluded_endpoints)

# Apply filter to uvicorn access logger
logging.getLogger("uvicorn.access").addFilter(EndpointFilter())

settings = get_settings()

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    version="1.0.0"
)

# CORS middleware (allow frontend to connect)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Register routers
app.include_router(tracks.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(music.router)
app.include_router(playback.router)
app.include_router(albums.router)
app.include_router(library.router)
app.include_router(search.router)
app.include_router(playlists.router)
app.include_router(tags.router)
app.include_router(lyrics.router)
app.include_router(downloads.router)

@app.get("/")
def root():
    """Health check endpoint"""
    return {
        "app": settings.app_name,
        "status": "running",
        "version": "1.0.0",
        "message": "ofatifie API"
    }

@app.get("/health")
def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "database": "connected"
    }