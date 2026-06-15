import { Check } from "lucide-react";
import { CHECKOUT_STEPS, type CheckoutStepId } from "@/lib/checkout-types";
import { cn } from "@/lib/utils";

interface CheckoutStepsProps {
  current: CheckoutStepId;
}

/** Horizontal progress indicator for the OmniCart checkout flow. */
export function CheckoutSteps({ current }: CheckoutStepsProps) {
  const currentIndex = CHECKOUT_STEPS.findIndex((s) => s.id === current);

  return (
    <ol className="flex items-center justify-between gap-2">
      {CHECKOUT_STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isActive = index === currentIndex;
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                isDone && "border-primary bg-primary text-primary-foreground",
                isActive && "border-primary text-primary",
                !isDone && !isActive && "border-muted-foreground/30 text-muted-foreground",
              )}
            >
              {isDone ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <span
              className={cn(
                "hidden text-sm font-medium sm:inline",
                isActive ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
            {index < CHECKOUT_STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-px flex-1",
                  index < currentIndex ? "bg-primary" : "bg-muted-foreground/20",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
