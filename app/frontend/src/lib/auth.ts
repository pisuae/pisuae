import axios, { AxiosInstance, AxiosError } from 'axios';
import { getAPIBaseURL } from './config';
import { lambdaWarmupPromise } from './config';

// Retry configuration
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 3500;

const DNS_ERROR_KEYWORDS = [
  'dns',
  'balancer resolve',
  'callback lock',
  'timeout',
  'failed to get from node cache',
  'could not acquire',
  'lambda-url',
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDnsError(text: string): boolean {
  const lower = text.toLowerCase();
  return DNS_ERROR_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Check if an error is a transient/retryable error
 */
function isRetryableError(error: AxiosError): boolean {
  // Network errors (DNS resolution, connection refused, timeout)
  if (!error.response) {
    return true;
  }
  const status = error.response.status;
  if (status >= 500 && status < 600) {
    // Also check if the 500 response body contains DNS error keywords
    const data = error.response.data;
    if (data && typeof data === 'object') {
      const msg =
        (data as Record<string, unknown>).message ||
        (data as Record<string, unknown>).detail ||
        '';
      if (typeof msg === 'string' && isDnsError(msg)) {
        return true;
      }
    }
    return true;
  }
  return false;
}

class RPApi {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  private getBaseURL() {
    return getAPIBaseURL();
  }

  /**
   * Execute a request with retry logic.
   * CRITICAL: Waits for Lambda warm-up before sending any request.
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    // Wait for Lambda to be reachable (config.ts handles the warm-up)
    await lambdaWarmupPromise;

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

        if (attempt >= MAX_RETRIES) {
          console.error(
            `[Auth] ${context}: All ${MAX_RETRIES + 1} attempts failed.`,
            lastError?.message
          );
          break;
        }

        const delay = Math.min(
          INITIAL_RETRY_DELAY * Math.pow(2, attempt) +
          Math.random() * 1000,
          30000
        );
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
      if (!axiosError.response) {
        console.warn(
          '[Auth] Network error fetching user, treating as not authenticated:',
          axiosError.message
        );
        return null;
      }
      // For 500 errors with DNS messages, also return null gracefully
      if (axiosError.response?.status && axiosError.response.status >= 500) {
        const data = axiosError.response.data;
        const msg =
          data && typeof data === 'object'
            ? (data as Record<string, unknown>).message ||
              (data as Record<string, unknown>).detail ||
              ''
            : '';
        if (typeof msg === 'string' && isDnsError(msg)) {
          console.warn(
            '[Auth] DNS/Lambda error fetching user, treating as not authenticated'
          );
          return null;
        }
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