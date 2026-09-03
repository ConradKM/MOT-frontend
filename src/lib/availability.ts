import type { DayLevel, SlotStatus } from '../api/publicGarage'

export interface LevelStyle {
  /** Human text — never rely on colour alone. */
  label: string
  /** Short glyph shown alongside the number in a day cell. */
  icon: string
  /** Border/background/text classes for a day cell at this level. */
  cell: string
  /** Solid colour for the legend swatch. */
  swatch: string
  selectable: boolean
}

export const DAY_LEVELS: Record<DayLevel, LevelStyle> = {
  available: {
    label: 'Good availability',
    icon: '✓',
    cell: 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-500',
    swatch: 'bg-emerald-500',
    selectable: true,
  },
  limited: {
    label: 'Limited availability',
    icon: '!',
    cell: 'border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-500',
    swatch: 'bg-amber-500',
    selectable: true,
  },
  full: {
    label: 'Fully booked',
    icon: '✕',
    cell: 'border-slate-200 bg-slate-50 text-slate-400',
    swatch: 'bg-rose-500',
    selectable: false,
  },
  closed: {
    label: 'Closed',
    icon: '–',
    cell: 'border-slate-100 bg-white text-slate-300',
    swatch: 'bg-slate-300',
    selectable: false,
  },
  past: {
    label: 'Unavailable',
    icon: '',
    cell: 'border-transparent bg-transparent text-slate-300',
    swatch: 'bg-slate-200',
    selectable: false,
  },
}

/** The levels worth showing in the calendar legend, in order. */
export const LEGEND_LEVELS: DayLevel[] = ['available', 'limited', 'full', 'closed']

export const SLOT_STATUS: Record<
  SlotStatus,
  { label: string; selectable: boolean; pill: string }
> = {
  available: {
    label: 'Available',
    selectable: true,
    pill: 'text-emerald-700',
  },
  limited: {
    label: 'Limited',
    selectable: true,
    pill: 'text-amber-700',
  },
  booked: {
    label: 'Booked',
    selectable: false,
    pill: 'text-slate-400',
  },
}
