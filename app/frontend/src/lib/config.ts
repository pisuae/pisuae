// Runtime configuration
let runtimeConfig: {
  API_BASE_URL: string;
} | null = null;

// Configuration loading state
let configLoading = true;

// Default fallback configuration
const defaultConfig = {
  API_BASE_URL: 'http://127.0.0.1:8000', // Only used if runtime config fails to load
};

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with retry logic for transient DNS/network failures.
 * Uses more aggressive retries for initial config load since the app
 * depends on this to function correctly.
 */
async function fetchWithRetry(
  url: string,
  maxRetries: number = 4,
  initialDelay: number = 2000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      // Check if the response is a 5xx with DNS error - treat as retryable
      if (response.status >= 500 && response.status < 600 && attempt < maxRetries) {
        const cloned = response.clone();
        try {
          const body = await cloned.json();
          const message = body?.message || body?.detail || '';
          if (
            typeof message === 'string' &&
            (message.toLowerCase().includes('dns') ||
              message.toLowerCase().includes('balancer') ||
              message.toLowerCase().includes('callback lock') ||
              message.toLowerCase().includes('node cache'))
          ) {
            const delay =
              initialDelay * Math.pow(2, attempt) + Math.random() * 1000;
            console.warn(
              `[Config] Fetch attempt ${attempt + 1} got DNS error (${message.slice(0, 80)}). Retrying in ${Math.round(delay)}ms...`
            );
            await sleep(delay);
            continue;
          }
        } catch {
          // If we can't parse the body, just return the response
        }
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      if (attempt >= maxRetries) {
        break;
      }

      const delay =
        initialDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.warn(
        `[Config] Fetch attempt ${attempt + 1} failed (${lastError.message}). Retrying in ${Math.round(delay)}ms...`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

// Function to load runtime configuration
export async function loadRuntimeConfig(): Promise<void> {
  try {
    console.log('🔧 Loading runtime config...');
    // Try to load configuration from a config endpoint with retry
    const response = await fetchWithRetry('/api/config');
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      // Only parse as JSON if the response is actually JSON
      if (contentType && contentType.includes('application/json')) {
        runtimeConfig = await response.json();
        console.log('Runtime config loaded successfully');
      } else {
        console.log(
          'Config endpoint returned non-JSON response, skipping runtime config'
        );
      }
    } else {
      console.log('Config fetch failed with status:', response.status);
    }
  } catch (error) {
    console.log('Failed to load runtime config, using defaults:', error);
  } finally {
    configLoading = false;
  }
}

// Get current configuration
export function getConfig() {
  // If config is still loading, return default config to avoid using stale Vite env vars
  if (configLoading) {
    return defaultConfig;
  }

  // First try runtime config (for Lambda)
  if (runtimeConfig) {
    return runtimeConfig;
  }

  // Then try Vite environment variables (for local development)
  if (import.meta.env.VITE_API_BASE_URL) {
    const viteConfig = {
      API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    };
    return viteConfig;
  }

  // Finally fall back to default
  return defaultConfig;
}

// Dynamic API_BASE_URL getter - this will always return the current config
export function getAPIBaseURL(): string {
  return getConfig().API_BASE_URL;
}

export const config = {
  get API_BASE_URL() {
    return getAPIBaseURL();
  },
};