/**
 * Resilient client wrapper for the web SDK.
 *
 * Provides retry-wrapped versions of common SDK operations to handle
 * transient DNS/balancer resolution errors during AWS Lambda cold starts.
 *
 * Usage:
 *   import { resilientAuth, resilientQuery, resilientInvoke } from '@/lib/resilient-client';
 *   const user = await resilientAuth();
 *   const products = await resilientQuery('products', { query: { status: 'active' } });
 */

import { client } from './api';
import { withRetry, withRetryQuiet } from './retry';

/**
 * Resilient auth.me() - returns user data or null.
 * Retries on DNS/network errors, returns null on 401 or persistent failure.
 */
export async function resilientAuth(): Promise<any | null> {
  try {
    const res = await withRetry(() => client.auth.me(), 4, 3000);
    return res?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Resilient auth.me() that throws on failure (for pages that need to redirect).
 */
export async function resilientAuthStrict(): Promise<any> {
  const res = await withRetry(() => client.auth.me(), 4, 3000);
  return res;
}

/**
 * Resilient entity query with retry.
 */
export async function resilientQuery(
  entityName: string,
  params: Record<string, any>,
  quiet = false
): Promise<any> {
  const entity = (client.entities as any)[entityName];
  if (!entity) throw new Error(`Unknown entity: ${entityName}`);

  if (quiet) {
    return withRetryQuiet(
      () => entity.query(params),
      { data: { items: [] } },
      3,
      2500
    );
  }
  return withRetry(() => entity.query(params), 4, 3000);
}

/**
 * Resilient entity queryAll with retry.
 */
export async function resilientQueryAll(
  entityName: string,
  params: Record<string, any>,
  quiet = false
): Promise<any> {
  const entity = (client.entities as any)[entityName];
  if (!entity) throw new Error(`Unknown entity: ${entityName}`);

  if (quiet) {
    return withRetryQuiet(
      () => entity.queryAll(params),
      { data: { items: [] } },
      3,
      2500
    );
  }
  return withRetry(() => entity.queryAll(params), 4, 3000);
}

/**
 * Resilient API call invoke with retry.
 */
export async function resilientInvoke(
  params: { url: string; method: string; data?: any },
  quiet = false
): Promise<any> {
  if (quiet) {
    return withRetryQuiet(
      () => client.apiCall.invoke(params),
      { data: {} },
      3,
      2500
    );
  }
  return withRetry(() => client.apiCall.invoke(params), 4, 3000);
}

/**
 * Resilient entity get with retry.
 */
export async function resilientGet(
  entityName: string,
  params: { id: string },
  quiet = false
): Promise<any> {
  const entity = (client.entities as any)[entityName];
  if (!entity) throw new Error(`Unknown entity: ${entityName}`);

  if (quiet) {
    return withRetryQuiet(() => entity.get(params), null, 3, 2500);
  }
  return withRetry(() => entity.get(params), 4, 3000);
}

/**
 * Resilient entity create with retry.
 */
export async function resilientCreate(
  entityName: string,
  params: { data: Record<string, any> }
): Promise<any> {
  return withRetry(
    () => (client.entities as any)[entityName].create(params),
    3,
    2500
  );
}

/**
 * Resilient entity update with retry.
 */
export async function resilientUpdate(
  entityName: string,
  params: { id: any; data: Record<string, any> }
): Promise<any> {
  return withRetry(
    () => (client.entities as any)[entityName].update(params),
    3,
    2500
  );
}

/**
 * Resilient entity delete with retry.
 */
export async function resilientDelete(
  entityName: string,
  params: { id: any }
): Promise<any> {
  return withRetry(
    () => (client.entities as any)[entityName].delete(params),
    3,
    2500
  );
}