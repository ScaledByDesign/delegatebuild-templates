import type { ProcessorKind } from "./manifest";

/** Result of a checkout-proxy call. Mirrors `BackendResult<T>` in `@/lib/omnicart`. */
export interface ProxyResult<T> {
  ok: boolean;
  data?: T;
  /** True when no backend is wired (the Worker proxy returned `503 { demo:true }`). */
  demo?: boolean;
  /** HTTP status, when a response was received. */
  httpStatus?: number;
  /** Normalized error message for the `failed` branch. */
  error?: string;
}

/** Shape every checkout response may carry alongside its processor payload. */
type CheckoutEnvelope = Record<string, unknown> & {
  demo?: boolean;
  message?: string;
  error?: string | { message?: string };
};

/**
 * POST a JSON body to the SAME-ORIGIN Worker checkout proxy
 * (`/api/checkout/:kind/*`) and decode the response. The Worker owns every
 * processor credential and forwards to the configured backend server-side, so
 * no secret or backend URL is ever exposed to the browser. When a processor has
 * no backend wired, the Worker returns `503 { demo: true }`, which we surface as
 * `{ ok: false, demo: true }` so the adapter falls back to demo mode.
 */
export async function checkoutProxy<T>(
  kind: ProcessorKind,
  path: string,
  body: unknown,
  pick: (json: Record<string, unknown>) => T | undefined,
  fallbackError: string,
  init?: { method?: string; headers?: Record<string, string> },
): Promise<ProxyResult<T>> {
  const url = `/api/checkout/${kind}/${path.replace(/^\//, "")}`;
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
      ...(init?.headers ?? {}),
    };

    const res = await fetch(url, {
      method: init?.method ?? "POST",
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = (await res.json().catch(() => ({}))) as CheckoutEnvelope;

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
