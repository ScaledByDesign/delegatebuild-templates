export type ExpressCheckoutLineItem = { name: string; amount: number }

export type ExpressCheckoutLineItemsCartTotals = {
  item_subtotal?: number
  shipping_total?: number
  tax_total?: number
  discount_total?: number
  total?: number
}

const toCents = (amount: number) => Math.round(amount * 100)

/**
 * Build Apple Pay / Google Pay line items for Stripe's Express Checkout sheet.
 *
 * Stripe expects the sum of `lineItems[].amount` (minor units) to match the PaymentIntent amount.
 * Because cart totals are floats, we reconcile any rounding delta by adjusting the Tax line when
 * present, otherwise the last line item.
 *
 * Note: Stripe's Express Checkout uses 'name' property (not 'label') for lineItems
 */
export const buildExpressCheckoutLineItems = (
  cart: ExpressCheckoutLineItemsCartTotals
): ExpressCheckoutLineItem[] => {
  const itemSubtotal = cart.item_subtotal ?? 0
  const shippingTotal = cart.shipping_total ?? 0
  const taxTotal = cart.tax_total ?? 0
  const discountTotal = cart.discount_total ?? 0

  const lineItems: ExpressCheckoutLineItem[] = [
    { name: 'Subtotal', amount: toCents(itemSubtotal) },
  ]

  if (shippingTotal > 0) {
    lineItems.push({ name: 'Shipping', amount: toCents(shippingTotal) })
  }

  if (discountTotal > 0) {
    lineItems.push({ name: 'Discount', amount: -toCents(discountTotal) })
  }

  if (taxTotal > 0) {
    lineItems.push({ name: 'Tax', amount: toCents(taxTotal) })
  }

  if (typeof cart.total === 'number' && lineItems.length) {
    const expectedTotal = toCents(cart.total)
    const sum = lineItems.reduce((acc, li) => acc + li.amount, 0)
    const diff = expectedTotal - sum

    if (diff !== 0) {
      const taxIdx = lineItems.findIndex((li) => li.name === 'Tax')
      const idxToAdjust = taxIdx >= 0 ? taxIdx : lineItems.length - 1
      lineItems[idxToAdjust] = {
        ...lineItems[idxToAdjust],
        amount: lineItems[idxToAdjust].amount + diff,
      }
    }
  }

  return lineItems
}
