/**
 * Portable, signed flow-definition export.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * Delegate core must NOT be the runtime bottleneck for checkout/upsell payment
 * processing. The deployer's generated worker owns the charge runtime (it holds
 * the processor secrets and runs the flow state machine locally). To do that it
 * needs the FLOW GRAPH — the ordered upsell/downsell nodes and their accept /
 * decline edges — as a portable, read-only, versioned snapshot it can fetch and
 * cache (live-fetch with pull-through fallback).
 *
 * This module is the SHARED CONTRACT for that snapshot:
 *   • `serializeFlowExport()` turns Prisma UpsellFlow + UpsellButton rows into a
 *     normalized `FlowExport` graph (no Prisma types leak out).
 *   • `signFlowExport()` / `verifyFlowExport()` wrap the snapshot in an
 *     HMAC-SHA256 envelope so the worker can verify integrity + pin a version,
 *     and so a tampered/stale snapshot is rejected. Mirrors the proven pattern
 *     in `lib/reports/preview-token.ts`.
 *
 * DELIBERATELY DB-FREE / RUNTIME-FREE.
 * No `@/lib/db`, no `@prisma/client` runtime import, no Next.js. The only
 * dependency is `node:crypto` (available in workerd). This lets the same file be
 * vendored into the portable flow-runtime package (Step 3) and imported by the
 * deployer's Cloudflare worker without dragging in the control-plane database.
 *
 * SECURITY
 *   • The signing secret is NEVER hard-coded — callers resolve it (env
 *     `FLOW_EXPORT_SIGNING_SECRET`, falling back to `DELEGATEBUILD_INBOUND_TOKEN`
 *     so a single shared machine secret can bootstrap both directions) and pass
 *     it in. This module never reads process.env, keeping it unit-testable.
 *   • The signature binds the ENTIRE canonical snapshot, including its version
 *     and workspace id, so a snapshot for flow A/workspace X can't be replayed
 *     as flow B/workspace Y.
 */

// Web Crypto + base64 globals only — no node:crypto/Buffer/process (workerd runs
// without nodejs_compat). `crypto`, `btoa`, `atob`, and `TextEncoder` are all on
// globalThis in workerd, browsers, and Node 18+.
const subtle = (globalThis.crypto as Crypto).subtle;
const te = new TextEncoder();
const td = new TextDecoder();

// ─── Contract version ─────────────────────────────────────────────────────────
// Bump when the FlowExport shape changes in a non-backward-compatible way so a
// worker pinned to an older shape can refuse to run an incompatible snapshot.
export const FLOW_EXPORT_SCHEMA_VERSION = 1 as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type UpsellPositionKindExport =
  | "INITIAL"
  | "UPSELL"
  | "DOWNSELL"
  | "CROSS_SELL"
  | "THANK_YOU_SUCCESS"
  | "THANK_YOU_DECLINE";

/** A single accept-option (multi-CTA) on a node, mirrored from acceptOptions Json. */
export interface FlowExportAcceptOption {
  id: string;
  label: string;
  productId?: string | null;
  /** Price in minor units (cents). */
  price?: number | null;
  compareAtPrice?: number | null;
  ctaText?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** One node in the exported graph (1:1 with an UpsellButton). */
export interface FlowExportNode {
  id: string;
  label: string;
  buttonText: string;
  positionKind: UpsellPositionKindExport;
  /** Display price in minor units (cents). */
  displayPrice: number;
  currencyCode: string;
  /** Edges — null means "no next node" (the runtime treats as terminal). */
  successNextButtonId: string | null;
  declineNextButtonId: string | null;
  isTerminalSuccess: boolean;
  isTerminalDecline: boolean;
  /** Optional explicit redirect overrides (Pattern B external pages). */
  successRedirectUrl: string | null;
  declineRedirectUrl: string | null;
  externalPageUrl: string | null;
  /** Auto-decline timer in seconds (0/None = no timer). */
  timer: number | null;
  displayOrder: number;
  /** Multi-CTA accept options (empty when single-accept). */
  acceptOptions: FlowExportAcceptOption[];
  /** Split-test config passed through opaquely for the runtime's router. */
  splitTestEnabled: boolean;
  splitTestVariants: unknown;
  splitTestVariantsDecline: unknown;
  /** Per-node line items / bundle config, passed through opaquely. */
  linesConfig: unknown;
  metadata: Record<string, unknown> | null;
}

/** The normalized, portable flow graph. */
export interface FlowExport {
  schemaVersion: number;
  flowId: string;
  workspaceId: string;
  slug: string;
  name: string;
  status: string;
  /** Optimistic-concurrency version of the flow (from UpsellFlow row). */
  flowVersion: number;
  /** Entry node id (positionKind INITIAL). */
  entryButtonId: string;
  nodes: FlowExportNode[];
  /** Unix ms the snapshot was produced — lets the worker reason about staleness. */
  exportedAt: number;
}

/** A signed envelope: `<payload_b64url>.<sig_b64url>`. */
export interface SignedFlowExport {
  /** Opaque token the worker stores and re-verifies. */
  token: string;
  /** The decoded export (also returned for convenience on mint). */
  export: FlowExport;
}

// ─── Minimal Prisma-row shapes (structural, no @prisma/client import) ──────────

export interface FlowRowLike {
  id: string;
  workspaceId: string;
  slug: string;
  name: string;
  status: string;
  version?: number | null;
  entryButtonId: string | null;
}

export interface ButtonRowLike {
  id: string;
  label: string | null;
  buttonText: string | null;
  positionKind: string;
  displayPrice: number | null;
  currencyCode: string | null;
  successNextButtonId: string | null;
  declineNextButtonId: string | null;
  isTerminalSuccess: boolean | null;
  isTerminalDecline: boolean | null;
  successRedirectUrl: string | null;
  declineRedirectUrl: string | null;
  externalPageUrl: string | null;
  timer: number | null;
  displayOrder: number | null;
  acceptOptions: unknown;
  splitTestEnabled: boolean | null;
  splitTestVariants: unknown;
  splitTestVariantsDecline: unknown;
  linesConfig: unknown;
  metadata: unknown;
}

// ─── Serialization ─────────────────────────────────────────────────────────────

function normalizeAcceptOptions(raw: unknown): FlowExportAcceptOption[] {
  if (!Array.isArray(raw)) return [];
  const out: FlowExportAcceptOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.label !== "string") continue;
    out.push({
      id: o.id,
      label: o.label,
      productId: typeof o.productId === "string" ? o.productId : null,
      price: typeof o.price === "number" ? o.price : null,
      compareAtPrice:
        typeof o.compareAtPrice === "number" ? o.compareAtPrice : null,
      ctaText: typeof o.ctaText === "string" ? o.ctaText : null,
      metadata:
        o.metadata && typeof o.metadata === "object"
          ? (o.metadata as Record<string, unknown>)
          : null,
    });
  }
  return out;
}

