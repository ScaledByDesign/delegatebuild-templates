/**
 * Checkout adapter registry.
 *
 * Mirrors the Delegate platform's `lib/integrations/checkout/index.ts`: a lazy
 * thunk map keyed by `ProcessorKind`. Each entry is a `() => Promise<adapter>`
 * so a processor's module (and any heavyweight deps) only loads when that
 * processor is actually selected — the picker can list every manifest kind
 * without importing four adapter modules up front.
 *
 * `getCheckoutAdapter(kind)` resolves the adapter; `listRegisteredKinds()`
 * returns the registered kinds. A module-load parity assertion guarantees every
 * manifest id has a registered adapter (and vice-versa), so adding a processor
 * to the manifest without wiring an adapter fails fast in development.
 */

import { PROCESSOR_IDS, type ProcessorKind } from "./manifest";
import type { CheckoutProcessorAdapter } from "./types";

/** Lazy thunks — the adapter module loads on first resolve, then is cached. */
const REGISTRY: Record<ProcessorKind, () => Promise<CheckoutProcessorAdapter>> = {
  stripe: () => import("./adapters/stripe").then((m) => m.stripeAdapter),
  omnicart: () => import("./adapters/omnicart").then((m) => m.omnicartAdapter),
  konnektive: () => import("./adapters/konnektive").then((m) => m.konnektiveAdapter),
  stickyio: () => import("./adapters/stickyio").then((m) => m.stickyioAdapter),
};

const cache = new Map<ProcessorKind, CheckoutProcessorAdapter>();

/** Resolve (and cache) the adapter for a processor kind. */
export async function getCheckoutAdapter(
  kind: ProcessorKind,
): Promise<CheckoutProcessorAdapter> {
  const cached = cache.get(kind);
  if (cached) return cached;
  const adapter = await REGISTRY[kind]();
  cache.set(kind, adapter);
  return adapter;
}

/** All processor kinds that have a registered adapter, in manifest order. */
export function listRegisteredKinds(): ProcessorKind[] {
  return PROCESSOR_IDS.filter((id) => id in REGISTRY);
}

// --- Manifest <-> registry parity (fail-fast in dev) -------------------------
//
// Every manifest id must have a registered adapter, and the registry must not
// register a kind that isn't in the manifest. This catches a half-wired
// processor at module load instead of at click time.
//
// Vite injects `import.meta.env` at build time; we read it through a local
// narrowing so the parity check compiles even where `vite/client` ambient
// types aren't in scope (e.g. an isolated type-check). It is tree-shaken out of
// production builds when `DEV` is statically false.
const importMetaEnv = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
if (importMetaEnv?.DEV) {
  const registered = new Set(Object.keys(REGISTRY));
  const manifest = new Set<string>(PROCESSOR_IDS);
  for (const id of manifest) {
    if (!registered.has(id)) {
      // eslint-disable-next-line no-console
      console.error(
        `[checkout/registry] manifest kind "${id}" has no registered adapter`,
      );
    }
  }
  for (const id of registered) {
    if (!manifest.has(id)) {
      // eslint-disable-next-line no-console
      console.error(
        `[checkout/registry] registered adapter "${id}" is not in the manifest`,
      );
    }
  }
}
