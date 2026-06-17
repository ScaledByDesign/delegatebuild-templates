import { Hono } from "hono";
import { Env } from './core-utils';

/**
 * Self-contained backend for the Delegate WebOS-native app.
 *
 * Data is PRIVATE by default. Each /api/* route is gated by `requireAccess`:
 *   - If `DELEGATE_APP_PUBLIC === "true"` (the owner opted the app public), serve
 *     everyone.
 *   - Otherwise require a valid `X-Delegate-App-Token`. The Delegate host mints
 *     this token only for an authenticated member of the connected workspace and
 *     delivers it to the iframe over the bridge (see src/lib/delegate-auth.ts).
 *     We verify it server-to-server against Delegate's
 *     /api/plugins/app-access/verify endpoint (cached 60s). So if THIS app's URL
 *     leaks, an outsider with no token gets 403.
 *
 * This app does NOT call Delegate's APIs for data — it owns its data here. The
 * only Delegate dependency is token verification + (separately) the AI bridge.
 *
 * Env (set by the build/deploy or wrangler.jsonc vars):
 *   DELEGATE_APP_PUBLIC  "true" to make the app public (no token required)
 *   DELEGATE_BASE_URL    Delegate origin for token verification (default https://delegate.ws)
 *
 * The in-memory `items` store is a DEMO only (resets per isolate). Replace it
 * with durable storage (D1, KV, or a Durable Object) for real apps.
 */

type Item = { id: string; title: string; done: boolean; createdAt: string };

let items: Item[] = [
  { id: "seed-1", title: "Welcome to your WebOS app", done: false, createdAt: new Date().toISOString() },
  { id: "seed-2", title: "Edit src/pages/WebOSHome.tsx", done: false, createdAt: new Date().toISOString() },
  { id: "seed-3", title: "Swap this in-memory store for D1/KV", done: true, createdAt: new Date().toISOString() },
];

// token -> expiry (ms). Verified tokens are cached briefly to avoid a callback
// on every request.
const verifiedTokens = new Map<string, number>();

async function isAuthorized(env: Record<string, string | undefined>, token: string | undefined): Promise<boolean> {
  if (env.DELEGATE_APP_PUBLIC === "true") return true; // owner opted public
  if (!token) return false;

  const now = Date.now();
  const cached = verifiedTokens.get(token);
  if (cached && cached > now) return true;

  const base = env.DELEGATE_BASE_URL || "https://delegate.ws";
  try {
    const res = await fetch(`${base}/api/plugins/app-access/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return false;
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: { ok?: boolean } };
    const ok = !!(json?.data?.ok ?? json?.ok);
    if (ok) verifiedTokens.set(token, now + 60_000);
    return ok;
  } catch {
    return false; // fail closed
  }
}

export function userRoutes(app: Hono<{ Bindings: Env }>) {
  // Access gate for this app's own data API.
  const guard = async (
    c: { env: Env; req: { header: (k: string) => string | undefined }; json: (body: unknown, status?: number) => Response },
    next: () => Promise<void>
  ) => {
    const env = c.env as unknown as Record<string, string | undefined>;
    const token = c.req.header("x-delegate-app-token");
    if (!(await isAuthorized(env, token))) {
      return c.json({ error: "Forbidden: open this app from Delegate" }, 403);
    }
    await next();
  };
  app.use('/api/items', guard);
  app.use('/api/items/*', guard);

  app.get('/api/items', (c) => c.json({ items }));

  app.post('/api/items', async (c) => {
    const body = await c.req.json().catch(() => ({}) as { title?: string });
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return c.json({ error: "title required" }, 400);
    const item: Item = {
      id: crypto.randomUUID(),
      title,
      done: false,
      createdAt: new Date().toISOString(),
    };
    items = [item, ...items];
    return c.json({ item }, 201);
  });

  app.patch('/api/items/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}) as { done?: boolean; title?: string });
    let updated: Item | undefined;
    items = items.map((it) => {
      if (it.id !== id) return it;
      updated = {
        ...it,
        done: typeof body.done === "boolean" ? body.done : it.done,
        title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : it.title,
      };
      return updated;
    });
    if (!updated) return c.json({ error: "not found" }, 404);
    return c.json({ item: updated });
  });

  app.delete('/api/items/:id', (c) => {
    const id = c.req.param('id');
    const before = items.length;
    items = items.filter((it) => it.id !== id);
    if (items.length === before) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true });
  });
}
