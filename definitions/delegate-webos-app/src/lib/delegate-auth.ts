/**
 * Delegate app access token (client side).
 *
 * Keeps this app's own `/api/*` data PRIVATE. The Delegate host mints a
 * short-lived token (only for an authenticated member of the connected
 * workspace) and pushes it into this iframe over the bridge as a
 * `delegate:auth` message — never via the URL. We hold it in memory and attach
 * it as `X-Delegate-App-Token` on every call to our own Worker, which verifies
 * it (see worker/userRoutes.ts). If this app's URL leaks, an outsider opening it
 * has no token, so the Worker returns 403.
 *
 * Call `initDelegateAuth()` once before render (see src/main.tsx).
 */

let appToken: string | null = null;
let access: "private" | "public" | null = null;
let initialized = false;
const waiters: Array<(token: string | null) => void> = [];

export function initDelegateAuth(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!data || data.source !== "delegate" || data.type !== "delegate:auth") return;
    const payload = data.payload ?? {};
    if (typeof payload.token === "string") appToken = payload.token;
    if (payload.access === "public" || payload.access === "private") access = payload.access;
    while (waiters.length) waiters.shift()?.(appToken);
  });
}

export function getAppToken(): string | null {
  return appToken;
}

export function getAccessMode(): "private" | "public" | null {
  return access;
}

/**
 * Resolve the access token, waiting briefly for the host to deliver it (it
 * arrives right after the iframe's delegate:ready). Returns null if none comes
 * (e.g. the app is opened standalone / outside Delegate).
 */
export function awaitAppToken(timeoutMs = 1500): Promise<string | null> {
  if (appToken) return Promise.resolve(appToken);
  if (typeof window === "undefined" || window.parent === window) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(appToken), timeoutMs);
    waiters.push((t) => {
      clearTimeout(timer);
      resolve(t);
    });
  });
}

/** Merge the access-token header into a fetch init. */
export async function withAppAuth(init?: RequestInit): Promise<RequestInit> {
  const token = appToken ?? (await awaitAppToken());
  const headers = new Headers(init?.headers);
  if (token) headers.set("X-Delegate-App-Token", token);
  return { ...init, headers };
}
