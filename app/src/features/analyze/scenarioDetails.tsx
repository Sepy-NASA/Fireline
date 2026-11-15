import { AlertTriangle, BarChart3, Database, ExternalLink, FileText, ListChecks, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAppStore } from '../../store/appStore'
import type { Branch, GraphNode, Session } from '../../types'
import { Button } from '../../components/ui/button'
import { cn } from '../../lib/utils'
import { PROVENANCE_META } from './nodeSystem'
import {
  DOI,
  EVIDENCE,
  NEXT_ACTIONS,
  PSI_URL,
  RV,
  nextActionsReply,
  roverInputs,
  type Evidence,
} from './roverScenario'

/* ————————————————————————————————————————————
   Right-panel details for the rover scenario:
   evidence rows, tested-vs-rover comparison,
   engineer inputs, mock documents, branch summary.
   Measured data, engineer inputs, agent
   interpretation and unknowns stay distinct.
   ———————————————————————————————————————————— */

export function hasScenarioDetails(node: GraphNode): boolean {
  return Boolean(EVIDENCE[node.data.ref]) || node.id.startsWith('rv_') || node.type === 'missionParam' || node.type === 'gap'
}

function ProvChip({ p }: { p?: string }) {
  if (!p) return null
  const m = PROVENANCE_META[p]
  if (!m) return null
  return <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium', m.cls)}>{m.label}</span>
}

function Section({ title, icon, children, tone }: { title: string; icon?: ReactNode; children: ReactNode; tone?: 'measured' | 'engineer' | 'gap' | 'agent' }) {
  const toneCls =
    tone === 'measured'
      ? 'border-l-teal'
      : tone === 'engineer'
        ? 'border-l-bright'
        : tone === 'gap'
          ? 'border-l-flame'
          : tone === 'agent'
            ? 'border-l-violet'
            : 'border-l-edge2'
  return (
    <section className={cn('border-l-2 pl-2.5', toneCls)}>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-dim">
        {icon}
        {title}
      </p>
      {children}
    </section>
  )
}

