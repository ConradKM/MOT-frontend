import { useState, type ReactNode } from 'react'

/**
 * A value that rolls in from the direction it moved whenever `compare`
 * changes - up for an increase, down for a decrease, with a brief highlight.
 * Nothing animates on first mount, and reduced motion shows the new value
 * straight away (see the `animate-value-*` utilities in index.css).
 *
 * `compare` is the number the direction is judged by (pence, minutes), kept
 * apart from `children` so formatted text never has to be parsed back.
 */
export function AnimatedValue({
  compare,
  children,
  className = '',
}: {
  compare: number
  children: ReactNode
  className?: string
}) {
  // Adjusting state during render rather than in an effect: the new value
  // and its animation land in the same paint, never a frame apart.
  const [state, setState] = useState<{ compare: number; tick: number; direction: 'up' | 'down' | null }>(
    { compare, tick: 0, direction: null },
  )
  if (state.compare !== compare) {
    setState({
      compare,
      tick: state.tick + 1,
      direction: compare > state.compare ? 'up' : 'down',
    })
  }

  const animation =
    state.direction === 'up'
      ? 'animate-value-up'
      : state.direction === 'down'
        ? 'animate-value-down'
        : ''

  return (
    <span className={`inline-block overflow-hidden align-bottom ${className}`}>
      {/* Keyed on each change so the animation replays, not just the first time. */}
      <span
        key={state.tick}
        data-direction={state.direction ?? undefined}
        className={`inline-block rounded px-0.5 ${animation}`}
      >
        {children}
      </span>
    </span>
  )
}
