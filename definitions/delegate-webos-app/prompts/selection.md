# Template Selection

Internal **Delegate WebOS-native app** — a React/Vite app that looks and behaves
like a first-party app inside the Delegate WebOS desktop, and is published back
into Delegate as an iframe plugin.

Use when:
- Building an **internal app/module that will live inside the Delegate WebOS
  desktop** (the "Build internal native app" flow in the Delegate Builder).
- The app should match the Delegate look & feel — same theme (dark / light /
  custom), same fonts, same component patterns (cards, status pills, drawers,
  empty states, scroll containers).
- The app is **self-contained**: it owns its own data via its own Cloudflare
  Worker (D1 / KV / Durable Objects). It does NOT need to read or write the
  user's Delegate tasks/contacts/etc.

Avoid when:
- The user wants a public marketing site / SSR / SEO page.
- The user wants a generic standalone web app with its own unrelated visual
  identity (use a general vite template instead).
- The app must directly access the signed-in user's Delegate data — that is not
  supported through this template's sandbox.

Built with:
- React 18, Vite, TypeScript, Tailwind, lucide-react, TanStack Query
- Cloudflare Workers (Hono) for self-contained backend data
- Delegate WebOS design system: semantic theme tokens, `fs-*` font scale,
  `_shared` primitives, `AppScrollContainer`, and the host theme bridge.
