/**
 * Retry utility with request queue for handling AWS Lambda cold-start DNS errors.
 *
 * The core problem: When a Lambda is cold, its DNS resolver hasn't initialized.
 * Multiple concurrent requests cause "failed to get from node cache: could not
 * acquire callback lock: timeout" because they all try to resolve DNS simultaneously.
 *
 * Solution:
 * 1. config.ts fires the FIRST request (warm-up) with aggressive retries.
 *    It exports `lambdaWarmupPromise` which resolves when Lambda is reachable.
 * 2. This module's request queue waits for that warm-up before sending ANY request.
 * 3. Requests are serialized (concurrency=1) until warm, then concurrency increases.
 * 4. Each request has its own retry logic for transient 5xx errors.
 */

import { lambdaWarmupPromise, isLambdaReady } from './config';

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
 * Global request queue.
 * - Waits for Lambda warm-up (from config.ts) before processing any request.
 * - During cold start: concurrency = 1 (fully serialized)
 * - After warm-up stabilizes: concurrency = 4
 * - Adds delay between requests during cold start to avoid DNS contention.
 * - Tracks consecutive successes to determine when DNS is fully stable.
 */
class RequestQueue {
  private queue: Array<{
    fn: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }> = [];
  private running = 0;
  private consecutiveSuccesses = 0;
  private dnsStable = false;

  private get maxConcurrent(): number {
    if (!isLambdaReady()) return 1;
    // After warm-up, start with concurrency 2 until DNS is proven stable
    if (!this.dnsStable) return 2;
    return 4;
  }

  private markSuccess() {
    this.consecutiveSuccesses++;
    // After 3 consecutive successes, consider DNS fully stable
    if (this.consecutiveSuccesses >= 3 && !this.dnsStable) {
      this.dnsStable = true;
      console.log('[RequestQueue] DNS is stable, increasing concurrency.');
    }
  }

  private markFailure() {
    this.consecutiveSuccesses = 0;
    // If we see a failure after being stable, reset stability
    if (this.dnsStable) {
      this.dnsStable = false;
      console.warn('[RequestQueue] DNS failure detected, reducing concurrency.');
    }
  }

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    // CRITICAL: Wait for Lambda to be reachable before sending any SDK request.
    // config.ts handles the warm-up with aggressive retries.
    // This prevents SDK requests from racing with the warm-up request.
    await lambdaWarmupPromise;

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
      // Check if the result is a retryable error response (DNS error returned as 500)
      if (isRetryableResponse(result)) {
        this.markFailure();
      } else {
        this.markSuccess();
      }
      item.resolve(result);
    } catch (error) {
      this.markFailure();
      item.reject(error);
    } finally {
      this.running--;
      // Longer cooldown when DNS is not yet stable
      const cooldown = this.dnsStable ? 30 : isLambdaReady() ? 200 : 800;
      if (this.queue.length > 0) {
        setTimeout(() => this.processNext(), cooldown);
      }
    }
  }
}

const globalQueue = new RequestQueue();

/**
 * Execute an API call with retry logic.
 * Waits for Lambda warm-up, then retries on transient errors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 6,
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
          const delay = Math.min(
            baseDelayMs * Math.pow(2, attempt) + Math.random() * 1500,
            30000
          );
          console.warn(
            `[Retry] Attempt ${attempt + 1}/${maxRetries}: retryable response. Retrying in ${Math.round(delay)}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        return result;
      }

      return result;
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries && isRetryableError(error)) {
        const delay = Math.min(
          baseDelayMs * Math.pow(2, attempt) + Math.random() * 1500,
          30000
        );
        console.warn(
          `[Retry] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${Math.round(delay)}ms...`,
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
 * Retry wrapper for non-critical operations.
 * Waits for Lambda warm-up, retries on failure, never throws.
 */
export async function withRetryQuiet<T>(
  fn: () => Promise<T>,
  fallback: T,
  maxRetries: number = 4,
  baseDelayMs: number = 3000
): Promise<T> {
  try {
    const result = await withRetry(fn, maxRetries, baseDelayMs);
    if (isRetryableResponse(result)) {
      console.warn(
        '[RetryQuiet] Retryable response after all retries, returning fallback.'
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