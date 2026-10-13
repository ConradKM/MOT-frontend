import { useDeferredValue, useId, useMemo, useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from './controls'
import { ErrorNote } from './controls'
import { errorMessage, isApiError } from '../../lib/errors'
import { checkJson, copyText, fillPrompt } from '../../lib/importJson'
import type { ImportFormat, ImportKind, ImportResult } from '../../types'
import { summarise } from '../../lib/importDisplay'
import { IssueList, SummaryChips } from './parts'

/**
 * Paste JSON → preview → import, for either kind of bulk import.
 *
 * The AI step happens outside the console on purpose: the operator gives a
 * screenshot and the copied prompt to an assistant of their choice and pastes
 * the JSON back. Everything after that is the server's: this component checks
 * the paste is JSON, sends it for a dry run, and renders the per-row result.
 * The commit re-validates from the same payload - a preview is never trusted.
 */

export interface ImportPanelProps {
  kind: ImportKind
  /** From `fetchImportFormats`; undefined while loading. */
  format: ImportFormat | undefined
  promptValues: { service_names?: string[]; timezone?: string; statuses?: string[] }
  preview: (payload: unknown) => Promise<ImportResult>
  /** What "import" means here - a server commit, or adding to a draft. */
  commit: {
    label: (result: ImportResult) => string
    run: (payload: unknown, result: ImportResult, acknowledgeWarnings: boolean) => Promise<void>
  }
  /** Renders the rows of a preview (a table, a list/calendar). */
  renderItems: (result: ImportResult) => ReactNode
}

export function ImportPanel({
  kind,
  format,
  promptValues,
  preview,
  commit,
  renderItems,
}: ImportPanelProps) {
  const textId = useId()
  const fileId = useId()
  const [text, setText] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  // The text the shown preview was made from. Any edit invalidates it.
  const [previewedText, setPreviewedText] = useState<string | null>(null)
  const [previewedPayload, setPreviewedPayload] = useState<unknown>(null)
  const [announcement, setAnnouncement] = useState('')

  // Parsing a large paste on every keystroke would stall typing; React may
  // render the deferred value a beat later instead.
  const deferredText = useDeferredValue(text)
  const check = useMemo(() => checkJson(deferredText), [deferredText])
  const stale = result !== null && previewedText !== text

  const runPreview = useMutation({
    mutationFn: ({ payload }: { payload: unknown; source: string }) => preview(payload),
    onSuccess: (data, { payload, source }) => {
      setResult(data)
      setPreviewedText(source)
      setPreviewedPayload(payload)
      setAcknowledged(false)
      setAnnouncement(`Preview ready: ${summarise(data)}.`)
    },
    onError: (err) => setAnnouncement(`Preview failed: ${errorMessage(err)}`),
  })

  const runCommit = useMutation({
    mutationFn: ({ payload, current }: { payload: unknown; current: ImportResult }) =>
      commit.run(payload, current, acknowledged),
    onSuccess: () => setAnnouncement('Import complete.'),
    onError: (err) => {
      // A refused commit (something changed since the preview) carries the
      // fresh result: show it rather than a bare status code.
      if (isApiError(err) && isImportResult(err.body)) {
        setResult(err.body)
        setAcknowledged(false)
        setAnnouncement(`Import refused: ${summarise(err.body)}.`)
      } else {
        setAnnouncement(`Import failed: ${errorMessage(err)}`)
      }
    },
  })

  const copy = async (label: string, value: string) => {
    const ok = await copyText(value)
    setCopied(ok ? label : `${label} — copy failed; select the text and copy it by hand`)
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setText(typeof reader.result === 'string' ? reader.result : '')
    reader.readAsText(file)
  }

  // Only act on a check of what is in the box *now*, not a deferred one.
  const checkIsCurrent = deferredText === text
  const canPreview = checkIsCurrent && check.ok === true && !runPreview.isPending
  const hasWarnings =
    result !== null && (result.counts.warning > 0 || result.warnings.length > 0)
  const nothingToImport = result !== null && result.counts.new === 0
  const canCommit =
    result !== null &&
    !stale &&
    result.counts.error === 0 &&
    !nothingToImport &&
    (!hasWarnings || acknowledged) &&
    !runCommit.isPending

  return (
    <div className="space-y-4">
      <details className="rounded-lg border border-slate-200 p-3">
        <summary className="min-h-11 cursor-pointer content-center text-sm font-medium text-slate-800">
          JSON format and AI prompt
        </summary>
        {format ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-slate-600">
              Give a screenshot of the {kind === 'services' ? 'price list' : 'diary'} to
              an AI assistant together with the prompt below, then paste the JSON it returns here.
              Nothing is saved until you preview it and press import.
            </p>
            {kind === 'appointments' ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <strong>Data protection:</strong> a diary screenshot contains customers&rsquo; names
                and contact details. Only use an AI assistant the business has agreed may process
                its customers&rsquo; personal data, and delete the screenshot afterwards.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="min-h-11"
                onClick={() =>
                  copy('AI prompt', fillPrompt(format.ai_prompt_template, promptValues))
                }
              >
                Copy AI prompt
              </Button>
              <Button
                type="button"
                className="min-h-11"
                onClick={() => copy('Example', JSON.stringify(format.example, null, 2))}
              >
                Copy example
              </Button>
            </div>
            <p role="status" className="text-xs text-slate-600">
              {copied ? `${copied}${copied.includes('failed') ? '' : ' copied.'}` : ''}
            </p>
            <pre className="max-h-64 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-800">
              {JSON.stringify(format.example, null, 2)}
            </pre>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Loading the format…</p>
        )}
      </details>

      <div>
        <label htmlFor={textId} className="block text-sm font-medium text-slate-700">
          Paste JSON
        </label>
        <textarea
          id={textId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={10}
          spellCheck={false}
          aria-describedby={`${textId}-check`}
          aria-invalid={check.ok === false ? true : undefined}
          placeholder={`{"${kind}": [ … ]}`}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none"
        />
        <p
          id={`${textId}-check`}
          className={`mt-1 text-xs ${check.ok === false ? 'text-rose-700' : 'text-slate-500'}`}
        >
          {check.ok === true
            ? 'Valid JSON.'
            : check.ok === false
              ? check.line !== null
                ? `Not valid JSON — line ${check.line}, column ${check.column}: ${check.message}`
                : `Not valid JSON: ${check.message}`
              : 'Paste the JSON your AI assistant returned, or choose a .json file.'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label
            htmlFor={fileId}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Choose a .json file
          </label>
          <input
            id={fileId}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="primary"
            className="min-h-11"
            disabled={!canPreview}
            onClick={() =>
              check.ok === true && runPreview.mutate({ payload: check.value, source: text })
            }
          >
            {runPreview.isPending ? 'Checking…' : 'Preview'}
          </Button>
        </div>
      </div>

      {runPreview.error ? <ErrorNote>{errorMessage(runPreview.error)}</ErrorNote> : null}

      {result ? (
        <section aria-label="Preview" className="space-y-3">
          {stale ? (
            <p className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              The JSON has changed since this preview. Preview again before importing.
            </p>
          ) : null}
          <SummaryChips result={result} />
          <IssueList errors={[]} warnings={result.warnings} />
          {renderItems(result)}

          <div className="space-y-3 border-t border-slate-200 pt-3">
            {result.counts.error > 0 ? (
              <p className="text-sm text-rose-700">
                Nothing can be imported until the {result.counts.error} row
                {result.counts.error === 1 ? '' : 's'} with errors {result.counts.error === 1 ? 'is' : 'are'}{' '}
                fixed. Correct the JSON and preview again.
              </p>
            ) : nothingToImport ? (
              <p className="text-sm text-slate-600">Everything in this paste already exists.</p>
            ) : hasWarnings ? (
              <label className="flex min-h-11 items-start gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="mt-1 size-4"
                  checked={acknowledged}
                  disabled={stale}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                <span>
                  Import anyway — I&rsquo;ve checked the warnings above (for example a
                  double-booking that really happened).
                </span>
              </label>
            ) : null}
            <Button
              type="button"
              variant="primary"
              className="min-h-11"
              disabled={!canCommit}
              onClick={() => runCommit.mutate({ payload: previewedPayload, current: result })}
            >
              {runCommit.isPending ? 'Importing…' : commit.label(result)}
            </Button>
            {runCommit.error && !(isApiError(runCommit.error) && isImportResult(runCommit.error.body)) ? (
              <ErrorNote>{errorMessage(runCommit.error)}</ErrorNote>
            ) : null}
          </div>
        </section>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}

function isImportResult(body: unknown): body is ImportResult {
  return (
    typeof body === 'object' &&
    body !== null &&
    'items' in body &&
    Array.isArray((body as ImportResult).items) &&
    'counts' in body
  )
}
