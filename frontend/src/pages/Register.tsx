import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Music } from 'lucide-react';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      await register({ username, email, password });
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
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

        {/* Register Card */}
        <div className="bg-black rounded-lg p-8 shadow-2xl border border-neutral-800">
          <h2 className="text-2xl font-bold text-center mb-6 text-white">
            Sign up for free
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
                minLength={3}
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#B93939] focus:border-transparent transition"
                placeholder="Choose a username"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold mb-2 text-white">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#B93939] focus:border-transparent transition"
                placeholder="your@email.com"
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
                minLength={8}
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#B93939] focus:border-transparent transition"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold mb-2 text-white">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#B93939] focus:border-transparent transition"
                placeholder="Confirm your password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-[#B93939] text-white rounded-full font-bold text-base hover:bg-[#a33232] active:bg-[#8f2b2b] disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
            >
              {isLoading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-neutral-800">
            <p className="text-center text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="text-[#B93939] hover:text-[#a33232] font-semibold underline">
                Log in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}