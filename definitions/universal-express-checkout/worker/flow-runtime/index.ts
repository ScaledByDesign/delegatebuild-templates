/**
 * @delegate/flow-runtime — portable upsell flow runtime.
 *
 * The deployer-owned twin of Delegate core's upsell engine. Import this in the
 * generated worker so the worker owns the full charge runtime and Delegate core
 * stays OUT of the payment hot path.
 *
 * Typical worker wiring:
 *
 *   import {
 *     FlowRuntime, ProviderRegistry, MemorySessionStore,
 *   } from "@delegate/flow-runtime";
 *
 *   const registry = new ProviderRegistry().register(stripeWorkerAdapter);
 *   const runtime = FlowRuntime.fromSignedToken(signedToken, FLOW_EXPORT_SECRET, {
 *     store, registry, selfOrigin: "https://shop.example.com",
 *   });
 *   const { session } = await runtime.initialize({ processorKind: "stripe" });
 *   // …after initial buy completes:
 *   await runtime.attachPaymentToken(session.id, "pm_x|cus_y", "stripe");
 *   // …on /u/click?action=accept:
 *   const step = await runtime.accept(session.id, nodeId);
 */

export * from "./types";
export * from "./flow-export";
export * from "./graph";
export * from "./registry";
export * from "./engine";
export * from "./memory-store";
