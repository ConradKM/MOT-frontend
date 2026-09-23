import type { AvailabilitySlot, DayLevel, SlotStatus } from '../api/publicGarage'

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

/** Above this many slots for a day, TimeSlotPicker groups them into coarser
 * buckets first rather than rendering one button per slot (relevant once
 * garages can offer 5-minute granularity - a full day can be 80+ slots). At
 * or below it, slots render as a single flat grid same as before. */
export const BUCKET_STEP_THRESHOLD = 8

const BUCKET_MINUTES = 60

export interface SlotBucket {
  /** "HH:MM" bucket start, e.g. "09:00". */
  bucketStart: string
  /** "HH:MM" bucket end (exclusive), e.g. "10:00". */
  bucketEnd: string
  /** Best status among the bucket's slots - available > limited > booked. */
  status: SlotStatus
  slots: AvailabilitySlot[]
}

function parseHHMM(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

function formatHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function aggregateBucketStatus(slots: AvailabilitySlot[]): SlotStatus {
  if (slots.some((s) => s.status === 'available')) return 'available'
  if (slots.some((s) => s.status === 'limited')) return 'limited'
  return 'booked'
}

/** Group a day's flat slot list into fixed-size time windows (default 1
 * hour), each carrying the best status of the slots it contains. Slots are
 * bucketed by their own start time only - a slot's own duration may run past
 * its bucket's end, which is fine since the bucket is a display grouping,
 * not a booking constraint. */
export function groupIntoHourBuckets(
  slots: AvailabilitySlot[],
  bucketMinutes: number = BUCKET_MINUTES,
): SlotBucket[] {
  const buckets = new Map<number, AvailabilitySlot[]>()
  for (const slot of slots) {
    const bucketStartMin = Math.floor(parseHHMM(slot.start) / bucketMinutes) * bucketMinutes
    const bucketSlots = buckets.get(bucketStartMin) ?? []
    bucketSlots.push(slot)
    buckets.set(bucketStartMin, bucketSlots)
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucketStartMin, bucketSlots]) => ({
      bucketStart: formatHHMM(bucketStartMin),
      bucketEnd: formatHHMM(bucketStartMin + bucketMinutes),
      status: aggregateBucketStatus(bucketSlots),
      slots: bucketSlots,
    }))
}
