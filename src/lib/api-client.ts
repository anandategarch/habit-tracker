/**
 * Frontend API client helper.
 *
 * Reads the API key (if any) from the `NEXT_PUBLIC_APP_API_KEY` env var and
 * attaches it as `x-api-key` header on every call. When the env var is not
 * set (e.g. local dev), the header is omitted and the request proceeds
 * without authentication.
 *
 * Usage:
 *   import { apiFetch } from '@/lib/api-client';
 *   const res = await apiFetch('/api/habits');
 *   const data = await res.json();
 *
 * This is a thin wrapper around fetch — it does NOT auto-throw on non-2xx.
 * Callers should check `res.ok` as usual.
 */

const API_KEY = process.env.NEXT_PUBLIC_APP_API_KEY || '';

export interface ApiFetchOptions extends RequestInit {
  // JSON body to be stringified automatically. Mutually exclusive with `body`.
  json?: unknown;
}

export function apiFetch(input: string, opts: ApiFetchOptions = {}): Promise<Response> {
  const { json, headers: customHeaders, ...rest } = opts;

  const headers = new Headers(customHeaders || {});
  if (API_KEY) {
    headers.set('x-api-key', API_KEY);
  }

  let body = rest.body;
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  }

  return fetch(input, {
    ...rest,
    headers,
    body,
  });
}

/**
 * Convenience wrapper that throws on non-2xx responses with the server's
 * error message when available. Returns parsed JSON on success.
 */
export async function apiJson<T = unknown>(input: string, opts: ApiFetchOptions = {}): Promise<T> {
  const res = await apiFetch(input, opts);
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = String(data.error);
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}
