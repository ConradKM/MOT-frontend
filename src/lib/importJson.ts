/**
 * The client side of a bulk import: is the paste JSON at all, and the AI
 * prompt filled in with this business's real values.
 *
 * Deliberately nothing more. Whether a row is *valid* - names, prices,
 * times, clashes - is decided by the server (MOT-backend `app/bulk_import`),
 * so this console and the garage app cannot drift from each other or from
 * the rules that actually apply.
 */

export type JsonCheck =
  | { ok: true; value: unknown }
  | { ok: false; message: string; line: number | null; column: number | null }
  | { ok: null }

/** AI assistants routinely wrap JSON in a markdown fence despite being asked
 * not to. Stripping one is presentation, not a validity rule. */
export function stripCodeFence(text: string): string {
  const match = /^\s*```[a-zA-Z]*\s*\n([\s\S]*?)\n?\s*```\s*$/.exec(text)
  return match ? match[1] : text
}

/** Line and column (1-based) of a character offset. */
export function lineColumn(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset)
  const lines = before.split('\n')
  return { line: lines.length, column: lines[lines.length - 1].length + 1 }
}

/** Parse a paste, reporting where it breaks. Empty input is `{ ok: null }` -
 * nothing to check yet, which is not an error. */
export function checkJson(raw: string): JsonCheck {
  const text = stripCodeFence(raw)
  if (!text.trim()) return { ok: null }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Engines report the failure point differently: V8 says "at position N"
    // (newer V8 adds "(line L column C)"), Firefox says "at line L column C".
    const lineCol = /line (\d+) column (\d+)/.exec(message)
    if (lineCol) {
      return { ok: false, message, line: Number(lineCol[1]), column: Number(lineCol[2]) }
    }
    const position = /position (\d+)/.exec(message)
    if (position) {
      const { line, column } = lineColumn(text, Number(position[1]))
      return { ok: false, message, line, column }
    }
    return { ok: false, message, line: null, column: null }
  }
}

/** Fill the server's prompt template. Placeholders it does not use are left
 * alone; values the template uses but we lack read as "(none yet)". */
export function fillPrompt(
  template: string,
  values: { service_names?: string[]; timezone?: string; statuses?: string[] },
): string {
  const list = (items?: string[]) =>
    items && items.length > 0 ? items.map((item) => `"${item}"`).join(', ') : '(none yet)'
  return template
    .replaceAll('{{service_names}}', list(values.service_names))
    .replaceAll('{{timezone}}', values.timezone || 'Europe/London')
    .replaceAll('{{statuses}}', list(values.statuses))
}

/** Copy text, reporting whether it worked - the Clipboard API is unavailable
 * on an insecure origin and can be refused by the browser. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
