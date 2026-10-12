import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { CalendarFeedWithUrl } from '../../api/calendarExport'

interface SubscriptionLinkPanelProps {
  feed: CalendarFeedWithUrl
  /** Clears the URL from the page - it can't be shown again afterwards. */
  onDone: () => void
}

/** The one time a subscription URL is ever visible: Apple one-tap subscribe,
 * Google's "From URL" steps, copy, and a QR code for setting up on a phone. */
export function SubscriptionLinkPanel({ feed, onDone }: SubscriptionLinkPanelProps) {
  const [qrSvg, setQrSvg] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // webcal:// so an iPhone's camera offers "Subscribe" straight away.
    QRCode.toString(feed.webcal_url, { type: 'svg', margin: 1, width: 192 })
      .then((out) => !cancelled && setQrSvg(out))
      .catch(() => !cancelled && setQrSvg(null))
    return () => {
      cancelled = true
    }
  }, [feed.webcal_url])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feed.subscription_url)
      setNote('Link copied')
    } catch {
      setNote('Copy failed - select the link and copy it manually')
    }
  }

  return (
    <section
      aria-labelledby="calendar-link-heading"
      className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4"
    >
      <h3 id="calendar-link-heading" className="text-sm font-semibold text-slate-900">
        Your link for “{feed.name}”
      </h3>
      <p className="mt-1 text-sm text-amber-800">
        <strong>This is the only time this link is shown.</strong> Anyone with it can see these
        appointments, so treat it like a password. If you lose it, regenerate it from the list
        below.
      </p>

      <label htmlFor="calendar-link-url" className="mt-3 block text-xs font-medium text-slate-600">
        Calendar link
      </label>
      <input
        id="calendar-link-url"
        readOnly
        value={feed.subscription_url}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs text-slate-700"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Copy link
        </button>
        <a
          href={feed.webcal_url}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Add to Apple Calendar
        </a>
      </div>
      {note && (
        <p className="mt-2 text-xs text-slate-600" role="status">
          {note}
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="text-sm text-slate-700">
          <h4 className="font-medium text-slate-900">Google Calendar</h4>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>Copy the link above.</li>
            <li>On a computer, open Google Calendar.</li>
            <li>
              Next to <em>Other calendars</em>, choose <strong>+</strong> then{' '}
              <strong>From URL</strong>.
            </li>
            <li>Paste the link and choose <strong>Add calendar</strong>.</li>
          </ol>
          <p className="mt-2 text-xs text-slate-500">
            Google can take several hours to pick up new or changed appointments. Apple Calendar
            is usually quicker (about an hour).
          </p>
        </div>
        <figure className="flex flex-col items-center">
          {qrSvg ? (
            <div
              className="h-32 w-32 [&>svg]:h-full [&>svg]:w-full"
              role="img"
              aria-label="QR code for the calendar link"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          ) : (
            <div
              className="flex h-32 w-32 items-center justify-center"
              role="img"
              aria-label="QR code for the calendar link"
            >
              <span className="text-xs text-slate-400">Generating…</span>
            </div>
          )}
          <figcaption className="mt-1 max-w-[8rem] text-center text-xs text-slate-500">
            Scan with an iPhone or iPad camera to subscribe
          </figcaption>
        </figure>
      </div>

      <div className="mt-4 text-right">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          I’ve saved my link
        </button>
      </div>
    </section>
  )
}
