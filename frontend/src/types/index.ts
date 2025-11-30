export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  storage_quota_mb: number;
  storage_used_mb: number;
  created_at: string;
  avatar_path: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}