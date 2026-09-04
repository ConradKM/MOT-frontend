import type { ChecklistItemStatus } from '../types'

/** Known labels/colours for the built-in options (the generic default and the
 * automotive/DVSA-style preset) - see
 * app/models/appointments/checklist_template_item.py on the backend. Any
 * other value (a garage's own custom result_options) falls back to
 * `humanizeResultOption` below rather than being unrenderable. */
const KNOWN_LABELS: Partial<Record<string, string>> = {
  NOT_CHECKED: 'Not checked',
  DONE: 'Done',
  NOT_APPLICABLE: 'N/A',
  PASS: 'Pass',
  ADVISORY: 'Advisory',
  MINOR: 'Minor',
  MAJOR: 'Major',
  DANGEROUS: 'Dangerous',
  RECTIFIED: 'Rectified',
  RECOMMENDED: 'Recommended',
  CUSTOMER_DECLINED: 'Customer declined',
}

/** Locked-in color scheme (see MOT-backend issue #8): mirrors DVSA grading — green for a
 * clean pass, amber-light/dark for advisory-register issues, red/dark-red for fails,
 * grey-light/dark for the two statuses with no pass/fail signal. Rectified/Recommended/
 * Customer-declined deliberately reuse Pass/Advisory/Minor's colors rather than getting
 * their own, since they're the same severity register under a different name. */
const KNOWN_CLASSES: Partial<Record<string, string>> = {
  NOT_CHECKED: 'bg-slate-300 text-slate-700',
  DONE: 'bg-emerald-100 text-emerald-700',
  NOT_APPLICABLE: 'bg-slate-100 text-slate-500',
  PASS: 'bg-emerald-100 text-emerald-700',
  ADVISORY: 'bg-amber-100 text-amber-700',
  MINOR: 'bg-amber-200 text-amber-900',
  MAJOR: 'bg-red-100 text-red-700',
  DANGEROUS: 'bg-red-600 text-white',
  RECTIFIED: 'bg-emerald-100 text-emerald-700',
  RECOMMENDED: 'bg-amber-100 text-amber-700',
  CUSTOMER_DECLINED: 'bg-amber-200 text-amber-900',
}

const FALLBACK_CLASS = 'bg-slate-200 text-slate-700'

/** "SOME_CUSTOM_VALUE" -> "Some custom value", for a garage's own result
 * option that isn't one of the built-in presets. */
export function humanizeResultOption(value: string): string {
  const known = KNOWN_LABELS[value]
  if (known) return known
  const words = value.toLowerCase().replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function resultOptionLabel(status: ChecklistItemStatus): string {
  return humanizeResultOption(status)
}

export function resultOptionClasses(status: ChecklistItemStatus): string {
  return KNOWN_CLASSES[status] ?? FALLBACK_CLASS
}
