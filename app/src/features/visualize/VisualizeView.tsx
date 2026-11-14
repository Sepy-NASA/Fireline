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
import { cn } from '../../lib/utils'

/* ————————————————————————————————————————————
   Visualize: chart templates over datasets chosen
   from Explore (or added from the working set).
   ———————————————————————————————————————————— */

type Template = 'scatter' | 'line' | 'bar' | 'coverage' | 'rover'

const TEMPLATES: { id: Template; label: string; icon: React.ReactNode }[] = [
  { id: 'scatter', label: 'Scatter', icon: <ScatterIcon className="size-3.5" /> },
  { id: 'line', label: 'Line', icon: <LineIcon className="size-3.5" /> },
  { id: 'bar', label: 'Bar', icon: <BarChart2 className="size-3.5" /> },
  { id: 'coverage', label: 'Coverage map', icon: <Grid3X3 className="size-3.5" /> },
  { id: 'rover', label: 'Rover O₂ coverage', icon: <Grid3X3 className="size-3.5" /> },
]

const PALETTE = ['#4da3ff', '#ffb454', '#3ad7a3', '#7a8bff', '#ff6b6b', '#9ad84a', '#e9eef5']

export function VisualizeView() {
  const vizPreset = useAppStore((s) => s.vizPreset)
  const [template, setTemplate] = useState<Template>(vizPreset === 'rover' ? 'rover' : 'scatter')
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

        <div className="ml-auto flex items-center gap-2">
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
        {template === 'rover' ? (
          <RoverCoverage />
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

/* ——— Demo: rover condition coverage (O₂ ranges from the supplied PSI tables) ——— */

const ROVER_ROWS: { label: string; file: string; kind: 'solid' | 'gas'; min: number; max: number; points?: number[]; note: string }[] = [
  { label: 'Saffire-II (PSI-99)', file: 'SAFFIRE-2.csv · rows 2-5, 2-8, 2-9', kind: 'solid', min: 21.5, max: 22.1, note: 'PMMA & SIBAL · 20 cm/s' },
  { label: 'Saffire-I (PSI-98)', file: 'SAFFIRE-1.csv · rows S1, S2', kind: 'solid', min: 21.5, max: 21.7, note: 'SIBAL · 20 cm/s' },
  { label: 'BASS-II (PSI-25)', file: 'BASS-II.csv · 129 rows', kind: 'solid', min: 13.6, max: 22.2, note: 'PMMA films/rods · flow free text' },
  { label: 'ACME BRE (PSI-20)', file: 'ACME BRE.csv · 18 daily summaries', kind: 'gas', min: 21, max: 40, points: [21, 25, 26.5, 34, 40], note: 'gas burner · different fuel' },
  { label: 'CFI-G (PSI-159)', file: 'CFI-G Normal + Inverse Flames.csv', kind: 'gas', min: 12, max: 85, note: 'gas flames · different fuel' },
]

function RoverCoverage() {
  const W = 760
  const left = 190
  const right = 30
  const x0 = 10
  const x1 = 90
  const sx = (v: number) => left + ((v - x0) / (x1 - x0)) * (W - left - right)
  const rowH = 46
  const top = 40
  const H = top + ROVER_ROWS.length * rowH + 50
  const ticks = [10, 20, 30, 40, 50, 60, 70, 80, 90]
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 overflow-auto p-6">
      <div className="w-full max-w-[800px]">
        <p className="text-sm font-semibold text-text">Tested O₂ range vs rover target — PSI evidence in this bundle</p>
        <p className="mt-0.5 text-xs text-dim">
          Amber = solid-material tests · violet = gas flames (different fuel, context only) · blue line = rover target 30 % O₂ (engineer input)
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[800px]" role="img" aria-label="O2 coverage of PSI evidence vs rover target">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={top - 10} y2={H - 40} stroke="#1c2430" />
            <text x={sx(t)} y={H - 22} textAnchor="middle" fontSize="10" fill="#5b6472">{t} %</text>
          </g>
        ))}
        <text x={(left + W - right) / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="#8b95a5">Oxygen (% by volume)</text>
        {ROVER_ROWS.map((r, i) => {
          const y = top + i * rowH + rowH / 2
          const color = r.kind === 'solid' ? '#ffb454' : '#a78bfa'
          return (
            <g key={r.label}>
              <text x={8} y={y - 4} fontSize="11.5" fill="#e9eef5" fontWeight={600}>{r.label}</text>
              <text x={8} y={y + 10} fontSize="9" fill="#5b6472">{r.file}</text>
              <rect x={sx(r.min)} y={y - 7} width={Math.max(sx(r.max) - sx(r.min), 4)} height={14} rx={3} fill={color} fillOpacity={r.kind === 'solid' ? 0.85 : 0.3} stroke={color} />
              {r.points?.map((p) => <circle key={p} cx={sx(p)} cy={y} r={3.5} fill={color} />)}
              <text x={sx(r.max) + 6 > W - 200 ? sx(r.min) : sx(r.max) + 6} y={sx(r.max) + 6 > W - 200 ? y + 20 : y + 4} fontSize="9.5" fill="#8b95a5">{r.min}–{r.max} % · {r.note}</text>
            </g>
          )
        })}
        <line x1={sx(30)} x2={sx(30)} y1={top - 18} y2={H - 40} stroke="#4da3ff" strokeWidth={2} strokeDasharray="5 3" />
        <text x={sx(30)} y={top - 22} textAnchor="middle" fontSize="10.5" fill="#4da3ff" fontWeight={600}>Rover target 30 %</text>
      </svg>
      <div className="grid w-full max-w-[800px] grid-cols-3 gap-2 text-[11.5px]">
        <div className="rounded-md border border-teal/30 bg-teal/5 p-2.5 text-dim">
          <p className="mb-0.5 font-semibold text-teal">Measured</p>
          Solid-material rows (PMMA, SIBAL) stop at ~22 % O₂, all from low-g orbital tests.
        </div>
        <div className="rounded-md border border-flame/30 bg-flame/5 p-2.5 text-dim">
          <p className="mb-0.5 font-semibold text-flame">Not covered</p>
          No solid-material row at 30 % O₂ and no test at 1/6 g. Rover pressure & airflow not tabulated in the Saffire rows.
        </div>
        <div className="rounded-md border border-[#a78bfa]/30 bg-[#a78bfa]/5 p-2.5 text-dim">
          <p className="mb-0.5 font-semibold text-[#c4b5fd]">Context only</p>
          Gas-flame data spans 30 % but cannot serve as a solid-polymer flammability threshold.
        </div>
      </div>
    </div>
  )
}
