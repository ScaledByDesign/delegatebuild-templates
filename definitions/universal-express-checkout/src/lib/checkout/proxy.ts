import type { ProcessorKind } from "./manifest";

/** Result of a direct call. Mirrors `BackendResult<T>` in `@/lib/omnicart`. */
export interface ProxyResult<T> {
  ok: boolean;
  data?: T;
  /** True when no backend is wired. */
  demo?: boolean;
  /** HTTP status, when a response was received. */
  httpStatus?: number;
  /** Normalized error message for the `failed` branch. */
  error?: string;
}

const getBackendUrl = (kind: ProcessorKind): string => {
  const isBrowser = typeof window !== 'undefined';
  if (isBrowser && (window as any)[`VITE_${kind.toUpperCase()}_CHECKOUT_BACKEND_URL`]) {
    return (window as any)[`VITE_${kind.toUpperCase()}_CHECKOUT_BACKEND_URL`];
  }
  const envKey = `VITE_${kind.toUpperCase()}_CHECKOUT_BACKEND_URL`;
  return import.meta.env[envKey] || "";
};

/**
 * POST a JSON body directly to the backend URL and decode the response.
 */
export async function checkoutProxy<T>(
  kind: ProcessorKind,
  path: string,
  body: unknown,
  pick: (json: Record<string, unknown>) => T | undefined,
  fallbackError: string,
  init?: { method?: string; headers?: Record<string, string> },
): Promise<ProxyResult<T>> {
  const backendUrl = getBackendUrl(kind);
  if (!backendUrl) {
    // If no backend configured, transparently fall back to demo mode
    return { ok: false, demo: true, httpStatus: 503 };
  }

  const url = `${backendUrl.replace(/\/$/, "")}/checkout/${path.replace(/^\//, "")}`;
  try {
    const headers: Record<string, string> = { "content-type": "application/json", ...(init?.headers || {}) };
    if (kind === 'omnicart') {
      const pubKey = import.meta.env.VITE_OMNICART_PUBLISHABLE_KEY;
      if (pubKey) {
        headers['x-publishable-api-key'] = pubKey;
      }
    }

    const res = await fetch(url, {
      method: init?.method ?? "POST",
      headers,
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
