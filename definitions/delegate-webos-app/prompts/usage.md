# Usage — Delegate WebOS-native app

This template produces an app that renders inside the **Delegate WebOS desktop**
as an iframe plugin. Build it to look and feel like a native WebOS app and keep
it **self-contained** (its own data, its own Worker). Follow these rules.

## Built with
- React 18 + Vite + TypeScript, React Router (`createBrowserRouter`)
- Tailwind CSS with the Delegate WebOS token system
- `lucide-react` icons, TanStack Query for data
- Cloudflare Worker (Hono) at `worker/index.ts` for backend data
- Error boundaries are already wired (`ErrorBoundary`, `RouteErrorBoundary`)

## Theming — tokens only (CRITICAL)
The Delegate host pushes the live WebOS theme into this app at runtime
(`src/lib/delegate-theme.ts`, already wired in `src/main.tsx`). You must use the
semantic tokens so the app re-themes automatically (dark / light / custom). When
run standalone it falls back to the browser's `prefers-color-scheme`.

- **Colors: semantic tokens ONLY.** Use `bg-background`, `bg-card`, `bg-muted`,
  `bg-surface-2`, `text-foreground`, `text-muted-foreground`,
  `text-foreground-subtle`, `text-link`, `border-border`, `ring-ring`,
  `bg-primary` / `text-primary-foreground`, `bg-destructive`, `accent-tint`.
  **Never** use raw Tailwind palette colors (`bg-white`, `text-blue-500`,
  `bg-gray-100`) or hex values in components — they won't re-theme and will look
  wrong in dark/light.
- **Fonts: `fs-*` scale ONLY.** Use `text-fs-3xs` (10px) … `text-fs-xl` (20px).
  **Never** use `text-[14px]` or other px literals — they ignore the Delegate
  font customizer. Body defaults to `--fs-base`.
- **Orange-on-light rule:** the brand orange (`--primary`, #ff6600) fails AA as
  text on light backgrounds. Use `--primary` for fills/borders/rings/tints and
  bold button text only; for clickable inline text use `text-link`.
- Genuinely semantic status colors (success green, warning amber) are allowed —
  see `StatusPill` tones in `src/components/webos/shared.tsx`.
- **Always check both dark and light.** Light is the contrast-sensitive one.

## Reuse the WebOS primitives
Import from `@/components/webos/shared` and `@/components/webos/AppScrollContainer`
instead of hand-rolling. Available:
- `AppScrollContainer` — wrap EVERY scrollable area (handles `min-h-0` + WebOS
  scrollbar). Do not use bare `flex-1 overflow-y-auto`.
- `AppLoadingState`, `EmptyState`, `ErrorBlock` — loading / empty / error states.
- `SectionHeader` — uppercase section divider.
- `StatusPill` — status chip (tones: neutral/success/warning/danger/info).
- `WindowDrawer` — window-scoped slide-over (do NOT use a body-portaled sheet).
- `useConfirm()` → `{ confirm, ConfirmDialog }` — replace `window.confirm()`.

See `src/pages/WebOSHome.tsx` for the canonical app anatomy — copy its structure.

## data-testid
- Root element: `data-testid="app-{appId}"` (e.g. `app-delegate-webos-app`).
- Interactive elements: `data-testid="{appId}-{element}"` (e.g.
  `delegate-webos-app-new`). Only add to interactive/targetable elements.

## Data — self-contained, via your own Worker
This app does NOT have access to Delegate's APIs or the user's session. Keep all
data in **your own** Worker at `worker/index.ts`:
- Only `/api/*` routes hit the Worker; everything else serves the SPA (see
  `wrangler.jsonc`: `not_found_handling: single-page-application` +
  `run_worker_first: ["/api/*"]`). Keep `/api/client-errors`.
- The sample uses an in-memory store — **replace it with durable storage**
  (D1, KV, or a Durable Object) for anything real. Add the binding in
  `wrangler.jsonc` and use `c.env`.
- On the client, fetch your own relative `/api/*` routes with TanStack Query.

## Routing
Uses `createBrowserRouter` in `src/main.tsx`. Add routes there with
`errorElement: <RouteErrorBoundary />`. Do NOT switch to `BrowserRouter` /
`HashRouter`, and do NOT remove `initDelegateTheme()` from `main.tsx`.

## What NOT to change
- `src/lib/delegate-theme.ts` and the `initDelegateTheme()` call (the host theme
  bridge) — keep them.
- The token utilities in `tailwind.config.js` / `src/index.css` — extend, don't
  replace with hardcoded colors.
