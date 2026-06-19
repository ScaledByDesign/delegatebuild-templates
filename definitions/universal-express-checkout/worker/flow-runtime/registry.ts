/**
 * Charge-adapter registry. The worker registers the adapters it has secrets for;
 * the runtime dispatches by the session's resolved processorKind.
 *
 * Mirrors core lib/upsell-flows/providers/index.ts (resolveUpsellProvider) but
 * the lookup table is populated by the WORKER, not from a DB row — the worker is
 * the secret holder.
 */

import {
  type ChargeAdapter,
  type ChargeStoredInput,
  type ChargeStoredResult,
  type ProcessorKind,
  ProviderError,
} from "./types";

export class ProviderRegistry {
  private readonly adapters = new Map<ProcessorKind, ChargeAdapter>();

  register(adapter: ChargeAdapter): this {
    this.adapters.set(adapter.kind, adapter);
    return this;
  }

  has(kind: ProcessorKind): boolean {
    return this.adapters.has(kind);
  }

  get(kind: ProcessorKind): ChargeAdapter | null {
    return this.adapters.get(kind) ?? null;
  }

  /**
   * Charge through the adapter for `kind`. Throws ProviderError("not_supported")
   * when no adapter is registered — the runtime records a paymentError rather
   * than crashing, exactly like core's `not_supported` handling.
   */
  async charge(
    kind: ProcessorKind | null,
    input: ChargeStoredInput,
  ): Promise<ChargeStoredResult> {
    if (!kind) {
      throw new ProviderError(
        "No processorKind resolved for session — cannot charge.",
        "not_configured",
      );
    }
    const adapter = this.adapters.get(kind);
    if (!adapter) {
      throw new ProviderError(
        `No charge adapter registered for processor "${kind}".`,
        "not_supported",
      );
    }
    return adapter.chargeStoredPaymentMethod(input);
  }
}
