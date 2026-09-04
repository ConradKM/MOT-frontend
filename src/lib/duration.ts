/** "1h 30m" / "2h" / "45 min" - a minute count as a short, human duration. */
export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (!minutes && minutes !== 0) return '—'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
