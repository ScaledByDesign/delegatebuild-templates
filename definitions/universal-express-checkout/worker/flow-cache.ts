/**
 * Pull-through flow-definition cache.
 *
 * The worker owns the upsell runtime, but the flow GRAPH is authored in Delegate
 * core. This module fetches the SIGNED flow-export from core
 * (`GET /api/flow-builder/export/:flowId`) and caches it, so:
 *
 *   • LIVE updates — every fetch gets the latest published graph (a flow edit in
 *     the builder reflects on the next session with no redeploy).
 *   • PULL-THROUGH fallback — when core is unreachable, the worker serves its
 *     last-good cached snapshot, so a core outage can NEVER take a merchant's
 *     post-purchase upsell down. (The signature is re-verified on the cached
 *     copy too, so a poisoned cache entry is rejected.)
 *
 * Cache backends, in order of preference:
 *   1. A Cloudflare KV namespace bound as `FLOW_CACHE` (survives restarts /
 *      instances) — recommended.
 *   2. An in-isolate Map fallback (works without KV, but per-isolate only).
 *
 * The signed token is the cache VALUE — opaque + tamper-evident. We also keep a
 * short freshness TTL so a healthy core is re-checked often, while still falling
 * back to a stale-but-valid token indefinitely when core is down.
 */

import { verifyFlowExport, type FlowExport } from "./flow-runtime";

export interface FlowCacheEnv {
  /** Base URL of Delegate core (e.g. https://delegate.ws). */
  OMNICART_UPSELL_RUNTIME_URL?: string;
  /** Machine token presented as Bearer to the export endpoint. */
  OMNICART_UPSELL_RUNTIME_TOKEN?: string;
  /** Workspace this deployment acts on behalf of (tenant scope). */
  DELEGATE_WORKSPACE_ID?: string;
  /** Secret to verify the signed export (same as core's signing secret). */
  FLOW_EXPORT_SIGNING_SECRET?: string;
  /** Optional KV namespace for durable cache. */
  FLOW_CACHE?: KVNamespace;
}

// workerd KV typing (minimal — avoids pulling @cloudflare/workers-types here).
export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

/** How long a freshly fetched token is considered "fresh" before re-fetch (s). */
const FRESH_TTL_S = 60;
/** How long a token persists in KV as a fallback even when stale (s). */
const FALLBACK_TTL_S = 60 * 60 * 24 * 7; // 7 days

interface CacheRecord {
  token: string;
  fetchedAt: number;
}

const memCache = new Map<string, CacheRecord>();

function cacheKey(flowId: string): string {
  return `flow-export:${flowId}`;
}

function resolveSecret(env: FlowCacheEnv): string {
  return (
    env.FLOW_EXPORT_SIGNING_SECRET?.trim() ||
    env.OMNICART_UPSELL_RUNTIME_TOKEN?.trim() ||
    ""
  );
}

async function readCache(
  env: FlowCacheEnv,
  flowId: string,
): Promise<CacheRecord | null> {
  if (env.FLOW_CACHE) {
    try {
      const raw = await env.FLOW_CACHE.get(cacheKey(flowId));
      if (raw) return JSON.parse(raw) as CacheRecord;
    } catch {
      /* fall through to mem cache */
    }
  }
  return memCache.get(flowId) ?? null;
}

async function writeCache(
  env: FlowCacheEnv,
  flowId: string,
  record: CacheRecord,
): Promise<void> {
  memCache.set(flowId, record);
  if (env.FLOW_CACHE) {
    try {
      await env.FLOW_CACHE.put(cacheKey(flowId), JSON.stringify(record), {
        expirationTtl: FALLBACK_TTL_S,
      });
    } catch {
      /* KV write failure is non-fatal — mem cache still holds it */
    }
  }
}

export interface ResolvedFlow {
  /** The verified, signed token (pass to FlowRuntime.fromSignedToken). */
  token: string;
  /** The decoded export (already verified). */
  export: FlowExport;
  /** Where the snapshot came from — useful for telemetry/headers. */
  source: "live" | "cache-fresh" | "cache-fallback";
}

/**
 * Resolve a usable, signature-verified flow snapshot for `flowId`.
 *
 * Strategy:
 *   1. If a fresh cached token exists (within FRESH_TTL_S), use it (cache-fresh).
 *   2. Otherwise try a live fetch from core; on success cache + return (live).
 *   3. On live-fetch failure, fall back to ANY valid cached token (cache-fallback).
 *   4. If nothing is available, throw — the caller degrades to demo/no-upsell.
 */
export async function resolveFlow(
  env: FlowCacheEnv,
  flowId: string,
  now: number = Date.now(),
): Promise<ResolvedFlow> {
  const secret = resolveSecret(env);
  if (!secret) {
    throw new Error("Flow export signing secret is not configured on the worker");
  }

  const cached = await readCache(env, flowId);

  // 1. Fresh cache hit — skip the network entirely.
  if (cached && now - cached.fetchedAt < FRESH_TTL_S * 1000) {
    try {
      const exp = await verifyFlowExport(cached.token, secret);
      return { token: cached.token, export: exp, source: "cache-fresh" };
    } catch {
      /* poisoned/expired cache — fall through to live fetch */
    }
  }

  // 2. Live fetch from core.
  const base = (env.OMNICART_UPSELL_RUNTIME_URL || "").replace(/\/$/, "");
  const workspaceId = env.DELEGATE_WORKSPACE_ID || "";
  if (base && workspaceId) {
    try {
      const resp = await fetch(
        `${base}/api/flow-builder/export/${encodeURIComponent(flowId)}`,
        {
          method: "GET",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${env.OMNICART_UPSELL_RUNTIME_TOKEN || ""}`,
            "X-Delegate-Workspace": workspaceId,
          },
        },
      );
      if (resp.ok) {
        const json = (await resp.json()) as {
          data?: { token?: string };
          token?: string;
        };
        const token = json.data?.token ?? json.token;
        if (token) {
          // Verify BEFORE caching — never cache an unverifiable token.
          const exp = await verifyFlowExport(token, secret);
          await writeCache(env, flowId, { token, fetchedAt: now });
          return { token, export: exp, source: "live" };
        }
      }
    } catch {
      /* network/core failure — fall back to cache below */
    }
  }

  // 3. Fallback to any valid cached token (even if stale).
  if (cached) {
    try {
      const exp = await verifyFlowExport(cached.token, secret);
      return { token: cached.token, export: exp, source: "cache-fallback" };
    } catch {
      /* cached token no longer verifies — nothing usable */
    }
  }

  // 4. Nothing usable.
  throw new Error(
    `Flow ${flowId} unavailable: core unreachable and no valid cached snapshot`,
  );
}
