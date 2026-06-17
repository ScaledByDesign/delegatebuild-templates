import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * WebOS scroll container — REQUIRED for any scrollable area in a WebOS app.
 *
 * Mirrors Delegate's `components/webos/AppScrollContainer`. A flex child with
 * `flex-1 overflow-y-auto` needs `min-h-0` to scroll inside its window instead
 * of expanding past it. This enforces the outer clip frame
 * (`flex flex-col h-full overflow-hidden`) AND the inner scroll surface
 * (`flex-1 min-h-0 overflow-y-auto overscroll-contain`) in one place.
 *
 * Do NOT add `flex-1 min-h-0 overflow-y-auto` to `innerClassName` — already set.
 */
export interface AppScrollContainerProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  testId?: string;
}

export const AppScrollContainer = forwardRef<HTMLDivElement, AppScrollContainerProps>(
  function AppScrollContainer({ children, className, innerClassName, testId }, ref) {
    return (
      <div className={cn("flex flex-col h-full overflow-hidden", className)}>
        <div
          ref={ref}
          data-testid={testId}
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overscroll-contain webos-scrollbar",
            innerClassName
          )}
        >
          {children}
        </div>
      </div>
    );
  }
);
