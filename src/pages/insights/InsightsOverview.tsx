/** Placeholder for the Insights overview, which is the next PR (the page
 * itself, backed by GET /api/insights). Kept deliberately plain so this
 * navigation change can land first without shipping half a dashboard. */
export function InsightsOverview() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Insights</h1>
      <p className="mt-1 text-sm text-slate-500">
        How busy you are, what you earn, and who is due back - coming here soon.
      </p>
    </div>
  )
}
