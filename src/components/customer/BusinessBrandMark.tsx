import { useState } from 'react'

interface Props {
  name: string
  logoUrl: string | null
}

/** The business's logo, or a clean initials badge when it has none (or the
 * logo url fails to load - a presigned url that has expired, say). Never a
 * broken-image icon, and never a layout shift between the two states: both
 * render at the same fixed size. */
export function BusinessBrandMark({ name, logoUrl }: Props) {
  const [failed, setFailed] = useState(false)

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        onError={() => setFailed(true)}
        className="h-10 w-10 shrink-0 rounded-md border border-slate-200 bg-white object-contain"
      />
    )
  }

  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <div
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white"
    >
      {initial}
    </div>
  )
}
