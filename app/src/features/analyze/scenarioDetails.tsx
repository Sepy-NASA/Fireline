import { AlertTriangle, BarChart3, Check, ChevronDown, Database, ExternalLink, ListChecks, Minus, Search, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useAppStore } from '../../store/appStore'
import type { Branch, GraphNode, Session } from '../../types'
import { Button } from '../../components/ui/button'
import { cn } from '../../lib/utils'
import { PROVENANCE_META } from './nodeSystem'
import { CONCLUSIONS, DOI, EVIDENCE, PSI_URL, RV, nextActionsReply, roverInputs, type Evidence } from './roverScenario'

/* ————————————————————————————————————————————
   Right-panel details for the rover review.
   Built to be scanned: numbers first, one-line
   statements, status icons, details collapsed.
   Measured data, engineer inputs and gaps keep
   their own colours.
   ———————————————————————————————————————————— */

export function hasScenarioDetails(node: GraphNode): boolean {
  return Boolean(EVIDENCE[node.data.ref]) || node.id.startsWith('rv_') || node.type === 'missionParam' || node.type === 'gap'
}

/* ——— short facts per PSI record ——— */

const SHORT: Record<string, { stats: [string, string][]; why: string; limit: string }> = {
  'PSI-99': { stats: [['O₂', '~22 %'], ['Air flow', '20 cm/s'], ['Sample', '29 × 5 cm']], why: 'Closest material rows: PMMA & SIBAL', limit: 'Near-air O₂ in low-g — not 30 % / 1/6 g' },
  'PSI-98': { stats: [['O₂', '~21.5 %'], ['Air flow', '20 cm/s'], ['Sample', '40.6 × 94 cm']], why: 'Large SIBAL samples, flow-direction effect', limit: 'No acrylic, not 30 % O₂, not 1/6 g' },
  'PSI-25': { stats: [['Rows', '129'], ['O₂', '13.6–22.2 %'], ['Material', 'PMMA film / rod']], why: 'PMMA screening data', limit: 'Lower O₂; airflow fields are free text' },
  'PSI-26': { stats: [['Rows', '122'], ['Materials', 'PMMA, SIBAL, Nomex'], ['Results', 'not numeric']], why: 'Material and geometry index', limit: 'No consistent result matrix' },
  'PSI-20': { stats: [['O₂', '21–40 %'], ['Fuel', 'ethylene / methane'], ['Days', '18']], why: '26.5 % and 34 % O₂ bracket the rover’s 30 %', limit: 'Gas flame — not a polymer test' },
  'PSI-159': { stats: [['O₂', 'up to 85 %'], ['Fuel', 'gas'], ['Tests', '333']], why: 'High-O₂ flame mechanism', limit: 'A chamber condition, not a material limit' },
  'PSI-69': { stats: [['Tests', '274'], ['Extinction', '186'], ['Fuel', 'droplets']], why: 'Suppressant behaviour', limit: 'Not material flammability evidence' },
  'PSI-102': { stats: [['Topic', 'smoke'], ['Use', 'detectors']], why: 'Smoke and detector response', limit: 'Not flammability evidence' },
  'PSI-47': { stats: [['Topic', 'dust vs smoke']], why: 'Nuisance-alarm context', limit: 'Feasibility study only' },
}

const NEXT_SHORT = [
  'Verify pressure & airflow in the signed design basis',
  'C1 — replace seat textile or reduce airflow at seats',
  'C2 — confirm flow direction at seats (CFD V-07)',
  'C3 — keep ignition sources away from the PMMA pane',
  'Read the Saffire-II report (row 2-9, “?-g” headers)',
  'Plan material tests at 30 % O₂; log 1/6 g as open',
]

const GAPS_SHORT = [
  'No test at 1/6 g in the PSI data',
  'No solid-material test at 30 % O₂',
  'Pressure not tabulated in the PSI rows',
  'A gas flame is not a polymer threshold',
  'Grade, coating and backing not matched to samples',
]

