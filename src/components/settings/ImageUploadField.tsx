import { useId, useRef, useState } from 'react'
import { IMAGE_CONTENT_TYPES, isSupportedImage } from '../../api/images'
import { errorMessage } from '../../lib/errors'

/**
 * Pick an image for a service or a service group.
 *
 * The bytes never pass through the app: `onUpload` asks for a presigned
 * ticket, PUTs straight to object storage, and lets the server confirm what
 * actually landed (see src/api/images.ts). That means the button is busy for
 * two round trips plus the transfer, so the pending state is not decoration.
 *
 * Only meaningful in GRID display mode, but offered whenever a business might
 * switch to it - discovering you need images only after switching would be a
 * worse order to find out in.
 */
export function ImageUploadField({
  label,
  imageUrl,
  onUpload,
  onRemove,
  disabled,
}: {
  label: string
  imageUrl: string | null
  onUpload: (file: File) => Promise<unknown>
  onRemove: () => Promise<unknown>
  disabled?: boolean
}) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleFile = (file: File | undefined) => {
    if (!file) return
    // Checked again server-side against the file's real first bytes - this is
    // only so an obviously wrong pick fails immediately rather than after an
    // upload.
    if (!isSupportedImage(file)) {
      setError('Use a PNG, JPEG or WebP image.')
      return
    }
    void run(() => onUpload(file))
    // Let the same file be picked again after a failure.
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <p className="block text-sm font-medium text-slate-700" id={`${id}-label`}>
        {label}
      </p>
      <div className="mt-1 flex items-center gap-3">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-slate-400">None</span>
          )}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={IMAGE_CONTENT_TYPES.join(',')}
            aria-labelledby={`${id}-label`}
            disabled={disabled || busy}
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="text-sm text-slate-600 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
          />
          {imageUrl && (
            <button
              type="button"
              onClick={() => void run(onRemove)}
              disabled={disabled || busy}
              className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {busy && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
