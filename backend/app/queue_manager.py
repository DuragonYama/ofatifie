"""
Download Queue Manager for Music Streaming App

Manages concurrent download requests to prevent server overload.
Implements an in-memory queue system with configurable concurrency limits.
"""

import asyncio
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Deque
from sqlalchemy.orm import Session

from app.models.user import User
from app.config import get_settings


class DownloadStatus(str, Enum):
    """Status enum for download jobs"""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class DownloadType(str, Enum):
    """Type enum for download sources"""
    SPOTIFY = "spotify"
    YOUTUBE = "youtube"


@dataclass
class DownloadJob:
    """Represents a download job in the queue"""
    id: str
    user_id: int
    type: DownloadType
    url: str
    status: DownloadStatus = DownloadStatus.QUEUED
    position: Optional[int] = None
    message: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    result: Optional[Dict] = None

    # Optional parameters for downloads
    tag_id: Optional[int] = None
    global_tag_id: Optional[int] = None

    def to_dict(self) -> Dict:
        """Convert job to dictionary for API responses"""
        return {
            "id": self.id,
            "type": self.type.value,
            "url": self.url,
            "status": self.status.value,
            "position": self.position,
            "message": self.message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "error": self.error,
            "result": self.result
        }


class DownloadQueueManager:
    """
    Singleton queue manager for handling download requests.

    Features:
    - In-memory queue with configurable concurrency limit
    - Automatic queue processing
    - Per-user job tracking
    - Position tracking for queued jobs
    - Job history retention (last 10 completed per user)
    """

    _instance = None
    _lock = asyncio.Lock()

    def __new__(cls):
        """Singleton pattern to ensure single queue manager instance"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        """Initialize the queue manager"""
        if self._initialized:
            return

        settings = get_settings()
        self.max_concurrent = settings.max_concurrent_downloads

        # Main queue (FIFO)
        self.queue: Deque[DownloadJob] = deque()

        # Currently processing jobs {job_id: job}
        self.processing: Dict[str, DownloadJob] = {}

        # Completed jobs by user {user_id: [jobs]}
        self.completed: Dict[int, List[DownloadJob]] = {}

        # Failed jobs by user {user_id: [jobs]}
        self.failed: Dict[int, List[DownloadJob]] = {}

        # All jobs by ID for quick lookup {job_id: job}
        self.jobs: Dict[str, DownloadJob] = {}

        # Lock for thread-safe operations
        self.process_lock = asyncio.Lock()

        # Statistics
        self.total_completed = 0
        self.total_failed = 0

        self._initialized = True

    def generate_job_id(self, user_id: int) -> str:
        """Generate unique job ID"""
        timestamp = int(time.time() * 1000)  # milliseconds
        return f"{user_id}_{timestamp}"

    async def add_job(
        self,
        user_id: int,
        download_type: DownloadType,
        url: str,
        tag_id: Optional[int] = None,
        global_tag_id: Optional[int] = None
    ) -> DownloadJob:
        """
        Add a new download job to the queue

        Args:
            user_id: ID of the user requesting download
            download_type: Type of download (spotify/youtube)
            url: URL to download from
            tag_id: Optional personal tag ID
            global_tag_id: Optional global tag ID

        Returns:
            DownloadJob: The created job
        """
        async with self.process_lock:
            job_id = self.generate_job_id(user_id)

            job = DownloadJob(
                id=job_id,
                user_id=user_id,
                type=download_type,
                url=url,
                tag_id=tag_id,
                global_tag_id=global_tag_id,
                status=DownloadStatus.QUEUED,
                message="Added to queue"
            )

            # Add to queue and job registry
            self.queue.append(job)
            self.jobs[job_id] = job

            # Update positions
            self._update_positions()

        # Start processing (non-blocking)
        asyncio.create_task(self._process_queue())

        return job

    def _update_positions(self):
        """Update position numbers for all queued jobs"""
        for i, job in enumerate(self.queue):
            job.position = i + 1
            job.message = f"Position {job.position} in queue"

    async def _process_queue(self):
        """Process jobs from the queue (background task)"""
        async with self.process_lock:
            # Check if we can process more jobs
            while len(self.processing) < self.max_concurrent and len(self.queue) > 0:
                job = self.queue.popleft()

                # Move to processing
                job.status = DownloadStatus.PROCESSING
                job.position = None
                job.message = "Downloading..."
                job.started_at = datetime.utcnow()

                self.processing[job.id] = job

                # Update positions for remaining queued jobs
                self._update_positions()

                # Job is now in processing state
                # The background process_job_task will execute it

    async def _execute_job(self, job: DownloadJob):
        """
        Execute a download job

        This will be called by the router with the actual download logic.
        The router will call mark_job_completed or mark_job_failed when done.
        """
        # Note: Actual download execution happens in the router
        # This is just a placeholder that will be overridden
        pass

    async def wait_until_processing(self, job_id: str, timeout: int = 3600) -> bool:
        """
        Wait until a job moves to processing status

        Args:
            job_id: Job ID to wait for
            timeout: Maximum time to wait in seconds (default: 1 hour)

        Returns:
            True if job is processing, False if timeout or job not found
        """
        start_time = asyncio.get_event_loop().time()

        while True:
            job = self.get_job(job_id)

            if not job:
                return False

            if job.status == DownloadStatus.PROCESSING:
                return True

            # Check if job failed or completed while waiting
            if job.status in [DownloadStatus.COMPLETED, DownloadStatus.FAILED]:
                return False

            # Check timeout
            if asyncio.get_event_loop().time() - start_time > timeout:
                return False

            # Wait a bit before checking again
            await asyncio.sleep(0.5)

    async def mark_job_completed(self, job_id: str, result: Dict):
        """
        Mark a job as completed

        Args:
            job_id: ID of the job
            result: Result data from the download
        """
        async with self.process_lock:
            if job_id not in self.processing:
                return

            job = self.processing.pop(job_id)
            job.status = DownloadStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            job.message = "Download completed successfully"
            job.result = result

            # Add to completed history
            if job.user_id not in self.completed:
                self.completed[job.user_id] = []

            self.completed[job.user_id].append(job)

            # Keep only last 10 completed jobs per user
            if len(self.completed[job.user_id]) > 10:
                old_job = self.completed[job.user_id].pop(0)
                self.jobs.pop(old_job.id, None)

            self.total_completed += 1

        # Process next job in queue
        await self._process_queue()

    async def mark_job_failed(self, job_id: str, error: str):
        """
        Mark a job as failed

        Args:
            job_id: ID of the job
            error: Error message
        """
        async with self.process_lock:
            if job_id not in self.processing:
                return

            job = self.processing.pop(job_id)
            job.status = DownloadStatus.FAILED
            job.completed_at = datetime.utcnow()
            job.message = "Download failed"
            job.error = error

            # Add to failed history
            if job.user_id not in self.failed:
                self.failed[job.user_id] = []

            self.failed[job.user_id].append(job)

            # Keep only last 10 failed jobs per user
            if len(self.failed[job.user_id]) > 10:
                old_job = self.failed[job.user_id].pop(0)
                self.jobs.pop(old_job.id, None)

            self.total_failed += 1

        # Process next job in queue
        await self._process_queue()

    def get_job(self, job_id: str) -> Optional[DownloadJob]:
        """Get a job by ID"""
        return self.jobs.get(job_id)

    def get_user_jobs(self, user_id: int) -> List[DownloadJob]:
        """
        Get all jobs for a user (queued, processing, completed, failed)

        Args:
            user_id: User ID

        Returns:
            List of jobs sorted by creation time (newest first)
        """
        user_jobs = []

        # Get queued jobs
        for job in self.queue:
            if job.user_id == user_id:
                user_jobs.append(job)

        # Get processing jobs
        for job in self.processing.values():
            if job.user_id == user_id:
                user_jobs.append(job)

        # Get completed jobs
        if user_id in self.completed:
            user_jobs.extend(self.completed[user_id])

        # Get failed jobs
        if user_id in self.failed:
            user_jobs.extend(self.failed[user_id])

        # Sort by creation time (newest first)
        user_jobs.sort(key=lambda j: j.created_at, reverse=True)

        return user_jobs

    def get_queue_info(self) -> Dict:
        """
        Get queue statistics

        Returns:
            Dictionary with queue stats
        """
        return {
            "queue_length": len(self.queue),
            "processing_count": len(self.processing),
            "max_concurrent": self.max_concurrent,
            "completed_count": self.total_completed,
            "failed_count": self.total_failed
        }

    def get_processing_jobs(self) -> List[DownloadJob]:
        """Get all currently processing jobs"""
        return list(self.processing.values())


# Global singleton instance
queue_manager = DownloadQueueManager()
