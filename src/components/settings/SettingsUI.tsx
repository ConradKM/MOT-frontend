/**
 * Shared building blocks for every page inside SettingsLayout.
 *
 * Type scale - a heading must be visibly larger *and* heavier than the text
 * beneath it, so the page reads top-down at a glance:
 *
 *   page title (h1)     text-2xl font-semibold   SettingsPageHeader
 *   section (h2)        text-lg  font-semibold   SettingsSection
 *   sub-section (h3)    text-base font-semibold  SettingsSubheading
 *   field label         text-sm  font-medium     FieldLabel
 *   body                text-sm
 *
 * A page's one-line description stays visible under its title. Every other
 * explanation - for a section, card or field - lives in an InfoTip beside the
 * name it explains, never as a permanent paragraph. What else stays on
 * screen is what the user must see to avoid getting stuck: validation
 * errors, blocking/warning messages, and state such as "Only an owner can
 * change this".
 */
import type { HTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'
import { InfoTip } from './InfoTip'

export function SettingsPageHeader({
  title,
  description,
  actions,
}: {
  title: string
  /** The page's description, shown under the title - the one explanation
   * that stays on screen rather than going into a tip. */
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 max-w-2xl">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** A section heading row: the h2, its tip, and optional controls on the right. */
export function SectionHeading({
  title,
  info,
  actions,
  id,
  as: Tag = 'h2',
}: {
  title: string
  info?: ReactNode
  actions?: ReactNode
  id?: string
  as?: 'h2' | 'h3'
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <Tag
          id={id}
          className={
            Tag === 'h2'
              ? 'text-lg font-semibold text-slate-900'
              : 'text-base font-semibold text-slate-900'
          }
        >
          {title}
        </Tag>
        {info && <InfoTip label={title}>{info}</InfoTip>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** A titled section of a settings page. */
export function SettingsSection({
  title,
  info,
  actions,
  id,
  className = '',
  children,
}: {
  title: string
  info?: ReactNode
  actions?: ReactNode
  /** The heading's id - also an in-page anchor (`#id`). */
  id?: string
  className?: string
  children: ReactNode
}) {
  const fallbackId = useId()
  const headingId = id ?? fallbackId
  return (
    <section aria-labelledby={headingId} className={className}>
      <SectionHeading title={title} info={info} actions={actions} id={headingId} />
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function SettingsSubheading({
  title,
  info,
  actions,
  id,
}: {
  title: string
  info?: ReactNode
  actions?: ReactNode
  id?: string
}) {
  return <SectionHeading as="h3" title={title} info={info} actions={actions} id={id} />
}

/** A white card that stands off the grey settings page. */
export function SettingsCard({
  children,
  className = '',
  as: Tag = 'div',
  ...rest
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'li'
} & HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`rounded-lg bg-white p-4 shadow-card sm:p-5 ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

/**
 * A field's label with an optional tip beside it. Points at its control with
 * `htmlFor`, so the tip button sits outside the <label> and its name never
 * becomes part of the field's.
 */
export function FieldLabel({
  htmlFor,
  children,
  info,
  required,
  className = '',
}: {
  htmlFor: string
  children: string
  info?: ReactNode
  required?: boolean
  className?: string
}) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {children}
        {required && <span className="text-red-600"> *</span>}
      </label>
      {info && <InfoTip label={children}>{info}</InfoTip>}
    </div>
  )
}
