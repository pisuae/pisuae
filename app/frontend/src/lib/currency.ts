/**
 * Currency formatting utility for PIS UAE marketplace.
 * All prices are displayed in AED (UAE Dirham).
 */

export const CURRENCY_CODE = 'AED';
export const CURRENCY_SYMBOL = 'AED';

/**
 * Format a number as AED currency string.
 * @example formatPrice(549) => "AED 549.00"
 * @example formatPrice(1299.5) => "AED 1,299.50"
 */
export function formatPrice(amount: number): string {
  return `${CURRENCY_SYMBOL} ${amount.toFixed(2)}`;
}

/**
 * Short format for tight spaces.
 * @example formatPriceShort(549) => "AED 549"
 */
export function formatPriceShort(amount: number): string {
  return `${CURRENCY_SYMBOL} ${Math.round(amount)}`;
}