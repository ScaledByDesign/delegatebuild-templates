/**
 * Delegate deeplink / launch params (client side).
 *
 * Native WebOS apps receive `openApp(appId, props)` values as React props (e.g.
 * `initialTab`, `searchQuery`, `taskId`). An iframe app can't take React props,
 * so the Delegate host forwards the same values over the bridge as a
 * `delegate:deeplink` message. This mirrors the platform deeplink pattern:
 *
 *   - cross-app:  openApp("plugin:my-app", { view: "items", filter: "open" })
 *   - URL:        /webos?app=plugin:my-app&view=items&filter=open
 *
 * Both arrive here as `{ view: "items", filter: "open" }`. Read them with
 * `useDelegateDeeplink()` (re-renders when they change) or `getLaunchParams()`.
 * Values are forwarded as-is (URL-origin params are strings).
 *
 * Call `initDelegateDeeplink()` once before render (see src/main.tsx).
 */
import { useEffect, useState } from "react";

export type LaunchParams = Record<string, unknown>;

let launchParams: LaunchParams = {};
let initialized = false;
const listeners = new Set<(p: LaunchParams) => void>();

export function initDelegateDeeplink(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!data || data.source !== "delegate" || data.type !== "delegate:deeplink") return;
    launchParams = (data.payload?.params ?? {}) as LaunchParams;
    listeners.forEach((fn) => fn(launchParams));
  });
}

export function getLaunchParams(): LaunchParams {
  return launchParams;
}

/** Subscribe to launch/deeplink params; updates if the host re-deeplinks. */
export function useDelegateDeeplink(): LaunchParams {
  const [params, setParams] = useState<LaunchParams>(launchParams);
  useEffect(() => {
    const fn = (p: LaunchParams) => setParams(p);
    listeners.add(fn);
    // Catch params that arrived between module load and mount.
    if (launchParams !== params) setParams(launchParams);
    return () => {
      listeners.delete(fn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return params;
}
