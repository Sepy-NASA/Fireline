import { BarChart2, Grid3X3, LineChart as LineIcon, ScatterChart as ScatterIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { DATASETS } from '../../generated/datasets'
import { useAppStore } from '../../store/appStore'
import { EvidenceFigures } from './EvidenceFigures'
import { cn } from '../../lib/utils'

/* ————————————————————————————————————————————
   Visualize: chart templates over datasets chosen
   from Explore (or added from the working set).
   ———————————————————————————————————————————— */

type Template = 'scatter' | 'line' | 'bar' | 'coverage' | 'rover' | 'figures'

const TEMPLATES: { id: Template; label: string; icon: React.ReactNode }[] = [
  { id: 'scatter', label: 'Scatter', icon: <ScatterIcon className="size-3.5" /> },
  { id: 'line', label: 'Line', icon: <LineIcon className="size-3.5" /> },
  { id: 'bar', label: 'Bar', icon: <BarChart2 className="size-3.5" /> },
  { id: 'coverage', label: 'Coverage map', icon: <Grid3X3 className="size-3.5" /> },
  { id: 'rover', label: 'Rover evidence', icon: <Grid3X3 className="size-3.5" /> },
  { id: 'figures', label: 'Evidence figures', icon: <BarChart2 className="size-3.5" /> },
]

const PALETTE = ['#4da3ff', '#ffb454', '#3ad7a3', '#7a8bff', '#ff6b6b', '#9ad84a', '#e9eef5']

export function VisualizeView() {
  const vizPreset = useAppStore((s) => s.vizPreset)
  const roverActive = useAppStore((s) => s.activeSessionId?.startsWith('ses_rover') ?? false)
  const [template, setTemplate] = useState<Template>(vizPreset === 'figures' ? 'figures' : vizPreset === 'rover' || roverActive ? 'rover' : 'scatter')
  // links from Analyze (agent reply, branch summary) open the evidence figures
  const setVizPreset = useAppStore((s) => s.setVizPreset)
  useEffect(() => {
    if (vizPreset === 'figures' || vizPreset === 'rover') {
      setTemplate(vizPreset)
      setVizPreset(null) // one-shot: later visits keep the user's own choice
    }
  }, [vizPreset, setVizPreset])
  const [datasetId, setDatasetId] = useState<string | null>(null)
  const workingItems = useAppStore((s) => s.workingItems)

  // dataset options = all datasets with enough rows (working-set filtering happens in Explore)
  const options = useMemo(() => DATASETS.filter((d) => d.rows >= 5).slice(0, 40), [])

  // auto-select the first working-set dataset when one is chosen in Explore/tray
  const firstWorkingDataset = useMemo(
    () => options.find((d) => workingItems.some((w) => w.ref === d.id)) ?? null,
    [workingItems, options],
  )
  useEffect(() => {
    if (!datasetId && firstWorkingDataset) setDatasetId(firstWorkingDataset.id)
  }, [firstWorkingDataset, datasetId])

  const dataset = options.find((d) => d.id === datasetId) ?? null

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* top bar: template picker + dataset selector */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-edge bg-panel px-3">
        <div className="flex items-center gap-1">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
                template === t.id ? 'bg-bright/15 text-bright' : 'text-dim hover:text-text',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className={cn('ml-auto flex items-center gap-2', (template === 'rover' || template === 'figures') && 'hidden')}>
          <label className="text-[11px] text-faint">Dataset</label>
          <select
            value={datasetId ?? ''}
            onChange={(e) => setDatasetId(e.target.value || null)}
            className="h-8 rounded-md border border-edge bg-panel2 px-2 text-xs text-text focus:outline-2 focus:outline-bright"
          >
            <option value="">— pick a dataset —</option>
            {options.map((d) => (
              <option key={d.id} value={d.id}>
                {d.accession} · {d.title} ({d.rows} rows)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {template === 'figures' ? (
          <EvidenceFigures />
        ) : template === 'rover' ? (
          <RoverEvidence />
        ) : !dataset ? (
          <EmptyChart />
        ) : template === 'coverage' ? (
          <CoverageMap dataset={dataset} />
        ) : (
          <ChartTemplate template={template} dataset={dataset} />
        )}
      </div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-sm text-faint">
      <Grid3X3 className="mb-3 size-8 opacity-40" />
      Choose a dataset to start visualizing.
      <p className="mt-1 text-xs text-faint/70">
        Pick files in Explore → working set → here, or use the selector above.
      </p>
    </div>
  )
}

/* numeric + categorical column classification */
function columnInfo(dataset: (typeof DATASETS)[number]) {
  const numericCols: string[] = []
  const categoricalCols: string[] = []
  for (const c of dataset.columns) {
    if (dataset.numeric[c] && dataset.numeric[c].count >= 5 && dataset.numeric[c].min !== null) {
      numericCols.push(c)
    } else {
      categoricalCols.push(c)
    }
  }
  return { numericCols, categoricalCols }
}

/** Parse a row value into a number (percent/fraction detection). */
function toNumberCell(v: string | undefined): number | null {
  if (v == null) return null
  const m = String(v).match(/-?\d+(?:\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  if (!Number.isFinite(n)) return null
  // small fractions → percent for readability in most contexts
  return n
}

function ChartTemplate({ template, dataset }: { template: Template; dataset: (typeof DATASETS)[number] }) {
  const { numericCols, categoricalCols } = useMemo(() => columnInfo(dataset), [dataset])
  const [xCol, setXCol] = useState(numericCols[0] ?? dataset.columns[0])
  const [yCol, setYCol] = useState(numericCols[1] ?? numericCols[0] ?? dataset.columns[0])
  const [colorCol, setColorCol] = useState<string | null>(categoricalCols[0] ?? null)
  const [limit, setLimit] = useState(200)

  const data = useMemo(() => {
    const parsed = dataset.sample
      .map((row) => ({
        x: toNumberCell(row[xCol]) ?? 0,
        y: toNumberCell(row[yCol]) ?? 0,
        cat: colorCol ? (row[colorCol] ?? '—') : null,
      }))
      .filter((d) => !(d.x === 0 && d.y === 0))
    return parsed.slice(0, limit)
  }, [dataset, xCol, yCol, colorCol, limit])

  const cats = useMemo(() => [...new Set(data.map((d) => d.cat).filter(Boolean))] as string[], [data])
  const catColor = useMemo(() => {
    const m = new Map<string, string>()
    cats.forEach((c, i) => m.set(c, PALETTE[i % PALETTE.length]))
    return m
  }, [cats])

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 p-3">
        <div className="h-full rounded-md border border-edge bg-panel p-2">
          <ResponsiveContainer width="100%" height="100%">
            {template === 'scatter' ? (
              <ScatterChart margin={{ top: 10, right: 20, bottom: 24, left: 8 }}>
                <CartesianGrid stroke="#1c2430" strokeDasharray="3 3" />
                <XAxis dataKey="x" name={xCol} stroke="#5b6472" tick={{ fill: '#8b95a5', fontSize: 10 }} label={{ value: short(xCol), position: 'insideBottom', offset: -12, fill: '#5b6472', fontSize: 10 }} />
                <YAxis dataKey="y" name={yCol} stroke="#5b6472" tick={{ fill: '#8b95a5', fontSize: 10 }} label={{ value: short(yCol), angle: -90, position: 'insideLeft', offset: 6, fill: '#5b6472', fontSize: 10 }} />
                <RTooltip content={<ScatterTip xCol={xCol} yCol={yCol} catCol={colorCol} />} cursor={{ strokeDasharray: '3 3', stroke: '#2a3442' }} />
                {colorCol ? (
                  cats.map((c) => (
                    <Scatter key={c} name={c} data={data.filter((d) => d.cat === c)} fill={catColor.get(c)} />
                  ))
                ) : (
                  <Scatter data={data} fill="#4da3ff" fillOpacity={0.75} />
                )}
              </ScatterChart>
            ) : template === 'line' ? (
              <LineChart data={data} margin={{ top: 10, right: 20, bottom: 24, left: 8 }}>
                <CartesianGrid stroke="#1c2430" strokeDasharray="3 3" />
                <XAxis dataKey="x" name={xCol} stroke="#5b6472" tick={{ fill: '#8b95a5', fontSize: 10 }} label={{ value: short(xCol), position: 'insideBottom', offset: -12, fill: '#5b6472', fontSize: 10 }} />
                <YAxis dataKey="y" stroke="#5b6472" tick={{ fill: '#8b95a5', fontSize: 10 }} />
                <RTooltip content={<ScatterTip xCol={xCol} yCol={yCol} catCol={colorCol} />} />
                {colorCol ? (
                  cats.map((c) => (
                    <Line key={c} type="monotone" dataKey="y" data={data.filter((d) => d.cat === c)} name={c} stroke={catColor.get(c)} dot={false} strokeWidth={1.5} />
                  ))
                ) : (
                  <Line type="monotone" dataKey="y" data={data} stroke="#4da3ff" dot={false} strokeWidth={1.5} />
                )}
              </LineChart>
            ) : (
              <BarChart data={data} margin={{ top: 10, right: 20, bottom: 24, left: 8 }}>
                <CartesianGrid stroke="#1c2430" strokeDasharray="3 3" />
                <XAxis dataKey="cat" stroke="#5b6472" tick={{ fill: '#8b95a5', fontSize: 10 }} />
                <YAxis dataKey="y" stroke="#5b6472" tick={{ fill: '#8b95a5', fontSize: 10 }} />
                <RTooltip cursor={{ fill: 'rgba(77,163,255,0.06)' }} />
                <Bar dataKey="y" name={yCol} radius={[3, 3, 0, 0]}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={catColor.get(d.cat ?? '') ?? '#4da3ff'} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* axis config */}
      <aside className="w-60 shrink-0 border-l border-edge bg-panel p-3">
        <p className="mb-2 text-[11px] font-semibold text-faint">Axes</p>
        <AxisSelect label="X" value={xCol} options={numericCols.length ? numericCols : dataset.columns} onChange={setXCol} />
        {template !== 'bar' && <AxisSelect label="Y" value={yCol} options={numericCols} onChange={setYCol} />}
        <AxisSelect label="Color" value={colorCol ?? ''} options={categoricalCols} onChange={(v) => setColorCol(v || null)} optional />

        <p className="mb-1 mt-4 text-[11px] font-semibold text-faint">Rows</p>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={20}
            max={Math.min(dataset.sample.length, 500)}
            step={20}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-full accent-[#4da3ff]"
          />
          <span className="tnum w-10 text-right font-mono text-[11px] text-dim">{limit}</span>
        </div>

        <div className="mt-4 rounded-md border border-edge bg-panel2 p-2">
          <p className="mb-1 text-[10px] font-semibold text-faint">Source</p>
          <p className="text-[11px] text-dim">{dataset.title}</p>
          <p className="tnum text-[10px] text-faint">{dataset.rows} rows · {dataset.columns.length} columns</p>
        </div>
      </aside>
    </div>
  )
}

function AxisSelect({ label, value, options, onChange, optional }: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
  optional?: boolean
}) {
  return (
    <div className="mb-2">
      <label className="mb-0.5 block text-[10px] text-faint">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-full rounded-md border border-edge bg-panel2 px-1.5 text-[11px] text-text focus:outline-2 focus:outline-bright"
      >
        {optional && <option value="">— none —</option>}
        {options.map((o) => (
          <option key={o} value={o}>{short(o)}</option>
        ))}
      </select>
    </div>
  )
}

function short(s: string) {
  return s.length > 26 ? s.slice(0, 24) + '…' : s
}

function ScatterTip({ active, payload, xCol, yCol, catCol }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-md border border-edge bg-panel px-2.5 py-1.5 text-[11px] shadow-pop">
      <p className="tnum text-text">{xCol}: {p.x}</p>
      <p className="tnum text-text">{yCol}: {p.y}</p>
      {catCol && <p className="text-dim">{catCol}: {p.cat}</p>}
    </div>
  )
}

/* ——— coverage map: O₂ % × pressure (atm), point per test, color by outcome/dataset ——— */
function CoverageMap({ dataset }: { dataset: (typeof DATASETS)[number] }) {
  const o2c = dataset.ranges.o2
  const pc = dataset.ranges.pressure
  const flow = dataset.ranges.flow

  if (!o2c) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-faint">
        This dataset has no O₂ column — pick one with oxygen or pressure readings (e.g. FLEX, CFI-G, Flame Design).
      </div>
    )
  }

  // find columns for o2, pressure, and outcome
  const cols = dataset.columns
  const o2Col = cols.find((c) => dataset.numeric[c]?.isO2) ?? cols.find((c) => /o2|oxygen/i.test(c))
  const pCol = cols.find((c) => dataset.numeric[c]?.isPressure) ?? cols.find((c) => /pressure|pinit|pmean|pfinal/i.test(c))
  const outCol = cols.find((c) => /end|outcome|result|ignit|extinct|self-ext|flow term/i.test(c))

  const parse = (v: string | undefined) => {
    if (v == null) return null
    const m = String(v).match(/-?\d+(?:\.\d+)?/)
    if (!m) return null
    const n = Number(m[0])
    return Number.isFinite(n) ? n : null
  }

  const points = dataset.sample
    .map((row) => {
      const rawO2 = o2Col ? parse(row[o2Col]) : null
      const o2 = rawO2 == null ? null : rawO2 > 5 ? rawO2 : rawO2 * 100
      let p = pCol ? parse(row[pCol]) : null
      if (p != null && pCol) {
        const pn = pCol.toLowerCase()
        if (pn.includes('mmhg')) p = p / 760
        else if (pn.includes('bar')) p = p * 0.986923
      }
      const out = outCol ? (row[outCol] ?? '—') : null
      return { o2, p, out }
    })
    .filter((d) => d.o2 != null)
    .slice(0, 400)

  const w = 680
  const h = 420
  const pad = 44
  const xMax = Math.min(100, Math.ceil((o2c.max ?? 40) * 1.1))
  const xMin = 0
  const yMin = 0
  const yMax = pc ? Math.ceil((pc.max ?? 3.3) + 0.5) : 4

  const sx = (v: number) => pad + ((v - xMin) / (xMax - xMin)) * (w - pad * 2)
  const sy = (v: number) => h - pad - ((v - yMin) / (yMax - yMin)) * (h - pad * 2)

  const OUT_COLORS: Record<string, string> = {
    Extinction: '#4da3ff',
    Disruption: '#ff6b6b',
    Completion: '#3ad7a3',
    Yes: '#3ad7a3',
    No: '#ff6b6b',
    SE: '#ffb454',
    FT: '#4da3ff',
  }

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="rounded-md border border-edge bg-panel p-3">
        <div className="mb-1 flex items-baseline gap-2">
          <p className="text-xs text-text">{dataset.accession} · {dataset.title}</p>
          <p className="text-[10px] text-faint">condition coverage</p>
        </div>
        <svg width={w} height={h} className="font-mono">
          {/* grid */}
          {Array.from({ length: 11 }, (_, i) => {
            const v = (xMax - xMin) * i / 10 + xMin
            const x = sx(v)
            return (
              <g key={`gx${i}`}>
                <line x1={x} y1={pad} x2={x} y2={h - pad} stroke="#1c2430" strokeWidth="0.5" />
                <text x={x} y={h - pad + 14} textAnchor="middle" fill="#5b6472" fontSize="9">{Math.round(v)}</text>
              </g>
            )
          })}
          {Array.from({ length: 8 }, (_, i) => {
            const v = (yMax - yMin) * i / 7 + yMin
            const y = sy(v)
            return (
              <g key={`gy${i}`}>
                <line x1={pad} y1={y} x2={w - pad} y2={y} stroke="#1c2430" strokeWidth="0.5" />
                <text x={pad - 8} y={y + 3} textAnchor="end" fill="#5b6472" fontSize="9">{v.toFixed(1)}</text>
              </g>
            )
          })}
          {/* lunar-base window: ≥30 % O₂, ≤0.7 atm */}
          <rect
            x={sx(30)}
            y={sy(0.7)}
            width={sx(xMax) - sx(30)}
            height={sy(0) - sy(0.7)}
            fill="rgba(77,163,255,0.07)"
            stroke="#4da3ff"
            strokeDasharray="4 3"
            strokeWidth="1"
          />
          <text x={w - pad} y={sy(0.7) - 6} textAnchor="end" fill="#4da3ff" fontSize="9">
            lunar-base window
          </text>
          {/* points */}
          {points.map((d, idx) => {
            const x = sx(Math.max(0, Math.min(xMax, d.o2!)))
            const y = d.p != null ? sy(Math.max(yMin, Math.min(yMax, d.p))) : h - pad
            return (
              <circle key={idx} cx={x} cy={y} r={2.2} fill={d.out ? (OUT_COLORS[d.out] ?? '#9ad84a') : '#4da3ff'} fillOpacity={0.8} stroke="#0e1218" strokeWidth="0.5" />
            )
          })}
          <text x={pad} y={pad - 16} fill="#8b95a5" fontSize="10">O₂ % →</text>
          <text x={pad - 10} y={pad - 30} fill="#5b6472" fontSize="9">pressure (atm) ↓</text>
        </svg>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-faint">
          <span>{points.length} sampled tests</span>
          {flow && <span>· flow {flow.min}–{flow.max} cm/s</span>}
          <span className="ml-auto">points colored by outcome when available</span>
        </div>
      </div>
    </div>
  )
}

/* ——— Rover evidence: what the PSI tables measured vs the rover inputs ——— */

const SOLID = '#ffb454'
const GAS = '#a78bfa'
const ROVER = '#4da3ff'

const O2_ROWS: { label: string; file: string; kind: 'solid' | 'gas'; min: number; max: number; points?: number[]; note: string }[] = [
  { label: 'Saffire-II (PSI-99)', file: 'SAFFIRE-2 · rows 2-5, 2-8, 2-9', kind: 'solid', min: 21.5, max: 22.1, note: 'PMMA & SIBAL' },
  { label: 'Saffire-I (PSI-98)', file: 'SAFFIRE-1 · rows S1, S2', kind: 'solid', min: 21.5, max: 21.7, note: 'SIBAL' },
  { label: 'BASS-II (PSI-25)', file: 'BASS-II · 129 rows', kind: 'solid', min: 13.6, max: 22.2, note: 'PMMA films / rods' },
  { label: 'ACME BRE (PSI-20)', file: 'ACME BRE · 18 summaries', kind: 'gas', min: 21, max: 40, points: [21, 25, 26.5, 34, 40], note: 'gas burner' },
  { label: 'CFI-G (PSI-159)', file: 'CFI-G normal + inverse', kind: 'gas', min: 12, max: 85, note: 'gas flames' },
]

/** Burn time per sample, straight from the tables (s). */
const BURN_ROWS: { id: string; src: string; material: string; value: number; flow: string; flag?: string }[] = [
  { id: '2-5', src: 'Saffire-II', material: 'SIBAL', value: 145, flow: 'concurrent' },
  { id: '2-8', src: 'Saffire-II', material: 'PMMA', value: 600, flow: 'concurrent' },
  { id: '2-9', src: 'Saffire-II', material: 'PMMA?', value: 900, flow: 'concurrent', flag: 'material cell blank in table' },
  { id: 'S1', src: 'Saffire-I', material: 'SIBAL', value: 420, flow: 'concurrent' },
  { id: 'S2', src: 'Saffire-I', material: 'SIBAL', value: 70, flow: 'opposed' },
]

function Panel({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-edge bg-panel p-4">
      <p className="text-[13px] font-semibold text-text">{title}</p>
      <p className="mb-3 text-[11px] text-faint">{sub}</p>
      {children}
    </div>
  )
}

function RangeChart({
  rows,
  min,
  max,
  ticks,
  unit,
  rover,
  roverLabel,
}: {
  rows: { label: string; file: string; color: string; from: number; to: number; points?: number[]; note: string; faint?: boolean }[]
  min: number
  max: number
  ticks: number[]
  unit: string
  rover: { from: number; to: number } | null
  roverLabel: string
}) {
  const W = 640
  const left = 170
  const right = 16
  const sx = (v: number) => left + ((v - min) / (max - min)) * (W - left - right)
  const rowH = 38
  const top = 28
  const H = top + rows.length * rowH + 34
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={sx(t)} x2={sx(t)} y1={top - 6} y2={H - 30} stroke="#1c2430" />
          <text x={sx(t)} y={H - 14} textAnchor="middle" fontSize="10" fill="#5b6472">{t}{unit}</text>
        </g>
      ))}
      {rover && (
        <>
          <rect x={sx(rover.from) - (rover.from === rover.to ? 1.5 : 0)} y={top - 6} width={Math.max(sx(rover.to) - sx(rover.from), 3)} height={H - 24 - top} fill={ROVER} fillOpacity={0.14} stroke={ROVER} strokeDasharray="4 3" />
          <text x={sx((rover.from + rover.to) / 2)} y={top - 12} textAnchor="middle" fontSize="10.5" fontWeight={600} fill={ROVER}>{roverLabel}</text>
        </>
      )}
      {rows.map((r, i) => {
        const y = top + i * rowH + rowH / 2
        return (
          <g key={r.label} opacity={r.faint ? 0.8 : 1}>
            <text x={4} y={y - 3} fontSize="11.5" fill="#e9eef5" fontWeight={600}>{r.label}</text>
            <text x={4} y={y + 11} fontSize="9" fill="#5b6472">{r.file}</text>
            <rect x={sx(r.from)} y={y - 6} width={Math.max(sx(r.to) - sx(r.from), 4)} height={12} rx={3} fill={r.color} fillOpacity={r.faint ? 0.3 : 0.85} stroke={r.color} />
            {r.points?.map((p) => <circle key={p} cx={sx(p)} cy={y} r={3.2} fill={r.color} />)}
          </g>
        )
      })}
    </svg>
  )
}

