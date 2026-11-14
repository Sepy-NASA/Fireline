import type { FileRecord } from './exploreIndex'

/* ————————————————————————————————————————————
   Data access for Explore: full experimental
   tables (bundled CSVs, lazy) and individual PSI
   files (public PSI download API).
   ———————————————————————————————————————————— */

/* ——— experimental tables ——— */

// each CSV becomes its own lazy chunk
const TABLE_LOADERS = import.meta.glob('./data/tables/*.csv', { query: '?raw', import: 'default' })

export interface ParsedTable {
  columns: string[]
  rows: string[][]
  raw: string
}

const tableCache = new Map<string, Promise<ParsedTable>>()

/** Load + parse the full CSV behind a dataset (by its `fileName`). */
export function loadTable(fileName: string): Promise<ParsedTable> {
  let p = tableCache.get(fileName)
  if (!p) {
    const loader = TABLE_LOADERS[`./data/tables/${fileName}`]
    p = loader
      ? loader().then((raw) => {
          const text = String(raw)
          const [header = [], ...rows] = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ''))
          return { columns: header, rows, raw: text }
        })
      : Promise.reject(new Error(`Table file not found: ${fileName}`))
    tableCache.set(fileName, p)
    p.catch(() => tableCache.delete(fileName))
  }
  return p
}

/** RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF, embedded newlines). */
export function parseCsv(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"'
          i++
        } else inQuotes = false
      } else cell += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(cell)
      out.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    out.push(row)
  }
  return out
}

/** Trigger a browser download of in-memory text. */
export function downloadText(fileName: string, text: string, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ——— individual PSI files ——— */

/** Public PSI API (used for links and <video>/<img>, which follow redirects without CORS). */
const PSI_API = 'https://psi.nasa.gov/geode-py/ws'
/** Same API through the Vite dev proxy (vite.config.ts) — needed for fetch(), PSI blocks other origins. */
const PSI_PROXY = '/psi-api'

const API_TIMEOUT_MS = 15_000
const DOWNLOAD_TIMEOUT_MS = 45_000

/** fetch() with a hard timeout, chained to an optional outer abort signal. */
async function fetchWithTimeout(url: string, ms: number, outer?: AbortSignal, what = 'Request'): Promise<Response> {
  const ctrl = new AbortController()
  const onOuter = () => ctrl.abort()
  outer?.addEventListener('abort', onOuter)
  let timedOut = false
  const t = setTimeout(() => {
    timedOut = true
    ctrl.abort()
  }, ms)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } catch (e) {
    if (timedOut) throw new Error(`${what} timed out after ${Math.round(ms / 1000)} s`)
    throw e
  } finally {
    clearTimeout(t)
    outer?.removeEventListener('abort', onOuter)
  }
}

/** Direct download URL — the API redirects to a temporary S3 link. */
export function psiDownloadUrl(file: FileRecord): string {
  return `${PSI_API}/studies/${encodeURIComponent(file.accession)}/download?file=${encodeURIComponent(file.name)}`
}

/** PSI investigation page (fallback when the browser can't fetch the file). */
export function psiInvestigationUrl(acc: string): string {
  return `https://psi.nasa.gov/physci/repo/data/investigations/${acc}`
}

/** Experimental tables are bundled with the app — no network needed for them. */
function localTableLoader(file: FileRecord) {
  return file.ext === 'csv' ? TABLE_LOADERS[`./data/tables/${file.name}`] : undefined
}

const signedCache = new Map<string, Promise<string>>()

/** Resolve the temporary signed S3 URL (`redirect=false`) via the dev proxy. */
export function resolveSignedUrl(file: FileRecord): Promise<string> {
  let p = signedCache.get(file.id)
  if (!p) {
    const url = `${PSI_PROXY}/studies/${encodeURIComponent(file.accession)}/download?file=${encodeURIComponent(file.name)}&redirect=false`
    p = fetchWithTimeout(url, API_TIMEOUT_MS, undefined, 'PSI server').then(async (r) => {
      if (r.status === 404 && !(r.headers.get('content-type') ?? '').includes('json'))
        throw new Error('PSI proxy not available — run the app with `npm run dev`')
      if (!r.ok) throw new Error(`PSI responded ${r.status} — the investigation may be unavailable on PSI right now`)
      let t = (await r.text()).trim()
      if (t.startsWith('{')) {
        const j = JSON.parse(t) as Record<string, unknown>
        t = String(j.url ?? j.link ?? j.signedUrl ?? '')
      } else if (t.startsWith('"')) t = JSON.parse(t) as string
      if (!/^https?:\/\//.test(t)) throw new Error('Unexpected response from PSI')
      return t
    })
    signedCache.set(file.id, p)
    // signed links expire (~1 h) and failures shouldn't stick
    p.then(
      () => setTimeout(() => signedCache.delete(file.id), 30 * 60_000),
      () => signedCache.delete(file.id),
    )
  }
  return p
}

/** Fetch a text file's content (truncated to `maxChars`). */
export async function fetchFileText(
  file: FileRecord,
  maxChars: number,
  signal?: AbortSignal,
): Promise<{ text: string; truncated: boolean; source: 'bundled' | 'psi' }> {
  const local = localTableLoader(file)
  let text: string
  let source: 'bundled' | 'psi'
  if (local) {
    text = String(await local())
    source = 'bundled'
  } else {
    const url = await resolveSignedUrl(file)
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const r = await fetchWithTimeout(url, timeoutForSize(file.size), signal, 'Download')
    if (!r.ok) throw new Error(`Download failed (${r.status})`)
    text = await r.text()
    source = 'psi'
  }
  return text.length > maxChars
    ? { text: text.slice(0, maxChars), truncated: true, source }
    : { text, truncated: false, source }
}

/** Download timeout scaled to file size (assumes ≥ 250 KB/s, never below the base timeout). */
const timeoutForSize = (bytes: number) => Math.max(DOWNLOAD_TIMEOUT_MS, Math.round((bytes / (250 * 1024)) * 1000))

/**
 * Fetch a binary file and return an object URL with the right MIME type.
 * PSI's signed links carry `Content-Disposition: attachment`, so an <iframe> pointed
 * at them downloads instead of displaying — a blob: URL has no such header.
 * Caller must URL.revokeObjectURL() the result.
 */
export async function fetchFileObjectUrl(file: FileRecord, mime: string, signal?: AbortSignal): Promise<string> {
  const url = await resolveSignedUrl(file)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const r = await fetchWithTimeout(url, timeoutForSize(file.size), signal, 'Download')
  if (!r.ok) throw new Error(`Download failed (${r.status})`)
  const blob = await r.blob()
  return URL.createObjectURL(new Blob([blob], { type: mime }))
}

/** URL to embed in <video>/<img>/<iframe>. Media elements follow the PSI redirect without CORS. */
export async function mediaUrl(file: FileRecord): Promise<string> {
  return psiDownloadUrl(file)
}

/** How long media gets to start loading before we call it a failure. */
export const MEDIA_TIMEOUT_MS = 25_000
