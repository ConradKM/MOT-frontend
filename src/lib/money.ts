/** Format a minor-unit amount (e.g. pence) as a localized currency string. */
export function formatMinor(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(minor / 100)
}
