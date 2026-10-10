/** Hand a Blob to the browser as a file download (an <a download> click on an
 * object URL). Shared by every "save this file" button so they all behave the
 * same way. */
export function saveBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}
