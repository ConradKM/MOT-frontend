import { useState, type ReactNode } from 'react'

interface DisclosureProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

/** A collapsible section — click the header to show/hide its content. */
export function Disclosure({ title, defaultOpen = false, children }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-lg font-semibold text-slate-900">{title}</span>
        <svg
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="none"
        >
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && <div className="border-t border-slate-100 px-4 py-4">{children}</div>}
    </div>
  )
}
