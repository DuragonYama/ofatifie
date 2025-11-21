"""
API Routers
"""
from app.routers import tracks, auth  # ← Added auth

__all__ = ["tracks", "auth"]  # ← Added auth