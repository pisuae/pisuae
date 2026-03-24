/**
 * Retry utility with exponential backoff for handling transient network errors
 * like DNS resolution failures, timeout issues, and 500 status responses.
 *
 * Specifically handles the AWS Lambda cold-start DNS error:
 * "failed the initial dns/balancer resolve for '...lambda-url...' with:
 *  failed to get from node cache: could not acquire callback lock: timeout"
 *
 * Includes a global request serializer to prevent concurrent Lambda DNS resolution
 * issues by limiting in-flight requests.
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
  'load balancer',
  'connection reset',
  'socket hang up',
  'aborted',
  'econnreset',
  'epipe',
  'failed the initial',
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
  if (typeof error === 'string' && containsRetryableKeyword(error))
    return true;

  // Check API response-style errors (e.g., { status: 500, data: { message: '...' } })
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;

    // Check status code for server errors (500, 502, 503, 504)
    const status = obj.status ?? obj.statusCode;
    if (typeof status === 'number' && status >= 500 && status <= 504)
      return true;

    // Check nested message fields
    const message =
      obj.message ??
      (obj.data && typeof obj.data === 'object'
        ? (obj.data as Record<string, unknown>).message
        : undefined);
    if (typeof message === 'string' && containsRetryableKeyword(message))
      return true;

    // Check nested detail field (FastAPI error format)
    const detail =
      obj.detail ??
      (obj.data && typeof obj.data === 'object'
        ? (obj.data as Record<string, unknown>).detail
        : undefined);
    if (typeof detail === 'string' && containsRetryableKeyword(detail))
      return true;

    // Check nested url field for lambda-url pattern
    const url = obj.url;
    if (typeof url === 'string' && containsRetryableKeyword(url)) return true;
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
  if (typeof status === 'number' && status >= 500 && status <= 504)
    return true;

  // Check nested data.message for DNS/network errors
  if (res.data && typeof res.data === 'object') {
    const data = res.data as Record<string, unknown>;
    if (
      typeof data.message === 'string' &&
      containsRetryableKeyword(data.message)
    )
      return true;
    if (
      typeof data.detail === 'string' &&
      containsRetryableKeyword(data.detail)
    )
      return true;
  }

  // Check top-level message
  if (
    typeof res.message === 'string' &&
    containsRetryableKeyword(res.message)
  )
    return true;

  return false;
}

/**
 * Global request queue to serialize API calls and prevent concurrent DNS resolution
 * issues with Lambda cold starts. This ensures limited concurrency,
 * giving the DNS resolver time to complete before the next request starts.
 */
class RequestQueue {
  private queue: Array<{
    fn: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }> = [];
  private running = 0;
  private maxConcurrent = 2; // Allow limited concurrency to balance speed vs DNS stability
  private cooldownMs = 200; // Small delay between requests to ease DNS pressure

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.processNext();
    });
  }

  private async processNext() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) return;

    const item = this.queue.shift();
    if (!item) return;

    this.running++;
    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      this.running--;
      // Add a small cooldown between requests to prevent DNS resolution storms
      if (this.queue.length > 0) {
        setTimeout(() => this.processNext(), this.cooldownMs);
      }
    }
  }
}

const globalQueue = new RequestQueue();

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelayMs: number = 2500
): Promise<T> {
  let lastError: unknown;
  let lastResult: T | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Route through the global queue to prevent concurrent DNS issues
      const result = (await globalQueue.enqueue(fn)) as T;

      // Check if the resolved result is actually a retryable error response
      if (isRetryableResponse(result)) {
        lastResult = result;
        if (attempt < maxRetries) {
          // Use jittered exponential backoff: base * 2^attempt + random jitter
          const delay =
            baseDelayMs * Math.pow(2, attempt) + Math.random() * 1500;
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
        const delay =
          baseDelayMs * Math.pow(2, attempt) + Math.random() * 1500;
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

/**
 * Retry wrapper specifically for non-critical operations.
 * Uses more retries and longer delays, and never throws - returns a fallback instead.
 */
export async function withRetryQuiet<T>(
  fn: () => Promise<T>,
  fallback: T,
  maxRetries: number = 6,
  baseDelayMs: number = 3000
): Promise<T> {
  try {
    const result = await withRetry(fn, maxRetries, baseDelayMs);
    // Extra safety: if the result is still a retryable error response, return fallback
    if (isRetryableResponse(result)) {
      console.warn(
        '[RetryQuiet] Got retryable response after all retries, returning fallback.'
      );
      return fallback;
    }
    return result;
  } catch {
    console.warn(
      '[RetryQuiet] All retries exhausted, returning fallback value.'
    );
    return fallback;
  }
}