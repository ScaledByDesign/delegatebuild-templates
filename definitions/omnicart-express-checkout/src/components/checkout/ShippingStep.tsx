import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatAmount } from "@/lib/omnicart";
import {
  EMPTY_ADDRESS,
  type ShippingAddress,
  type ShippingOption,
} from "@/lib/checkout-types";

interface ShippingStepProps {
  address: ShippingAddress;
  options: ShippingOption[];
  selectedOptionId: string;
  currency: string;
  onChangeAddress: (address: ShippingAddress) => void;
  onSelectOption: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

const FIELDS: { key: keyof ShippingAddress; label: string; span?: boolean }[] = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email", span: true },
  { key: "address_1", label: "Address", span: true },
  { key: "city", label: "City" },
  { key: "province", label: "State / Province" },
  { key: "postal_code", label: "Postal code" },
  { key: "country_code", label: "Country" },
];

/** Step 2 — collect shipping address and select an OmniCart shipping option. */
export function ShippingStep({
  address,
  options,
  selectedOptionId,
  currency,
  onChangeAddress,
  onSelectOption,
  onBack,
  onContinue,
}: ShippingStepProps) {
  const [touched, setTouched] = useState(false);
  const required: (keyof ShippingAddress)[] = [
    "first_name",
    "last_name",
    "email",
    "address_1",
    "city",
    "postal_code",
    "country_code",
  ];
  const isValid = required.every((k) => (address[k] ?? "").toString().trim().length > 0);

  const handleContinue = () => {
    setTouched(true);
    if (isValid) onContinue();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Shipping details</h2>
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-2">
          {FIELDS.map((field) => {
            const value = (address[field.key] ?? "") as string;
            const showError = touched && required.includes(field.key) && !value.trim();
            return (
              <div
                key={field.key}
                className={field.span ? "sm:col-span-2" : undefined}
              >
                <Label htmlFor={field.key} className="mb-1.5 block">
                  {field.label}
                </Label>
                <Input
                  id={field.key}
                  value={value}
                  aria-invalid={showError}
                  onChange={(e) =>
                    onChangeAddress({ ...address, [field.key]: e.target.value })
                  }
                />
                {showError && (
                  <p className="mt-1 text-xs text-destructive">Required</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <h3 className="pt-2 text-sm font-semibold">Shipping method</h3>
      <Card>
        <CardContent className="py-4">
          <RadioGroup value={selectedOptionId} onValueChange={onSelectOption}>
            {options.map((opt) => (
              <Label
                key={opt.id}
                htmlFor={opt.id}
                className="flex cursor-pointer items-center justify-between rounded-md border p-3 has-[:checked]:border-primary"
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem id={opt.id} value={opt.id} />
                  <span className="text-sm font-medium">{opt.name}</span>
                </div>
                <span className="text-sm font-medium">
                  {opt.amount === 0 ? "Free" : formatAmount(opt.amount, currency)}
                </span>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" size="lg" onClick={onBack}>
          Back to cart
        </Button>
        <Button size="lg" onClick={handleContinue}>
          Continue to payment
        </Button>
      </div>
    </div>
  );
}

export { EMPTY_ADDRESS };
