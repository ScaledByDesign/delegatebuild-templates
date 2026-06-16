import React, { useCallback } from "react";
import {
  PaymentElement,
  AddressElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  StripePaymentElementChangeEvent,
  StripeAddressElementChangeEvent,
} from "@stripe/stripe-js";
import {
  updateShippingAddress,
  updateBillingAddress,
  updateCartEmail,
} from "@/lib/data/checkout";
import { Checkbox } from "@/components/ui/checkbox";
import { capitalizeWords } from "@/lib/checkout/states";
import { saveOrderRecoveryData } from "@/lib/checkout/orderRecovery";

interface PaymentElementComponentProps {
  onSuccess: (paymentIntent?: any) => void; // Updated to accept paymentIntent
  onError: (error: string) => void;
  isProcessing?: boolean;
  collectShipping?: boolean; // Optional: collect shipping address separately
  cartId?: string; // Cart ID for syncing address with Medusa
  onAddressUpdated?: (address: any) => void; // Callback when address is synced with Medusa
  email?: string; // Email from parent (cart email)
  shippingAddress?: any; // Shipping address from cart (for billing same as shipping)
}

export const PaymentElementComponent: React.FC<
  PaymentElementComponentProps
> = ({
  onSuccess,
  onError,
  isProcessing = false,
  collectShipping = false,
  cartId = "",
  onAddressUpdated,
  email = "",
  shippingAddress: shippingAddressProp,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = React.useState(false);
  const [shippingAddress, setShippingAddress] = React.useState<any>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [smsOptIn, setSmsOptIn] = React.useState(false);
  const [billingSameAsShipping, setBillingSameAsShipping] =
    React.useState(true);

  // Sync billing address to Medusa when checkbox changes
  React.useEffect(() => {
    if (billingSameAsShipping && shippingAddressProp && cartId) {
      // Use shipping address as billing address
      updateBillingAddress(cartId, shippingAddressProp)
        .then(() => console.log("✅ Billing address synced to match shipping"))
        .catch((error) =>
          console.error("Failed to sync billing address:", error),
        );
    }
  }, [billingSameAsShipping, shippingAddressProp, cartId]);

  const handlePaymentChange = useCallback(
    (event: StripePaymentElementChangeEvent) => {
      console.log("Payment element changed:", event.value.type);
    },
    [],
  );

  const syncAddressWithMedusa = useCallback(async (stripeAddress: any) => {
    try {
      console.log("🏠 Syncing address with Medusa for tax calculation...");
      console.log("📍 Raw Stripe Address Element value:", stripeAddress);

      // Address Element returns address fields nested under 'address' property
      // Structure: { name: "...", phone: "...", address: { line1, city, state, ... } }
      const addressData = stripeAddress.address || {};

      // Extract state code from Stripe address (e.g., "TX", "CA")
      const stripeStateCode = addressData.state?.toUpperCase?.() || "";

      // Stripe returns country as "US", "CA", etc. Convert to proper country_code
      const countryCode = addressData.country?.toLowerCase?.() || "us";

      // Convert Stripe state code to Medusa tax region format
      // Medusa tax regions use format: "us-tx" (country-state, lowercase)
      // Stripe sends: "TX" (uppercase state only)
      const provinceCode = stripeStateCode
        ? `${countryCode}-${stripeStateCode.toLowerCase()}`
        : "";

      console.log(
        `💰 Tax region mapping: Stripe "${stripeStateCode}" → Medusa "${provinceCode}"`,
      );

      const medusaAddress = {
        first_name: stripeAddress.name?.split(" ")[0] || "",
        last_name: stripeAddress.name?.split(" ").slice(1).join(" ") || "",
        address_1: addressData.line1 || "",
        address_2: addressData.line2 || "",
        city: addressData.city || "",
        province: provinceCode, // Use converted format for tax matching
        postal_code: addressData.postal_code || "",
        country_code: countryCode,
        phone: stripeAddress.phone || "",
      };

      console.log("📦 Sending address to Medusa:", medusaAddress);

      // Sync shipping address
      const response = await updateShippingAddress(cartId, medusaAddress);
      const updatedCart = (response as any)?.cart;

      console.log("✅ Shipping address synced with Medusa");

      // Log tax calculation results
      if (updatedCart) {
        const taxTotal = updatedCart.tax_total || 0;
        const subtotal = updatedCart.subtotal || 0;
        const taxRate =
          subtotal > 0 ? ((taxTotal / subtotal) * 100).toFixed(2) : "0.00";
        console.log(
          `💰 Tax calculated: $${taxTotal.toFixed(2)} (${taxRate}% of $${subtotal.toFixed(2)})`,
        );
        console.log(`   Province: ${provinceCode}, Country: ${countryCode}`);

        if (taxTotal === 0 && provinceCode === "us-tx") {
          console.warn(
            "⚠️ Texas order with $0 tax - check tax region configuration!",
          );
        }
      }

      // Also set as billing address (most customers use same address for both)
      // This will be updated with actual billing details after payment if different
      await updateBillingAddress(cartId, medusaAddress);
      console.log(
        "✅ Billing address pre-filled (will update after payment if different)",
      );

      if (onAddressUpdated) {
        onAddressUpdated(updatedCart);
      }
    } catch (error) {
      console.error("❌ Failed to sync address with Medusa:", error);
      // Don't stop payment for address sync failure - just log it
    }
  }, [cartId, onAddressUpdated]);

  const handleShippingChange = useCallback(
    (event: StripeAddressElementChangeEvent) => {
      if (event.complete) {
        console.log("Shipping address collected from Stripe:", event.value);
        setShippingAddress(event.value);

        // Sync address with Medusa to recalculate tax
        if (cartId) {
          syncAddressWithMedusa(event.value);
        }
      }
    },
    [cartId, syncAddressWithMedusa],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      // Clear any previous errors
      setErrorMessage(null);

      // Email validation - safety net in case parent doesn't validate
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        const errorMsg =
          "Please enter a valid email address before completing your order.";
        setErrorMessage(errorMsg);
        onError(errorMsg);
        return;
      }

      if (!stripe || !elements) {
        const errorMsg =
          "Stripe not loaded. Please refresh the page and try again.";
        setErrorMessage(errorMsg);
        onError(errorMsg);
        return;
      }

      setIsLoading(true);

      try {
        const { error: submitError } = await elements.submit();
        if (submitError) {
          const errorMsg = submitError.message || "Payment submission failed";
          setErrorMessage(errorMsg);
          onError(errorMsg);
          setIsLoading(false);
          return;
        }

        // Prepare billing details
        const billingDetails: any = {
          email: email,
        };

        // If billing same as shipping, use shipping address
        if (billingSameAsShipping && shippingAddressProp) {
          billingDetails.name =
            `${shippingAddressProp.first_name || ""} ${shippingAddressProp.last_name || ""}`.trim();
          billingDetails.phone = shippingAddressProp.phone;
          billingDetails.address = {
            line1: shippingAddressProp.address_1,
            line2: shippingAddressProp.address_2 || undefined,
            city: shippingAddressProp.city,
            state: shippingAddressProp.province
              ?.replace("us-", "")
              .toUpperCase(),
            postal_code: shippingAddressProp.postal_code,
            country: "US",
          };
        }

        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          redirect: "if_required",
          confirmParams: {
            payment_method_data: {
              billing_details: billingDetails,
            },
          },
        });

        if (error) {
          // Map Stripe error codes to user-friendly messages
          let errorMsg = error.message || "Payment failed";

          // Provide specific guidance based on error type
          if (error.type === "card_error") {
            switch (error.code) {
              case "card_declined":
                errorMsg =
                  "Your card was declined. Please try a different payment method.";
                break;
              case "insufficient_funds":
                errorMsg = "Insufficient funds. Please try a different card.";
                break;
              case "expired_card":
                errorMsg =
                  "Your card has expired. Please use a different card.";
                break;
              case "incorrect_cvc":
                errorMsg =
                  "Incorrect security code (CVC). Please check and try again.";
                break;
              case "processing_error":
                errorMsg =
                  "An error occurred while processing your card. Please try again.";
                break;
              default:
                errorMsg =
                  error.message || "Card payment failed. Please try again.";
            }
          } else if (error.type === "validation_error") {
            errorMsg = "Please check your payment details and try again.";
          }

          console.error("Stripe payment error:", {
            type: error.type,
            code: error.code,
            message: error.message,
          });
          setErrorMessage(errorMsg);
          onError(errorMsg);
        } else if (paymentIntent?.status === "succeeded") {
          console.log("✅ Payment succeeded, PaymentIntent:", paymentIntent.id);
          console.log(
            "💳 Billing address from PaymentIntent:",
            paymentIntent.billing_details?.address,
          );

          // CRITICAL: Save recovery data IMMEDIATELY after payment capture,
          // BEFORE any cart-mutating call (billing sync below, or the address/
          // tax sync + complete in handlePaymentSuccess). Once the PaymentIntent
          // is in a terminal "succeeded" state, those mutations can fail with
          // "Could not delete all payment sessions" and leave the customer
          // charged but the order stuck pending. With recovery data saved,
          // attemptOrderRecovery() can finish the order on the next page load.
          if (cartId) {
            saveOrderRecoveryData({
              cartId,
              paymentIntentId: paymentIntent.id,
              paymentIntentStatus: paymentIntent.status,
              paymentAmount: paymentIntent.amount,
              email,
            });
          }

          // Email is already synced from our custom input field
          // No need to sync email from PaymentIntent since we're not collecting it there

          // Sync actual billing address from PaymentIntent to Medusa cart
          if (cartId && paymentIntent.billing_details) {
            try {
              const billingDetails = paymentIntent.billing_details;

              // Format name parts with proper capitalization
              const nameParts = billingDetails.name?.split(" ") || [];
              const firstName = nameParts[0]
                ? capitalizeWords(nameParts[0])
                : "";
              const lastName = nameParts.slice(1).join(" ");
              const formattedLastName = lastName
                ? capitalizeWords(lastName)
                : "";

              const billingAddress = {
                first_name: firstName,
                last_name: formattedLastName,
                address_1: billingDetails.address?.line1
                  ? capitalizeWords(billingDetails.address.line1)
                  : "",
                address_2: billingDetails.address?.line2
                  ? capitalizeWords(billingDetails.address.line2)
                  : "",
                city: billingDetails.address?.city
                  ? capitalizeWords(billingDetails.address.city)
                  : "",
                province: billingDetails.address?.state || "",
                postal_code: billingDetails.address?.postal_code || "",
                country_code:
                  billingDetails.address?.country?.toLowerCase() || "us",
                phone: billingDetails.phone || "",
              };

              await updateBillingAddress(cartId, billingAddress);
              console.log("✅ Final billing address synced to Medusa cart");
            } catch (error) {
              console.error("Failed to sync billing address to Medusa:", error);
              // Don't fail payment for billing address sync failure
            }
          }

          setErrorMessage(null);
          onSuccess(paymentIntent); // Pass PaymentIntent to success handler
        } else if (paymentIntent?.status === "processing") {
          console.log("Payment processing...");
          setErrorMessage("Payment is being processed. Please wait...");
        } else if (paymentIntent?.status === "requires_payment_method") {
          // Payment failed but can be retried
          const errorMsg =
            "Payment was not successful. Please check your payment details and try again.";
          setErrorMessage(errorMsg);
          onError(errorMsg);
        } else if (paymentIntent?.status === "requires_action") {
          // Additional authentication required (3D Secure, etc.)
          const errorMsg =
            "Additional authentication required. Please complete the verification.";
          setErrorMessage(errorMsg);
          onError(errorMsg);
        } else {
          const errorMsg = `Unexpected payment status: ${paymentIntent?.status}. Please contact support.`;
          setErrorMessage(errorMsg);
          onError(errorMsg);
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again.";
        setErrorMessage(errorMsg);
        onError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [
      stripe,
      elements,
      onSuccess,
      onError,
      email,
      cartId,
      billingSameAsShipping,
      shippingAddressProp,
    ],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Message Display */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">
                Payment Error
              </h3>
              <div className="mt-2 text-sm text-red-700">{errorMessage}</div>
              {!errorMessage.includes("terminal") &&
                !errorMessage.includes("expired") && (
                  <div className="mt-3 text-sm text-red-600">
                    <p className="font-medium">You can try again:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Check your card details are correct</li>
                      <li>Try a different payment method</li>
                      <li>Contact your bank if the issue persists</li>
                    </ul>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Shipping Address (Optional) */}
      {collectShipping && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-3 text-gray-700">
            Shipping Address
          </h4>
          <AddressElement
            onChange={handleShippingChange}
            options={{
              mode: "shipping",
              allowedCountries: ["US"],
              fields: {
                phone: "always",
              },
              validation: {
                phone: {
                  required: "always",
                },
              },
            }}
          />
        </div>
      )}

      {/* Billing Same as Shipping Checkbox - Show when we have a shipping address */}
      {shippingAddressProp && (
        <div className="flex items-center gap-2 mb-4">
          <Checkbox
            id="billing-same-as-shipping"
            checked={billingSameAsShipping}
            onCheckedChange={(checked) =>
              setBillingSameAsShipping(checked as boolean)
            }
          />
          <label
            htmlFor="billing-same-as-shipping"
            className="text-sm font-medium cursor-pointer"
            style={{
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              color: "rgb(60, 60, 60)",
            }}
          >
            Billing address is same as shipping
          </label>
        </div>
      )}

      {/* Payment Details with Billing Address */}
      <div className="border border-gray-200 rounded-lg p-4">
        <PaymentElement
          onChange={handlePaymentChange}
          options={{
            layout: "accordion",
            fields: {
              billingDetails: {
                name:
                  billingSameAsShipping && shippingAddressProp
                    ? "never"
                    : "auto",
                email: "never", // We collect email ourselves
                phone:
                  billingSameAsShipping && shippingAddressProp
                    ? "never"
                    : "auto",
                address:
                  billingSameAsShipping && shippingAddressProp
                    ? "never"
                    : "auto",
              },
            },
          }}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || isProcessing || !stripe || !elements}
        className="w-full bg-[#4188d3] text-white py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#197bbd] transition-colors"
      >
        {isLoading || isProcessing ? "Processing..." : "Complete Order"}
      </button>

      {/* SMS Marketing Opt-in Section */}
      <div
        className="bg-white"
        style={{
          border: "1px solid rgb(230, 230, 230)",
          borderRadius: "4px",
          padding: "12px",
          display: "block",
          boxSizing: "border-box",
        }}
      >
        <div className="flex items-start gap-3">
          <Checkbox
            id="sms-optin-express"
            checked={smsOptIn}
            onCheckedChange={(checked) => setSmsOptIn(checked as boolean)}
            className="mt-1"
          />
          <div className="flex-1">
            <label
              htmlFor="sms-optin-express"
              className="block cursor-pointer"
              style={{
                fontFamily: '"roboto condensed", sans-serif',
                fontSize: "14px",
                color: "rgb(111, 111, 111)",
                overflowWrap: "break-word",
                wordBreak: "break-word",
              }}
            >
              <div style={{ fontWeight: "500", marginBottom: "4px" }}>
                Get 10% off your next order
              </div>
              <div style={{ color: "rgb(111, 111, 111)", marginBottom: "8px" }}>
                Sign up to get texts from VNSH and we'll text you a coupon code
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: "rgb(111, 111, 111)",
                  lineHeight: "1.3",
                }}
              >
                By checking this box, you agree to receive recurring automated
                promotional and personalized marketing text messages{" "}
                <b>(e.g. cart reminders)</b> from VNSH at the cell number used
                when signing up. Consent is not a condition of any purchase.{" "}
                <b>Reply HELP for help and STOP to cancel.</b> Msg frequency
                varies. Msg & data rates may apply. View{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ cursor: "pointer" }}
                >
                  Terms
                </a>{" "}
                &{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ cursor: "pointer" }}
                >
                  Privacy
                </a>
                .
              </div>
            </label>
          </div>
        </div>
      </div>
    </form>
  );
};
