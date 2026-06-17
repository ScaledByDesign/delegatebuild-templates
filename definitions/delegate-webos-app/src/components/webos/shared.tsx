import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Loader2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * WebOS `_shared` primitives (port of Delegate's
 * `components/webos/apps/_shared`). Reuse these instead of hand-rolling
 * spinners / empty states / dialogs / drawers so the app stays consistent with
 * the WebOS design system. Token-only colors, `fs-*` fonts, orange-on-light
 * safe (clickable text uses `text-link`, never `text-primary`).
 */

// ── AppLoadingState ──────────────────────────────────────────────────────────
export function AppLoadingState({
  label = "Loading…",
  testId,
  className,
}: {
  label?: string;
  testId?: string;
  className?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn("flex h-full w-full flex-col items-center justify-center gap-3", className)}
    >
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-fs-base text-muted-foreground">{label}</p>
    </div>
  );
}

// ── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
  action,
  testId,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center"
    >
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <p className="text-fs-md font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-fs-base text-muted-foreground">{description}</p>
      ) : null}
      {action ? (
        // Orange-on-light: clickable text uses text-link, fill uses primary.
        <button
          onClick={action.onClick}
          className="mt-1 rounded-md bg-primary px-3 py-1.5 text-fs-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

// ── ErrorBlock ───────────────────────────────────────────────────────────────
export function ErrorBlock({
  error,
  onRetry,
  testId,
}: {
  error: string;
  onRetry?: () => void;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-fs-md font-medium text-foreground">Something went wrong</p>
      <p className="max-w-sm text-fs-base text-muted-foreground">{error}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="mt-1 rounded-md bg-muted px-3 py-1.5 text-fs-base text-foreground transition-colors hover:bg-muted/70"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

// ── SectionHeader ────────────────────────────────────────────────────────────
export function SectionHeader({
  icon,
  title,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between px-4 py-2", className)}>
      <div className="flex items-center gap-2">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        <h2 className="text-fs-2xs font-semibold uppercase tracking-wide text-foreground-subtle">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

// ── StatusPill ───────────────────────────────────────────────────────────────
type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<StatusTone, string> = {
  // Semantic status colors are intentional (theme-ok).
  neutral: "bg-muted text-muted-foreground",
  success: "bg-green-500/15 text-green-600 dark:text-green-400",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  danger: "bg-destructive/15 text-destructive",
  info: "bg-primary/15 text-link",
};

export function StatusPill({
  label,
  tone = "neutral",
  testId,
}: {
  label: string;
  tone?: StatusTone;
  testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-fs-2xs font-medium",
        TONE_CLASSES[tone]
      )}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

// ── WindowDrawer ─────────────────────────────────────────────────────────────
// Window-scoped slide-over. NOT shadcn Sheet (which portals to document.body and
// breaks WebOS window containment) — this stays absolutely positioned inside the
// app's own container.
export function WindowDrawer({
  open,
  onOpenChange,
  title,
  children,
  width = "w-96",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40">
      <div
        className="absolute inset-0 bg-foreground/20"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex flex-col border-l border-border bg-card shadow-xl",
          width
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h3 className="text-fs-md font-medium text-foreground">{title}</h3>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto webos-scrollbar p-4">{children}</div>
      </div>
    </div>
  );
}

// ── useConfirm ───────────────────────────────────────────────────────────────
// Theme-aware, testable replacement for window.confirm(). Render <ConfirmDialog />
// once near the app root, then `await confirm({ message })` in handlers.
interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function useConfirm() {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setState({ options, resolve }));
  }, []);

  const close = useCallback(
    (result: boolean) => {
      state?.resolve(result);
      setState(null);
    },
    [state]
  );

  const ConfirmDialog = useCallback(() => {
    if (!state) return null;
    const { title, message, confirmLabel, cancelLabel, destructive } = state.options;
    return createPortal(
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 p-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl">
          {title ? (
            <h3 className="mb-1 text-fs-md font-semibold text-foreground">{title}</h3>
          ) : null}
          <p className="text-fs-base text-muted-foreground">{message}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => close(false)}
              className="rounded-md px-3 py-1.5 text-fs-base text-foreground transition-colors hover:bg-muted"
            >
              {cancelLabel ?? "Cancel"}
            </button>
            <button
              onClick={() => close(true)}
              className={cn(
                "rounded-md px-3 py-1.5 text-fs-base font-medium text-primary-foreground transition-colors",
                destructive ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
              )}
            >
              {confirmLabel ?? "Confirm"}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }, [state, close]);

  return { confirm, ConfirmDialog };
}