function asPositionKind(kind: string): UpsellPositionKindExport {
  switch (kind) {
    case "INITIAL":
    case "UPSELL":
    case "DOWNSELL":
    case "CROSS_SELL":
    case "THANK_YOU_SUCCESS":
    case "THANK_YOU_DECLINE":
      return kind;
    default:
      // Unknown future kind — treat as a plain UPSELL so the runtime can still
      // walk the graph rather than crash. The metadata still carries the raw.
      return "UPSELL";
  }
}

/**
 * Turn loaded Prisma rows into a normalized, portable `FlowExport`.
 *
 * The caller is responsible for the DB read + tenant scoping. Pass the flow row
 * and ALL its button rows; ordering is normalized here by `displayOrder` then id.
 */
export function serializeFlowExport(
  flow: FlowRowLike,
  buttons: ButtonRowLike[],
  nowMs: number = Date.now(),
): FlowExport {
  const nodes: FlowExportNode[] = buttons
    .slice()
    .sort((a, b) => {
      const da = a.displayOrder ?? 0;
      const db_ = b.displayOrder ?? 0;
      if (da !== db_) return da - db_;
      return a.id.localeCompare(b.id);
    })
    .map((b) => ({
      id: b.id,
      label: b.label ?? "",
      buttonText: b.buttonText ?? "",
      positionKind: asPositionKind(b.positionKind),
      displayPrice: b.displayPrice ?? 0,
      currencyCode: (b.currencyCode ?? "USD").toUpperCase(),
      successNextButtonId: b.successNextButtonId ?? null,
      declineNextButtonId: b.declineNextButtonId ?? null,
      isTerminalSuccess: Boolean(b.isTerminalSuccess),
      isTerminalDecline: Boolean(b.isTerminalDecline),
      successRedirectUrl: b.successRedirectUrl ?? null,
      declineRedirectUrl: b.declineRedirectUrl ?? null,
      externalPageUrl: b.externalPageUrl ?? null,
      timer: typeof b.timer === "number" ? b.timer : null,
      displayOrder: b.displayOrder ?? 0,
      acceptOptions: normalizeAcceptOptions(b.acceptOptions),
      splitTestEnabled: Boolean(b.splitTestEnabled),
      splitTestVariants: b.splitTestVariants ?? null,
      splitTestVariantsDecline: b.splitTestVariantsDecline ?? null,
      linesConfig: b.linesConfig ?? null,
      metadata:
        b.metadata && typeof b.metadata === "object"
          ? (b.metadata as Record<string, unknown>)
          : null,
    }));

  // Resolve entry button: prefer denormalized cache; fall back to the INITIAL
  // node (mirrors runtime.ts initializeSession derivation, so the export and the
  // server runtime agree on the entry point).
  let entryButtonId = flow.entryButtonId ?? "";
  if (!entryButtonId) {
    const initial = nodes.find((n) => n.positionKind === "INITIAL");
    entryButtonId = initial?.id ?? "";
  }

  return {
    schemaVersion: FLOW_EXPORT_SCHEMA_VERSION,
    flowId: flow.id,
    workspaceId: flow.workspaceId,
    slug: flow.slug,
    name: flow.name,
    status: flow.status,
    flowVersion: flow.version ?? 1,
    entryButtonId,
    nodes,
    exportedAt: nowMs,
  };
}

