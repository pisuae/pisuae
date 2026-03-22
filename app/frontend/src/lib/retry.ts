/**
 * Retry utility with exponential backoff for handling transient network errors
 * like DNS resolution failures, timeout issues, and 500 status responses.
 */

const RETRYABLE_KEYWORDS = [
  'dns',
  'timeout',
  'network',
  'econnrefused',
  'enotfound',
  'balancer resolve',
  'callback lock',
  'fetch failed',
  'failed to get from node cache',
  'could not acquire',
  'lambda-url',
  'internal server error',
  'service unavailable',
  'bad gateway',
  'gateway timeout',
];

function containsRetryableKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return RETRYABLE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function isRetryableError(error: unknown): boolean {
  // Check thrown Error objects
  if (error instanceof Error) {
    if (containsRetryableKeyword(error.message)) return true;
  }

  // Check string errors
  if (typeof error === 'string' && containsRetryableKeyword(error)) return true;

  // Check API response-style errors (e.g., { status: 500, data: { message: '...' } })
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;

    // Check status code for server errors (500, 502, 503, 504)
    const status = obj.status ?? obj.statusCode;
    if (typeof status === 'number' && status >= 500 && status <= 504) return true;

    // Check nested message fields
    const message =
      obj.message ??
      (obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>).message : undefined);
    if (typeof message === 'string' && containsRetryableKeyword(message)) return true;
  }

  return false;
}

/**
 * Check if an API response indicates a retryable server error.
 * This handles cases where the SDK resolves the promise but returns an error response.
 */
function isRetryableResponse(response: unknown): boolean {
  if (!response || typeof response !== 'object') return false;

  const res = response as Record<string, unknown>;

  // Check status field
  const status = res.status ?? res.statusCode;
  if (typeof status === 'number' && status >= 500 && status <= 504) return true;

  // Check nested data.message for DNS/network errors
  if (res.data && typeof res.data === 'object') {
    const data = res.data as Record<string, unknown>;
    if (typeof data.message === 'string' && containsRetryableKeyword(data.message)) return true;
  }

  // Check top-level message
  if (typeof res.message === 'string' && containsRetryableKeyword(res.message)) return true;

  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1500
): Promise<T> {
  let lastError: unknown;
  let lastResult: T | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();

      // Check if the resolved result is actually a retryable error response
      if (isRetryableResponse(result)) {
        lastResult = result;
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
          console.warn(
            `[Retry] Attempt ${attempt + 1}/${maxRetries} got retryable response (status 5xx / DNS error). Retrying in ${Math.round(delay)}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        // All retries exhausted, return the last result as-is
        return result;
      }

      return result;
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries && isRetryableError(error)) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(
          `[Retry] Attempt ${attempt + 1}/${maxRetries} failed with retryable error. Retrying in ${Math.round(delay)}ms...`,
          error instanceof Error ? error.message : error
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  // If we got a result but it was retryable, return it rather than throwing
  if (lastResult !== undefined) return lastResult;
  throw lastError;
}