import { useState, type FormEvent } from 'react'
import { CircleAlert, CircleCheck, ExternalLink } from 'lucide-react'
import { useGarage, useUpdateBookingAppearance } from '../../api/queries'
import { BookingThemeScope } from '../../components/customer/BookingThemeScope'
import { WizardStepper } from '../../components/customer/WizardStepper'
import { useToast } from '../../components/Toast'
import { useGarageId } from '../../hooks/useGarageId'
import { BOOKING_THEME_PRESETS, DEFAULT_BACKGROUND, DEFAULT_TEXT } from '../../lib/bookingTheme'
import { bookingUrl } from '../../lib/bookingUrl'
import { MIN_CONTRAST_RATIO, contrastRatio, formatRatio, isHexColor } from '../../lib/contrast'
import { errorMessage, isApiError } from '../../lib/errors'
import type { Garage } from '../../types'

const PREVIEW_STEPS = [
  { id: 1, label: 'Service' },
  { id: 2, label: 'Date & time' },
  { id: 3, label: 'Details' },
  { id: 4, label: 'Review' },
]

/**
 * The page background and page text colour of this business's customer-facing
 * pages (booking, walk-in queue, terms, customer portal). Owner only - the
 * server 403s anyone else, and is the authority on contrast (422).
 */
export function BookingAppearanceSettings() {
  const { data: garage, isLoading, isError } = useGarage()

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
        Booking page appearance
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Choose the colours customers see on your booking page, walk-in queue, terms page and
        customer account. This changes the page background and the text on it; cards and forms
        stay white so they are always easy to fill in. Only the business owner can change this.
      </p>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}
      {isError && <p className="mt-6 text-sm text-red-600">Failed to load your settings.</p>}
      {garage && (
        <AppearanceForm
          key={`${garage.booking_background_color}-${garage.booking_text_color}`}
          garage={garage}
        />
      )}
    </div>
  )
}

function AppearanceForm({ garage }: { garage: Garage }) {
  const garageId = useGarageId()
  const update = useUpdateBookingAppearance()
  const { showToast } = useToast()

  const [background, setBackground] = useState(garage.booking_background_color ?? DEFAULT_BACKGROUND)
  const [text, setText] = useState(garage.booking_text_color ?? DEFAULT_TEXT)
  const [error, setError] = useState<string | null>(null)

  const isCustom = garage.booking_background_color !== null
  const bothHex = isHexColor(background) && isHexColor(text)
  const ratio = bothHex ? contrastRatio(background, text) : null
  const passes = ratio !== null && ratio >= MIN_CONTRAST_RATIO

  const save = async (input: { booking_background_color: string | null; booking_text_color: string | null }) => {
    setError(null)
    try {
      await update.mutateAsync(input)
      showToast(
        input.booking_background_color
          ? 'Booking page colours saved.'
          : 'Booking page colours reset to the default.',
        'success',
      )
    } catch (err) {
      setError(
        isApiError(err) && err.code === 403
          ? 'Only the business owner can change the booking page colours.'
          : errorMessage(err),
      )
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!passes) return
    void save({
      booking_background_color: background.toLowerCase(),
      booking_text_color: text.toLowerCase(),
    })
  }

  const applyPreset = (preset: { background: string; text: string }) => {
    setBackground(preset.background)
    setText(preset.text)
    setError(null)
  }

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-2">
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <ColorField id="booking-bg" label="Page background" value={background} onChange={setBackground} />
        <ColorField id="booking-text" label="Page text" value={text} onChange={setText} />

        <ContrastReadout ratio={ratio} />

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Presets</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {BOOKING_THEME_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 items-center justify-center rounded border border-slate-300 text-[10px] font-semibold"
                  style={{ backgroundColor: p.background, color: p.text }}
                >
                  A
                </span>
                {p.name}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
          <button
            type="submit"
            disabled={!passes || update.isPending}
            aria-describedby={passes ? undefined : 'booking-save-blocked'}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {update.isPending ? 'Saving…' : 'Save colours'}
          </button>
          <button
            type="button"
            disabled={update.isPending}
            onClick={() => {
              setBackground(DEFAULT_BACKGROUND)
              setText(DEFAULT_TEXT)
              if (isCustom) void save({ booking_background_color: null, booking_text_color: null })
            }}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Reset to default
          </button>
          {!passes && (
            <p id="booking-save-blocked" className="w-full text-xs text-slate-500">
              {bothHex
                ? `Saving is turned off until the text and background contrast is at least ${MIN_CONTRAST_RATIO}:1.`
                : 'Saving is turned off until both colours are 6-digit hex values like #1a2b3c.'}
            </p>
          )}
          {isCustom ? null : (
            <p className="w-full text-xs text-slate-500">Your pages use the default colours.</p>
          )}
        </div>
      </form>

      <section aria-labelledby="booking-preview-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="booking-preview-heading" className="text-sm font-medium text-slate-700">
            Preview
          </h2>
          <a
            href={bookingUrl(garageId)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 underline hover:text-slate-900"
          >
            Preview real page
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200" data-testid="booking-preview">
          <BookingThemeScope background={background} text={text} className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white">
                {garage.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-page-muted">Book an appointment</p>
                <p className="font-display text-xl font-semibold tracking-tight text-page-strong">
                  {garage.name}
                </p>
              </div>
            </div>
            <WizardStepper steps={PREVIEW_STEPS} currentStep={1} />
            <div className="mt-6 rounded-lg bg-white p-5 shadow-card">
              <p className="font-display text-lg font-semibold tracking-tight text-slate-900">
                What are you booking?
              </p>
              <p className="mt-1 text-sm text-slate-500">Choose a service to see available times.</p>
              <div className="mt-4 rounded-md border border-slate-200 px-4 py-3 text-sm text-slate-800">
                MOT test
              </div>
            </div>
          </BookingThemeScope>
        </div>
      </section>
    </div>
  )
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const valid = isHexColor(value)
  // The native picker only accepts a complete #rrggbb; while the hex box
  // holds something partial it keeps showing the last whole colour.
  const [lastValid, setLastValid] = useState(valid ? value : DEFAULT_BACKGROUND)
  if (valid && value.toLowerCase() !== lastValid.toLowerCase()) setLastValid(value)

  return (
    <div>
      <label htmlFor={`${id}-hex`} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} colour picker`}
          value={(valid ? value : lastValid).toLowerCase()}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-slate-300 bg-white p-0.5"
        />
        <input
          id={`${id}-hex`}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          aria-invalid={!valid || undefined}
          aria-describedby={valid ? undefined : `${id}-error`}
          className="w-28 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>
      {!valid && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
          Use a 6-digit hex colour like #1a2b3c.
        </p>
      )}
    </div>
  )
}

function ContrastReadout({ ratio }: { ratio: number | null }) {
  if (ratio === null) return null
  const passes = ratio >= MIN_CONTRAST_RATIO
  const Icon = passes ? CircleCheck : CircleAlert

  return (
    <p
      role="status"
      aria-live="polite"
      data-testid="contrast-readout"
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
        passes ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {passes
        ? `Contrast ${formatRatio(ratio)}, passes (needs at least ${MIN_CONTRAST_RATIO}:1).`
        : `Contrast ${formatRatio(ratio)}, too low: needs at least ${MIN_CONTRAST_RATIO}:1 so customers can read it.`}
    </p>
  )
}