/** O₂ match: the Saffire rows are ~21.5–22.1 % */
const o2Status = (text: string): 'ok' | 'no' | 'na' => {
  const v = parseFloat(text)
  if (Number.isNaN(v)) return 'na'
  return v >= 20 && v <= 23 ? 'ok' : 'no'
}

/* ——— small building blocks ——— */

type Status = 'ok' | 'partial' | 'no' | 'na'

function StatusIcon({ s }: { s: Status }) {
  if (s === 'ok') return <Check className="size-3.5 shrink-0 text-teal" />
  if (s === 'partial') return <Minus className="size-3.5 shrink-0 text-amber" />
  if (s === 'no') return <X className="size-3.5 shrink-0 text-flame" />
  return <Minus className="size-3.5 shrink-0 text-faint" />
}

function Chip({ children, cls }: { children: ReactNode; cls?: string }) {
  return <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium', cls ?? 'border-edge text-dim')}>{children}</span>
}

function ProvChip({ p }: { p?: string }) {
  const m = p ? PROVENANCE_META[p] : undefined
  return m ? <Chip cls={m.cls}>{m.label}</Chip> : null
}

function Head({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div>
      <p className="text-[15px] font-semibold leading-tight text-text">{title}</p>
      {sub && <p className="mt-0.5 font-mono text-[11px] text-faint">{sub}</p>}
      {children && <div className="mt-1.5 flex flex-wrap gap-1">{children}</div>}
    </div>
  )
}

function Card({ title, tone, children, right }: { title: string; tone?: 'measured' | 'engineer' | 'gap' | 'agent'; children: ReactNode; right?: ReactNode }) {
  const bar = tone === 'measured' ? 'bg-teal' : tone === 'engineer' ? 'bg-bright' : tone === 'gap' ? 'bg-flame' : tone === 'agent' ? 'bg-violet' : 'bg-edge2'
  return (
    <section className="overflow-hidden rounded-md border border-edge bg-panel2">
      <div className="flex items-center gap-2 border-b border-edge px-2.5 py-1.5">
        <span className={cn('size-1.5 rounded-full', bar)} />
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-dim">{title}</span>
        {right && <span className="ml-auto">{right}</span>}
      </div>
      <div className="p-2.5">{children}</div>
    </section>
  )
}

function Stats({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-md border border-edge bg-panel2 px-2 py-1.5">
          <p className="text-[9.5px] uppercase tracking-wider text-faint">{k}</p>
          <p className="truncate text-[13px] font-semibold text-text" title={v}>
            {v}
          </p>
        </div>
      ))}
    </div>
  )
}

