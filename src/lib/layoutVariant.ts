/**
 * Tenant layout registry (frontend mirror of app/garages/layouts.py).
 *
 * Every garage renders the same shared UI. A garage may optionally be pinned to
 * a named layout *variant* - a presentation-only bundle. The rule is the same on
 * both sides of the wire:
 *
 *   A variant is a DATA entry in LAYOUT_VARIANTS, resolved by key.
 *   Never branch on `garage.name` or `garage.id`.
 *
 * `layout_variant` is platform-controlled: it is chosen at onboarding and comes
 * back on the garage payload read-only. Garage users can't change it.
 */

export const DEFAULT_LAYOUT_VARIANT = 'default'

export interface LayoutVariant {
  /** data-layout-variant value + CSS hook. */
  key: string
  label: string
}

export const LAYOUT_VARIANTS: Record<string, LayoutVariant> = {
  default: { key: 'default', label: 'Standard' },
}

export function isKnownLayoutVariant(variant: string | null | undefined): boolean {
  return variant != null && variant in LAYOUT_VARIANTS
}

/**
 * The layout key to render for a garage. Falls back to the shared default when
 * the garage has no variant pinned or names one that isn't registered (e.g. a
 * variant retired after it was assigned).
 */
export function resolveLayoutVariant(
  garage: { layout_variant?: string | null } | null | undefined,
): string {
  const variant = garage?.layout_variant
  return isKnownLayoutVariant(variant) ? (variant as string) : DEFAULT_LAYOUT_VARIANT
}
