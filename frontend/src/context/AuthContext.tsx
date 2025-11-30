import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../lib/api';
import type { User, LoginRequest, RegisterRequest, LoginResponse } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current user on mount if token exists
  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const response = await api.get<User>('/auth/me');
          setUser(response.data);
        } catch (error) {
          // Token is invalid, clear it
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    fetchUser();
  }, [token]);

  const login = async (credentials: LoginRequest) => {
    const formData = new FormData();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);

    const response = await api.post<LoginResponse>('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token } = response.data;
    localStorage.setItem('token', access_token);
    setToken(access_token);

    // Fetch user data
    const userResponse = await api.get<User>('/auth/me');
    setUser(userResponse.data);
  };

  const register = async (data: RegisterRequest) => {
    await api.post('/auth/register', data);
    // Auto-login after registration
    await login({ username: data.username, password: data.password });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}