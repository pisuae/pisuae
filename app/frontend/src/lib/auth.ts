import axios, { AxiosInstance, AxiosError } from 'axios';
import { getAPIBaseURL } from './config';

// Retry configuration - more aggressive for DNS/balancer issues
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 2000; // 2 seconds

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * DNS/balancer error keywords to detect transient Lambda cold-start issues
 */
const DNS_ERROR_KEYWORDS = [
  'dns',
  'balancer resolve',
  'callback lock',
  'timeout',
  'node cache',
  'could not acquire',
  'lambda-url',
  'econnrefused',
  'enotfound',
  'econnreset',
  'socket hang up',
  'network error',
  'failed to fetch',
  'aborted',
  'connection reset',
  'bad gateway',
  'service unavailable',
  'gateway timeout',
];

/**
 * Check if an error message contains DNS/network related keywords
 */
function isDnsOrNetworkError(message: string): boolean {
  const lower = message.toLowerCase();
  return DNS_ERROR_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * Check if an error is a transient/retryable error
 * Now also checks the response body for DNS error messages (500 with DNS message)
 */
function isRetryableError(error: AxiosError): boolean {
  // Network errors (DNS resolution, connection refused, timeout)
  if (!error.response) {
    return true;
  }

  const status = error.response.status;

  // Server errors (5xx) are retryable
  if (status >= 500 && status < 600) {
    return true;
  }

  // Check response body for DNS/network error messages
  const data = error.response.data as Record<string, unknown> | undefined;
  if (data) {
    const message =
      typeof data.message === 'string'
        ? data.message
        : typeof data.detail === 'string'
          ? data.detail
          : '';
    if (message && isDnsOrNetworkError(message)) {
      return true;
    }
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
      timeout: 20000, // 20 second timeout (increased for cold starts)
    });
  }

  private getBaseURL() {
    return getAPIBaseURL();
  }

  /**
   * Execute a request with retry logic and exponential backoff.
   * Specifically handles the Lambda DNS/balancer resolution error:
   * "failed the initial dns/balancer resolve ... could not acquire callback lock: timeout"
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await operation();

        // Also check if the successful response contains a DNS error in the body
        // (some frameworks return 200 with error payload)
        const axiosResult = result as { data?: Record<string, unknown>; status?: number };
        if (
          axiosResult?.status &&
          axiosResult.status >= 500 &&
          axiosResult.data?.message &&
          typeof axiosResult.data.message === 'string' &&
          isDnsOrNetworkError(axiosResult.data.message)
        ) {
          if (attempt < MAX_RETRIES) {
            const delay =
              INITIAL_RETRY_DELAY * Math.pow(2, attempt) +
              Math.random() * 1000;
            console.warn(
              `[Auth] ${context}: Attempt ${attempt + 1} got DNS error in response. Retrying in ${Math.round(delay)}ms...`
            );
            await sleep(delay);
            continue;
          }
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        const axiosError = error as AxiosError;

        // Don't retry non-retryable errors (4xx client errors, except timeout)
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
          Math.random() * 1000;

        // Extract meaningful error info for logging
        const errorDetail = axiosError.response?.data
          ? JSON.stringify(
              (axiosError.response.data as Record<string, unknown>).message ||
                (axiosError.response.data as Record<string, unknown>).detail ||
                'unknown'
            ).slice(0, 120)
          : axiosError.message;

        console.warn(
          `[Auth] ${context}: Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed (${errorDetail}). Retrying in ${Math.round(delay)}ms...`
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

      // For DNS/network errors (including 500 with DNS message), return null
      // This prevents the app from crashing on transient network issues
      if (!axiosError.response) {
        console.warn(
          '[Auth] Network error fetching user, treating as not authenticated:',
          axiosError.message
        );
        return null;
      }

      // Check if it's a 500 with DNS/balancer error message
      const data = axiosError.response?.data as Record<string, unknown> | undefined;
      const errorMessage =
        typeof data?.message === 'string'
          ? data.message
          : typeof data?.detail === 'string'
            ? data.detail
            : '';
      if (
        axiosError.response?.status === 500 &&
        errorMessage &&
        isDnsOrNetworkError(errorMessage)
      ) {
        console.warn(
          '[Auth] DNS/balancer error fetching user after retries, treating as not authenticated:',
          errorMessage
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