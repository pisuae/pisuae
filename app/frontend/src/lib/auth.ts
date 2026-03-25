import axios, { AxiosInstance, AxiosError } from 'axios';
import { getAPIBaseURL } from './config';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is a transient/retryable error
 */
function isRetryableError(error: AxiosError): boolean {
  // Network errors (DNS resolution, connection refused, timeout)
  if (!error.response) {
    return true;
  }
  // Server errors (5xx) are retryable
  const status = error.response.status;
  return status >= 500 && status < 600;
}

class RPApi {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000, // 15 second timeout
    });
  }

  private getBaseURL() {
    return getAPIBaseURL();
  }

  /**
   * Execute a request with retry logic and exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const axiosError = error as AxiosError;

        // Don't retry non-retryable errors (4xx client errors)
        if (axiosError.response && !isRetryableError(axiosError)) {
          throw error;
        }

        // Don't retry after max attempts
        if (attempt >= MAX_RETRIES) {
          console.error(
            `[Auth] ${context}: All ${MAX_RETRIES + 1} attempts failed.`,
            lastError?.message
          );
          break;
        }

        // Exponential backoff with jitter
        const delay =
          INITIAL_RETRY_DELAY * Math.pow(2, attempt) +
          Math.random() * 500;
        console.warn(
          `[Auth] ${context}: Attempt ${attempt + 1} failed (${axiosError.message}). Retrying in ${Math.round(delay)}ms...`
        );
        await sleep(delay);
      }
    }

    throw lastError;
  }

  async getCurrentUser() {
    try {
      const response = await this.withRetry(
        () => this.client.get(`${this.getBaseURL()}/api/v1/auth/me`),
        'getCurrentUser'
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 401) {
        return null;
      }
      // For DNS/network errors, return null instead of throwing
      // This prevents the app from crashing on transient network issues
      if (!axiosError.response) {
        console.warn(
          '[Auth] Network error fetching user, treating as not authenticated:',
          axiosError.message
        );
        return null;
      }
      throw new Error(
        (axiosError.response?.data as { detail?: string })?.detail ||
          'Failed to get user info'
      );
    }
  }

  async login() {
    try {
      const response = await this.withRetry(
        () => this.client.get(`${this.getBaseURL()}/api/v1/auth/login`),
        'login'
      );
      // The backend will redirect to OIDC provider
      // SSO will work via cookies automatically
      window.location.href = response.data.redirect_url;
    } catch (error) {
      const axiosError = error as AxiosError;
      throw new Error(
        (axiosError.response?.data as { detail?: string })?.detail ||
          'Failed to initiate login. Please check your network connection and try again.'
      );
    }
  }

  async logout() {
    try {
      const response = await this.withRetry(
        () => this.client.get(`${this.getBaseURL()}/api/v1/auth/logout`),
        'logout'
      );
      // The backend will redirect to OIDC provider logout
      window.location.href = response.data.redirect_url;
    } catch (error) {
      const axiosError = error as AxiosError;
      throw new Error(
        (axiosError.response?.data as { detail?: string })?.detail ||
          'Failed to logout. Please check your network connection and try again.'
      );
    }
  }
}

export const authApi = new RPApi();