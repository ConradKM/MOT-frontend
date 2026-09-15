import { useState } from 'react'

interface Props {
  name: string
  logoUrl: string | null
  /** Overrides the default h-10 w-10 sizing - the staff header wants a
   * smaller mark than the public booking wizard's. */
  className?: string
}

/** The business's logo, or a clean initials badge when it has none (or the
 * logo url fails to load - a presigned url that has expired, say). Never a
 * broken-image icon, and never a layout shift between the two states: both
 * render at the same fixed size. Shared between the public booking wizard's
 * header and the garage app's own staff-facing header - same fallback rules,
 * one definition. */
export function BusinessBrandMark({ name, logoUrl, className }: Props) {
  const [failed, setFailed] = useState(false)
  const size = className ?? 'h-10 w-10'

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        onError={() => setFailed(true)}
        className={`${size} shrink-0 rounded-md border border-slate-200 bg-white object-contain`}
      />
    )
  }

  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <div
      aria-hidden="true"
      className={`${size} flex shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white`}
    >
      {initial}
    </div>
  )
}
