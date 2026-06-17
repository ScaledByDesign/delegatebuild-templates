/**
 * Delegate theme bridge (host → app, one-way).
 *
 * When this app runs as an iframe plugin inside the Delegate WebOS desktop, the
 * host posts the live WebOS design tokens via `postMessage`:
 *
 *   { source: "delegate", type: "delegate:theme",
 *     payload: { mode: "dark"|"light"|"custom",
 *                tokens: Record<cssVar, string>, fontScale: number } }
 *
 * We apply those tokens to `:root` so the app paints in the exact active theme
 * (dark / light / custom + the user's font scale). On mount we announce
 * readiness (`delegate:ready`) so the host (re)sends the current theme,
 * eliminating load-order races.
 *
 * Standalone (not embedded) or if the host never responds, we fall back to the
 * browser's `prefers-color-scheme` by toggling the `.dark` class — the default
 * token values live in `src/index.css`.
 *
 * Call `initDelegateTheme()` once, before React renders (see `src/main.tsx`).
 */

interface ThemePayload {
  mode?: "dark" | "light" | "custom";
  tokens?: Record<string, string>;
  fontScale?: number;
}

let hostApplied = false;

function applyTokens(payload: ThemePayload): void {
  const root = document.documentElement;
  const { tokens, mode, fontScale } = payload;

  if (tokens) {
    for (const [name, value] of Object.entries(tokens)) {
      if (name.startsWith("--") && typeof value === "string" && value) {
        root.style.setProperty(name, value);
      }
    }
  }
  if (typeof fontScale === "number" && fontScale > 0) {
    root.style.setProperty("--font-scale", String(fontScale));
  }

  // Keep the `.dark` class in sync so any `dark:` utilities resolve correctly.
  root.classList.toggle("dark", mode === "dark");
  if (mode) root.dataset.theme = mode;
  root.dataset.delegateThemed = "1";
  hostApplied = true;
}

function applyBrowserFallback(): void {
  if (hostApplied) return; // host already themed us
  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", prefersDark);
  document.documentElement.dataset.theme = prefersDark ? "dark" : "light";
}

export function initDelegateTheme(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("message", (event: MessageEvent) => {
    const data = event.data;
    if (!data || data.source !== "delegate" || data.type !== "delegate:theme") return;
    applyTokens((data.payload ?? {}) as ThemePayload);
  });

  const embedded = !!window.parent && window.parent !== window;

  if (embedded) {
    // Ask the host to send the current theme now.
    try {
      window.parent.postMessage({ source: "delegate-app", type: "delegate:ready" }, "*");
    } catch {
      /* cross-origin parent may reject; the host also pushes on its own ready handshake */
    }
  }

  // Track OS theme changes while standalone.
  if (typeof window.matchMedia === "function") {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!hostApplied) applyBrowserFallback();
    };
    if (typeof mql.addEventListener === "function") mql.addEventListener("change", onChange);
  }

  // Fall back if the host never speaks the protocol (or we're standalone).
  window.setTimeout(applyBrowserFallback, embedded ? 700 : 0);
}
