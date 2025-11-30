import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary">Welcome, {user?.username}!</h1>
            <p className="text-muted-foreground mt-1">
              Storage: {user?.storage_used_mb.toFixed(2)} MB / {user?.storage_quota_mb} MB
            </p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90"
          >
            Logout
          </button>
        </div>

        <div className="bg-card p-6 rounded-lg border">
          <h2 className="text-xl font-semibold mb-4">Music Player Coming Soon! 🎵</h2>
          <p className="text-muted-foreground">
            Your authentication is working! Next, we'll build the music player, library, and playlists.
          </p>
        </div>
      </div>
    </div>
  );
}