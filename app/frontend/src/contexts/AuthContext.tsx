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

// Progressive retry delays: 5s, 10s, 20s, 30s (then cap at 30s)
const RETRY_DELAYS = [5000, 10000, 20000, 30000];
const MAX_AUTO_RETRIES = 8;

/**
 * DNS/balancer error keywords
 */
const DNS_ERROR_KEYWORDS = [
  'dns',
  'balancer resolve',
  'callback lock',
  'timeout',
  'node cache',
  'could not acquire',
  'lambda-url',
  'network error',
  'failed to fetch',
  'econnrefused',
  'enotfound',
  'econnreset',
  'unable to connect',
  'bad gateway',
  'service unavailable',
  'gateway timeout',
];

function isNetworkOrDnsError(message: string): boolean {
  const lower = message.toLowerCase();
  return DNS_ERROR_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);

  const scheduleRetry = useCallback(
    (checkFn: (isAutoRetry: boolean) => Promise<void>) => {
      // Don't schedule if we've exceeded max retries
      if (retryCountRef.current >= MAX_AUTO_RETRIES) {
        console.warn(
          `[Auth] Max auto-retries (${MAX_AUTO_RETRIES}) reached. Stopping automatic retries.`
        );
        return;
      }

      // Clear any existing retry
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      const delayIndex = Math.min(
        retryCountRef.current,
        RETRY_DELAYS.length - 1
      );
      const delay = RETRY_DELAYS[delayIndex];
      retryCountRef.current += 1;

      console.log(
        `[Auth] Scheduling auto-retry #${retryCountRef.current} in ${delay / 1000}s...`
      );

      retryTimeoutRef.current = setTimeout(() => {
        retryTimeoutRef.current = null;
        if (mountedRef.current) {
          checkFn(true);
        }
      }, delay);
    },
    []
  );

  const checkAuthStatus = useCallback(
    async (isAutoRetry = false) => {
      try {
        if (!isAutoRetry) {
          setLoading(true);
        }
        setError(null);
        const userData = await authApi.getCurrentUser();
        if (mountedRef.current) {
          setUser(userData);
          // Reset retry count on success
          retryCountRef.current = 0;
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

          if (isNetworkOrDnsError(errorMessage)) {
            // For network/DNS errors, set user to null but show a friendlier message
            setError(
              'Unable to connect to server. Retrying automatically...'
            );
            setUser(null);

            // Schedule progressive auto-retry
            scheduleRetry(checkAuthStatus);
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
    },
    [scheduleRetry]
  );

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
    retryCountRef.current = 0;
    checkAuthStatus();

    // Also listen for online/offline events to auto-retry when connection is restored
    const handleOnline = () => {
      console.log('[Auth] Browser came online, re-checking auth...');
      retryCountRef.current = 0; // Reset retry count
      checkAuthStatus(true);
    };

    window.addEventListener('online', handleOnline);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', handleOnline);
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
    refetch: () => {
      retryCountRef.current = 0; // Reset on manual refetch
      return checkAuthStatus(false);
    },
    isAdmin: user?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};