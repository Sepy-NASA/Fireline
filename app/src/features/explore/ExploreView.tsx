import { Box, Check, Eye, FileText, Loader2, Network, Plus, Search, SlidersHorizontal, Table2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { activeSession, useAppStore } from '../../store/appStore'
import { Badge } from '../../components/ui/badge'
import { ScrollArea } from '../../components/ui/scroll-area'
import { Separator } from '../../components/ui/separator'
import { cn } from '../../lib/utils'
import {
  EMPTY_FILTERS,
  FILE_CATEGORIES,
  FILE_TYPE_FAMILIES,
  formatBytes,
  investFor,
  loadFileInventory,
  previewKindFor,
  searchData,
  searchFiles,
  type DataRecord,
  type ExploreFilters,
  type FileRecord,
} from './exploreIndex'
import { addToAnalyze, isInAnalyze, type AnalyzeItem } from './addToAnalyze'
import { DatasetPreview, FilePreview, OpenDataModal, type OpenTarget } from './previews'
import { psiDownloadUrl } from './dataAccess'
import type { SafetyArea, WorkingItem } from '../../types'

/* ————————————————————————————————————————————
   Explore: search engine over the indexed data.
   Left facet rail · center search row + results
   (Data / Files) · right detail with Preview,
   Open data, working-set and Analyze actions.
   ———————————————————————————————————————————— */

type Tab = 'data' | 'files'

const SAFETY_COLOR: Record<SafetyArea, string> = {
  prevention: 'bg-bright/15 text-bright',
  detection: 'bg-violet/15 text-violet',
  suppression: 'bg-flame/15 text-flame',
  supporting: 'bg-muted text-dim',
}

const PAGE = 200

/* ——— record → working item / analyze item ——— */

function dataWorkingItem(r: DataRecord): WorkingItem {
  return {
    id: `ws_${r.dataset.id}`,
    type: 'dataset',
    ref: r.dataset.id,
    label: `${r.acronym} — ${r.dataset.title}`,
    sub: `${r.dataset.rows} rows · ${r.dataset.columns.length} columns`,
    tags: r.inv?.tags ?? [],
  }
}

function fileWorkingItem(f: FileRecord): WorkingItem {
  return {
    id: `ws_file_${f.id}`,
    type: 'file',
    ref: f.id,
    label: f.name,
    sub: `${f.acronym} · ${f.category} · ${formatBytes(f.size)}`,
    tags: [f.family, f.category],
  }
}

function dataAnalyzeItem(r: DataRecord): AnalyzeItem {
  return {
    kind: 'dataset',
    ref: r.dataset.id,
    label: r.dataset.title,
    hint: `${r.dataset.rows} test rows · ${r.dataset.columns.length} columns`,
    accession: r.dataset.accession,
  }
}

function fileAnalyzeItem(f: FileRecord): AnalyzeItem {
  const isDoc = f.family === 'document'
  return {
    kind: isDoc ? 'publication' : 'dataset',
    ref: f.id,
    label: f.name,
    hint: `${f.category} · .${f.ext} · ${formatBytes(f.size)}`,
    accession: f.accession,
  }
}

export function ExploreView() {
  const [tab, setTab] = useState<Tab>('data')
  const [filters, setFilters] = useState<ExploreFilters>(EMPTY_FILTERS)
  const [selectedDataId, setSelectedDataId] = useState<string | null>(null)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [previewOn, setPreviewOn] = useState(false)
  const [openTarget, setOpenTarget] = useState<OpenTarget | null>(null)
  const [limit, setLimit] = useState(PAGE)

  const [files, setFiles] = useState<FileRecord[] | null>(null)
  const [filesError, setFilesError] = useState<string | null>(null)

  const workingItems = useAppStore((s) => s.workingItems)
  const addWorkingItems = useAppStore((s) => s.addWorkingItems)
  const setView = useAppStore((s) => s.setView)
  const setTrayOpen = useAppStore((s) => s.setTrayOpen)
  const session = useAppStore(activeSession)

  // deep-link from Analyze (e.g. the agent's "Open SAFFIRE-2 table in Explore")
  const exploreFocus = useAppStore((s) => s.exploreFocus)
  const setExploreFocus = useAppStore((s) => s.setExploreFocus)
  useEffect(() => {
    if (!exploreFocus) return
    setTab(exploreFocus.tab ?? 'data')
    setFilters({ ...EMPTY_FILTERS, q: exploreFocus.q })
    if (exploreFocus.datasetId) {
      setSelectedDataId(exploreFocus.datasetId)
      setPreviewOn(true)
    }
    setExploreFocus(null)
  }, [exploreFocus, setExploreFocus])

  // the file inventory is a lazy chunk; start loading right away so counts are ready
  useEffect(() => {
    let alive = true
    loadFileInventory()
      .then((f) => alive && setFiles(f))
      .catch((e: unknown) => alive && setFilesError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [])

  // new search → back to the first page
  useEffect(() => setLimit(PAGE), [filters, tab])

  const toggle = <K extends 'areas' | 'tags' | 'fileTypes' | 'categories'>(key: K, value: ExploreFilters[K][number]) =>
    setFilters((f) => {
      const list = (f[key] as (typeof value)[]).includes(value)
        ? (f[key] as (typeof value)[]).filter((x) => x !== value)
        : [...(f[key] as (typeof value)[]), value]
      return { ...f, [key]: list }
    })

  const activeFilterCount =
    filters.areas.length +
    filters.tags.length +
    filters.fileTypes.length +
    filters.categories.length +
    (filters.spatialOnly ? 1 : 0)

  const dataResults = useMemo(() => searchData(filters), [filters])
  const fileResults = useMemo(() => (files ? searchFiles(files, filters) : []), [files, filters])
  const fileById = useMemo(() => new Map((files ?? []).map((f) => [f.id, f])), [files])

  const selectedData = selectedDataId ? dataResults.find((r) => r.id === selectedDataId) ?? null : null
  const selectedFile = selectedFileId ? fileById.get(selectedFileId) ?? null : null

  const inWorking = (id: string) => workingItems.some((w) => w.id === id)

  const select = (kind: Tab, id: string) => {
    setPreviewOn(false)
    if (kind === 'data') setSelectedDataId((cur) => (cur === id ? null : id))
    else setSelectedFileId((cur) => (cur === id ? null : id))
  }

  const tabs: [Tab, number | null, React.ReactNode][] = [
    ['data', dataResults.length, <Table2 className="size-3.5" />],
    ['files', files ? fileResults.length : null, <FileText className="size-3.5" />],
  ]

  return (
    <div className="flex h-full min-h-0">
      {/* facet rail */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-edge bg-panel">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-edge px-3">
          <SlidersHorizontal className="size-3.5 text-dim" />
          <span className="text-xs font-semibold text-text">Filters</span>
          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters((f) => ({ ...EMPTY_FILTERS, q: f.q }))}
              className="ml-auto text-[11px] text-faint hover:text-text"
            >
              Clear ({activeFilterCount})
            </button>
          )}
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 p-3">
            <Facet title="VR Preview">
              <CheckRow
                checked={filters.spatialOnly}
                onToggle={() => setFilters((f) => ({ ...f, spatialOnly: !f.spatialOnly }))}
                label="spatial-ready only"
                badge="text-violet"
              />
            </Facet>

            <Facet title="Safety area">
              {(['prevention', 'detection', 'suppression', 'supporting'] as SafetyArea[]).map((a) => (
                <CheckRow
                  key={a}
                  checked={filters.areas.includes(a)}
                  onToggle={() => toggle('areas', a)}
                  label={a}
                  badge={SAFETY_COLOR[a]}
                />
              ))}
            </Facet>

            <Facet title="Context">
              {['materials', 'fuels', 'smoke', 'suppressants', 'moon-relevant', 'flight'].map((t) => (
                <CheckRow key={t} checked={filters.tags.includes(t)} onToggle={() => toggle('tags', t)} label={t} />
              ))}
            </Facet>

            <Facet title="File type">
              {FILE_TYPE_FAMILIES.map((t) => (
                <CheckRow
                  key={t.id}
                  checked={filters.fileTypes.includes(t.id)}
                  onToggle={() => toggle('fileTypes', t.id)}
                  label={t.label}
                />
              ))}
            </Facet>

            <Facet title="File category">
              {FILE_CATEGORIES.map((c) => (
                <CheckRow
                  key={c}
                  checked={filters.categories.includes(c)}
                  onToggle={() => toggle('categories', c)}
                  label={c}
                />
              ))}
            </Facet>
          </div>
        </ScrollArea>
      </aside>

      {/* results */}
      <section className="flex min-w-0 flex-1 flex-col bg-panel2">
        {/* search row — sits above the data */}
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-edge bg-panel px-3">
          <Search className="size-4 shrink-0 text-dim" />
          <input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder={tab === 'data' ? 'Search experiments, investigations, columns…' : 'Search file names, paths, investigations…'}
            className="h-8 min-w-0 flex-1 bg-transparent text-sm text-text placeholder:text-faint focus:outline-none"
            aria-label="Search"
          />
          {filters.q && (
            <button
              onClick={() => setFilters((f) => ({ ...f, q: '' }))}
              className="rounded p-1 text-faint hover:text-text"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-edge px-2">
          {tabs.map(([t, n, icon]) => (
            <button
              key={t}
              onClick={() => {
                setTab(t)
                setPreviewOn(false)
              }}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
                tab === t ? 'bg-edge/40 text-text' : 'text-dim hover:text-text',
              )}
            >
              {icon}
              {t === 'data' ? 'experiments' : t}
              <span className="tnum font-mono text-[10px] text-faint">
                {n == null ? <Loader2 className="inline size-3 animate-spin" /> : n.toLocaleString()}
              </span>
            </button>
          ))}
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-1 p-2">
            {tab === 'data' ? (
              dataResults.length === 0 ? (
                <EmptyState />
              ) : (
                dataResults.map((r) => (
                  <DataRow
                    key={r.id}
                    rec={r}
                    onSelect={() => select('data', r.id)}
                    selected={selectedDataId === r.id}
                    inWorking={inWorking(`ws_${r.dataset.id}`)}
                    onAdd={() => addWorkingItems([dataWorkingItem(r)])}
                  />
                ))
              )
            ) : filesError ? (
              <p className="p-4 text-sm text-flame">Couldn't load the file inventory: {filesError}</p>
            ) : !files ? (
              <div className="flex h-40 items-center justify-center gap-2 text-sm text-faint">
                <Loader2 className="size-4 animate-spin" /> Loading file inventory…
              </div>
            ) : fileResults.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {fileResults.slice(0, limit).map((f) => (
                  <FileRow
                    key={f.id}
                    file={f}
                    onSelect={() => select('files', f.id)}
                    selected={selectedFileId === f.id}
                    inWorking={inWorking(`ws_file_${f.id}`)}
                    onAdd={() => addWorkingItems([fileWorkingItem(f)])}
                  />
                ))}
                {fileResults.length > limit && (
                  <button
                    onClick={() => setLimit((l) => l + PAGE)}
                    className="mt-1 h-8 rounded-md border border-edge text-xs text-dim transition-colors hover:text-text"
                  >
                    Show more — {(fileResults.length - limit).toLocaleString()} remaining
                  </button>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </section>

      {/* detail / actions */}
      <aside className="flex w-96 shrink-0 flex-col border-l border-edge bg-panel">
        <div className="flex h-11 shrink-0 items-center border-b border-edge px-3">
          <span className="truncate text-xs font-semibold text-text">
            {tab === 'data' ? (selectedData ? selectedData.acronym : 'Detail') : selectedFile ? selectedFile.name : 'Detail'}
          </span>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {tab === 'data' && selectedData ? (
            <DataDetail
              rec={selectedData}
              previewOn={previewOn}
              onTogglePreview={() => setPreviewOn((p) => !p)}
              onOpen={() => setOpenTarget({ type: 'dataset', record: selectedData })}
              inWorking={inWorking(`ws_${selectedData.dataset.id}`)}
              onAddWorking={() => addWorkingItems([dataWorkingItem(selectedData)])}
              inAnalyze={isInAnalyze(session, selectedData.dataset.id)}
              onAddAnalyze={() => addToAnalyze([dataAnalyzeItem(selectedData)])}
              onGoAnalyze={() => setView('analyze')}
            />
          ) : tab === 'files' && selectedFile ? (
            <FileDetail
              file={selectedFile}
              previewOn={previewOn}
              onTogglePreview={() => setPreviewOn((p) => !p)}
              onOpen={() => setOpenTarget({ type: 'file', file: selectedFile })}
              inWorking={inWorking(`ws_file_${selectedFile.id}`)}
              onAddWorking={() => addWorkingItems([fileWorkingItem(selectedFile)])}
              inAnalyze={isInAnalyze(session, selectedFile.id)}
              onAddAnalyze={() => addToAnalyze([fileAnalyzeItem(selectedFile)])}
              onGoAnalyze={() => setView('analyze')}
            />
          ) : (
            <div className="p-4 text-sm text-faint">
              Select {tab === 'data' ? 'an experiment' : 'a file'} to preview it, open its data, or add it to your working set
              or the Analyze canvas.
            </div>
          )}
        </ScrollArea>

        <div className="shrink-0 space-y-2 border-t border-edge p-3">
          <button
            onClick={() => setTrayOpen(true)}
            className="h-9 w-full rounded-md border border-edge text-xs text-dim transition-colors hover:text-text"
          >
            Working set — {workingItems.length} item{workingItems.length === 1 ? '' : 's'}
          </button>
          <button
            onClick={() => {
              setTrayOpen(true)
              setView('visualize')
            }}
            disabled={workingItems.length === 0}
            className="h-9 w-full rounded-md bg-bright text-xs font-semibold text-ink transition-colors hover:bg-bright/85 disabled:opacity-40"
          >
            Go to visualization
          </button>
        </div>
      </aside>

      <OpenDataModal target={openTarget} onClose={() => setOpenTarget(null)} />
    </div>
  )
}

/* ——— detail panels ——— */

interface ActionProps {
  previewOn: boolean
  onTogglePreview: () => void
  onOpen: () => void
  inWorking: boolean
  onAddWorking: () => void
  inAnalyze: boolean
  onAddAnalyze: () => void
  onGoAnalyze: () => void
  canPreview?: boolean
  canOpen?: boolean
}

function Actions(p: ActionProps) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={p.onTogglePreview}
          disabled={p.canPreview === false}
          className={cn(
            'flex h-8 items-center justify-center gap-1.5 rounded-md border text-xs transition-colors disabled:opacity-40',
            p.previewOn ? 'border-bright bg-bright/10 text-bright' : 'border-edge text-dim enabled:hover:text-text',
          )}
        >
          <Eye className="size-3.5" /> {p.previewOn ? 'Hide preview' : 'Preview'}
        </button>
        <button
          onClick={p.onOpen}
          disabled={p.canOpen === false}
          className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-bright text-xs font-semibold text-ink transition-colors enabled:hover:bg-bright/85 disabled:opacity-40"
        >
          <Table2 className="size-3.5" /> Open data
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={p.onAddWorking}
          disabled={p.inWorking}
          className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-edge text-xs text-dim transition-colors enabled:hover:text-text disabled:text-teal"
        >
          {p.inWorking ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
          {p.inWorking ? 'In working set' : 'Add to working set'}
        </button>
        {p.inAnalyze ? (
          <button
            onClick={p.onGoAnalyze}
            className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-teal/40 text-xs text-teal transition-colors hover:bg-teal/10"
          >
            <Check className="size-3.5" /> In Analyze — open →
          </button>
        ) : (
          <button
            onClick={p.onAddAnalyze}
            className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-edge text-xs text-dim transition-colors hover:text-text"
          >
            <Network className="size-3.5" /> Add to Analyze
          </button>
        )}
      </div>
    </div>
  )
}

function DataDetail({ rec, ...actions }: { rec: DataRecord } & ActionProps) {
  const d = rec.dataset
  return (
    // fixed width: the scroll area's content box otherwise grows with wide preview tables
    <div className="w-[383px] space-y-3 p-3">
      <div>
        <p className="text-sm font-semibold text-text">{d.title}</p>
        <p className="text-xs text-dim">
          {rec.acronym} · {d.accession}
        </p>
        {rec.inv && <p className="mt-0.5 text-[11px] text-faint">{rec.inv.title}</p>}
      </div>
      {rec.inv && (
        <div className="flex flex-wrap gap-1">
          {rec.inv.tags.map((t) => (
            <Badge key={t} variant={t === 'moon-relevant' ? 'amber' : 'muted'}>
              {t}
            </Badge>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-dim">
        <Metric label="rows" value={String(d.rows)} />
        <Metric label="columns" value={String(d.columns.length)} />
        <Metric label="O₂ range" value={rec.o2Range} />
        <Metric label="pressure" value={rec.pRange} />
      </div>

      {rec.spatial.ready && (
        <div className="space-y-1 rounded-md border border-violet/30 bg-violet/5 p-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-violet">
            <Box className="size-3.5" /> Spatial-ready · VR Preview
          </p>
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-dim">
            {rec.spatial.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <Actions {...actions} />

      {actions.previewOn && <DatasetPreview record={rec} />}

      {rec.inv && (
        <>
          <p className="text-[12px] leading-relaxed text-dim">{rec.inv.objective.slice(0, 300)}…</p>
          <a
            href={rec.inv.url}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 items-center justify-center rounded-md border border-edge text-xs text-dim transition-colors hover:text-text"
          >
            Open PSI record ↗
          </a>
        </>
      )}
    </div>
  )
}

function FileDetail({ file, ...actions }: { file: FileRecord } & ActionProps) {
  const inv = investFor(file.accession)
  const kind = previewKindFor(file.ext)
  const canView = !file.restricted && kind !== 'none'
  return (
    <div className="w-[383px] space-y-3 p-3">
      <div>
        <p className="break-all text-sm font-semibold text-text">{file.name}</p>
        <p className="text-xs text-dim">
          {file.acronym} · {file.accession}
        </p>
        <p className="mt-0.5 break-all font-mono text-[10px] text-faint">
          {file.category}/{file.path}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-dim">
        <Metric label="size" value={formatBytes(file.size)} />
        <Metric label="type" value={`.${file.ext}`} />
        <Metric label="category" value={file.category} />
        <Metric label="preview" value={file.restricted ? 'restricted' : kind === 'none' ? '—' : kind} />
      </div>

      <Actions {...actions} canPreview={canView} canOpen={canView} />

      {actions.previewOn && <FilePreview key={file.id} file={file} />}

      <div className="flex gap-1.5">
        {!file.restricted && (
          <a
            href={psiDownloadUrl(file)}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 flex-1 items-center justify-center rounded-md border border-edge text-xs text-dim transition-colors hover:text-text"
          >
            Download ↗
          </a>
        )}
        {inv && (
          <a
            href={inv.url}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 flex-1 items-center justify-center rounded-md border border-edge text-xs text-dim transition-colors hover:text-text"
          >
            PSI record ↗
          </a>
        )}
      </div>
    </div>
  )
}

/* ——— small pieces ——— */

function Facet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold text-faint">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function CheckRow({
  checked,
  onToggle,
  label,
  badge,
}: {
  checked: boolean
  onToggle: () => void
  label: string
  badge?: string
}) {
  return (
    <button onClick={onToggle} className="flex w-full items-center gap-2 text-left text-xs text-dim hover:text-text">
      <span
        className={cn(
          'flex size-3.5 shrink-0 items-center justify-center rounded-sm border',
          checked ? 'border-bright bg-bright text-ink' : 'border-edge2',
        )}
      >
        {checked && <Check className="size-2.5" strokeWidth={3} />}
      </span>
      <span className={cn('flex-1 truncate', badge)}>{label}</span>
    </button>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-edge bg-panel2 px-2 py-1.5">
      <p className="text-[10px] text-faint">{label}</p>
      <p className="tnum truncate text-[12px] text-text" title={value}>
        {value}
      </p>
    </div>
  )
}

function DataRow({
  rec,
  onSelect,
  selected,
  inWorking,
  onAdd,
}: {
  rec: DataRecord
  onSelect: () => void
  selected: boolean
  inWorking: boolean
  onAdd: () => void
}) {
  const d = rec.dataset
  return (
    <div
      onClick={onSelect}
      className={cn(
        'cursor-pointer rounded-md border px-2.5 py-2 transition-colors',
        selected ? 'border-bright bg-bright/5' : 'border-edge/60 bg-panel hover:border-edge2',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-text">{rec.acronym}</span>
        <span className="truncate text-xs text-dim">{d.title}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {rec.spatial.ready && (
            <Badge variant="violet" title={rec.spatial.reasons.join('\n')} className="flex items-center gap-1">
              <Box className="size-3" /> spatial-ready
            </Badge>
          )}
          {rec.inv?.moonRelevant && <Badge variant="amber">moon</Badge>}
          <span className="text-[11px] text-faint">{d.accession}</span>
        </div>
      </div>
      <p className="mt-0.5 truncate font-mono text-[10px] text-faint">{d.columns.join(' · ')}</p>
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-faint">
        {rec.inv && <span className={SAFETY_COLOR[rec.inv.safetyArea]}>{rec.inv.safetyArea}</span>}
        {rec.inv && <span>·</span>}
        <span className="tnum font-mono">{d.rows} rows</span>
        <span>·</span>
        <span className="tnum font-mono">{rec.o2Range} O₂</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onAdd()
          }}
          disabled={inWorking}
          className="ml-auto rounded px-1.5 py-0.5 text-[10px] text-teal enabled:hover:bg-teal/10 disabled:opacity-40"
        >
          {inWorking ? '✓ added' : '+ add'}
        </button>
      </div>
    </div>
  )
}

function FileRow({
  file,
  onSelect,
  selected,
  inWorking,
  onAdd,
}: {
  file: FileRecord
  onSelect: () => void
  selected: boolean
  inWorking: boolean
  onAdd: () => void
}) {
  const kind = previewKindFor(file.ext)
  return (
    <div
      onClick={onSelect}
      className={cn(
        'cursor-pointer rounded-md border px-2.5 py-1.5 transition-colors',
        selected ? 'border-bright bg-bright/5' : 'border-edge/60 bg-panel hover:border-edge2',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] text-text" title={file.path}>
          {file.name}
        </span>
        {(kind === 'text' || kind === 'video') && !file.restricted && (
          <Eye className="size-3 shrink-0 text-faint" aria-label="previewable" />
        )}
        <Badge variant="muted">.{file.ext}</Badge>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-faint">
        <span className="font-semibold text-dim">{file.acronym}</span>
        <span>·</span>
        <span>{file.category}</span>
        <span>·</span>
        <span className="tnum font-mono">{formatBytes(file.size)}</span>
        {file.restricted && <Badge variant="amber">restricted</Badge>}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onAdd()
          }}
          disabled={inWorking}
          className="ml-auto rounded px-1.5 py-0.5 text-[10px] text-teal enabled:hover:bg-teal/10 disabled:opacity-40"
        >
          {inWorking ? '✓ added' : '+ add'}
        </button>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-40 flex-col items-center justify-center text-sm text-faint">
      <Separator className="mb-3 w-24" />
      No results for these filters.
    </div>
  )
}
