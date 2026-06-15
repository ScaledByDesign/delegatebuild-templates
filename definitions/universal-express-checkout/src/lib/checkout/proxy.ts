/**
 * Same-origin Worker proxy helper for the universal checkout adapters.
 *
 * Every processor adapter (Stripe, OmniCart, Konnektive, Sticky.io) talks to its
 * backend through the Cloudflare Worker proxy mounted at `/api/checkout/*` so
 * processor credentials never touch the browser. The Worker keys each backend on
 * the processor id (`/api/checkout/:kind/...`) and returns `503 { demo: true }`
 * when that processor has no backend configured.
 *
 * This helper centralizes that contract:
 *   - decodes the `503 { demo: true }` signal into a typed `{ demo: true }` result
 *     so adapters can return the contract's `demo` branch instead of erroring;
 *   - normalizes non-OK responses into a structured error (never throws on a
 *     network/decline path — adapters map that to `{ status: "failed" }`);
 *   - keeps the JSON content-type + body plumbing in one place.
 */

import type { ProcessorKind } from "./manifest";

/** Result of a proxied call. Mirrors `BackendResult<T>` in `@/lib/omnicart`. */
export interface ProxyResult<T> {
  ok: boolean;
  data?: T;
  /** True when the proxy returned `503 { demo: true }` (no backend wired). */
  demo?: boolean;
  /** HTTP status, when a response was received. */
  httpStatus?: number;
  /** Normalized error message for the `failed` branch. */
  error?: string;
}

const CHECKOUT_BASE = "/api/checkout";

/**
 * POST a JSON body to `/api/checkout/:kind/:path` and decode the response.
 *
 * `pick` maps the decoded JSON to the value the adapter wants. A `503 { demo }`
 * resolves to `{ ok:false, demo:true }`; any other non-OK resolves to
 * `{ ok:false, error }`; a network throw is caught and normalized.
 */
export async function checkoutProxy<T>(
  kind: ProcessorKind,
  path: string,
  body: unknown,
  pick: (json: Record<string, unknown>) => T | undefined,
  fallbackError: string,
  init?: { method?: string; headers?: Record<string, string> },
): Promise<ProxyResult<T>> {
  const url = `${CHECKOUT_BASE}/${encodeURIComponent(kind)}/${path.replace(/^\//, "")}`;
  try {
    const res = await fetch(url, {
      method: init?.method ?? "POST",
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
      demo?: boolean;
      message?: string;
      error?: string | { message?: string };
    };
    if (res.status === 503 && json.demo) {
      return { ok: false, demo: true, httpStatus: 503 };
    }
    if (!res.ok) {
      const errMsg =
        typeof json.error === "object"
          ? json.error?.message
          : (json.error as string | undefined);
      return {
        ok: false,
        httpStatus: res.status,
        error: (json.message as string | undefined) || errMsg || fallbackError,
      };
    }
    return { ok: true, httpStatus: res.status, data: pick(json) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : fallbackError };
  }
}
