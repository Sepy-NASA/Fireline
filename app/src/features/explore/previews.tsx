import * as Dialog from '@radix-ui/react-dialog'
import { Download, ExternalLink, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '../../components/ui/badge'
import { cn } from '../../lib/utils'
import {
  downloadText,
  fetchFileObjectUrl,
  fetchFileText,
  loadTable,
  MEDIA_TIMEOUT_MS,
  mediaUrl,
  parseCsv,
  psiDownloadUrl,
  psiInvestigationUrl,
  type ParsedTable,
} from './dataAccess'
import { formatBytes, previewKindFor, type DataRecord, type FileRecord } from './exploreIndex'

/* ————————————————————————————————————————————
   Previews (inline, right panel) and the
   "Open data" modal for datasets and files.
   ———————————————————————————————————————————— */

const INLINE_TEXT_CHARS = 6_000
const FULL_TEXT_CHARS = 2_000_000
/** don't auto-fetch huge files for an inline preview */
const INLINE_MAX_BYTES = 5 * 1024 * 1024

/* ——— tables ——— */

function TableGrid({ columns, rows, className }: { columns: string[]; rows: string[][]; className?: string }) {
  return (
    <div className={cn('overflow-auto rounded-md border border-edge', className)}>
      <table className="w-max min-w-full border-collapse font-mono text-[11px]">
        <thead className="sticky top-0 z-10 bg-panel">
          <tr>
            <th className="border-b border-edge px-2 py-1 text-right font-normal text-faint">#</th>
            {columns.map((c, i) => (
              <th key={i} className="whitespace-nowrap border-b border-edge px-2 py-1 text-left font-semibold text-text">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="odd:bg-panel2/60 hover:bg-bright/5">
              <td className="tnum px-2 py-0.5 text-right text-faint">{i + 1}</td>
              {columns.map((_, j) => (
                <td key={j} className="max-w-72 truncate whitespace-nowrap px-2 py-0.5 text-dim" title={r[j]}>
                  {r[j]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Inline preview of a dataset: columns + first sample rows (no network). */
export function DatasetPreview({ record }: { record: DataRecord }) {
  const d = record.dataset
  const rows = d.sample.slice(0, 8).map((r) => d.columns.map((c) => r[c] ?? ''))
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-faint">
        First {rows.length} of {d.rows} rows · {d.columns.length} columns
      </p>
      <TableGrid columns={d.columns} rows={rows} className="max-h-64" />
    </div>
  )
}

/* ——— files ——— */

type Load<T> = { state: 'idle' } | { state: 'loading' } | { state: 'ok'; value: T } | { state: 'error'; error: string }

function useFileText(file: FileRecord, maxChars: number, enabled: boolean) {
  const [s, setS] = useState<Load<{ text: string; truncated: boolean; source: 'bundled' | 'psi' }>>({ state: 'idle' })
  useEffect(() => {
    if (!enabled) return
    const ctrl = new AbortController()
    setS({ state: 'loading' })
    fetchFileText(file, maxChars, ctrl.signal)
      .then((value) => setS({ state: 'ok', value }))
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        setS({ state: 'error', error: e instanceof Error ? e.message : String(e) })
      })
    return () => ctrl.abort()
  }, [file, maxChars, enabled])
  return s
}

function useMediaUrl(file: FileRecord) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setUrl(null)
    mediaUrl(file).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [file])
  return url
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-xs text-faint">
      <Loader2 className="size-3.5 animate-spin" /> {label}
    </div>
  )
}

function FetchError({ file, error }: { file: FileRecord; error: string }) {
  return (
    <div className="space-y-2 rounded-md border border-flame/30 bg-flame/5 p-2.5 text-[12px] text-dim">
      <p>
        Couldn't load this file <span className="text-faint">({error})</span>. You can still try downloading it
        directly from PSI.
      </p>
      <div className="flex gap-3">
        <a href={psiDownloadUrl(file)} target="_blank" rel="noreferrer" className="text-bright hover:underline">
          Download ↗
        </a>
        <a href={psiInvestigationUrl(file.accession)} target="_blank" rel="noreferrer" className="text-bright hover:underline">
          PSI record ↗
        </a>
      </div>
    </div>
  )
}

function TextView({ file, full }: { file: FileRecord; full: boolean }) {
  const tooBig = !full && file.size > INLINE_MAX_BYTES
  const s = useFileText(file, full ? FULL_TEXT_CHARS : INLINE_TEXT_CHARS, !tooBig)
  if (tooBig)
    return <p className="py-3 text-xs text-faint">File is {formatBytes(file.size)} — use “Open data” to load it.</p>
  if (s.state === 'idle' || s.state === 'loading') return <Spinner label="Downloading from PSI…" />
  if (s.state === 'error') return <FetchError file={file} error={s.error} />
  if (file.ext === 'csv') {
    const [header = [], ...rows] = parseCsv(s.value.text).filter((r) => r.some((c) => c.trim() !== ''))
    // a truncated CSV may end mid-row — drop the last line
    const body = s.value.truncated ? rows.slice(0, -1) : rows
    const shown = full ? body.slice(0, 2000) : body.slice(0, 8)
    return (
      <div className={cn('flex min-h-0 flex-col gap-1.5', full && 'flex-1')}>
        <div className="flex items-center gap-2 text-[11px] text-faint">
          <span>
            {full ? `${body.length}${s.value.truncated ? '+' : ''} rows` : `First ${shown.length} rows`} · {header.length} columns
          </span>
          {s.value.source === 'bundled' && <Badge variant="teal">bundled copy</Badge>}
          {full && (
            <button
              onClick={() => downloadText(file.name, s.value.text)}
              className="ml-auto flex h-7 items-center gap-1.5 rounded-md border border-edge px-2.5 text-xs text-dim transition-colors hover:text-text"
            >
              <Download className="size-3.5" /> Download CSV
            </button>
          )}
        </div>
        <TableGrid columns={header} rows={shown} className={full ? 'min-h-0 flex-1' : 'max-h-64'} />
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <pre
        className={cn(
          'overflow-auto whitespace-pre rounded-md border border-edge bg-panel2 p-2 font-mono text-[11px] leading-snug text-dim',
          full ? 'max-h-[70vh]' : 'max-h-64',
        )}
      >
        {s.value.text || '(empty file)'}
      </pre>
      {s.value.truncated && <p className="text-[10px] text-faint">Truncated preview — open the data for the full file.</p>}
    </div>
  )
}

function MediaView({ file, full }: { file: FileRecord; full: boolean }) {
  const url = useMediaUrl(file)
  const [failed, setFailed] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const kind = previewKindFor(file.ext)
  // PSI sometimes never answers for an investigation — don't spin forever
  useEffect(() => {
    if (!url || ready || failed) return
    const t = setTimeout(() => setFailed(`no response from PSI after ${MEDIA_TIMEOUT_MS / 1000} s`), MEDIA_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [url, ready, failed, kind])
  if (!url) return <Spinner label="Resolving file…" />
  if (failed) return <FetchError file={file} error={failed} />
  if (kind === 'video')
    return (
      <div className="space-y-1">
        <video
          key={url}
          src={url}
          controls
          preload="metadata"
          onLoadedMetadata={() => setReady(true)}
          onError={() => setFailed(file.ext === 'ts' ? "this browser can't play MPEG-TS video" : "the browser couldn't load this video")}
          className={cn('w-full rounded-md border border-edge bg-black', full ? 'max-h-[70vh]' : 'max-h-56')}
        />
        {!ready && <p className="flex items-center gap-1.5 text-[10px] text-faint"><Loader2 className="size-3 animate-spin" /> Loading video from PSI…</p>}
        {file.ext === 'ts' && <p className="text-[10px] text-faint">MPEG-TS plays natively only in some browsers (e.g. Safari).</p>}
      </div>
    )
  if (kind === 'image')
    return (
      <img
        src={url}
        alt={file.name}
        onLoad={() => setReady(true)}
        onError={() => setFailed("the browser couldn't load this image")}
        className={cn('w-full rounded-md border border-edge object-contain', full ? 'max-h-[70vh]' : 'max-h-56')}
      />
    )
  return null
}

/** PDF: downloaded as a blob (PSI links force "attachment"), shown in the browser's PDF viewer. */
function PdfView({ file, full }: { file: FileRecord; full: boolean }) {
  const [s, setS] = useState<Load<string>>({ state: 'loading' })
  useEffect(() => {
    const ctrl = new AbortController()
    let objectUrl: string | null = null
    setS({ state: 'loading' })
    fetchFileObjectUrl(file, 'application/pdf', ctrl.signal)
      .then((u) => {
        objectUrl = u
        if (ctrl.signal.aborted) URL.revokeObjectURL(u)
        else setS({ state: 'ok', value: u })
      })
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) setS({ state: 'error', error: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      ctrl.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file])
  if (s.state === 'loading' || s.state === 'idle')
    return <Spinner label={`Downloading PDF from PSI (${formatBytes(file.size)})…`} />
  if (s.state === 'error') return <FetchError file={file} error={s.error} />
  return (
    <div className={cn('flex flex-col gap-1', full && 'min-h-0 flex-1')}>
      <iframe
        title={file.name}
        src={s.value}
        className={cn('w-full rounded-md border border-edge bg-white', full ? 'min-h-[70vh] flex-1' : 'h-72')}
      />
      <a href={s.value} target="_blank" rel="noreferrer" className="self-end text-[11px] text-bright hover:underline">
        Open in new tab ↗
      </a>
    </div>
  )
}

/** Inline (right panel) or full (modal) preview of a single file. */
export function FilePreview({ file, full = false }: { file: FileRecord; full?: boolean }) {
  if (file.restricted)
    return <p className="py-3 text-xs text-amber">This file is restricted on PSI and can't be previewed.</p>
  const kind = previewKindFor(file.ext)
  if (kind === 'text') return <TextView file={file} full={full} />
  if (kind === 'none')
    return (
      <p className="py-3 text-xs text-faint">
        No in-browser preview for .{file.ext} files.{' '}
        <a href={psiDownloadUrl(file)} target="_blank" rel="noreferrer" className="text-bright hover:underline">
          Download ↗
        </a>
      </p>
    )
  if (kind === 'pdf') {
    if (!full && file.size > INLINE_MAX_BYTES)
      return <p className="py-3 text-xs text-faint">PDF is {formatBytes(file.size)} — use “Open data” to load it.</p>
    return <PdfView key={file.id} file={file} full={full} />
  }
  return <MediaView key={file.id} file={file} full={full} />
}

/* ——— the "Open data" modal ——— */

export type OpenTarget = { type: 'dataset'; record: DataRecord } | { type: 'file'; file: FileRecord }

const MAX_RENDER_ROWS = 2000

function DatasetFull({ record }: { record: DataRecord }) {
  const [s, setS] = useState<Load<ParsedTable>>({ state: 'loading' })
  useEffect(() => {
    let alive = true
    setS({ state: 'loading' })
    loadTable(record.dataset.fileName)
      .then((value) => alive && setS({ state: 'ok', value }))
      .catch((e: unknown) => alive && setS({ state: 'error', error: e instanceof Error ? e.message : String(e) }))
    return () => {
      alive = false
    }
  }, [record])

  if (s.state === 'loading' || s.state === 'idle') return <Spinner label="Loading data…" />
  if (s.state === 'error') return <p className="text-xs text-flame">{s.error}</p>
  const t = s.value
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2 text-[11px] text-faint">
        <span className="tnum">{t.rows.length} rows</span>·<span className="tnum">{t.columns.length} columns</span>
        {t.rows.length > MAX_RENDER_ROWS && <span>· showing first {MAX_RENDER_ROWS}</span>}
        <button
          onClick={() => downloadText(record.dataset.fileName, t.raw)}
          className="ml-auto flex h-7 items-center gap-1.5 rounded-md border border-edge px-2.5 text-xs text-dim transition-colors hover:text-text"
        >
          <Download className="size-3.5" /> Download CSV
        </button>
      </div>
      <TableGrid columns={t.columns} rows={t.rows.slice(0, MAX_RENDER_ROWS)} className="min-h-0 flex-1" />
    </div>
  )
}

export function OpenDataModal({ target, onClose }: { target: OpenTarget | null; onClose: () => void }) {
  const title = target?.type === 'dataset' ? `${target.record.acronym} — ${target.record.dataset.title}` : target?.file.name
  const sub =
    target?.type === 'dataset'
      ? target.record.dataset.fileName
      : target
        ? `${target.file.acronym} · ${target.file.category} · ${formatBytes(target.file.size)}`
        : ''
  return (
    <Dialog.Root open={!!target} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[86vh] w-[1100px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-lg border border-edge bg-panel p-4 shadow-pop focus:outline-none">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-sm font-semibold text-text">{title}</Dialog.Title>
              <Dialog.Description className="truncate text-[11px] text-faint">{sub}</Dialog.Description>
            </div>
            {target?.type === 'file' && (
              <>
                <Badge variant="muted">.{target.file.ext}</Badge>
                <a
                  href={psiDownloadUrl(target.file)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-7 items-center gap-1.5 rounded-md border border-edge px-2.5 text-xs text-dim transition-colors hover:text-text"
                >
                  <ExternalLink className="size-3.5" /> Download
                </a>
              </>
            )}
            <Dialog.Close className="rounded-md p-1 text-dim hover:text-text" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-auto">
            {/* key: remount per target so stale state never leaks between files */}
            {target?.type === 'dataset' && <DatasetFull record={target.record} />}
            {target?.type === 'file' && <FilePreview key={target.file.id} file={target.file} full />}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
