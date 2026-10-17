/**
 * The "limited availability" threshold. The API stores it as a 0-1 ratio of a
 * slot's capacity (`limited_threshold_ratio`; a time shows as limited once
 * its free places fall to or below floor(capacity * ratio)). A business
 * thinks in percentages, so the settings page converts at the edge - the
 * field, its 0-1 range and its validation are unchanged.
 */
export function ratioToPercent(ratio: number): string {
  return String(Math.round(ratio * 100))
}

export function percentToRatio(percent: string): number {
  return Number(percent) / 100
}