function SourceLinks({ ev }: { ev: Evidence }) {
  return (
    <div className="space-y-1">
      <p className="break-all font-mono text-[10.5px] text-dim">{ev.file}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <a href={PSI_URL(ev.accession)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-teal hover:underline">
          PSI record {ev.accession} <ExternalLink className="size-3" />
        </a>
        {DOI[ev.accession] && (
          <a href={`https://doi.org/${DOI[ev.accession]}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-teal hover:underline">
            DOI {DOI[ev.accession]} <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  )
}

/* ——— tested vs rover comparison ——— */

function Comparison({ ev, session }: { ev: Evidence; session: Session }) {
  if (!ev.tested) return null
  const r = roverInputs(session)
  const rows: { k: string; tested: string; rover: string; prov: string; verdict: string; bad?: boolean }[] = [
    { k: 'Oxygen', tested: ev.tested.o2, rover: r.o2.text, prov: r.o2.prov, verdict: 'Not covered — below 30 % target', bad: true },
    { k: 'Gravity', tested: ev.tested.gravity, rover: r.gravity.text, prov: r.gravity.prov, verdict: 'Not covered — no 1/6-g test', bad: true },
    {
      k: 'Air flow',
      tested: ev.tested.flow,
      rover: r.flow.text,
      prov: r.flow.prov,
      verdict: r.flow.prov === 'unknown' ? 'Cannot compare — rover value unknown' : 'Speeds overlap — but the 1/6-g buoyant + forced flow field ≠ PSI low-g setup',
      bad: r.flow.prov === 'unknown',
    },
    {
      k: 'Pressure',
      tested: ev.tested.pressure,
      rover: r.pressure.text,
      prov: r.pressure.prov,
      verdict: 'Cannot compare — not tabulated in PSI row',
      bad: true,
    },
    {
      k: 'Geometry',
      tested: ev.tested.geometry,
      rover: [r.pmma?.value && `PMMA ${r.pmma.value.split(' · ').pop()}`, r.textile?.value && `textile ${r.textile.value.split(' · ')[1] ?? r.textile.value}`].filter(Boolean).join(' · ') || 'Installed geometry from BOM',
      prov: r.pmma?.value || r.textile?.value ? 'engineer' : 'unknown',
      verdict: 'Different sample size and installation (coatings, backings) — compare per row',
    },
  ]
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-amber/40 bg-amber/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-amber">
        {ev.tested.o2} O₂ · {ev.tested.flow.split(' ')[0]} {ev.tested.flow.split(' ')[1]} · not 1/6 g or 30 % O₂
      </div>
      <div className="overflow-hidden rounded-md border border-edge">
        <div className="grid grid-cols-[64px_1fr_1fr] bg-panel2 px-2 py-1 text-[9.5px] font-semibold uppercase tracking-wide text-faint">
          <span />
          <span className="text-teal">PSI tested</span>
          <span className="text-bright">Rover input</span>
        </div>
        {rows.map((row) => (
          <div key={row.k} className="grid grid-cols-[64px_1fr_1fr] gap-x-2 border-t border-edge px-2 py-1.5 text-[11px]">
            <span className="font-semibold text-dim">{row.k}</span>
            <span className="text-text">{row.tested}</span>
            <span className={row.prov === 'unknown' ? 'italic text-faint' : 'text-text'}>
              {row.rover}
              {row.prov === 'provisional' && <span className="ml-1 text-[9px] text-amber">(provisional)</span>}
            </span>
            <span className={cn('col-span-3 mt-0.5 text-[10px]', row.bad ? 'text-flame' : 'text-faint')}>→ {row.verdict}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Rows({ ev }: { ev: Evidence }) {
  if (!ev.rows) return null
  return (
    <div className="space-y-2">
      {ev.rows.map((row) => (
        <div key={row.id} className="rounded-md border border-edge bg-panel2 p-2">
          <p className="mb-1 flex items-center justify-between text-[12px] font-semibold text-text">
            Sample {row.id}
            <span className="font-mono text-[9.5px] font-normal text-teal">original table values</span>
          </p>
          <dl className="grid grid-cols-[96px_1fr] gap-x-2 gap-y-0.5 text-[11px]">
            {row.cells.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-faint">{k}</dt>
                <dd className={cn('font-mono text-text', /Note|blank|See Fig|037/.test(v) && 'text-amber')}>{v}</dd>
              </div>
            ))}
          </dl>
          {row.flags.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {row.flags.map((f) => (
                <li key={f} className="flex gap-1.5 text-[10.5px] leading-snug text-amber">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {ev.notes && (
        <ul className="space-y-0.5 text-[10.5px] leading-snug text-faint">
          {ev.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EvidenceDetails({ node, ev, session }: { node: GraphNode; ev: Evidence; session: Session }) {
  const context = ev.role.startsWith('Atmosphere') || ev.role.startsWith('Separate')
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-semibold text-text">{node.data.label}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {ev.role.startsWith('Separate') ? (
            <span className="inline-block rounded border border-[#a78bfa]/50 bg-[#a78bfa]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#c4b5fd]">
              Not material evidence
            </span>
          ) : (
            <ProvChip p={context ? 'context' : 'measured'} />
          )}
          <span className="rounded border border-edge px-1.5 py-0.5 text-[10px] text-dim">{ev.role}</span>
        </div>
      </div>
      <Section title="Source" icon={<FileText className="size-3" />}>
        <SourceLinks ev={ev} />
        {ev.accession === 'PSI-99' && (
          <p className="mt-1 text-[10.5px] text-faint">Final report: retrieve via the PSI record — not ingested in this bundle.</p>
        )}
      </Section>
      {ev.tested && (
        <Section title="Tested vs rover" tone="gap" icon={<ShieldAlert className="size-3" />}>
          <Comparison ev={ev} session={session} />
        </Section>
      )}
      {ev.rows && (
        <Section title="Table evidence" tone="measured" icon={<Database className="size-3" />}>
          <Rows ev={ev} />
        </Section>
      )}
      <Section title="Useful for this review" tone="measured">
        <p className="text-[12px] leading-relaxed text-text">{ev.useful}</p>
      </Section>
      <Section title="Important boundary" tone="gap">
        <p className="text-[12px] leading-relaxed text-text">{ev.boundary}</p>
      </Section>
    </div>
  )
}

/* ——— engineer inputs, materials, docs, gap ——— */

function FieldsTable({ fields }: { fields: NonNullable<GraphNode['data']['fields']> }) {
  return (
    <div className="space-y-1">
      {fields.map((f) => (
        <div key={f.label} className="rounded border border-edge bg-panel2 px-2 py-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-dim">{f.label}</span>
            <ProvChip p={f.status === 'confirmed' ? 'engineer' : f.status} />
          </div>
          <p className={cn('text-[12px]', f.value ? 'text-text' : 'italic text-faint')}>{f.value || 'unknown'}</p>
          <p className="font-mono text-[9.5px] text-faint">{f.source}</p>
        </div>
      ))}
    </div>
  )
}

function MaterialDetails({ node, session }: { node: GraphNode; session: Session }) {
  const updateNode = useAppStore((s) => s.updateNode)
  const setSelected = useAppStore((s) => s.setSelectedNode)
  const isPmma = node.id === RV.pmma
  const match = node.data.match ?? 'unassessed'
  const setMatch = (m: 'same-family' | 'analogue') =>
    updateNode(session.id, node.id, {
      data: {
        ...node.data,
        match: m,
        badge: m === 'same-family' ? 'same material family · formulation/geometry to verify' : 'analogue only',
      },
    })
  const rows = isPmma
    ? [
        { id: RV.saffire2ds, label: 'Saffire-II rows 2-8, 2-9 (PMMA)' },
        { id: RV.bass2, label: 'BASS-II PMMA films / rods' },
        { id: RV.bass, label: 'BASS sample index' },
      ]
    : [
        { id: RV.saffire2ds, label: 'Saffire-II row 2-5 (SIBAL)' },
        { id: RV.saffire1ds, label: 'Saffire-I rows S1, S2 (SIBAL)' },
      ]
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-semibold text-text">{node.data.label}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          <ProvChip p={node.data.provenance} />
          <span className="rounded border border-amber/40 px-1.5 py-0.5 text-[10px] text-amber">Rover material (BOM)</span>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-dim">{node.data.hint}</p>
      </div>
      {node.data.fields && (
        <Section title="From Cabin Materials BOM.pdf (PLR-BOM-001)" tone="engineer">
          <FieldsTable fields={node.data.fields} />
        </Section>
      )}
      <Section title="Closest PSI rows" tone="measured">
        <ul className="space-y-1">
          {rows.map((r) => {
            const on = session.nodes.some((n) => n.id === r.id)
            return (
              <li key={r.label}>
                <button
                  disabled={!on}
                  onClick={() => setSelected(r.id)}
                  className="text-left text-[12px] text-teal enabled:hover:underline disabled:text-faint"
                >
                  {r.label} {on ? '→' : '(not on canvas yet)'}
                </button>
              </li>
            )
          })}
        </ul>
      </Section>
      <Section title="Engineer judgement: relation to tested rows" tone="engineer">
        <div className="grid gap-1.5">
          <button
            onClick={() => setMatch('same-family')}
            className={cn(
              'rounded-md border px-2 py-1.5 text-left text-[11.5px] transition-colors',
              match === 'same-family' ? 'border-bright bg-bright/15 text-bright' : 'border-edge text-dim hover:text-text',
            )}
          >
            Same material family — formulation / geometry still to verify
          </button>
          <button
            onClick={() => setMatch('analogue')}
            className={cn(
              'rounded-md border px-2 py-1.5 text-left text-[11.5px] transition-colors',
              match === 'analogue' ? 'border-bright bg-bright/15 text-bright' : 'border-edge text-dim hover:text-text',
            )}
          >
            Analogue only — different blend, coating or laminate
          </button>
        </div>
        <p className="mt-1.5 text-[10.5px] text-faint">
          A row labelled “{isPmma ? 'PMMA' : 'SIBAL'}” does not prove identity with the rover’s exact grade, coating, laminate or installation.
        </p>
      </Section>
    </div>
  )
}

function MissionDetails({ node, session, onOpenAddData }: { node: GraphNode; session: Session; onOpenAddData: () => void }) {
  const r = roverInputs(session)
  const coverage: Record<string, string> = {
    [RV.g]: 'PSI coverage in this bundle: none — no partial-gravity (1/6 g) combustion dataset.',
    [RV.o2]: 'PSI solid-material coverage: ~21.5–22.1 % (Saffire-II). Higher O₂ only in gas-flame studies (ACME BRE, CFI-G).',
    [RV.p]: 'Saffire tables do not tabulate pressure — comparison stays open.',
    [RV.flow]: 'Saffire rows: 20 cm/s. Rover 1/6-g flow field is not equivalent to the PSI microgravity setup.',
  }
  const unknown = node.data.provenance === 'unknown'
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-semibold text-text">{node.data.label}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          <ProvChip p={node.data.provenance} />
          <span className="rounded border border-edge px-1.5 py-0.5 text-[10px] text-dim">Mission input — not an experimental result</span>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-dim">{node.data.hint}</p>
      </div>
      {node.id === RV.mission ? (
        <Section title="Rover inputs" tone="engineer">
          <dl className="grid grid-cols-[70px_1fr_auto] items-center gap-x-2 gap-y-1 text-[11.5px]">
            {(
              [
                ['Gravity', r.gravity],
                ['Oxygen', r.o2],
                ['Pressure', r.pressure],
                ['Airflow', r.flow],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-faint">{k}</dt>
                <dd className={v.prov === 'unknown' ? 'italic text-faint' : 'text-text'}>{v.text}</dd>
                <dd>
                  <ProvChip p={v.prov} />
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : (
        coverage[node.id] && (
          <Section title="PSI coverage" tone="gap">
            <p className="text-[12px] leading-relaxed text-text">{coverage[node.id]}</p>
          </Section>
        )
      )}
      {(unknown || node.data.provenance === 'provisional') && (
        <Button variant="outline" size="sm" className="w-full" onClick={onOpenAddData}>
          <FileText /> Confirm from design basis
        </Button>
      )}
    </div>
  )
}

function DocDetails({ node }: { node: GraphNode }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-semibold text-text">{node.data.label}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          <ProvChip p="engineer" />
          <span className="rounded border border-amber/40 px-1.5 py-0.5 text-[10px] text-amber">Engineer-provided document (demo upload)</span>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
          Uploaded demo PDF (fictional). Field extraction simulated; values confirmed by the engineer before use. Not a NASA source document.
        </p>
      </div>
      {node.data.fields && (
        <Section title="Extracted fields" tone="engineer">
          <FieldsTable fields={node.data.fields} />
        </Section>
      )}
    </div>
  )
}

function GapDetails({ node }: { node: GraphNode }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-semibold text-text">{node.data.label}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          <ProvChip p="agent" />
          <span className="rounded border border-flame/40 px-1.5 py-0.5 text-[10px] text-flame">Open issue — not a predicted failure</span>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-dim">{node.data.hint}</p>
      </div>
      <Section title="Next engineering actions" tone="agent" icon={<ListChecks className="size-3" />}>
        <ol className="list-decimal space-y-1 pl-4 text-[11.5px] leading-snug text-text">
          {NEXT_ACTIONS.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
      </Section>
    </div>
  )
}

export function ScenarioNodeDetails({ node, session, onOpenAddData }: { node: GraphNode; session: Session; onOpenAddData: () => void }) {
  const ev = EVIDENCE[node.data.ref]
  if (ev) return <EvidenceDetails node={node} ev={ev} session={session} />
  if (node.type === 'gap') return <GapDetails node={node} />
  if (node.type === 'missionParam') return <MissionDetails node={node} session={session} onOpenAddData={onOpenAddData} />
  if (node.type === 'material') return <MaterialDetails node={node} session={session} />
  if (node.type === 'externalSource') return <DocDetails node={node} />
  return null
}

/* ——— branch summary ——— */

const GAPS = [
  'No partial-gravity combustion dataset for 1/6 g is present in this PSI bundle.',
  'Saffire-II material tests are near 21.5–22.1 % O₂, below the 30 % target.',
  'Test geometry, material formulation, airflow, pressure and ignition conditions must be compared before treating rows as relevant analogues.',
  'A gas-flame experiment cannot be used as a solid-polymer flammability threshold.',
  'A row labelled “PMMA” does not prove identity with the rover’s exact grade, coating, laminate or installation.',
]

export function BranchSummary({ session, branch }: { session: Session; branch: Branch }) {
  const addMessage = useAppStore((s) => s.addMessage)
  const addWorkingItems = useAppStore((s) => s.addWorkingItems)
  const setView = useAppStore((s) => s.setView)
  const setVizPreset = useAppStore((s) => s.setVizPreset)
  const setHighlight = useAppStore((s) => s.setHighlight)
  const thinking = useAppStore((s) => s.agentThinking)
  const setThinking = useAppStore((s) => s.setAgentThinking)
  const members = branch.nodeIds.map((id) => session.nodes.find((n) => n.id === id)).filter((n): n is GraphNode => Boolean(n))
  const seen = new Set<string>()
  const measured = members
    .map((n) => EVIDENCE[n.data.ref])
    .filter((e): e is Evidence => Boolean(e) && !seen.has(e!.accession) && Boolean(seen.add(e!.accession)))
  if (measured.some((m) => m.accession === 'PSI-25') && !measured.some((m) => m.accession === 'PSI-26')) {
    measured.push(EVIDENCE['PSI-26'])
  }
  const r = roverInputs(session)
  const actionsProposed = session.nodes.some((n) => n.id === RV.gap)

  const toWorkingSet = () => {
    const items = [
      { id: 'ws_ds_PSI-99_saffire-2', type: 'dataset' as const, ref: 'ds_PSI-99_saffire-2', label: 'SAFFIRE-2 table (PSI-99)', sub: 'rows 2-5, 2-8, 2-9 · ~22 % O₂ · 20 cm/s', tags: ['dataset', 'solid material'] },
      { id: 'ws_ds_PSI-98_saffire-1', type: 'dataset' as const, ref: 'ds_PSI-98_saffire-1', label: 'SAFFIRE-1 table (PSI-98)', sub: 'rows S1, S2 · SIBAL', tags: ['dataset', 'solid material'] },
      { id: 'ws_ds_PSI-25_bass-ii', type: 'dataset' as const, ref: 'ds_PSI-25_bass-ii', label: 'BASS-II table (PSI-25)', sub: '129 rows · O₂ 13.6–22.2 %', tags: ['dataset', 'screening'] },
      { id: 'ws_ds_PSI-20_acme_bre', type: 'dataset' as const, ref: 'ds_PSI-20_acme_bre', label: 'ACME BRE summary (PSI-20)', sub: 'gas burner · O₂ 21–40 % · different fuel', tags: ['dataset', 'context'] },
      { id: 'ws_ref_PSI-99_report', type: 'investigation' as const, ref: 'PSI-99', label: 'Saffire-II report reference', sub: 'PMMA spread notes · "?-g" headers to verify', tags: ['report'] },
    ]
    addWorkingItems(items)
    return items
  }

  return (
    <div className="space-y-4 p-3">
      <div>
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-text">
          <span className="size-2 rounded-full" style={{ background: branch.color }} />
          {branch.name}
        </p>
        <p className="mt-0.5 text-[11px] text-faint">{members.length} nodes · branch summary</p>
      </div>

      <Section title="Measured in PSI" tone="measured">
        <ul className="space-y-1.5 text-[11.5px] leading-snug text-text">
          {measured.map((m) => (
            <li key={m.accession}>
              {m.measured}
              <span className="block font-mono text-[9.5px] text-faint">{m.file.replace('experimental-tables/', '')}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Mission inputs (from engineer documents)" tone="engineer">
        <ul className="space-y-1 text-[11.5px] text-text">
          <li>Rover gravity: {r.gravity.text} — design basis PLR-DB-001 §2.</li>
          <li>Oxygen target: {r.o2.text} — design basis §3.2.</li>
          <li className={r.pressure.prov === 'unknown' ? 'italic text-faint' : ''}>
            Pressure: {r.pressure.text} {r.pressure.prov === 'provisional' && <span className="text-amber">(provisional — task-brief comparison point)</span>}
          </li>
          <li className={r.flow.prov === 'unknown' ? 'italic text-faint' : ''}>Airflow: {r.flow.text}</li>
          {r.pmma?.match && r.pmma.match !== 'unassessed' && (
            <li>Rover PMMA: {r.pmma.match === 'same-family' ? 'same material family — formulation/geometry to verify' : 'analogue only'}</li>
          )}
        </ul>
      </Section>

      <Section title="Transfer limitations / evidence gaps" tone="gap" icon={<AlertTriangle className="size-3" />}>
        <ul className="list-disc space-y-1 pl-4 text-[11.5px] leading-snug text-text">
          {GAPS.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
        <p className="mt-2 rounded border border-edge bg-panel2 px-2 py-1.5 text-[10.5px] leading-snug text-dim">
          No fire probability or “risk match” percentage is shown: the supplied files contain no calibrated rover-risk model.
        </p>
      </Section>

      {actionsProposed && (
        <Section title="Next engineering actions (agent proposal)" tone="agent" icon={<ListChecks className="size-3" />}>
          <ol className="list-decimal space-y-1 pl-4 text-[11.5px] leading-snug text-text">
            {NEXT_ACTIONS.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ol>
        </Section>
      )}

      <div className="space-y-2 border-t border-edge pt-3">
        {!actionsProposed && (
          <Button
            size="sm"
            className="w-full"
            disabled={thinking}
            onClick={() => {
              if (thinking) return
              addMessage(session.id, { id: `m_${Date.now().toString(36)}_u`, role: 'user', text: 'Propose the next engineering actions to close the gap.', at: Date.now() })
              setThinking(true)
              setTimeout(() => {
                const reply = nextActionsReply(session.id)
                reply.apply?.()
                const id = `m_${Date.now().toString(36)}_a`
                useAppStore.getState().setStreamingMsgId(id)
                addMessage(session.id, {
                  id,
                  role: 'agent',
                  text: reply.text,
                  at: Date.now(),
                  chips: reply.chips,
                  hrefs: reply.hrefs,
                  links: reply.links,
                })
                setHighlight([RV.gap], 2200)
                setThinking(false)
              }, 2000)
            }}
          >
            <ListChecks /> Propose next actions
          </Button>
        )}
        <Button variant="outline" size="sm" className="w-full" onClick={() => toWorkingSet()}>
          <Database /> Save evidence to working set
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            toWorkingSet()
            setVizPreset('rover')
            setView('visualize')
          }}
        >
          <BarChart3 /> Condition-coverage plot
        </Button>
      </div>
    </div>
  )
}
