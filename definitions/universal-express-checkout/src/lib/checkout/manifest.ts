/**
 * Processor manifest — SINGLE SOURCE OF TRUTH for which payment processors the
 * universal checkout can target.
 *
 * Mirrors the Delegate platform's `lib/integrations/checkout/manifest-kind.ts`.
 * PURE TWIN: no network, no SDK — safe to import from the client picker AND the
 * adapter registry, so `ProcessorKind` stays identical across both.
 *
 * To add a processor end-to-end:
 *   1. Add an entry here (id + label).
 *   2. Add the adapter module under `src/lib/checkout/adapters/` and register
 *      it in `./registry.ts` (the registry-parity check asserts every manifest
 *      id has an adapter).
 * The `<ProcessorPicker>` then surfaces it automatically.
 */

export interface ProcessorManifestEntry {
  /** Provider id — also the env-config key the Worker proxy keys backends on. */
  readonly id: string;
  /** Human-facing display name shown in the picker. */
  readonly label: string;
  /**
   * Processor class. `payment` = a payment processor inside a commerce engine
   * (Stripe, OmniCart/Medusa) that supports the two-call browser-payment flow.
   * `crm` = a full order/CRM platform (Konnektive, Sticky.io) that owns the
   * order lifecycle and charges in a single call.
   */
  readonly class: "payment" | "crm";
}

/** The manifest. Order here is the order the picker renders processors in. */
export const PROCESSOR_MANIFEST = [
  { id: "stripe", label: "Stripe", class: "payment" },
  { id: "omnicart", label: "OmniCart", class: "payment" },
  { id: "konnektive", label: "Konnektive", class: "crm" },
  { id: "stickyio", label: "Sticky.io", class: "crm" },
] as const satisfies readonly ProcessorManifestEntry[];

/** Closed set of processor ids, derived from the manifest. */
export type ProcessorKind = (typeof PROCESSOR_MANIFEST)[number]["id"];

/** All manifest ids in manifest order. */
export const PROCESSOR_IDS = PROCESSOR_MANIFEST.map((e) => e.id) as ProcessorKind[];

/** Fast id → label lookup. */
export const PROCESSOR_LABELS: Readonly<Record<string, string>> =
  Object.fromEntries(PROCESSOR_MANIFEST.map((e) => [e.id, e.label]));

/** Fast id → class lookup. */
export const PROCESSOR_CLASSES: Readonly<Record<string, "payment" | "crm">> =
  Object.fromEntries(PROCESSOR_MANIFEST.map((e) => [e.id, e.class]));

/** True iff `id` is a known processor kind. */
export function isProcessorKind(id: string): id is ProcessorKind {
  return PROCESSOR_LABELS[id] !== undefined;
}

/** Display label for a processor id; falls back to the raw id. */
export function processorLabel(id: string): string {
  return PROCESSOR_LABELS[id] ?? id;
}
