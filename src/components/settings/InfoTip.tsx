import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { Info } from 'lucide-react'

/** Gap kept between the tip and either edge of the viewport. */
const EDGE_GAP = 8
/** Grace period for moving the pointer from the icon onto the tip. */
const CLOSE_DELAY_MS = 120

interface InfoTipProps {
  /** What the tip explains - becomes the button's name, "About {label}". */
  label: string
  children: ReactNode
  className?: string
}

/**
 * The explanation for a setting, behind an info icon beside its name, so the
 * page shows a name and its control and nothing else permanently.
 *
 * Opens on hover, on keyboard focus and on tap (touch has no hover); closes
 * on Escape, on a tap outside, or when the pointer and focus have both left.
 * The tip is part of the hover area, so it stays open while the pointer is
 * over it (WCAG 1.4.13). The text is always in the DOM and wired to the
 * button with `aria-describedby`, so a screen reader hears it on focus
 * whether or not it is showing.
 *
 * Never put this inside a <label> or a heading - its name would leak into
 * theirs. Put it beside them (see FieldLabel / SettingsSection).
 */
export function InfoTip({ label, children, className = '' }: InfoTipProps) {
  const tipId = useId()
  const [open, setOpen] = useState(false)
  const [offset, setOffset] = useState(0)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)
  // Set between pointerdown and click, so a tap's focus event doesn't open
  // the tip only for the click straight after to toggle it shut again.
  const pointerType = useRef<string | null>(null)

  const cancelClose = () => window.clearTimeout(closeTimer.current)
  useEffect(() => cancelClose, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: globalThis.PointerEvent | MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Keep the tip on screen: centred under the icon where it fits, nudged
  // sideways where it would run off either edge.
  useLayoutEffect(() => {
    if (!open || !tipRef.current) return
    const rect = tipRef.current.getBoundingClientRect()
    const viewport = document.documentElement.clientWidth || window.innerWidth
    const left = rect.left - offset
    const right = rect.right - offset
    if (left < EDGE_GAP) setOffset(EDGE_GAP - left)
    else if (right > viewport - EDGE_GAP) setOffset(viewport - EDGE_GAP - right)
    else if (offset !== 0) setOffset(0)
    // Measured once per opening; re-running on `offset` would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onPointerEnter = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    cancelClose()
    setOpen(true)
  }
  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    cancelClose()
    closeTimer.current = window.setTimeout(() => {
      if (!wrapperRef.current?.contains(document.activeElement)) setOpen(false)
    }, CLOSE_DELAY_MS)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    // Handled here so an Escape that closes the tip doesn't also close
    // whatever the tip sits in (an expanded table row, a dialog).
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <span
      ref={wrapperRef}
      className={`relative inline-flex align-middle ${className}`}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={tipId}
        aria-expanded={open}
        onPointerDown={(e) => {
          pointerType.current = e.pointerType || 'mouse'
        }}
        onFocus={() => {
          if (!pointerType.current) setOpen(true)
        }}
        onBlur={(e) => {
          if (!wrapperRef.current?.contains(e.relatedTarget as Node)) setOpen(false)
        }}
        onClick={() => {
          // A mouse click on an icon the pointer is already hovering keeps
          // the tip up; a tap or a keyboard press toggles it.
          if (pointerType.current === 'mouse') setOpen(true)
          else setOpen((o) => !o)
          pointerType.current = null
        }}
        className="relative inline-flex h-6 w-6 shrink-0 cursor-help items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 before:absolute before:-inset-2.5 before:content-['']"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      <span
        ref={tipRef}
        id={tipId}
        role="tooltip"
        hidden={!open}
        style={{ transform: `translateX(calc(-50% + ${offset}px))` }}
        className="absolute left-1/2 top-full z-30 w-max max-w-[min(18rem,calc(100vw-1rem))] pt-1.5 text-left text-xs font-normal normal-case leading-5 tracking-normal"
      >
        <span className="block whitespace-normal rounded-md bg-slate-900 px-3 py-2 text-white shadow-lg">
          {children}
        </span>
      </span>
    </span>
  )
}