// ─── Canonicalization + signing ────────────────────────────────────────────────

/**
 * Deterministic JSON for signing. Recursively sorts object keys so the exact
 * same logical export always produces the same bytes regardless of property
 * insertion order — otherwise the worker's re-verification could spuriously
 * fail. Arrays preserve order (graph order is meaningful).
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortDeep(obj[key]);
    }
    return out;
  }
  return value;
}

// --- base64url over bytes/strings (workerd-native, no Buffer) --------------

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64urlEncode(s: string): string {
  return bytesToBase64url(te.encode(s));
}

function base64urlDecodeToString(s: string): string {
  return td.decode(base64urlToBytes(s));
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/** Constant-time byte compare (Web Crypto has no timingSafeEqual). */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return subtle.importKey(
    "raw",
    te.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(payloadB64: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const mac = await subtle.sign("HMAC", key, te.encode(payloadB64));
  return bytesToBase64url(new Uint8Array(mac));
}

/** SHA-256 hex of the canonical export - a stable content fingerprint. */
export async function fingerprintFlowExport(exp: FlowExport): Promise<string> {
  const digest = await subtle.digest("SHA-256", te.encode(canonicalize(exp)));
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Wrap a `FlowExport` in a signed envelope. Format: `<payload_b64url>.<sig>`.
 * Async because Web Crypto signing is promise-based.
 *
 * @param exp     The serialized export.
 * @param secret  Resolved signing secret (caller reads env - never hard-coded).
 */
export async function signFlowExport(
  exp: FlowExport,
  secret: string,
): Promise<SignedFlowExport> {
  if (!secret) {
    throw new FlowExportError(
      "missing_secret",
      "Flow export signing secret is not configured.",
    );
  }
  const payloadB64 = base64urlEncode(canonicalize(exp));
  const sig = await sign(payloadB64, secret);
  return { token: `${payloadB64}.${sig}`, export: exp };
}

/**
 * Verify + decode a signed flow-export token. Throws on any tamper / bad sig.
 * The worker calls this on every fetched snapshot AND on every cached snapshot
 * it loads from its pull-through cache, so a poisoned cache entry is rejected.
 * Async because Web Crypto verification is promise-based.
 */
export async function verifyFlowExport(
  token: string,
  secret: string,
): Promise<FlowExport> {
  if (!secret) {
    throw new FlowExportError(
      "missing_secret",
      "Flow export signing secret is not configured.",
    );
  }
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) {
    throw new FlowExportError(
      "malformed",
      "Flow export token format invalid: missing signature separator.",
    );
  }
  const payloadB64 = token.slice(0, dotIdx);
  const sigReceived = token.slice(dotIdx + 1);
  const sigExpected = await sign(payloadB64, secret);

  let valid: boolean;
  try {
    valid = constantTimeEqual(
      base64urlToBytes(sigReceived),
      base64urlToBytes(sigExpected),
    );
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new FlowExportError(
      "invalid_signature",
      "Flow export signature is invalid (tampered or wrong secret).",
    );
  }

  let parsed: FlowExport;
  try {
    parsed = JSON.parse(base64urlDecodeToString(payloadB64)) as FlowExport;
  } catch {
    throw new FlowExportError("malformed", "Flow export payload could not be decoded.");
  }

  if (parsed.schemaVersion !== FLOW_EXPORT_SCHEMA_VERSION) {
    throw new FlowExportError(
      "schema_mismatch",
      `Flow export schema v${parsed.schemaVersion} is not supported by this runtime (expected v${FLOW_EXPORT_SCHEMA_VERSION}).`,
    );
  }
  return parsed;
}

// ─── Error ──────────────────────────────────────────────────────────────────

export type FlowExportErrorCode =
  | "missing_secret"
  | "malformed"
  | "invalid_signature"
  | "schema_mismatch";

export class FlowExportError extends Error {
  readonly code: FlowExportErrorCode;
  constructor(code: FlowExportErrorCode, message: string) {
    super(message);
    this.name = "FlowExportError";
    this.code = code;
  }
}

/**
 * Resolve the signing secret from the environment. Kept here (not in the
 * pure module surface) as a convenience for the Next.js route; the worker
 * resolves its own copy from its worker secret. Returns null when unset so the
 * route can fail closed.
 */
export function resolveFlowExportSecret(
  env?: Record<string, string | undefined>,
): string | null {
  // Worker copy: NEVER touch `process` (absent without nodejs_compat). Callers
  // pass `c.env`; an empty default keeps this a no-op rather than a crash.
  const e = env ?? {};
  const s =
    e.FLOW_EXPORT_SIGNING_SECRET?.trim() ||
    e.DELEGATEBUILD_INBOUND_TOKEN?.trim() ||
    "";
  return s || null;
}
