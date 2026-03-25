import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { authApi } from '../lib/auth';

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  last_login?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// Auto-retry delay for background auth checks (30 seconds)
const AUTO_RETRY_DELAY = 30000;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const checkAuthStatus = useCallback(async (isAutoRetry = false) => {
    try {
      if (!isAutoRetry) {
        setLoading(true);
      }
      setError(null);
      const userData = await authApi.getCurrentUser();
      if (mountedRef.current) {
        setUser(userData);
        // Clear any pending retry on success
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        const errorMessage =
          err instanceof Error ? err.message : 'An error occurred';

        // Check if it's a network/DNS error
        const isNetworkError =
          errorMessage.includes('dns') ||
          errorMessage.includes('DNS') ||
          errorMessage.includes('Network Error') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('balancer resolve');

        if (isNetworkError) {
          // For network errors, set user to null but show a friendlier message
          setError(
            'Unable to connect to server. The app will retry automatically.'
          );
          setUser(null);

          // Schedule an auto-retry for network errors
          if (!retryTimeoutRef.current) {
            retryTimeoutRef.current = setTimeout(() => {
              retryTimeoutRef.current = null;
              if (mountedRef.current) {
                checkAuthStatus(true);
              }
            }, AUTO_RETRY_DELAY);
          }
        } else {
          setError(errorMessage);
          setUser(null);
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const login = async () => {
    try {
      setError(null);
      await authApi.login();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await authApi.logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logout failed');
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    checkAuthStatus();

    return () => {
      mountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [checkAuthStatus]);

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    logout,
    refetch: () => checkAuthStatus(false),
    isAdmin: user?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};