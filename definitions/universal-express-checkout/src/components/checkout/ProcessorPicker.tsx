import { CreditCard, ShoppingCart, Workflow, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PROCESSOR_MANIFEST,
  type ProcessorKind,
} from "@/lib/checkout/manifest";

interface ProcessorPickerProps {
  /** Currently-selected processor. */
  value: ProcessorKind;
  /** Called when the merchant picks a different processor. */
  onChange: (kind: ProcessorKind) => void;
  /** Disable while a charge is in flight. */
  disabled?: boolean;
}

/** Icon per processor id, falling back to a generic card icon. */
const ICONS: Record<string, typeof CreditCard> = {
  stripe: CreditCard,
  omnicart: ShoppingCart,
  konnektive: Workflow,
  stickyio: Repeat,
};

/**
 * Processor selector for the universal checkout. Renders one tile per manifest
 * entry, tagged with its class (payment vs CRM). Drives which `CheckoutProcessorAdapter`
 * the page resolves from the registry. Manifest-driven: adding a processor to
 * `PROCESSOR_MANIFEST` (and registering its adapter) surfaces it here
 * automatically.
 */
export function ProcessorPicker({
  value,
  onChange,
  disabled,
}: ProcessorPickerProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Payment processor</h3>
        <span className="text-xs text-muted-foreground">
          Same checkout, any backend
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PROCESSOR_MANIFEST.map((entry) => {
          const Icon = ICONS[entry.id] ?? CreditCard;
          const isActive = entry.id === value;
          return (
            <button
              key={entry.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(entry.id)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/20 hover:border-muted-foreground/40",
                disabled && "cursor-not-allowed opacity-60",
              )}
              aria-pressed={isActive}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="text-sm font-medium text-foreground">
                {entry.label}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {entry.class === "payment" ? "Payment" : "CRM"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
