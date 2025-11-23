"""
Main FastAPI application
ofatifie - Music Streaming App Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import tracks, auth, admin
from app.routers import tracks, auth, admin, music, playback, albums, library, search, playlists

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

# Register routers
app.include_router(tracks.router)
app.include_router(auth.router)  # ← Added this line
app.include_router(admin.router)
app.include_router(music.router)
app.include_router(playback.router)
app.include_router(albums.router)
app.include_router(library.router)
app.include_router(search.router)
app.include_router(playlists.router)

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