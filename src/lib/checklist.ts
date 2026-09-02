import type { ChecklistItemStatus } from '../types'

export const CHECKLIST_ITEM_STATUSES: ChecklistItemStatus[] = [
  'PASS',
  'ADVISORY',
  'MINOR',
  'MAJOR',
  'DANGEROUS',
  'RECTIFIED',
  'RECOMMENDED',
  'CUSTOMER_DECLINED',
  'NOT_APPLICABLE',
  'NOT_CHECKED',
]

export const checklistItemStatusLabels: Record<ChecklistItemStatus, string> = {
  PASS: 'Pass',
  ADVISORY: 'Advisory',
  MINOR: 'Minor',
  MAJOR: 'Major',
  DANGEROUS: 'Dangerous',
  RECTIFIED: 'Rectified',
  RECOMMENDED: 'Recommended',
  CUSTOMER_DECLINED: 'Customer declined',
  NOT_APPLICABLE: 'N/A',
  NOT_CHECKED: 'Not checked',
}

/** Locked-in color scheme (see MOT-backend issue #8): mirrors DVSA grading — green for a
 * clean pass, amber-light/dark for advisory-register issues, red/dark-red for fails,
 * grey-light/dark for the two statuses with no pass/fail signal. Rectified/Recommended/
 * Customer-declined deliberately reuse Pass/Advisory/Minor's colors rather than getting
 * their own, since they're the same severity register under a different name. */
export const checklistItemStatusClasses: Record<ChecklistItemStatus, string> = {
  PASS: 'bg-emerald-100 text-emerald-700',
  ADVISORY: 'bg-amber-100 text-amber-700',
  MINOR: 'bg-amber-200 text-amber-900',
  MAJOR: 'bg-red-100 text-red-700',
  DANGEROUS: 'bg-red-600 text-white',
  RECTIFIED: 'bg-emerald-100 text-emerald-700',
  RECOMMENDED: 'bg-amber-100 text-amber-700',
  CUSTOMER_DECLINED: 'bg-amber-200 text-amber-900',
  NOT_APPLICABLE: 'bg-slate-100 text-slate-500',
  NOT_CHECKED: 'bg-slate-300 text-slate-700',
}
