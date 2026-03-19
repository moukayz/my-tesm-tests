/**
 * app/lib/cjkFontLoader.ts
 *
 * Lazy singleton loader for the NotoSansSC CJK font.
 * Fetches the font file at most once per browser session and registers it
 * with each jsPDF document instance for correct CJK character rendering.
 *
 * Slice 2 — F-02: CJK Font in PDF
 */

import type { jsPDF } from 'jspdf'

// ─────────────────────────────────────────────────────────────────────────────
// Singleton cache — font bytes fetched at most once per browser session.
// Stores a Promise<string> so concurrent callers share the single inflight fetch.
// ─────────────────────────────────────────────────────────────────────────────
let fontBytesPromise: Promise<string> | null = null

/**
 * Lazily fetches the CJK font asset from /fonts/NotoSansSC-subset.ttf,
 * converts it to base64, and registers it with the given jsPDF instance.
 *
 * Singleton: font bytes are fetched at most once per browser session.
 * The jsPDF Virtual File System (VFS) registration is per-doc-instance.
 *
 * @param doc - The jsPDF instance to register the font on.
 * @returns   The font family name to use in autoTable styles ("NotoSansSC").
 * @throws    If the font fetch fails (network error or HTTP non-2xx).
 */
export async function loadCjkFont(doc: jsPDF): Promise<string> {
  if (!fontBytesPromise) {
    fontBytesPromise = fetchFontAsBase64()
  }

  let base64str: string
  try {
    base64str = await fontBytesPromise
  } catch (err) {
    // Reset singleton on failure so the next call retries the fetch
    fontBytesPromise = null
    throw err
  }

  // Re-register on every new doc instance (jsPDF VFS is per-instance)
  doc.addFileToVFS('NotoSansSC.ttf', base64str)
  doc.addFont('NotoSansSC.ttf', 'NotoSansSC', 'normal')

  return 'NotoSansSC'
}

async function fetchFontAsBase64(): Promise<string> {
  const response = await fetch('/fonts/NotoSansSC-subset.ttf')
  if (!response.ok) {
    throw new Error(`CJK font fetch failed: HTTP ${response.status}`)
  }
  const buffer = await response.arrayBuffer()
  return arrayBufferToBase64(buffer)
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
