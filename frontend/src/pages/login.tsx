import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Music } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login({ username, password });
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#121212] p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Music className="w-10 h-10 text-[#B93939]" />
            <h1 className="text-4xl font-bold text-white">ofatifie</h1>
          </div>
          <p className="text-gray-400">Music for everyone</p>
        </div>

        {/* Login Card */}
        <div className="bg-black rounded-lg p-8 shadow-2xl border border-neutral-800">
          <h2 className="text-2xl font-bold text-center mb-6 text-white">
            Log in to ofatifie
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-4 text-sm text-red-200 bg-red-900/30 border border-red-800 rounded-md">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-semibold mb-2 text-white">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#B93939] focus:border-transparent transition"
                placeholder="Enter your username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold mb-2 text-white">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#B93939] focus:border-transparent transition"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-[#B93939] text-white rounded-full font-bold text-base hover:bg-[#a33232] active:bg-[#8f2b2b] disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
            >
              {isLoading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-neutral-800">
            <p className="text-center text-gray-400">
              Don't have an account?{' '}
              <Link to="/register" className="text-[#B93939] hover:text-[#a33232] font-semibold underline">
                Sign up for ofatifie
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}