/** Format a minor-unit amount (e.g. pence) as a localized currency string.
 * `currency` comes from the API (not user-typed in the current UI, but the
 * backend only checks it's 3 characters, not that it's a real ISO code) -
 * `Intl.NumberFormat` throws a RangeError on an invalid code, which would
 * otherwise take down the whole customer/settings page over one bad value. */
export function formatMinor(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(minor / 100)
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`
  }
}
