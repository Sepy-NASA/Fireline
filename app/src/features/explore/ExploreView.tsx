import { Check, FileText, FolderSearch, Search, Table2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { Badge } from '../../components/ui/badge'
import { ScrollArea } from '../../components/ui/scroll-area'
import { Separator } from '../../components/ui/separator'
import { cn } from '../../lib/utils'
import {
  EMPTY_FILTERS,
  FILE_CATEGORIES,
  FILE_TYPE_FAMILIES,
  INVEST_RECORDS,
  searchFileGroups,
  searchInvestigations,
  type ExploreFilters,
} from './exploreIndex'
import type { SafetyArea } from '../../types'

/* ————————————————————————————————————————————
   Explore: search engine over the indexed data.
   Left facet rail · center results · right detail
   + selection tray (working set).
   ———————————————————————————————————————————— */

type Tab = 'data' | 'investigations' | 'files'

const SAFETY_COLOR: Record<SafetyArea, string> = {
  prevention: 'bg-bright/15 text-bright',
  detection: 'bg-violet/15 text-violet',
  suppression: 'bg-flame/15 text-flame',
  supporting: 'bg-muted text-dim',
}

export function ExploreView() {
  const [tab, setTab] = useState<Tab>('data')
  const [filters, setFilters] = useState<ExploreFilters>(EMPTY_FILTERS)
  const [selected, setSelected] = useState<string | null>(null)
  const workingItems = useAppStore((s) => s.workingItems)
  const addWorkingItems = useAppStore((s) => s.addWorkingItems)
  const setView = useAppStore((s) => s.setView)
  const setTrayOpen = useAppStore((s) => s.setTrayOpen)

  const toggle = <K extends keyof ExploreFilters>(key: K, value: ExploreFilters[K][number]) =>
    setFilters((f) => {
      const list = (f[key] as (typeof value)[]).includes(value)
        ? (f[key] as (typeof value)[]).filter((x) => x !== value)
        : [...(f[key] as (typeof value)[]), value]
      return { ...f, [key]: list }
    })

  const invResults = useMemo(() => searchInvestigations(filters), [filters])
  const fileResults = useMemo(() => searchFileGroups(filters), [filters])
  const selectedInv = selected ? INVEST_RECORDS.find((r) => r.accession === selected) : null

  const inWorking = (id: string) => workingItems.some((w) => w.ref === id)

  const addInvestigation = (acc: string) => {
    const rec = INVEST_RECORDS.find((r) => r.accession === acc)
    if (!rec) return
    addWorkingItems([
      {
        id: `ws_${acc}`,
        type: 'investigation',
        ref: acc,
        label: rec.acronym,
        sub: `${rec.title}`,
        tags: rec.tags,
      },
    ])
  }

  const resultCounts: [Tab, number][] = [
    ['data', invResults.length],
    ['investigations', invResults.length],
    ['files', fileResults.length],
  ]

  return (
    <div className="flex h-full min-h-0">
      {/* facet rail */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-edge bg-panel">
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-edge px-3">
          <Search className="size-3.5 text-dim" />
          <span className="text-xs font-semibold text-text">Search & filters</span>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 p-3">
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search investigations, materials…"
              className="h-8 w-full rounded-md border border-edge bg-panel2 px-2.5 text-sm text-text placeholder:text-faint focus:outline-2 focus:outline-bright"
              aria-label="Search"
            />

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
                <CheckRow
                  key={t}
                  checked={filters.tags.includes(t)}
                  onToggle={() => toggle('tags', t)}
                  label={t}
                />
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
        <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-edge px-2">
          {resultCounts.map(([t, n]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
                tab === t ? 'bg-edge/40 text-text' : 'text-dim hover:text-text',
              )}
            >
              {t === 'data' && <Table2 className="size-3.5" />}
              {t === 'investigations' && <FolderSearch className="size-3.5" />}
              {t === 'files' && <FileText className="size-3.5" />}
              {t}
              <span className="tnum font-mono text-[10px] text-faint">{n}</span>
            </button>
          ))}
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col p-2">
            {tab === 'files' ? (
              fileResults.length === 0 ? (
                <EmptyState />
              ) : (
                fileResults.map((g) => (
                  <FileRow key={g.id} group={g} onSelect={() => setSelected(g.accession)} selected={selected === g.accession} inWorking={inWorking(g.id)} onAdd={() => {
                    addWorkingItems([{
                      id: `ws_${g.id}`,
                      type: 'file',
                      ref: g.id,
                      label: `${g.acronym} — ${g.category}`,
                      sub: `${g.count} files`,
                      tags: [g.fileType, g.category],
                    }])
                  }} />
                ))
              )
            ) : invResults.length === 0 ? (
              <EmptyState />
            ) : (
              invResults.map((r) => (
                <InvestRow
                  key={r.accession}
                  rec={r}
                  onSelect={() => setSelected(r.accession)}
                  selected={selected === r.accession}
                  inWorking={inWorking(r.accession)}
                  onAdd={() => addInvestigation(r.accession)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </section>

      {/* detail / selection */}
      <aside className="flex w-80 shrink-0 flex-col border-l border-edge bg-panel">
        <div className="flex h-9 shrink-0 items-center border-b border-edge px-3">
          <span className="text-xs font-semibold text-text">
            {selectedInv ? selectedInv.acronym : 'Detail'}
          </span>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {selectedInv ? (
            <div className="space-y-3 p-3">
              <div>
                <p className="text-sm font-semibold text-text">{selectedInv.acronym}</p>
                <p className="text-xs text-dim">{selectedInv.title}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedInv.tags.map((t) => (
                  <Badge key={t} variant={t === 'moon-relevant' ? 'amber' : 'muted'}>{t}</Badge>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-dim">
                <Metric label="tests" value={String(selectedInv.nTests)} />
                <Metric label="datasets" value={String(selectedInv.datasetCount)} />
                <Metric label="O₂ range" value={selectedInv.o2Range} />
                <Metric label="pressure" value={selectedInv.pRange} />
              </div>
              <p className="text-[12px] leading-relaxed text-dim">
                {selectedInv.objective.slice(0, 300)}…
              </p>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => addInvestigation(selectedInv.accession)}
                  disabled={inWorking(selectedInv.accession)}
                  className="h-8 rounded-md bg-bright text-xs font-semibold text-ink transition-colors hover:bg-bright/85 disabled:opacity-40"
                >
                  {inWorking(selectedInv.accession) ? 'In working set ✓' : 'Add to working set'}
                </button>
                <a
                  href={selectedInv.url}
                  target="_blank"
                  rel="noreferrer"
                  className="h-8 rounded-md border border-edge text-xs text-dim transition-colors hover:text-text flex items-center justify-center"
                >
                  Open PSI record ↗
                </a>
              </div>
            </div>
          ) : (
            <div className="p-4 text-sm text-faint">
              Select an investigation or file to see details, then add it to your working set.
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
            onClick={() => { setTrayOpen(true); setView('visualize') }}
            disabled={workingItems.length === 0}
            className="h-9 w-full rounded-md bg-bright text-xs font-semibold text-ink transition-colors hover:bg-bright/85 disabled:opacity-40"
          >
            Go to visualization
          </button>
        </div>
      </aside>
    </div>
  )
}

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
          'flex size-3.5 items-center justify-center rounded-sm border',
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
    <div className="rounded-md border border-edge bg-panel2 px-2 py-1.5">
      <p className="text-[10px] text-faint">{label}</p>
      <p className="tnum text-[12px] text-text">{value}</p>
    </div>
  )
}

function InvestRow({ rec, onSelect, selected, inWorking, onAdd }: {
  rec: (typeof INVEST_RECORDS)[number]
  onSelect: () => void
  selected: boolean
  inWorking: boolean
  onAdd: () => void
}) {
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
        <span className="text-[11px] text-faint">{rec.accession}</span>
        <div className="ml-auto flex items-center gap-1">
          {rec.moonRelevant && <Badge variant="amber">moon</Badge>}
          <span className="tnum font-mono text-[10px] text-bright">#{rec.relevance.toFixed(1)}</span>
        </div>
      </div>
      <p className="mt-0.5 truncate text-xs text-dim">{rec.title}</p>
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-faint">
        <span className={SAFETY_COLOR[rec.safetyArea]}>{rec.safetyArea}</span>
        <span>·</span>
        <span className="tnum font-mono">{rec.nTests} tests</span>
        <span>·</span>
        <span className="tnum font-mono">{rec.o2Range} O₂</span>
        <button
          onClick={(e) => { e.stopPropagation(); onAdd() }}
          disabled={inWorking}
          className="ml-auto rounded px-1.5 py-0.5 text-[10px] text-teal enabled:hover:bg-teal/10 disabled:opacity-40"
        >
          {inWorking ? '✓ added' : '+ add'}
        </button>
      </div>
    </div>
  )
}

function FileRow({ group, onSelect, selected, inWorking, onAdd }: {
  group: ReturnType<typeof searchFileGroups>[number]
  onSelect: () => void
  selected: boolean
  inWorking: boolean
  onAdd: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'cursor-pointer rounded-md border px-2.5 py-2 transition-colors',
        selected ? 'border-bright bg-bright/5' : 'border-edge/60 bg-panel hover:border-edge2',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-text">{group.acronym}</span>
        <span className="text-[11px] text-faint">{group.category}</span>
        <div className="ml-auto">
          <Badge variant="muted">{group.fileType}</Badge>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-faint">
        <span className="tnum font-mono">{group.count} files</span>
        {group.representative && <span className="truncate">· {group.representative}</span>}
        <button
          onClick={(e) => { e.stopPropagation(); onAdd() }}
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
