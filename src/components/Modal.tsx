import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  /** Panel width: `md` (default), `lg` (same as `wide`), or `xl` for content
   * with tabs or side-by-side sections. Takes precedence over `wide`. */
  size?: 'md' | 'lg' | 'xl'
  /** Actions pinned below the content. When set, the header and footer stay
   * fixed and only the content scrolls - for long content whose actions must
   * stay reachable (e.g. Terms & Conditions with an Accept button). */
  footer?: ReactNode
  /** Accessible name for the content's own scroll region. With a footer the
   * region is keyboard-focusable (so it can be scrolled with the arrow keys)
   * and receives focus when the modal opens. */
  bodyLabel?: string
}

/** A generic modal shell - same backdrop/panel chrome as ConfirmDialog, but
 * for free-form content (e.g. a call's details) rather than a confirm/cancel
 * prompt. Escape and a backdrop click close it.
 *
 * Rendered into document.body: an ancestor with a transform (e.g. the
 * booking wizard's step-in animation) becomes the containing block for
 * `position: fixed`, which would otherwise clip the overlay to that ancestor
 * and push the panel's top or bottom off screen. */
const SIZE_CLASS = { md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' } as const

export function Modal({
  open,
  title,
  onClose,
  children,
  wide = false,
  size,
  footer,
  bodyLabel,
}: ModalProps) {
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const scrollRegion = Boolean(footer)
  useEffect(() => {
    if (open && scrollRegion) bodyRef.current?.focus()
  }, [open, scrollRegion])

  if (!open) return null

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
          <path
            d="M5 5l10 10M15 5L5 15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${SIZE_CLASS[size ?? (wide ? 'lg' : 'md')]} max-h-[85vh] rounded-lg bg-white shadow-xl ${
          scrollRegion ? 'flex flex-col' : 'overflow-y-auto p-5'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {scrollRegion ? (
          <>
            <div className="shrink-0 border-b border-slate-100 px-5 py-4">{header}</div>
            <div
              ref={bodyRef}
              role="region"
              aria-label={bodyLabel ?? title}
              tabIndex={0}
              className="min-h-0 flex-1 overflow-y-auto px-5 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400"
            >
              {children}
            </div>
            <div className="shrink-0 border-t border-slate-100 px-5 py-3">{footer}</div>
          </>
        ) : (
          <>
            {header}
            <div className="mt-4">{children}</div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
