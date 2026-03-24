/**
 * Retry utility with exponential backoff for handling transient network errors
 * like DNS resolution failures, timeout issues, and 500 status responses.
 *
 * Specifically handles the AWS Lambda cold-start DNS error:
 * "failed the initial dns/balancer resolve for '...lambda-url...' with:
 *  failed to get from node cache: could not acquire callback lock: timeout"
 *
 * Strategy:
 * 1. Global warm-up: The first API call "warms" the Lambda. All subsequent
 *    calls wait until the warm-up completes before proceeding.
 * 2. Serialized queue: Only 1 request at a time during cold start, expanding
 *    to 2 after the Lambda is confirmed warm.
 * 3. Aggressive retries with exponential backoff for DNS/5xx errors.
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
  if (error instanceof Error) {
    if (containsRetryableKeyword(error.message)) return true;
  }

  if (typeof error === 'string' && containsRetryableKeyword(error))
    return true;

  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;

    const status = obj.status ?? obj.statusCode;
    if (typeof status === 'number' && status >= 500 && status <= 504)
      return true;

    const message =
      obj.message ??
      (obj.data && typeof obj.data === 'object'
        ? (obj.data as Record<string, unknown>).message
        : undefined);
    if (typeof message === 'string' && containsRetryableKeyword(message))
      return true;

    const detail =
      obj.detail ??
      (obj.data && typeof obj.data === 'object'
        ? (obj.data as Record<string, unknown>).detail
        : undefined);
    if (typeof detail === 'string' && containsRetryableKeyword(detail))
      return true;

    const url = obj.url;
    if (typeof url === 'string' && containsRetryableKeyword(url)) return true;
  }

  return false;
}

function isRetryableResponse(response: unknown): boolean {
  if (!response || typeof response !== 'object') return false;

  const res = response as Record<string, unknown>;

  const status = res.status ?? res.statusCode;
  if (typeof status === 'number' && status >= 500 && status <= 504)
    return true;

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

  if (
    typeof res.message === 'string' &&
    containsRetryableKeyword(res.message)
  )
    return true;

  return false;
}

/**
 * Global Lambda warm-up tracker.
 * The first successful non-error API response marks the Lambda as "warm".
 * Until then, all requests are serialized (concurrency = 1) to prevent
 * the DNS callback lock timeout.
 */
class WarmupTracker {
  private _isWarm = false;
  private _warmPromise: Promise<void> | null = null;
  private _warmResolve: (() => void) | null = null;

  constructor() {
    this._warmPromise = new Promise<void>((resolve) => {
      this._warmResolve = resolve;
    });
  }

  get isWarm(): boolean {
    return this._isWarm;
  }

  markWarm(): void {
    if (!this._isWarm) {
      this._isWarm = true;
      console.log('[Warmup] Lambda is now warm. Increasing concurrency.');
      this._warmResolve?.();
    }
  }

  /**
   * Wait for the Lambda to be warm. Returns immediately if already warm.
   * Times out after maxWaitMs to prevent deadlocks.
   */
  async waitForWarm(maxWaitMs = 30000): Promise<void> {
    if (this._isWarm) return;
    await Promise.race([
      this._warmPromise,
      new Promise<void>((resolve) => setTimeout(resolve, maxWaitMs)),
    ]);
  }
}

const warmupTracker = new WarmupTracker();

/** Export for external use (e.g., checking warm status) */
export function isLambdaWarm(): boolean {
  return warmupTracker.isWarm;
}

/**
 * Global request queue to serialize API calls and prevent concurrent DNS resolution
 * issues with Lambda cold starts.
 *
 * - During cold start (not warm): concurrency = 1 (fully serialized)
 * - After warm-up: concurrency = 3 (normal operation)
 */
class RequestQueue {
  private queue: Array<{
    fn: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
    isWarmup?: boolean;
  }> = [];
  private running = 0;
  private cooldownMs = 300; // Delay between requests during cold start

  private get maxConcurrent(): number {
    return warmupTracker.isWarm ? 3 : 1;
  }

  async enqueue<T>(fn: () => Promise<T>, isWarmup = false): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        isWarmup,
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
      // Use longer cooldown during cold start, shorter when warm
      const cooldown = warmupTracker.isWarm ? 50 : this.cooldownMs;
      if (this.queue.length > 0) {
        setTimeout(() => this.processNext(), cooldown);
      }
    }
  }
}

const globalQueue = new RequestQueue();

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelayMs: number = 3000
): Promise<T> {
  let lastError: unknown;
  let lastResult: T | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = (await globalQueue.enqueue(fn)) as T;

      // Check if the resolved result is actually a retryable error response
      if (isRetryableResponse(result)) {
        lastResult = result;
        if (attempt < maxRetries) {
          const delay =
            baseDelayMs * Math.pow(2, attempt) + Math.random() * 1500;
          console.warn(
            `[Retry] Attempt ${attempt + 1}/${maxRetries} got retryable response. Retrying in ${Math.round(delay)}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        return result;
      }

      // Success! Mark Lambda as warm
      warmupTracker.markWarm();
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

  if (lastResult !== undefined) return lastResult;
  throw lastError;
}

/**
 * Retry wrapper specifically for non-critical operations.
 * Waits for Lambda warm-up before starting, and never throws.
 */
export async function withRetryQuiet<T>(
  fn: () => Promise<T>,
  fallback: T,
  maxRetries: number = 4,
  baseDelayMs: number = 3000
): Promise<T> {
  // Wait for Lambda to be warm before making non-critical requests
  // This prevents non-critical calls from competing with critical ones during cold start
  await warmupTracker.waitForWarm(20000);

  try {
    const result = await withRetry(fn, maxRetries, baseDelayMs);
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