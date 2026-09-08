import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { bookingUrl } from '../lib/bookingUrl'

/**
 * The business's public booking link + a QR code for it, with copy / download.
 *
 * The QR is generated deterministically in the browser from {@link bookingUrl}
 * (the stable UUID-based URL) — nothing is stored server-side. It is rendered
 * as inline SVG; "Download SVG" serialises that node, "Download PNG" rasterises
 * it through a canvas on click.
 */
export function BookingQrCard({ garageId }: { garageId: string }) {
  const url = bookingUrl(garageId)
  const [svg, setSvg] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const svgWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toString(url, { type: 'svg', margin: 1, width: 256 })
      .then((out) => !cancelled && setSvg(out))
      .catch(() => !cancelled && setSvg(null))
    return () => {
      cancelled = true
    }
  }, [url])

  const flash = (msg: string) => {
    setNote(msg)
    window.setTimeout(() => setNote(null), 2500)
  }

  const download = (blob: Blob, filename: string) => {
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(href)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      flash('Link copied')
    } catch {
      flash('Copy failed — select the link and copy it manually')
    }
  }

  const downloadSvg = () => {
    if (!svg) return
    download(new Blob([svg], { type: 'image/svg+xml' }), 'booking-qr.svg')
  }

  const downloadPng = () => {
    const source = svgWrapRef.current?.querySelector('svg')
    if (!source) return
    const serialized = new XMLSerializer().serializeToString(source)
    const img = new Image()
    img.onload = () => {
      const size = 1024
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, 0, 0, size, size)
      canvas.toBlob((blob) => {
        if (blob) download(blob, 'booking-qr.png')
      }, 'image/png')
    }
    img.onerror = () => flash('PNG render failed — use Download SVG instead')
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(serialized)))}`
  }

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-slate-900">Public booking link</h2>
      <p className="mt-1 text-sm text-slate-500">
        Share this link or print the QR code so customers can book with you directly. It
        stays the same for the life of your business.
      </p>

      <div className="mt-4 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        {svg ? (
          <div
            ref={svgWrapRef}
            className="flex h-40 w-40 shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full"
            aria-label="Booking link QR code"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div
            ref={svgWrapRef}
            className="flex h-40 w-40 shrink-0 items-center justify-center"
            aria-label="Booking link QR code"
          >
            <span className="text-xs text-slate-400">Generating…</span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <code className="block truncate rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
            {url}
          </code>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Copy link
            </button>
            <button
              type="button"
              onClick={downloadPng}
              disabled={!svg}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Download PNG
            </button>
            <button
              type="button"
              onClick={downloadSvg}
              disabled={!svg}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Download SVG
            </button>
          </div>
          {note && (
            <p className="mt-2 text-xs text-slate-500" role="status">
              {note}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
