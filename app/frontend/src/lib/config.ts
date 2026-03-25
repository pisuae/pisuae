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
 * Keywords indicating a transient DNS/Lambda cold-start error
 */
const DNS_ERROR_KEYWORDS = [
  'dns',
  'balancer resolve',
  'callback lock',
  'timeout',
  'failed to get from node cache',
  'could not acquire',
  'lambda-url',
  'service unavailable',
  'bad gateway',
  'gateway timeout',
];

function isDnsError(text: string): boolean {
  const lower = text.toLowerCase();
  return DNS_ERROR_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Global warm-up state.
 * Resolved once the Lambda has responded successfully to at least one request.
 * Other modules (retry.ts) can await this before sending their own requests.
 */
let _warmupResolve: (() => void) | null = null;
let _warmupDone = false;

export const lambdaWarmupPromise: Promise<void> = new Promise<void>(
  (resolve) => {
    _warmupResolve = resolve;
  }
);

export function isLambdaReady(): boolean {
  return _warmupDone;
}

function markLambdaReady(): void {
  if (!_warmupDone) {
    _warmupDone = true;
    console.log('[Config] Lambda is reachable and warm.');
    _warmupResolve?.();
  }
}

/**
 * Fetch with aggressive retry logic for Lambda cold-start DNS failures.
 * This is the FIRST request the app makes, so it must be very patient.
 *
 * Strategy:
 * - 7 attempts total (1 initial + 6 retries)
 * - Base delay 3s with exponential backoff (3s, 6s, 12s, 24s, 48s, 96s)
 * - Also checks response body for DNS error messages (Lambda returns 500 with DNS error)
 */
async function fetchWithRetry(
  url: string,
  maxRetries: number = 6,
  initialDelay: number = 3000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      // Check if the response is a 5xx with a DNS error in the body
      if (response.status >= 500) {
        try {
          const cloned = response.clone();
          const body = await cloned.text();
          if (isDnsError(body)) {
            // This is a DNS/cold-start error returned as a 500 response
            if (attempt < maxRetries) {
              const delay =
                initialDelay * Math.pow(2, attempt) +
                Math.random() * 2000;
              console.warn(
                `[Config] Attempt ${attempt + 1}/${maxRetries + 1}: Lambda DNS error (500). Retrying in ${Math.round(delay)}ms...`
              );
              await sleep(delay);
              continue;
            }
          }
        } catch {
          // Could not read body, treat as normal 500
        }
      }

      // Any successful response (even non-200) means Lambda is reachable
      if (response.ok || response.status < 500) {
        markLambdaReady();
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      if (attempt >= maxRetries) {
        break;
      }

      const delay =
        initialDelay * Math.pow(2, attempt) + Math.random() * 2000;
      console.warn(
        `[Config] Attempt ${attempt + 1}/${maxRetries + 1} failed (${lastError.message}). Retrying in ${Math.round(delay)}ms...`
      );
      await sleep(delay);
    }
  }

  // Even if all retries failed, mark as "ready" so the app doesn't hang forever
  // The individual API calls have their own retry logic
  markLambdaReady();
  throw lastError;
}

// Function to load runtime configuration
export async function loadRuntimeConfig(): Promise<void> {
  try {
    console.log('[Config] Loading runtime config (this warms up the Lambda)...');
    const response = await fetchWithRetry('/api/config');
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        runtimeConfig = await response.json();
        console.log('[Config] Runtime config loaded successfully');
      } else {
        console.log(
          '[Config] Config endpoint returned non-JSON response, skipping'
        );
      }
    } else {
      console.log(
        '[Config] Config fetch returned status:',
        response.status
      );
    }
  } catch (error) {
    console.log('[Config] Failed to load runtime config, using defaults:', error);
  } finally {
    configLoading = false;
  }
}

// Get current configuration
export function getConfig() {
  if (configLoading) {
    return defaultConfig;
  }

  if (runtimeConfig) {
    return runtimeConfig;
  }

  if (import.meta.env.VITE_API_BASE_URL) {
    return {
      API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    };
  }

  return defaultConfig;
}

// Dynamic API_BASE_URL getter
export function getAPIBaseURL(): string {
  return getConfig().API_BASE_URL;
}

export const config = {
  get API_BASE_URL() {
    return getAPIBaseURL();
  },
};