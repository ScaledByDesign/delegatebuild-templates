/**
 * Worker-owned charge adapters.
 *
 * These implement the portable `ChargeAdapter` contract by calling the
 * DEPLOYER'S processor backend (the same backends the universal
 * `/api/checkout/:kind` proxy already forwards to). The processor SECRETS live
 * on those backends — never in Delegate core and never in the browser. This is
 * what makes the deployer "solely responsible for integration/infrastructure":
 * the 1-click upsell charge runs worker → deployer-backend → processor, with
 * Delegate core entirely out of the path.
 *
 * Backend contract (per processor backend, deployer-operated):
 *   POST {backend}/checkout/charge-stored
 *     body: { paymentMethodToken, amount, currency, metadata, idempotencyKey, workspaceId }
 *     200 : { paymentIntentId, amountCharged, currency, status }
 *     402 : { error, code: "card_declined" | ... }   (decline → ProviderError)
 *     503 : { demo: true }                            (no backend → demo charge)
 */

import {
  type ChargeAdapter,
  type ChargeStoredInput,
  type ChargeStoredResult,
  type ProcessorKind,
  ProviderError,
} from "./flow-runtime";

export interface ChargeBackendResolver {
  /** Return the backend base URL for a processor kind, or undefined if unwired. */
  (kind: ProcessorKind): string | undefined;
}

interface BackendChargeResponse {
  paymentIntentId?: string;
  transactionId?: string;
  amountCharged?: number;
  currency?: string;
  status?: string;
  demo?: boolean;
  error?: string | { message?: string };
  code?: string;
}

function normalizeBackend(raw: string | undefined): string {
  let b = (raw || "").trim();
  if (b && !/^https?:\/\//i.test(b)) b = `https://${b}`;
  return b.replace(/\/$/, "");
}

function mapErrorCode(code: string | undefined): ProviderError["code"] {
  switch (code) {
    case "card_declined":
    case "authentication_required":
    case "invalid_token":
    case "not_configured":
    case "not_supported":
      return code;
    default:
      return "upstream_error";
  }
}

/**
 * Build a ChargeAdapter for a processor kind that POSTs the 1-click charge to
 * the deployer's configured backend. When no backend is wired, it throws
 * ProviderError("not_supported") so the runtime records a paymentError (the
 * upsell degrades gracefully — the already-completed purchase is unaffected).
 */
export function makeBackendChargeAdapter(
  kind: ProcessorKind,
  resolveBackend: ChargeBackendResolver,
  extraHeaders?: () => Record<string, string>,
): ChargeAdapter {
  return {
    kind,
    async chargeStoredPaymentMethod(
      input: ChargeStoredInput,
    ): Promise<ChargeStoredResult> {
      const backend = normalizeBackend(resolveBackend(kind));
      if (!backend) {
        throw new ProviderError(
          `No backend configured for processor "${kind}".`,
          "not_supported",
        );
      }

      let resp: Response;
      try {
        resp = await fetch(`${backend}/checkout/charge-stored`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            ...(extraHeaders?.() ?? {}),
          },
          body: JSON.stringify({
            paymentMethodToken: input.paymentMethodToken,
            amount: input.amount,
            currency: input.currency,
            metadata: input.metadata ?? {},
            idempotencyKey: input.idempotencyKey,
            workspaceId: input.workspaceId,
          }),
        });
      } catch (err) {
        throw new ProviderError(
          `Charge backend unreachable: ${err instanceof Error ? err.message : "unknown"}`,
          "upstream_error",
        );
      }

      const json = (await resp
        .json()
        .catch(() => ({}))) as BackendChargeResponse;

      if (resp.status === 503 && json.demo) {
        throw new ProviderError(
          `${kind} backend in demo mode — no live charge performed.`,
          "not_supported",
        );
      }

      if (!resp.ok) {
        const msg =
          typeof json.error === "object"
            ? json.error?.message
            : (json.error as string | undefined);
        throw new ProviderError(
          msg || `Charge failed (${resp.status})`,
          mapErrorCode(json.code),
        );
      }

      const paymentIntentId = json.paymentIntentId ?? json.transactionId;
      if (!paymentIntentId) {
        throw new ProviderError(
          "Charge backend returned no transaction id.",
          "upstream_error",
        );
      }

      return {
        paymentIntentId,
        amountCharged:
          typeof json.amountCharged === "number"
            ? json.amountCharged
            : input.amount,
        currency: json.currency ?? input.currency,
        status: json.status ?? "succeeded",
      };
    },
  };
}
