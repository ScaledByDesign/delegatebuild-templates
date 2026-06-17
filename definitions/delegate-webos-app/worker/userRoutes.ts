import { Hono } from "hono";
import { Env } from './core-utils';

/**
 * Self-contained backend for the Delegate WebOS-native app.
 *
 * This app owns its own data here — it runs in a sandboxed, cross-origin iframe
 * inside Delegate with NO Delegate session, so it does not (and cannot) call
 * Delegate's APIs. Everything the app needs lives in this Worker.
 *
 * CORS, error handling, `/api/health` and `/api/client-errors` are owned by
 * core (`worker/index.ts`) — do not redefine them.
 *
 * The in-memory `items` store is a DEMO only (it resets per isolate). Replace it
 * with durable storage (D1, KV, or a Durable Object via core-utils) for real
 * apps, and add the binding to `wrangler.jsonc` so it's available on `c.env`.
 */

type Item = { id: string; title: string; done: boolean; createdAt: string };

let items: Item[] = [
  { id: "seed-1", title: "Welcome to your WebOS app", done: false, createdAt: new Date().toISOString() },
  { id: "seed-2", title: "Edit src/pages/WebOSHome.tsx", done: false, createdAt: new Date().toISOString() },
  { id: "seed-3", title: "Swap this in-memory store for D1/KV", done: true, createdAt: new Date().toISOString() },
];

export function userRoutes(app: Hono<{ Bindings: Env }>) {
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
