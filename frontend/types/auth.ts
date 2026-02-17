/**
 * Auth Types
 */

export interface AuthState {
  user: { userId: string; username: string } | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface AuthContextType {
  state: AuthState;
  login: (token: string, user: { userId: string; username: string }) => void;
  logout: () => void;
}