function RoverEvidence() {
  const session = useAppStore((s) => s.sessions.find((x) => x.id === s.activeSessionId))
  const val = (id: string) => session?.nodes.find((n) => n.id === id)?.data.value || ''
  const o2 = val('rv_o2') || '30 %'
  const flow = val('rv_airflow')
  const pressure = val('rv_pressure')
  const gravity = val('rv_gravity') || '1/6 g'
  const flowRange = flow.match(/([\d.]+)\s*[–-]\s*([\d.]+)/)
  const o2num = parseFloat(o2) || 30
  const burnMax = 1000
  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-[1180px] space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[16px] font-semibold text-text">Rover evidence — measured in PSI vs rover inputs</p>
            <p className="text-[12px] text-dim">Saffire, BASS and ACME tables against the rover design basis.</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {[
              ['Gravity', gravity],
              ['O₂', o2],
              ['Pressure', pressure || '—'],
              ['Airflow', flow || '—'],
            ].map(([k, v]) => (
              <span key={k} className="rounded-md border border-bright/40 bg-bright/10 px-2 py-1 text-bright">
                <span className="text-faint">{k} </span>
                {v}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            o2num >= 20 && o2num <= 23
              ? ['Oxygen', `Saffire rows at ~22 % O₂. Rover: ${o2}.`, 'Covered', 'text-teal border-teal/40 bg-teal/5']
              : ['Oxygen', `Solid-material tests stop at ~22 %. Rover: ${o2}.`, 'Not covered', 'text-flame border-flame/40 bg-flame/5'],
            ['Gravity', `All tests in orbital low-g. Rover: ${gravity}.`, 'Not covered', 'text-flame border-flame/40 bg-flame/5'],
            ['Airflow', `Saffire rows at 20 cm/s. Rover: ${flow || 'unknown'}.`, flow ? 'Speed overlaps' : 'Unknown', 'text-amber border-amber/40 bg-amber/5'],
          ].map(([k, t, v, cls]) => (
            <div key={k} className={`rounded-lg border p-3 ${cls}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wider">{k} · {v}</p>
              <p className="mt-1 text-[12px] text-dim">{t}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Panel title="Tested O₂ range" sub="Amber = solid-material tests · violet = gas flames (different fuel, context only)">
            <RangeChart
              rows={O2_ROWS.map((r) => ({ label: r.label, file: r.file, color: r.kind === 'solid' ? SOLID : GAS, from: r.min, to: r.max, points: r.points, note: r.note, faint: r.kind === 'gas' }))}
              min={10}
              max={90}
              ticks={[10, 20, 30, 40, 50, 60, 70, 80, 90]}
              unit="%"
              rover={{ from: o2num, to: o2num }}
              roverLabel={`Rover ${o2}`}
            />
          </Panel>
          <Panel title="Air flow at the sample" sub="Saffire tables list 20 cm/s · BASS-II flow fields are free text (not plotted)">
            <RangeChart
              rows={[
                { label: 'Saffire-II (PSI-99)', file: 'SAFFIRE-2 · all rows', color: SOLID, from: 20, to: 20, note: '' },
                { label: 'Saffire-I (PSI-98)', file: 'SAFFIRE-1 · S1, S2', color: SOLID, from: 20, to: 20, note: '' },
              ]}
              min={0}
              max={40}
              ticks={[0, 5, 10, 15, 20, 25, 30, 35, 40]}
              unit=""
              rover={flowRange ? { from: parseFloat(flowRange[1]), to: parseFloat(flowRange[2]) } : null}
              roverLabel={`Rover ${flow} (1/6-g flow field)`}
            />
            <p className="mt-1 text-[10.5px] text-faint">cm/s. Same speed does not mean the same flow field: 1/6 g adds buoyant flow.</p>
          </Panel>
        </div>

        <Panel title="Burn time per sample" sub="Measured in the Saffire tables, ~22 % O₂, 20 cm/s · different sample sizes — not a flammability limit">
          <div className="space-y-1.5">
            {BURN_ROWS.map((r) => (
              <div key={r.id} className="grid grid-cols-[150px_1fr_70px] items-center gap-3">
                <div>
                  <p className="text-[12px] font-semibold text-text">
                    {r.src} · {r.id}
                  </p>
                  <p className="text-[10px] text-faint">
                    {r.material} · {r.flow}
                    {r.flag ? ` · ${r.flag}` : ''}
                  </p>
                </div>
                <div className="h-4 rounded-sm bg-edge/40">
                  <div
                    className="h-4 rounded-sm"
                    style={{ width: `${(r.value / burnMax) * 100}%`, background: r.material.startsWith('PMMA') ? SOLID : '#3ad7a3', opacity: r.flag ? 0.6 : 0.9 }}
                  />
                </div>
                <span className="text-right font-mono text-[12px] text-text">{r.value} s</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-3 text-[10.5px] text-faint">
            <span><span className="mr-1 inline-block size-2 rounded-sm" style={{ background: SOLID }} />PMMA</span>
            <span><span className="mr-1 inline-block size-2 rounded-sm bg-teal" />Cotton-fiberglass (SIBAL)</span>
          </div>
        </Panel>
      </div>
    </div>
  )
}
