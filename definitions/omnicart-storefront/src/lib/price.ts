/**
 * Format a price amount to a currency string
 * @param amount - The price amount (in dollars, not cents)
 * @param currencyCode - The currency code (e.g., 'USD', 'EUR')
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number, currencyCode: string = 'USD'): string => {
  if (!Number.isFinite(amount)) {
    return '—';
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    // Fallback to USD if currency code is invalid
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  }
};

/**
 * Alias for formatCurrency for backward compatibility
 */
export const formatPrice = formatCurrency;

