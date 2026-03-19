/**
 * app/lib/fileSave.ts
 *
 * Saves content to a file on the user's device.
 *
 * Strategy (priority order):
 *  1. File System Access API (showSaveFilePicker) — Chrome/Edge, shows native save dialog.
 *  2. Anchor download fallback — Safari/Firefox, triggers download to Downloads folder.
 *
 * AbortError (user cancels native dialog) is caught and silently swallowed.
 * All other errors are re-thrown to the caller.
 */

export interface SaveFileOptions {
  /** The content to save. Strings are converted to Blob internally. */
  content: string | Blob
  /** Suggested filename for the save dialog, e.g. "itinerary.md" */
  filename: string
  /** MIME type, e.g. "text/markdown" | "application/pdf" */
  mimeType: string
}

/**
 * Converts string or Blob content to a Blob with the given MIME type.
 */
function toBlob(content: string | Blob, mimeType: string): Blob {
  if (content instanceof Blob) return content
  return new Blob([content], { type: mimeType })
}

/**
 * Saves content to a file via the File System Access API or an anchor fallback.
 */
export async function saveFile(opts: SaveFileOptions): Promise<void> {
  const blob = toBlob(opts.content, opts.mimeType)

  // ── Priority 1: File System Access API ────────────────────────────────────
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (
        window as Window & {
          showSaveFilePicker: (opts: {
            suggestedName: string
            types: Array<{ description: string; accept: Record<string, string[]> }>
          }) => Promise<FileSystemFileHandle>
        }
      ).showSaveFilePicker({
        suggestedName: opts.filename,
        types: [
          {
            description: opts.mimeType,
            accept: { [opts.mimeType]: [`.${opts.filename.split('.').pop() ?? 'bin'}`] },
          },
        ],
      })

      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled the native dialog — silent swallow
        return
      }
      throw err
    }
  }

  // ── Priority 2: Anchor download fallback ─────────────────────────────────
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = opts.filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
