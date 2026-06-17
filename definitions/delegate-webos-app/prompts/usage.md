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

## App shell layout (match the Delegate ecom/payments apps)
Generated apps should use the same shell as Delegate's first-party apps (Stripe,
Shopify, etc.): a left **sidebar** + a **content** column with a thin **toolbar**.

```tsx
<div data-testid="app-{appId}" className="flex h-full w-full overflow-hidden bg-background text-foreground">
  <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card sm:flex">
    <div className="border-b border-border px-4 py-3">{/* brand header */}</div>
    <nav className="flex min-h-0 flex-1 flex-col">
      <AppScrollContainer innerClassName="p-2 space-y-0.5">{/* SidebarItem… */}</AppScrollContainer>
    </nav>
  </aside>
  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">{/* toolbar */}</div>
    <AppScrollContainer innerClassName="p-4 space-y-4">{/* MetricCard grid + Section… */}</AppScrollContainer>
  </div>
</div>
```

Spacing rhythm: header `px-4 py-3`, toolbar `px-4 py-2.5`, content `p-4 space-y-4`,
grids `gap-3`, sidebar nav `p-2 space-y-0.5`.

## Reuse the WebOS primitives
Import from `@/components/webos/shared` and `@/components/webos/AppScrollContainer`
instead of hand-rolling. Available:
- `AppScrollContainer` — wrap EVERY scrollable area (handles `min-h-0` + WebOS
  scrollbar). Do not use bare `flex-1 overflow-y-auto`.
- `AppLoadingState`, `EmptyState`, `ErrorBlock` — loading / empty / error states.
- `SidebarItem` — left-nav item (active/inactive styles built in).
- `MetricCard` — KPI/stat tile (tinted icon + label + bold value; tones:
  primary/neutral/success/warning/danger/info). Use a `grid gap-3` of these.
- `FilterTabs` — segmented filter strip (active = filled primary).
- `Section` + `KV` — card with a muted header row; `KV` = label/value detail rows.
- `ListRow` — list/table row (`px-4 py-3`, hover when clickable).
- `SectionHeader` — standalone uppercase section divider (when not using `Section`).
- `StatusPill` — status chip (tones: neutral/success/warning/danger/info).
- `WindowDrawer` — window-scoped slide-over (do NOT use a body-portaled sheet).
- `useConfirm()` → `{ confirm, ConfirmDialog }` — replace `window.confirm()`.

See `src/pages/WebOSHome.tsx` for the canonical app anatomy (sidebar + toolbar +
KPI grid + Section/ListRow + drawer) — copy its structure.

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