function KV({ rows }: { rows: { k: string; v: string; title?: string; muted?: boolean }[] }) {
  return (
    <dl className="space-y-1">
      {rows.map((r) => (
        <div key={r.k} className="grid grid-cols-[92px_1fr] gap-2 text-[12px]" title={r.title}>
          <dt className="text-faint">{r.k}</dt>
          <dd className={r.muted ? 'italic text-faint' : 'text-text'}>{r.v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Fold({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-md border border-edge">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-2.5 py-1.5 text-[11.5px] text-dim hover:text-text">
        {title}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-edge p-2.5">{children}</div>}
    </div>
  )
}

function Links({ accession }: { accession: string }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
      <a href={PSI_URL(accession)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal hover:underline">
        PSI record <ExternalLink className="size-3" />
      </a>
      {DOI[accession] && (
        <a href={`https://doi.org/${DOI[accession]}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal hover:underline">
          DOI <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  )
}

/* ——— evidence (investigation / table) ——— */

const TABLE_FOR: Record<string, { ds: string; node: string; label: string }> = {
  'PSI-99': { ds: 'ds_PSI-99_saffire-2', node: RV.saffire2ds, label: 'SAFFIRE-2' },
  'PSI-98': { ds: 'ds_PSI-98_saffire-1', node: RV.saffire1ds, label: 'SAFFIRE-1' },
  'PSI-25': { ds: 'ds_PSI-25_bass-ii', node: RV.bass2ds, label: 'BASS-II' },
}

/** "Open the table in Explore" — shown while the investigation's table is not on the canvas yet. */
function ExploreTableButton({ ev, session }: { ev: Evidence; session: Session }) {
  const t = TABLE_FOR[ev.accession]
  if (!t || session.nodes.some((n) => n.id === t.node)) return null
  return (
    <button
      onClick={() => {
        const st = useAppStore.getState()
        st.setExploreFocus({ q: t.label.toLowerCase().split('-')[0], datasetId: t.ds })
        st.setView('explore')
      }}
      className="flex w-full items-center justify-center gap-1.5 rounded-md border border-bright/60 bg-bright/15 px-2.5 py-2 text-[12.5px] font-semibold text-bright transition-colors hover:bg-bright/25"
    >
      <Search className="size-3.5" /> Open {t.label} table in Explore →
    </button>
  )
}

function VsRover({ ev, session }: { ev: Evidence; session: Session }) {
  if (!ev.tested) return null
  const r = roverInputs(session)
  const pm = r.pmma?.value?.split(' · ').pop()
  const tx = r.textile?.value?.split(' · ')[1]
  const rows: { k: string; psi: string; rover: string; s: Status; why: string }[] = [
    {
      k: 'Oxygen',
      psi: ev.tested.o2,
      rover: r.o2.prov === 'unknown' ? '?' : r.o2.text,
      s: r.o2.prov === 'unknown' ? 'na' : o2Status(r.o2.text),
      why: o2Status(r.o2.text) === 'ok' ? 'Matches the rover cabin air' : 'Differs from the rover O₂ — not covered',
    },
    { k: 'Gravity', psi: 'low-g', rover: r.gravity.prov === 'unknown' ? '?' : r.gravity.text, s: 'no', why: 'No 1/6-g test' },
    {
      k: 'Air flow',
      psi: ev.tested.flow.split(' (')[0],
      rover: r.flow.prov === 'unknown' ? '?' : r.flow.text,
      s: r.flow.prov === 'unknown' ? 'na' : 'partial',
      why: 'Speeds overlap, but the 1/6-g flow field differs',
    },
    { k: 'Pressure', psi: '—', rover: r.pressure.prov === 'unknown' ? '?' : r.pressure.text, s: 'na', why: 'Not tabulated in the PSI rows' },
    { k: 'Geometry', psi: ev.tested.geometry.replace(' samples', ''), rover: [pm, tx].filter(Boolean).join(' / ') || '?', s: 'partial', why: 'Different sample size and installation' },
  ]
  return (
    <Card title="Tested vs rover" tone="gap">
      <div className="grid grid-cols-[16px_62px_1fr_1fr] items-center gap-x-2 gap-y-1.5 text-[12px]">
        <span />
        <span />
        <span className="text-[9.5px] uppercase tracking-wider text-teal">PSI</span>
        <span className="text-[9.5px] uppercase tracking-wider text-bright">Rover</span>
        {rows.map((row) => (
          <div key={row.k} className="contents" title={row.why}>
            <StatusIcon s={row.s} />
            <span className="text-faint">{row.k}</span>
            <span className="truncate text-text" title={row.psi}>
              {row.psi}
            </span>
            <span className={cn('truncate', row.rover === '?' ? 'text-faint' : 'text-text')} title={row.rover}>
              {row.rover}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 border-t border-edge pt-1.5 text-[11px] text-amber">
        {o2Status(r.o2.text) === 'ok' ? 'O₂ and airflow match — gravity does not. Use for decisions, not qualification.' : 'Analogue only — does not qualify the rover material.'}
      </p>
    </Card>
  )
}

function RowsTable({ ev }: { ev: Evidence }) {
  const [open, setOpen] = useState<string | null>(null)
  if (!ev.rows) return null
  const cell = (row: NonNullable<Evidence['rows']>[number], ...keys: string[]) => {
    for (const k of keys) {
      const c = row.cells.find(([key]) => key === k)
      if (c) return c[1]
    }
    return '—'
  }
  const odd = (v: string) => /Note|blank|See Fig|037/.test(v)
  return (
    <Card title="Sample rows" tone="measured" right={<span className="text-[10px] text-faint">click a row</span>}>
      <div className="text-[12px]">
        <div className="grid grid-cols-[34px_1fr_54px_62px_14px] gap-x-2 pb-1 text-[9.5px] uppercase tracking-wider text-faint">
          <span>#</span>
          <span>Material</span>
          <span>Burn</span>
          <span>Spread</span>
          <span />
        </div>
        {ev.rows.map((row) => {
          const mat = cell(row, 'Material')
          const burn = cell(row, 'Burn time')
          const spread = cell(row, '?-g spread length', 'Flow direction')
          const isOpen = open === row.id
          return (
            <div key={row.id} className="border-t border-edge">
              <button
                onClick={() => setOpen(isOpen ? null : row.id)}
                className="grid w-full grid-cols-[34px_1fr_54px_62px_14px] items-center gap-x-2 py-1.5 text-left hover:bg-edge/20"
              >
                <span className="font-mono text-text">{row.id}</span>
                <span className={cn('truncate', odd(mat) ? 'text-amber' : 'text-text')}>{mat.replace('Cotton-Fiberglass ', '')}</span>
                <span className="font-mono text-text">{burn}</span>
                <span className={cn('truncate font-mono', odd(spread) ? 'text-amber' : 'text-text')}>{spread}</span>
                {row.flags.length > 0 ? <AlertTriangle className="size-3 text-amber" /> : <span />}
              </button>
              {isOpen && (
                <div className="mb-2 space-y-1.5 rounded bg-panel px-2 py-1.5">
                  <KV rows={row.cells.map(([k, v]) => ({ k, v }))} />
                  {row.flags.map((f) => (
                    <p key={f} className="flex gap-1.5 text-[11px] leading-snug text-amber">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                      {f}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function EvidenceDetails({ node, ev, session }: { node: GraphNode; ev: Evidence; session: Session }) {
  const short = SHORT[ev.accession]
  const context = ev.role.startsWith('Atmosphere') || ev.role.startsWith('Separate')
  return (
    <div className="space-y-3">
      <Head title={node.data.label.replace(/ \(PSI-\d+\)$/, '')} sub={`${ev.accession} · ${ev.file.split('/').pop()}`}>
        {ev.role.startsWith('Separate') ? <Chip cls={PROVENANCE_META.context.cls}>Not material evidence</Chip> : <ProvChip p={context ? 'context' : 'measured'} />}
        <Chip>{ev.role.split(' · ')[0]}</Chip>
      </Head>
      {short && <Stats items={short.stats} />}
      {short && (
        <div className="space-y-1 text-[12px]">
          <p className="flex gap-1.5 text-text">
            <Check className="mt-0.5 size-3.5 shrink-0 text-teal" />
            {short.why}
          </p>
          <p className="flex gap-1.5 text-text">
            <X className="mt-0.5 size-3.5 shrink-0 text-flame" />
            {short.limit}
          </p>
        </div>
      )}
      <ExploreTableButton ev={ev} session={session} />
      <VsRover ev={ev} session={session} />
      <RowsTable ev={ev} />
      <Fold title="Details & source">
        <div className="space-y-2 text-[11.5px] leading-relaxed text-dim">
          <p>{ev.useful}</p>
          <p>{ev.boundary}</p>
          {ev.notes && ev.notes.map((n) => <p key={n} className="text-faint">{n}</p>)}
          <p className="break-all font-mono text-[10px] text-faint">{ev.file}</p>
          <Links accession={ev.accession} />
        </div>
      </Fold>
    </div>
  )
}

/* ——— engineer inputs, materials, documents, gap ——— */

function MaterialDetails({ node, session }: { node: GraphNode; session: Session }) {
  const updateNode = useAppStore((s) => s.updateNode)
  const setSelected = useAppStore((s) => s.setSelectedNode)
  const isPmma = node.id === RV.pmma
  const match = node.data.match ?? 'unassessed'
  const setMatch = (m: 'same-family' | 'analogue') =>
    updateNode(session.id, node.id, {
      data: { ...node.data, match: m, badge: m === 'same-family' ? 'same family · verify formulation' : 'analogue only' },
    })
  const rows = isPmma
    ? [
        { id: RV.saffire2ds, alt: RV.saffire2, label: 'Saffire-II 2-8, 2-9' },
        { id: RV.bass2ds, alt: RV.bass2, label: 'BASS-II PMMA' },
      ]
    : [
        { id: RV.saffire2ds, alt: RV.saffire2, label: 'Saffire-II 2-5' },
        { id: RV.saffire1ds, alt: RV.saffire1, label: 'Saffire-I S1, S2' },
      ]
  const fields = node.data.fields ?? []
  return (
    <div className="space-y-3">
      <Head title={node.data.label.replace(/^Rover /, '')} sub={isPmma ? 'BOM line 14' : 'BOM line 22'}>
        <ProvChip p={node.data.provenance} />
        <Chip cls="border-amber/40 text-amber">Rover material</Chip>
      </Head>
      {fields.length > 0 ? (
        <Card title="From BOM" tone="engineer">
          <KV
            rows={fields.slice(1).map((f) => ({
              k: f.label.replace('PMMA ', '').replace('Textile specification / installation', 'Spec').replace('Layers / adhesives / coatings', 'Layers'),
              v: f.value || 'not stated',
              title: f.source,
              muted: !f.value,
            }))}
          />
        </Card>
      ) : (
        <p className="text-[12px] italic text-faint">Upload the cabin materials BOM to fill grade, thickness and layers.</p>
      )}
      <Card title="Closest PSI rows" tone="measured">
        <div className="flex flex-wrap gap-1.5">
          {rows.map((r) => {
            const target = session.nodes.some((n) => n.id === r.id) ? r.id : session.nodes.some((n) => n.id === r.alt) ? r.alt : null
            return (
              <button
                key={r.label}
                disabled={!target}
                onClick={() => target && setSelected(target)}
                className="rounded-md border border-teal/40 bg-teal/10 px-2 py-1 text-[11.5px] text-teal enabled:hover:bg-teal/20 disabled:border-edge disabled:bg-transparent disabled:text-faint"
              >
                {r.label}
              </button>
            )
          })}
        </div>
      </Card>
      <Card title="Your judgement" tone="engineer">
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ['same-family', 'Same family', 'verify formulation'],
              ['analogue', 'Analogue only', 'blend / coating differs'],
            ] as const
          ).map(([k, t, sub]) => (
            <button
              key={k}
              onClick={() => setMatch(k)}
              className={cn(
                'rounded-md border px-2 py-1.5 text-left transition-colors',
                match === k ? 'border-bright bg-bright/15' : 'border-edge hover:border-edge2',
              )}
            >
              <span className={cn('block text-[12px] font-semibold', match === k ? 'text-bright' : 'text-text')}>{t}</span>
              <span className="block text-[10.5px] text-faint">{sub}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}

function MissionDetails({ node, session, onOpenAddData }: { node: GraphNode; session: Session; onOpenAddData: () => void }) {
  const r = roverInputs(session)
  const coverage: Record<string, [Status, string]> = {
    [RV.g]: ['no', 'No 1/6-g combustion test in the PSI data'],
    [RV.o2]: o2Status(r.o2.text) === 'ok' ? ['ok', 'Saffire rows at ~22 % O₂ — matches cabin air'] : ['no', 'Solid-material tests stop at ~22 % O₂'],
    [RV.p]: ['na', 'Not tabulated in the Saffire rows'],
    [RV.flow]: ['partial', 'Saffire rows at 20 cm/s — flow field differs in 1/6 g'],
  }
  if (node.id === RV.mission) {
    return (
      <div className="space-y-3">
        <Head title="Mission environment" sub="Rover Cabin Design Basis.pdf">
          <ProvChip p="engineer" />
        </Head>
        <Stats
          items={[
            ['Gravity', r.gravity.prov === 'unknown' ? '?' : r.gravity.text],
            ['O₂', r.o2.prov === 'unknown' ? '?' : r.o2.text],
            ['Pressure', r.pressure.prov === 'unknown' ? '?' : r.pressure.text],
          ]}
        />
        <Stats items={[['Airflow', r.flow.prov === 'unknown' ? '?' : r.flow.text]]} />
        <p className="text-[11px] text-faint">Inputs from the design basis — not experimental results.</p>
      </div>
    )
  }
  const cov = coverage[node.id]
  const [name, value] = node.data.label.split(': ')
  return (
    <div className="space-y-3">
      <Head title={name} sub={node.data.hint.split('.')[0]}>
        <ProvChip p={node.data.provenance} />
      </Head>
      <div className="rounded-md border border-bright/30 bg-bright/5 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-faint">Rover input</p>
        <p className="text-[22px] font-semibold leading-tight text-text">{node.data.value || value || '?'}</p>
        {node.data.badge && <p className="text-[11px] text-dim">{node.data.badge}</p>}
      </div>
      {cov && (
        <Card title="PSI coverage" tone="gap">
          <p className="flex gap-1.5 text-[12px] text-text">
            <StatusIcon s={cov[0]} />
            {cov[1]}
          </p>
        </Card>
      )}
      {node.data.provenance === 'unknown' && (
        <Button variant="outline" size="sm" className="w-full" onClick={onOpenAddData}>
          Upload design basis
        </Button>
      )}
    </div>
  )
}

function DocDetails({ node }: { node: GraphNode }) {
  const fields = node.data.fields ?? []
  return (
    <div className="space-y-3">
      <Head title={node.data.label} sub={node.id === RV.docBasis ? 'PLR-DB-001 · Rev B' : 'PLR-BOM-001 · Rev B'}>
        <ProvChip p="engineer" />
        <Chip cls="border-amber/40 text-amber">Engineer-provided document</Chip>
      </Head>
      <Card title="Extracted values" tone="engineer">
        <KV rows={fields.map((f) => ({ k: f.label.replace('Airflow ', '').replace('near materials', '').trim(), v: f.value || 'not stated', title: f.source, muted: !f.value }))} />
      </Card>
      <p className="text-[11px] text-faint">Hover a value to see its section and page.</p>
    </div>
  )
}

function GapDetails({ node }: { node: GraphNode }) {
  return (
    <div className="space-y-3">
      <Head title="Uncovered condition">
        <Chip cls="border-flame/40 text-flame">Open issue — not a predicted failure</Chip>
      </Head>
      <Stats items={[['O₂', '30 %'], ['Gravity', '1/6 g'], ['PSI tests', '0']]} />
      <p className="text-[12px] text-dim">{node.data.hint}</p>
      <Card title="Next actions" tone="agent">
        <ol className="list-decimal space-y-1 pl-4 text-[12px] text-text">
          {NEXT_SHORT.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

function ConclusionDetails({ node, session }: { node: GraphNode; session: Session }) {
  const setSelected = useAppStore((s) => s.setSelectedNode)
  const c = CONCLUSIONS.find((x) => x.id === node.id)
  if (!c) return null
  return (
    <div className="space-y-3">
      <Head title={c.title} sub={`Conclusion ${c.short}`}>
        <ProvChip p="agent" />
        <Chip cls="border-teal/40 text-teal">{c.confidence.split(' — ')[0]}</Chip>
      </Head>
      <Card title="Measured in PSI" tone="measured">
        {c.data.map((d) => {
          const target = session.nodes.some((n) => n.id === d.node) ? d.node : d.alt && session.nodes.some((n) => n.id === d.alt) ? d.alt : null
          return (
            <button key={d.text} disabled={!target} onClick={() => target && setSelected(target)} className="text-left text-[12px] text-text enabled:hover:text-teal">
              {d.text}
            </button>
          )
        })}
      </Card>
      <Card title="Rover" tone="engineer">
        <p className="text-[12px] text-text">{c.rover}</p>
      </Card>
      <Card title="Decision" tone="agent">
        <p className="text-[13px] font-semibold leading-snug text-text">{c.decision}</p>
      </Card>
      <p className="text-[11px] text-faint">{c.confidence}. Agent interpretation — the engineer decides.</p>
    </div>
  )
}

export function ScenarioNodeDetails({ node, session, onOpenAddData }: { node: GraphNode; session: Session; onOpenAddData: () => void }) {
  const ev = EVIDENCE[node.data.ref]
  if (ev) return <EvidenceDetails node={node} ev={ev} session={session} />
  if (node.type === 'gap') return <GapDetails node={node} />
  if (node.type === 'conclusion') return <ConclusionDetails node={node} session={session} />
  if (node.type === 'missionParam') return <MissionDetails node={node} session={session} onOpenAddData={onOpenAddData} />
  if (node.type === 'material') return <MaterialDetails node={node} session={session} />
  if (node.type === 'externalSource') return <DocDetails node={node} />
  return null
}

/* ——— branch summary ——— */

const MEASURED_LINE: Record<string, [string, string]> = {
  'PSI-99': ['Saffire-II', 'PMMA & SIBAL · ~22 % O₂ · 20 cm/s'],
  'PSI-98': ['Saffire-I', 'SIBAL · ~21.5 % O₂ · 20 cm/s'],
  'PSI-25': ['BASS-II', 'PMMA · 13.6–22.2 % O₂'],
  'PSI-26': ['BASS', 'sample index · no numeric results'],
  'PSI-20': ['ACME BRE', 'gas flames · 21–40 % O₂'],
  'PSI-159': ['CFI-G', 'gas flames · up to 85 % O₂'],
}

export function BranchSummary({ session, branch }: { session: Session; branch: Branch }) {
  const addMessage = useAppStore((s) => s.addMessage)
  const addWorkingItems = useAppStore((s) => s.addWorkingItems)
  const setView = useAppStore((s) => s.setView)
  const setVizPreset = useAppStore((s) => s.setVizPreset)
  const setHighlight = useAppStore((s) => s.setHighlight)
  const thinking = useAppStore((s) => s.agentThinking)
  const setThinking = useAppStore((s) => s.setAgentThinking)
  const members = branch.nodeIds.map((id) => session.nodes.find((n) => n.id === id)).filter((n): n is GraphNode => Boolean(n))
  const accessions = [...new Set(members.map((n) => EVIDENCE[n.data.ref]?.accession).filter((a): a is string => Boolean(a)))]
  if (accessions.includes('PSI-25') && !accessions.includes('PSI-26')) accessions.push('PSI-26')
  const r = roverInputs(session)
  const actionsProposed = session.nodes.some((n) => n.id === RV.gap)

  const toWorkingSet = () =>
    addWorkingItems([
      { id: 'ws_ds_PSI-99_saffire-2', type: 'dataset', ref: 'ds_PSI-99_saffire-2', label: 'SAFFIRE-2 table (PSI-99)', sub: 'rows 2-5, 2-8, 2-9 · ~22 % O₂ · 20 cm/s', tags: ['dataset', 'solid material'] },
      { id: 'ws_ds_PSI-98_saffire-1', type: 'dataset', ref: 'ds_PSI-98_saffire-1', label: 'SAFFIRE-1 table (PSI-98)', sub: 'rows S1, S2 · SIBAL', tags: ['dataset', 'solid material'] },
      { id: 'ws_ds_PSI-25_bass-ii', type: 'dataset', ref: 'ds_PSI-25_bass-ii', label: 'BASS-II table (PSI-25)', sub: '129 rows · O₂ 13.6–22.2 %', tags: ['dataset', 'screening'] },
      { id: 'ws_ds_PSI-20_acme_bre', type: 'dataset', ref: 'ds_PSI-20_acme_bre', label: 'ACME BRE summary (PSI-20)', sub: 'gas burner · O₂ 21–40 %', tags: ['dataset', 'context'] },
    ])

  const propose = () => {
    if (thinking) return
    addMessage(session.id, { id: `m_${Date.now().toString(36)}_u`, role: 'user', text: 'Propose the next engineering actions to close the gap.', at: Date.now() })
    setThinking(true)
    setTimeout(() => {
      const reply = nextActionsReply(session.id)
      reply.apply?.()
      const id = `m_${Date.now().toString(36)}_a`
      useAppStore.getState().setStreamingMsgId(id)
      addMessage(session.id, { id, role: 'agent', text: reply.text, at: Date.now(), chips: reply.chips, hrefs: reply.hrefs, links: reply.links })
      setHighlight([RV.gap], 2200)
      setThinking(false)
    }, 2000)
  }

  const inputs: [string, { text: string; prov: string }][] = [
    ['Gravity', r.gravity],
    ['O₂', r.o2],
    ['Pressure', r.pressure],
    ['Airflow', r.flow],
  ]

  return (
    <div className="space-y-3 p-3">
      <Head title={branch.name} sub={`${members.length} nodes`} />

      <Card title="Measured in PSI" tone="measured" right={<span className="text-[10px] text-faint">{accessions.length}</span>}>
        <ul className="space-y-1.5">
          {accessions.map((a) => (
            <li key={a} className="text-[12px]">
              <span className="font-semibold text-text">{MEASURED_LINE[a]?.[0] ?? a}</span>
              <span className="text-dim"> — {MEASURED_LINE[a]?.[1] ?? ''}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Rover inputs" tone="engineer">
        <div className="grid grid-cols-2 gap-1.5">
          {inputs.map(([k, v]) => (
            <div key={k} className="rounded border border-edge bg-panel px-2 py-1">
              <p className="text-[9.5px] uppercase tracking-wider text-faint">{k}</p>
              <p className={cn('truncate text-[13px] font-semibold', v.prov === 'unknown' ? 'text-faint' : 'text-text')}>{v.prov === 'unknown' ? '?' : v.text}</p>
            </div>
          ))}
        </div>
      </Card>

      {session.nodes.some((n) => n.type === 'conclusion') && (
        <Card title="Conclusions" tone="agent" right={<span className="text-[10px] text-faint">{CONCLUSIONS.length}</span>}>
          <ul className="space-y-1.5">
            {CONCLUSIONS.map((c) => (
              <li key={c.id} className="text-[12px]">
                <span className="font-semibold text-text">
                  {c.short} · {c.title}
                </span>
                <span className="block text-dim">→ {c.decisionShort}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Gaps" tone="gap" right={<span className="text-[10px] text-faint">{GAPS_SHORT.length}</span>}>
        <ul className="space-y-1">
          {GAPS_SHORT.map((g) => (
            <li key={g} className="flex gap-1.5 text-[12px] text-text">
              <X className="mt-0.5 size-3.5 shrink-0 text-flame" />
              {g}
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t border-edge pt-1.5 text-[10.5px] text-faint">No risk % — there is no calibrated rover-risk model.</p>
      </Card>

      {actionsProposed && (
        <Card title="Next actions" tone="agent">
          <ol className="list-decimal space-y-1 pl-4 text-[12px] text-text">
            {NEXT_SHORT.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ol>
        </Card>
      )}

      <div className="space-y-1.5 pt-1">
        {!actionsProposed && (
          <Button size="sm" className="w-full" disabled={thinking} onClick={propose}>
            <ListChecks /> Propose next actions
          </Button>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          <Button variant="outline" size="sm" onClick={toWorkingSet}>
            <Database /> Working set
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toWorkingSet()
              setVizPreset('rover')
              setView('visualize')
            }}
          >
            <BarChart3 /> Charts
          </Button>
        </div>
      </div>
    </div>
  )
}
