/**
 * Delegate AI — use the connected account's funded model waterfall.
 *
 * AI requests are brokered through the Delegate host (the parent window) via the
 * plugin gateway action `ai.complete`, which runs Delegate's canonical
 * `chatWithFallback`: the CONNECTED workspace's multi-provider waterfall
 * (Anthropic → OpenAI → Gemini per the workspace's AI Models order, via Bifrost)
 * automatically rotates when a provider is throttled or out of credits, and the
 * usage is metered to that workspace. This app never holds a provider key.
 *
 * This works ONLY when the app runs embedded inside Delegate (a cross-origin
 * iframe). Standalone, `chatWithDelegateAI` rejects — gate UI on
 * `isEmbeddedInDelegate()` / the hook's `available` flag.
 *
 * Wire protocol matches Delegate's plugin bridge: post
 * `{ type:"delegate:request", requestId, action, payload }` to the parent and
 * await a `{ type:"delegate:response", requestId, payload|error }` reply. (Same
 * channel the official /sdk/plugin.js uses; reimplemented here so the app stays
 * self-contained with no external script dependency.)
 */
import { useCallback, useState } from "react";

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

let seq = 0;
const pending = new Map<string, Pending>();
let listening = false;

function ensureListener(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const msg = event.data;
    if (!msg || msg.type !== "delegate:response" || !msg.requestId) return;
    const h = pending.get(msg.requestId);
    if (!h) return;
    pending.delete(msg.requestId);
    clearTimeout(h.timer);
    if (msg.error) {
      h.reject(new Error(msg.error.message || msg.error.code || "Delegate request failed"));
    } else {
      h.resolve(msg.payload);
    }
  });
}

export function isEmbeddedInDelegate(): boolean {
  return typeof window !== "undefined" && !!window.parent && window.parent !== window;
}

function delegateRequest<T>(action: string, payload: unknown, timeoutMs = 45_000): Promise<T> {
  if (!isEmbeddedInDelegate()) {
    return Promise.reject(
      new Error("Delegate AI is only available when this app runs inside Delegate.")
    );
  }
  ensureListener();
  const requestId = `app-${Date.now()}-${++seq}`;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error("Delegate AI request timed out"));
    }, timeoutMs);
    pending.set(requestId, { resolve: resolve as (v: unknown) => void, reject, timer });
    window.parent.postMessage({ type: "delegate:request", requestId, action, payload }, "*");
  });
}

export interface DelegateChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DelegateAIOptions {
  /** Single-turn prompt (use this OR `messages`). */
  prompt?: string;
  /** Multi-turn conversation. */
  messages?: DelegateChatMessage[];
  /** Optional system instruction prepended to the conversation. */
  system?: string;
  /** Model HINT — the engine maps it to the latest funded equivalent. */
  model?: string;
  /** Max output tokens (clamped server-side to 1..4096). */
  maxTokens?: number;
  /** "json" asks the model for JSON output. */
  responseFormat?: "text" | "json";
}

export interface DelegateAIResult {
  content: string;
  model?: string;
  provider?: string;
}

/**
 * Run a completion through the connected account's funded waterfall.
 * Throws when not embedded in Delegate, or when every funded provider is
 * exhausted (the host surfaces the error after rotation).
 */
export async function chatWithDelegateAI(opts: DelegateAIOptions): Promise<DelegateAIResult> {
  // The gateway wraps handler results as { success, data }; unwrap defensively.
  const env = await delegateRequest<{ data?: DelegateAIResult } | DelegateAIResult>(
    "ai.complete",
    opts
  );
  const data = (env as { data?: DelegateAIResult })?.data ?? (env as DelegateAIResult);
  return data;
}

/** React convenience wrapper with loading/error state + an `available` flag. */
export function useDelegateAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = useCallback(async (opts: DelegateAIOptions): Promise<DelegateAIResult> => {
    setLoading(true);
    setError(null);
    try {
      return await chatWithDelegateAI(opts);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { complete, loading, error, available: isEmbeddedInDelegate() };
}
