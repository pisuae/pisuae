/**
 * Retry utility with exponential backoff for handling transient network errors
 * like DNS resolution failures and timeout issues.
 */

const RETRYABLE_ERRORS = [
  'dns',
  'timeout',
  'network',
  'ECONNREFUSED',
  'ENOTFOUND',
  'balancer resolve',
  'callback lock',
  'fetch failed',
];

function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();
  return RETRYABLE_ERRORS.some((keyword) => lowerMessage.includes(keyword.toLowerCase()));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries && isRetryableError(error)) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(
          `[Retry] Attempt ${attempt + 1}/${maxRetries} failed with retryable error. Retrying in ${Math.round(delay)}ms...`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}