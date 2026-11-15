import { useAppStore } from '../../store/appStore'
import type { ChatMessage, GraphNode, GraphNodeData, NodeKind, Provenance, Session } from '../../types'
import { entryForStableId } from './catalog'

/* ————————————————————————————————————————————
   Hackathon demo scenario:
   "Lunar rover cabin — material evidence review".

   Everything here is hardcoded on purpose. PSI
   facts are copied from the supplied tables in
   ../data/experimental-tables; rover documents are
   clearly-labelled mock fixtures (NOT NASA files).
   ———————————————————————————————————————————— */

export const SESSION_NAME = 'Lunar rover cabin — material evidence review'

export const ROOT_TEXT =
  'Assess the PSI evidence relevant to PMMA/acrylic and cotton-fiberglass cabin materials for a lunar rover at 1/6 g and 30% O₂. Use the approved pressure and airflow from the attached design basis. Separate measured evidence from transfer assumptions and list the missing tests.'

export const BRANCH_NAME = '30% O₂ rover material evidence'

/** Stable node ids used by the scenario. Evidence nodes reuse catalog ids. */
export const RV = {
  root: 'rv_root',
  mission: 'rv_mission',
  g: 'rv_gravity',
  o2: 'rv_o2',
  p: 'rv_pressure',
  flow: 'rv_airflow',
  pmma: 'rv_pmma',
  textile: 'rv_textile',
  docBasis: 'rv_doc_basis',
  docBom: 'rv_doc_bom',
  gap: 'rv_gap',
  c1: 'rv_c1',
  c2: 'rv_c2',
  c3: 'rv_c3',
  saffire2: 'n_investigation_PSI-99',
  saffire2ds: 'n_dataset_ds_PSI-99_saffire-2',
  saffire1: 'n_investigation_PSI-98',
  saffire1ds: 'n_dataset_ds_PSI-98_saffire-1',
  bass2ds: 'n_dataset_ds_PSI-25_bass-ii',
  bass2: 'n_investigation_PSI-25',
  bass: 'n_investigation_PSI-26',
  bre: 'n_investigation_PSI-20',
  cfig: 'n_investigation_PSI-159',
  flex: 'n_investigation_PSI-69',
  same: 'n_investigation_PSI-102',
  daft: 'n_investigation_PSI-47',
} as const

const VIOLET = '#a78bfa'

/** Hand-placed layout: lanes left → right (inputs → question → materials → evidence). */
export const POS: Record<string, { x: number; y: number }> = {
  // Atmosphere context · different fuel (above mission inputs, next to O₂)
  [RV.bre]: { x: 0, y: -210 },
  [RV.cfig]: { x: 160, y: -210 },
  // Mission inputs · engineer-provided
  [RV.o2]: { x: 0, y: 60 },
  [RV.g]: { x: 0, y: 210 },
  [RV.p]: { x: 0, y: 360 },
  [RV.flow]: { x: 0, y: 510 },
  [RV.mission]: { x: 160, y: 210 },
  [RV.docBasis]: { x: 160, y: 430 },
  // Research question + open issue
  [RV.root]: { x: 330, y: 240 },
  [RV.gap]: { x: 365, y: -30 },
  // Rover materials · BOM
  [RV.pmma]: { x: 570, y: 100 },
  [RV.textile]: { x: 570, y: 290 },
  [RV.docBom]: { x: 570, y: 480 },
  // Direct solid-material evidence · measured in PSI
  [RV.saffire2]: { x: 790, y: 60 },
  [RV.saffire2ds]: { x: 950, y: 60 },
  [RV.saffire1]: { x: 790, y: 250 },
  [RV.saffire1ds]: { x: 950, y: 250 },
  [RV.bass2]: { x: 790, y: 440 },
  [RV.bass2ds]: { x: 950, y: 440 },
  [RV.bass]: { x: 790, y: 620 },
  // Engineering conclusions · agent interpretation
  [RV.c1]: { x: 1140, y: 60 },
  [RV.c2]: { x: 1140, y: 250 },
  [RV.c3]: { x: 1140, y: 440 },
  // Follow-ups · not material evidence
  [RV.flex]: { x: 790, y: 860 },
  [RV.same]: { x: 950, y: 860 },
  [RV.daft]: { x: 1110, y: 860 },
}

/** Background lanes that group the canvas by evidence type (drawn behind nodes). */
export const LANES: { id: string; title: string; subtitle: string; color: string; members: string[] }[] = [
  { id: 'lane_context', title: 'Atmosphere context', subtitle: 'different fuel · not material evidence', color: '#a78bfa', members: [RV.bre, RV.cfig] },
  { id: 'lane_mission', title: 'Mission inputs', subtitle: 'from design basis PLR-DB-001', color: '#4da3ff', members: [RV.o2, RV.g, RV.p, RV.flow, RV.mission, RV.docBasis] },
  { id: 'lane_materials', title: 'Rover materials', subtitle: 'from BOM PLR-BOM-001', color: '#ffb454', members: [RV.pmma, RV.textile, RV.docBom] },
  { id: 'lane_evidence', title: 'Direct solid-material evidence', subtitle: 'measured in PSI · ~22 % O₂ · low-g', color: '#3ad7a3', members: [RV.saffire2, RV.saffire2ds, RV.saffire1, RV.saffire1ds, RV.bass2, RV.bass2ds, RV.bass] },
  { id: 'lane_conclusions', title: 'Engineering conclusions', subtitle: 'interpretation of measured rows', color: '#7a8bff', members: [RV.c1, RV.c2, RV.c3] },
  { id: 'lane_followup', title: 'Follow-up branches', subtitle: 'suppression & detection · optional', color: '#8b95a5', members: [RV.flex, RV.same, RV.daft] },
]

/* ——— PSI record links ——— */

export const PSI_URL = (acc: string) => `https://psi.nasa.gov/physci/repo/data/investigations/${acc}`

export const DOI: Record<string, string> = {
  'PSI-99': '10.60555/2chp-m469',
  'PSI-98': '10.60555/0t15-1z43',
  'PSI-25': '10.60555/4qc4-de67',
  'PSI-26': '10.60555/58h4-dy80',
  'PSI-20': '10.60555/vb93-3y72',
  'PSI-159': '10.60555/cyt1-kh64',
  'PSI-69': '10.60555/mbq8-0451',
}

/* ——— Evidence registry (keyed by node data.ref) ——— */

export type EvidenceRole =
  | 'Direct material match · different environment'
  | 'Material screening context'
  | 'Atmosphere context · different fuel'
  | 'Separate · suppression follow-up'
  | 'Separate · detection follow-up'

export interface TableRow {
  id: string
  cells: [string, string][]
  flags: string[]
}

export interface Evidence {
  accession: string
  title: string
  role: EvidenceRole
  file: string
  useful: string
  boundary: string
  /** "Measured in PSI" statement for branch summaries */
  measured: string
  /** tested conditions for the rover comparison (only for solid-material rows) */
  tested?: { o2: string; flow: string; gravity: string; pressure: string; geometry: string }
  rows?: TableRow[]
  notes?: string[]
}

const SAFFIRE2_FILE = 'experimental-tables/PSI-99_Experimental table_SAFFIRE-2.csv'
const SAFFIRE1_FILE = 'experimental-tables/PSI-98_Experimental table_SAFFIRE-1.csv'

const SAFFIRE2: Evidence = {
  accession: 'PSI-99',
  title: 'Saffire-II',
  role: 'Direct material match · different environment',
  file: SAFFIRE2_FILE,
  useful:
    'Strongest direct material bridge in the supplied tables: rows for silicone, cotton-fiberglass (SIBAL), PMMA and PMMA/Nomex with air flow, O₂, burn time and burn/spread observations.',
  boundary:
    'Tabulated O₂ is ~21.5–22.1 %, not 30 %. Air flow is 20 cm/s. The "?-g" column headers are garbled in this export — check the report before treating each label as definitive. No 1/6-g test.',
  measured:
    'Saffire-II (PSI-99): large-sample low-gravity observations for PMMA (rows 2-8, 2-9) and SIBAL (row 2-5) near 22 % O₂ at 20 cm/s air flow.',
  tested: {
    o2: '~21.5–22.1 %',
    flow: '20 cm/s (concurrent)',
    gravity: 'Low-g spacecraft test ("?-g" header garbled — verify)',
    pressure: 'Not tabulated',
    geometry: '29 cm × 5 cm samples',
  },
  rows: [
    {
      id: '2-5',
      cells: [
        ['Material', 'Cotton-Fiberglass (SIBAL)'],
        ['Thickness', '037 mm'],
        ['Length × width', '29 cm × 5 cm'],
        ['Air flow', '20 cm/s'],
        ['O₂ (Note 1)', '~ 22.1'],
        ['Ignition', '80 W · 9.2 s'],
        ['Burn time', '145 s'],
        ['Flow direction', 'Concurrent'],
        ['?-g burn length', '29 cm'],
        ['?-g spread length', '2.1 mm/s'],
      ],
      flags: [
        'Thickness entered as "037 mm" — likely 0.37 mm, verify in report.',
        'Strongest directly tabulated spread observation in this table.',
      ],
    },
    {
      id: '2-8',
      cells: [
        ['Material', 'PMMA'],
        ['Thickness', 'See Fig. 5'],
        ['Length × width', '29 cm × 5 cm'],
        ['Air flow', '20 cm/s'],
        ['O₂ (Note 1)', '22.1 to 22.0'],
        ['Ignition', '97 W · 30 s'],
        ['Burn time', '600 s'],
        ['Flow direction', 'Concurrent'],
        ['?-g burn length', '~ 10 cm (note 3)'],
        ['?-g spread length', 'Note 4'],
      ],
      flags: [
        'Thickness only given in the report (Fig. 5).',
        'Note 3: ~10 cm is the length of fuel with significant visible damage.',
        'Spread field points to Note 4 — no clean numeric spread rate. Not invented here.',
      ],
    },
    {
      id: '2-9',
      cells: [
        ['Material', '(blank in export)'],
        ['Thickness', '1 cm'],
        ['Length × width', '29 cm × 5 cm'],
        ['Air flow', '20 cm/s'],
        ['O₂ (Note 1)', '22.0 to 21.9'],
        ['Ignition', '97 W · 30 s'],
        ['Burn time', '900 s'],
        ['Flow direction', 'Concurrent'],
        ['?-g burn length', '~ 10 cm (note 4)'],
        ['?-g spread length', 'Note 4'],
      ],
      flags: [
        'Material cell is blank in this export (row follows PMMA 2-8) — confirm in report.',
        'Note 4: flame anchored at sample base, very slow regression (0.01–0.04 mm/s). ~10 cm is not a clean spread measurement.',
      ],
    },
  ],
  notes: [
    'Note 1 — O₂ derived from measured CO₂ production, referenced to initial O₂ reported by ISS.',
    'Note 3 — length of fuel with significant visible damage.',
    'Note 4 — flames remain anchored at the sample base; very slow regression rate (0.01–0.04 mm/s).',
  ],
}

const SAFFIRE1: Evidence = {
  accession: 'PSI-98',
  title: 'Saffire-I',
  role: 'Direct material match · different environment',
  file: SAFFIRE1_FILE,
  useful:
    'Two large SIBAL fabric samples (40.6 × 94 cm, 0.37 cm thick) at 20 cm/s; burn time differs between concurrent (420 s) and opposed (70 s) flow — shows geometry and flow direction matter.',
  boundary: 'Only two actual sample rows plus flow-visualization entries. Not an acrylic dataset, not 30 % O₂, not lunar gravity.',
  measured: 'Saffire-I (PSI-98): two large SIBAL samples at ~21.5–21.7 % O₂, 20 cm/s; concurrent vs opposed flow burn times differ (420 s vs 70 s).',
  tested: {
    o2: '~21.5–21.7 %',
    flow: '20 cm/s (concurrent / opposed)',
    gravity: 'Low-g spacecraft test',
    pressure: 'Not tabulated',
    geometry: '40.6 cm × 94 cm, 0.37 cm',
  },
  rows: [
    {
      id: 'S1',
      cells: [
        ['Material', 'SIBAL Fabric'],
        ['Thickness', '0.37 cm'],
        ['Length × width', '40.6 cm × 94 cm'],
        ['Air flow', '20 cm/s'],
        ['O₂', '21.5 - 21.7'],
        ['Ignition', '182 W · 8 s'],
        ['Burn time', '420 s'],
        ['Flow direction', 'Concurrent'],
      ],
      flags: [],
    },
    {
      id: 'S2',
      cells: [
        ['Material', 'SIBAL Fabric'],
        ['Thickness', '0.37 cm'],
        ['Length × width', '40.6 cm × 94 cm'],
        ['Air flow', '20 cm/s'],
        ['O₂', '~ 21.5'],
        ['Ignition', '182 W · 8 s'],
        ['Burn time', '70 s'],
        ['Flow direction', 'Opposed'],
      ],
      flags: ['Same material and size as S1 — burn time differs with flow direction.'],
    },
  ],
}

export const EVIDENCE: Record<string, Evidence> = {
  'PSI-99': SAFFIRE2,
  'ds_PSI-99_saffire-2': SAFFIRE2,
  'PSI-98': SAFFIRE1,
  'ds_PSI-98_saffire-1': SAFFIRE1,
  'PSI-25': {
    accession: 'PSI-25',
    title: 'BASS-II',
    role: 'Material screening context',
    file: 'experimental-tables/PSI-25_Experimental table_BASS-II.csv',
    useful: '129 rows including PMMA films/rods and other samples; O₂ is reported per test and includes lower-O₂ screening.',
    boundary:
      'O₂ mostly in a lower / near-air range (13.6–22.2 %). Air-flow / fan fields are irregular free text. Not a clean 1/6-g, 30 %-O₂ rover comparison — check source reports for ambiguous runs.',
    measured: 'BASS-II (PSI-25): PMMA film/rod samples at ~13.6–22.2 % O₂ — screening context with condition and outcome limitations.',
  },
  'PSI-26': {
    accession: 'PSI-26',
    title: 'BASS',
    role: 'Material screening context',
    file: 'experimental-tables/PSI-26_Experimental table_BASS.csv',
    useful: '122 rows describing samples incl. PMMA, SIBAL, Nomex, spheres, slabs and candles — material and geometry discovery.',
    boundary: 'Primarily a sample / test list — no consistent numeric result matrix.',
    measured: 'BASS (PSI-26): sample/geometry index (PMMA, SIBAL, Nomex) — no consistent numeric outcomes.',
  },
  'PSI-20': {
    accession: 'PSI-20',
    title: 'ACME BRE',
    role: 'Atmosphere context · different fuel',
    file: 'experimental-tables/PSI-20_Experimental table_ACME BRE.csv',
    useful:
      '18 daily summaries of a gaseous burner (mostly ethylene, some methane) with O₂ combinations of 21, 25, 26.5, 34 and 40 %. 26.5 % and 34 % bracket the rover’s 30 % target.',
    boundary:
      'Gas flames, not polymer coupon tests. Chamber pressures varied but are not identified in the summary table. Two O₂ cells are malformed ("3400%", "2100%"). Cannot be used to say PMMA burns at 30 % O₂.',
    measured: 'ACME BRE (PSI-20): elevated-O₂ gaseous-burner flames (21–40 %) — not polymer tests.',
  },
  'PSI-159': {
    accession: 'PSI-159',
    title: 'CFI-G',
    role: 'Atmosphere context · different fuel',
    file: 'experimental-tables/PSI-159_Experimental table_CFI-G_Normal Flames.csv (+ Inverse Flames)',
    useful: 'High-O₂ gas-flame mechanism context: O₂ fractions up to 0.85, pressure, ignition, burn time, self-extinction fields.',
    boundary: 'Gaseous-fuel flame research, not a rover-material test. 85 % is a tested chamber condition — not a habitat recommendation or an acrylic limit.',
    measured: 'CFI-G (PSI-159): gaseous flames up to 0.85 O₂ fraction — mechanism context only.',
  },
  'PSI-69': {
    accession: 'PSI-69',
    title: 'FLEX',
    role: 'Separate · suppression follow-up',
    file: 'experimental-tables/PSI-69_Experimental table_FLEX.csv',
    useful: '274 liquid-droplet tests with fuel, pressure, O₂/CO₂/He fractions, droplet size, burn time and outcome (186 Extinction, 61 Disruption, 27 Completion).',
    boundary: 'Methanol/heptane droplet suppression tests do not establish solid-material flammability or rover material limits.',
    measured: 'FLEX (PSI-69): droplet suppression outcomes — separate branch.',
  },
  'PSI-102': {
    accession: 'PSI-102',
    title: 'SAME',
    role: 'Separate · detection follow-up',
    file: 'experimental-tables/PSI-102_Experimental table_SAME.csv',
    useful: 'Smoke behaviour and detector response in low gravity — later rover-alarm branch.',
    boundary: 'Detection evidence is not material flammability evidence.',
    measured: 'SAME (PSI-102): smoke / detector response — detection branch.',
  },
  'PSI-47': {
    accession: 'PSI-47',
    title: 'DAFT',
    role: 'Separate · detection follow-up',
    file: 'experimental-tables/PSI-47_Experimental table_DAFT.csv',
    useful: 'Dust-vs-smoke measurement feasibility — relevant to nuisance-alarm questions on the lunar surface.',
    boundary: 'A measurement-feasibility study, not a lunar rover smoke-alarm qualification.',
    measured: 'DAFT (PSI-47): dust aerosol measurement feasibility — detection branch.',
  },
}

/* ——— Mock engineer documents ——— */

export type FieldStatus = 'confirmed' | 'provisional' | 'unknown'

export interface ExtractedField {
  key: string
  label: string
  value: string
  source: string
  status: FieldStatus
  note?: string
}

export interface MockDoc {
  id: 'basis' | 'bom'
  nodeId: string
  name: string
  /** bundled copy served by Vite (public/demo-docs) */
  file: string
  match: RegExp
  summary: string
  fields: ExtractedField[]
}

export const MOCK_DOCS: MockDoc[] = [
  {
    id: 'basis',
    nodeId: RV.docBasis,
    name: 'Rover Cabin Design Basis.pdf',
    file: '/demo-docs/Rover Cabin Design Basis.pdf',
    match: /design.?basis|PLR-DB/i,
    summary: 'PLR-DB-001 Rev A — cabin pressure, atmosphere control, ventilation, open items.',
    fields: [
      { key: 'gravity', label: 'Gravity', value: '1/6 g', source: 'PLR-DB-001 §2 Mission environment · p. 2', status: 'confirmed', note: 'Lunar surface operations (1.62 m/s²).' },
      { key: 'pressure', label: 'Cabin total pressure', value: '10.2 psia', source: 'PLR-DB-001 §3.1 Total pressure · p. 3', status: 'confirmed', note: 'Approved nominal (Rev B). Minimum 9.5 psia.' },
      { key: 'pmode', label: 'Pressure mode', value: 'Nominal', source: 'PLR-DB-001 §3.1 · p. 3', status: 'confirmed', note: 'Contingency mode 8.2 psia at 34 % O₂ — EVA-prep only, < 24 h.' },
      { key: 'o2', label: 'O₂ target', value: '30 %', source: 'PLR-DB-001 §3.2 Atmosphere control · p. 3', status: 'confirmed', note: 'Control band 28.5–30.5 %.' },
      { key: 'o2max', label: 'O₂ transient upper bound', value: '32 %', source: 'PLR-DB-001 §3.2 · p. 3', status: 'confirmed', note: 'Max. 30 min, e.g. after repress.' },
      { key: 'flow', label: 'Airflow range near materials', value: '5–20 cm/s', source: 'PLR-DB-001 §4 Ventilation · p. 4', status: 'confirmed', note: 'Low / high fan setting; nominal cabin average 10 cm/s (CFD case V-07).' },
      { key: 'flowdir', label: 'Airflow direction near materials', value: 'Forward → aft', source: 'PLR-DB-001 §4 · p. 4', status: 'confirmed', note: 'Parallel to panel and seat surfaces. 1/6-g buoyant + forced flow ≠ microgravity test.' },
    ],
  },
  {
    id: 'bom',
    nodeId: RV.docBom,
    name: 'Cabin Materials BOM.pdf',
    file: '/demo-docs/Cabin Materials BOM.pdf',
    match: /bom|materials|PLR-BOM/i,
    summary: 'PLR-BOM-001 Rev A — interior non-metallic materials under fire-safety review.',
    fields: [
      { key: 'pmma', label: 'Acrylic component', value: 'PMMA (cast acrylic)', source: 'PLR-BOM-001 line 14 · p. 2', status: 'confirmed', note: 'Forward viewport inner pane, 0.42 m² installed.' },
      { key: 'pmmaGrade', label: 'PMMA grade / formulation', value: 'Cast, unfilled, clear — PLR-M-014', source: 'PLR-BOM-001 line 14 · p. 2, Note N2 · p. 3', status: 'confirmed' },
      { key: 'pmmaThk', label: 'PMMA thickness', value: '6.0 mm', source: 'PLR-BOM-001 line 14 · p. 2', status: 'confirmed' },
      { key: 'textile', label: 'Textile', value: 'Cotton-fiberglass textile', source: 'PLR-BOM-001 line 22 · p. 2', status: 'confirmed', note: 'Seat and stowage covers, 3.8 m² installed.' },
      { key: 'textileSpec', label: 'Textile specification / installation', value: '25 % cotton / 75 % glass · 0.35 mm · seats & stowage', source: 'PLR-BOM-001 line 22 · p. 2, Note N3 · p. 3', status: 'confirmed', note: 'SIBAL-type blend, spec PLR-T-022, 250 g/m².' },
      { key: 'layers', label: 'Layers / adhesives / coatings', value: 'PMMA: ≈5 µm acrylic hard coat, RTV edge seal · textile: Nomex felt backing, silicone adhesive', source: 'PLR-BOM-001 Note N1 · p. 3', status: 'confirmed', note: 'Part of the installed configuration — not represented in the PSI sample rows.' },
    ],
  },
]

/** Recognise an uploaded PDF as one of the demo fixtures (by file name). */
export function matchMockDoc(fileName: string): MockDoc | undefined {
  return MOCK_DOCS.find((d) => d.match.test(fileName))
}

/* ——— store helpers ——— */

const st = () => useAppStore.getState()
const sess = (id: string) => st().sessions.find((s) => s.id === id)

function upsertNode(sessionId: string, node: GraphNode, overwrite = true): string {
  const s = sess(sessionId)
  if (!s) return node.id
  const ex = s.nodes.find((n) => n.id === node.id || n.data.ref === node.data.ref)
  if (ex) {
    if (overwrite) st().updateNode(sessionId, ex.id, { data: { ...ex.data, ...node.data } })
    return ex.id
  }
  st().addNode(sessionId, node)
  return node.id
}

function upsertEdge(sessionId: string, source: string, target: string, label: string) {
  const s = sess(sessionId)
  if (!s) return
  if (s.edges.some((e) => e.source === source && e.target === target)) {
    st().setEdges(sessionId, (es) => es.map((e) => (e.source === source && e.target === target ? { ...e, label } : e)))
    return
  }
  st().addEdge(sessionId, { id: `e_${source}_${target}`, source, target, label, type: 'RELATES_TO' })
}

function node(kind: NodeKind, id: string, data: Omit<GraphNodeData, 'kind' | 'ref'> & { ref?: string }): GraphNode {
  return { id, type: kind, position: POS[id] ?? { x: 400, y: 300 }, data: { kind, ref: data.ref ?? id, ...data } }
}

/** Evidence node from the generated catalog + scenario badges. */
function evidenceNode(stableId: string, label: string, extra: Partial<GraphNodeData>): GraphNode {
  const entry = entryForStableId(stableId)
  return {
    id: stableId,
    type: entry?.kind ?? 'investigation',
    position: POS[stableId] ?? { x: 700, y: 300 },
    data: {
      kind: entry?.kind ?? 'investigation',
      ref: entry?.ref ?? stableId,
      label,
      hint: entry?.hint ?? '',
      ...extra,
    },
  }
}

const msgId = () => `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

/* ——— seed ——— */

export function buildRoverSession(): Session {
  return {
    id: `ses_rover_${Date.now().toString(36)}`,
    name: SESSION_NAME,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    researchStatement: '',
    nodes: [],
    edges: [],
    branches: [],
    messages: [
      {
        id: 'm0',
        role: 'agent',
        text:
          'New review session. I hold the local PSI index: 24-investigation catalog, investigation details and 22 experimental tables.\n\nStart by defining the goal of this review — the question the evidence should answer. Then upload the rover design basis and the cabin materials BOM (PDF) with "Add data".\n\nThis is literature & data triage — not material certification and not a substitute for NASA-STD-6001 testing.',
        at: Date.now(),
      },
    ],
  }
}

/** Is this the rover-review demo session? */
export const isRoverSession = (session: { id: string }) => session.id.startsWith('ses_rover')

/** Does the session already have its goal (research-question node)? */
export const hasGoal = (session: { nodes: GraphNode[] }) => session.nodes.some((n) => n.type === 'researchQuestion')

/** Step 1 — define (or edit) the review goal. Creates / updates the root node. */
export function defineGoal(sessionId: string, text: string) {
  const s = sess(sessionId)
  if (!s || !text.trim()) return
  const goal = text.trim()
  const label = goal === ROOT_TEXT ? 'Lunar rover cabin — material evidence review' : goal.length > 80 ? `${goal.slice(0, 78)}…` : goal
  const isFirst = !hasGoal(s)
  st().updateResearchStatement(sessionId, goal)
  const existing = s.nodes.find((n) => n.type === 'researchQuestion')
  if (existing) {
    st().updateNode(sessionId, existing.id, { data: { ...existing.data, label, hint: goal } })
  } else {
    const id = isRoverSession(s) ? RV.root : `n_researchQuestion_goal_${Date.now().toString(36)}`
    st().addNode(sessionId, {
      id,
      type: 'researchQuestion',
      position: POS[RV.root] ?? { x: 400, y: 250 },
      data: { kind: 'researchQuestion', ref: id, label, hint: goal },
    })
  }
  if (!isFirst) return
  const mid = msgId()
  st().addMessage(sessionId, {
    id: mid,
    role: 'agent',
    text:
      'Goal set — it is the root of the canvas. I will keep measured PSI evidence, your inputs and my interpretation separate.\n\nNext: upload the rover design basis and the cabin materials BOM (PDF) with "Add data" on the right. Pressure, atmosphere, airflow and material data will come from those documents — I won\'t assume any value.',
    at: Date.now(),
  })
  st().setStreamingMsgId(mid)
}

/* ——— step 2: confirm mock document ——— */

const statusToProv = (s: FieldStatus): Provenance =>
  s === 'confirmed' ? 'engineer' : s === 'provisional' ? 'provisional' : 'unknown'

export function applyDocument(sessionId: string, doc: MockDoc, fields: ExtractedField[]) {
  const f = (k: string) => fields.find((x) => x.key === k)!
  const docId = upsertNode(
    sessionId,
    node('externalSource', doc.nodeId, {
      label: doc.name,
      hint: 'Engineer-provided document (uploaded PDF) — mission inputs, not a NASA source document.',
      provenance: 'engineer',
      badge: 'uploaded PDF',
      fields: fields.map(({ label, value, source, status }) => ({ label, value, source, status })),
    }),
  )
  upsertEdge(sessionId, RV.root, docId, 'engineer document')

  const confirmed: string[] = []
  const stillUnknown: string[] = []
  const track = (label: string, x: ExtractedField) =>
    (x.status === 'unknown' || !x.value ? stillUnknown : confirmed).push(`${label}: ${x.value || 'unknown'}${x.status === 'provisional' ? ' (provisional)' : ''}`)

  if (doc.id === 'basis') {
    const g = f('gravity')
    const p = f('pressure')
    const mode = f('pmode')
    const o2 = f('o2')
    const o2max = f('o2max')
    const flow = f('flow')
    const dir = f('flowdir')
    const known = (x: ExtractedField) => Boolean(x.value) && x.status !== 'unknown'

    upsertNode(sessionId, node('missionParam', RV.mission, {
      label: 'Mission environment',
      hint: `From ${doc.name}. Engineer-provided inputs — not experimental results.`,
      provenance: 'engineer',
      badge: 'from design basis',
    }))
    upsertNode(sessionId, node('missionParam', RV.g, {
      label: `Gravity: ${g.value}`,
      value: g.value,
      hint: `${g.source}. PSI combustion tables in this bundle contain no lunar-gravity tests.`,
      provenance: statusToProv(g.status),
      badge: 'not in PSI tests',
    }))
    upsertNode(sessionId, node('missionParam', RV.o2, {
      label: `Oxygen: ${o2.value}`,
      value: o2.value,
      hint: `${o2.source}. ${o2.note ?? ''} Transient upper bound: ${o2max.value || 'not stated'}.`,
      provenance: statusToProv(o2.status),
      badge: o2max.value ? `target · max ${o2max.value}` : 'target · max unknown',
    }))
    upsertNode(sessionId, node('missionParam', RV.p, {
      label: known(p) ? `Pressure: ${p.value}` : 'Pressure: not stated',
      value: known(p) ? p.value : '',
      hint: `${p.source}. ${p.note ?? ''} Mode: ${mode.value || 'unknown'}.`,
      provenance: known(p) ? statusToProv(p.status) : 'unknown',
      badge: known(p) ? (p.status === 'provisional' ? 'provisional' : `${mode.value || 'mode ?'} · approved`) : 'unknown',
    }))
    upsertNode(sessionId, node('missionParam', RV.flow, {
      label: known(flow) ? `Airflow: ${flow.value}` : 'Airflow: not stated',
      value: known(flow) ? flow.value : '',
      hint: `${flow.source}. ${flow.note ?? ''} Direction: ${dir.value || 'unknown'}. The rover’s 1/6-g flow field is not equivalent to the PSI microgravity setup.`,
      provenance: known(flow) ? statusToProv(flow.status) : 'unknown',
      badge: known(flow) ? dir.value || 'direction ?' : 'unknown',
    }))
    upsertEdge(sessionId, RV.root, RV.mission, 'mission inputs')
    upsertEdge(sessionId, RV.mission, RV.g, 'gravity')
    upsertEdge(sessionId, RV.mission, RV.o2, 'oxygen')
    upsertEdge(sessionId, RV.mission, RV.p, 'pressure')
    upsertEdge(sessionId, RV.mission, RV.flow, 'airflow')
    upsertEdge(sessionId, docId, RV.mission, 'source document')
    for (const [label, x] of [
      ['Gravity', g],
      ['Pressure', p],
      ['Pressure mode', mode],
      ['O₂ target', o2],
      ['O₂ transient max', o2max],
      ['Airflow', flow],
      ['Airflow direction', dir],
    ] as const)
      track(label, x)
  } else {
    const pm = f('pmma')
    const grade = f('pmmaGrade')
    const thk = f('pmmaThk')
    upsertNode(sessionId, node('material', RV.pmma, {
      label: `Rover ${pm.value || 'PMMA / acrylic'}`,
      value: [grade.value, thk.value].filter(Boolean).join(' · '),
      hint: `${pm.source}. Grade: ${grade.value || 'to confirm'} · thickness: ${thk.value || 'to confirm'}. "PMMA" alone does not prove identity with a tested formulation.`,
      provenance: statusToProv(grade.value ? grade.status : 'provisional'),
      badge: grade.value && thk.value ? 'grade & thickness given' : 'grade & thickness to confirm',
      fields: [pm, grade, thk, f('layers')].map(({ label, value, source, status }) => ({ label, value, source, status })),
    }))
    const tx = f('textile')
    const spec = f('textileSpec')
    upsertNode(sessionId, node('material', RV.textile, {
      label: `Rover ${tx.value || 'cotton-fiberglass textile'}`,
      value: spec.value,
      hint: `${tx.source}. Spec / installation: ${spec.value || 'to confirm'}.`,
      provenance: statusToProv(spec.value ? spec.status : 'provisional'),
      badge: spec.value ? 'spec given' : 'spec to confirm',
      fields: [tx, spec, f('layers')].map(({ label, value, source, status }) => ({ label, value, source, status })),
    }))
    upsertEdge(sessionId, RV.root, RV.pmma, 'rover material')
    upsertEdge(sessionId, RV.root, RV.textile, 'rover material')
    upsertEdge(sessionId, docId, RV.pmma, 'line 14 p. 2')
    upsertEdge(sessionId, docId, RV.textile, 'line 22 p. 2')
    track('Acrylic', pm)
    track('PMMA grade', grade)
    track('PMMA thickness', thk)
    track('Textile', tx)
    track('Textile spec', spec)
    track('Layers / adhesives / coatings', f('layers'))
  }

  const docMsgId = msgId()
  st().addMessage(sessionId, {
    id: docMsgId,
    role: 'agent',
    text:
      `Read "${doc.name}" — engineer-provided document. You confirmed the extracted values below; I treat them as mission inputs, never as measurements. Fields marked TBD in the PDF stay unknown.\n\n` +
      (confirmed.length ? `Confirmed / provisional:\n• ${confirmed.join('\n• ')}\n\n` : '') +
      (stillUnknown.length ? `Still unknown (kept visible on the canvas):\n• ${stillUnknown.join('\n• ')}` : 'No fields left unknown.'),
    at: Date.now(),
    chips:
      doc.id === 'basis'
        ? [{ nodeId: RV.p, label: 'Pressure' }, { nodeId: RV.flow, label: 'Airflow' }, { nodeId: docId, label: doc.name }]
        : [{ nodeId: RV.pmma, label: 'Rover PMMA' }, { nodeId: RV.textile, label: 'Rover textile' }, { nodeId: docId, label: doc.name }],
  })
  st().setHighlight(doc.id === 'basis' ? [RV.mission, RV.g, RV.o2, RV.p, RV.flow] : [RV.pmma, RV.textile], 1800)
  st().setStreamingMsgId(docMsgId)
}

/* ——— step 3: agent evidence search ——— */

function ensureMaterials(sessionId: string) {
  const s = sess(sessionId)
  if (!s) return
  if (!s.nodes.some((n) => n.id === RV.pmma)) {
    upsertNode(sessionId, node('material', RV.pmma, {
      label: 'Rover PMMA / acrylic',
      hint: 'From the scenario; BOM not attached yet — grade and thickness to confirm.',
      provenance: 'unknown',
      badge: 'grade & thickness to confirm',
    }))
    upsertEdge(sessionId, RV.root, RV.pmma, 'rover material')
  }
  if (!s.nodes.some((n) => n.id === RV.textile)) {
    upsertNode(sessionId, node('material', RV.textile, {
      label: 'Rover cotton-fiberglass textile',
      hint: 'From the scenario; BOM not attached yet — spec to confirm.',
      provenance: 'unknown',
      badge: 'spec to confirm',
    }))
    upsertEdge(sessionId, RV.root, RV.textile, 'rover material')
  }
}

export interface ScriptedReply {
  text: string
  chips?: { nodeId: string; label: string }[]
  hrefs?: { label: string; href: string }[]
  links?: ChatMessage['links']
  highlight?: string[]
  select?: string
  /** canvas mutation performed when the reply lands */
  apply?: () => void
}

export function evidenceReply(sessionId: string): ScriptedReply {
  return {
    apply: () => {
      ensureMaterials(sessionId)
      const ev = (id: string, label: string, extra: Partial<GraphNodeData>) => upsertNode(sessionId, evidenceNode(id, label, extra))
      ev(RV.saffire2, 'Saffire-II (PSI-99)', { provenance: 'measured', badge: 'direct material · different env', hint: 'PMMA & SIBAL rows · ~22 % O₂ · 20 cm/s · not 1/6 g / 30 % O₂' })
      ev(RV.saffire1, 'Saffire-I (PSI-98)', { provenance: 'measured', badge: 'direct material · SIBAL', hint: '2 large SIBAL samples · ~21.5–21.7 % O₂ · 20 cm/s' })
      ev(RV.bass2, 'BASS-II (PSI-25)', { provenance: 'measured', badge: 'screening context', hint: '129 rows · PMMA films/rods · O₂ 13.6–22.2 %' })
      ev(RV.bass, 'BASS (PSI-26)', { provenance: 'measured', badge: 'material index', hint: '122-row sample list · no consistent numeric results' })
      ev(RV.bre, 'ACME BRE (PSI-20)', { provenance: 'context', color: VIOLET, badge: 'different fuel · gas burner', hint: 'Ethylene/methane burner · O₂ 21–40 % · not a polymer test' })
      ev(RV.cfig, 'CFI-G (PSI-159)', { provenance: 'context', color: VIOLET, badge: 'different fuel · gas flame', hint: 'Gaseous flames up to 0.85 O₂ fraction · not a material test' })

      upsertEdge(sessionId, RV.pmma, RV.saffire2, 'material tested · PMMA 2-8/2-9')
      upsertEdge(sessionId, RV.textile, RV.saffire2, 'material tested · SIBAL 2-5')
      upsertEdge(sessionId, RV.textile, RV.saffire1, 'material tested · SIBAL S1/S2')
      upsertEdge(sessionId, RV.pmma, RV.bass2, 'screening context')
      upsertEdge(sessionId, RV.pmma, RV.bass, 'material index')
      const o2Anchor = sess(sessionId)?.nodes.some((n) => n.id === RV.o2) ? RV.o2 : RV.root
      upsertEdge(sessionId, o2Anchor, RV.bre, 'condition context · different fuel')
      upsertEdge(sessionId, o2Anchor, RV.cfig, 'condition context · different fuel')
    },
    text:
      'Searched the local index (catalog, investigation details, 22 experimental tables). Grouped by how each source relates to your rover inputs — ranked by match reasons, not by probability.\n\n' +
      '① Direct material match · different environment\n' +
      '• Saffire-II (PSI-99) · PSI-99_Experimental table_SAFFIRE-2.csv — SIBAL row 2-5 and PMMA rows 2-8 / 2-9: 29 × 5 cm samples, 20 cm/s, ~21.5–22.1 % O₂; burn time 145 / 600 / 900 s.\n' +
      '• Saffire-I (PSI-98) · PSI-98_Experimental table_SAFFIRE-1.csv — SIBAL S1 / S2, 40.6 × 94 cm, 0.37 cm, 20 cm/s, ~21.5–21.7 % O₂; 420 s concurrent vs 70 s opposed.\n\n' +
      '② Material screening context\n' +
      '• BASS-II (PSI-25) — PMMA films/rods among 129 rows, O₂ ~13.6–22.2 %; air-flow fields are free text.\n' +
      '• BASS (PSI-26) — 122-row sample list (PMMA, SIBAL, Nomex); no consistent numeric results.\n\n' +
      '③ Atmosphere context · different fuel\n' +
      '• ACME BRE (PSI-20) — gaseous burner (mostly ethylene) at 21–40 % O₂; 26.5 % and 34 % bracket 30 %. Not a polymer test.\n' +
      '• CFI-G (PSI-159) — gas flames up to 0.85 O₂ fraction. A tested chamber condition, not a material limit.\n\n' +
      '④ Separate — not added\n' +
      '• FLEX (PSI-69) — droplet suppression (186 extinction / 61 disruption / 27 completion). Offered only for a suppressant branch.\n\n' +
      'Not covered: no PSI table in this bundle tests 1/6 g, and no solid-material row is at 30 % O₂. I did not infer a 1/6-g result from microgravity data.\n\n' +
      'Next: open the SAFFIRE-2 table in Explore, check the measured rows and add the table to the canvas.',
    chips: [
      { nodeId: RV.saffire2, label: 'Saffire-II' },
      { nodeId: RV.saffire1, label: 'Saffire-I' },
      { nodeId: RV.bass2, label: 'BASS-II' },
      { nodeId: RV.bass, label: 'BASS' },
      { nodeId: RV.bre, label: 'ACME BRE' },
      { nodeId: RV.cfig, label: 'CFI-G' },
      { nodeId: RV.flex, label: 'FLEX (suppression)' },
    ],
    hrefs: [
      { label: 'PSI-99 record', href: PSI_URL('PSI-99') },
      { label: 'PSI-98 record', href: PSI_URL('PSI-98') },
      { label: 'PSI-25', href: PSI_URL('PSI-25') },
      { label: 'PSI-20', href: PSI_URL('PSI-20') },
    ],
    links: [{ view: 'explore', label: 'Open SAFFIRE-2 table in Explore', ref: 'ds_PSI-99_saffire-2' }],
    highlight: [RV.saffire2, RV.saffire1, RV.textile, RV.pmma],
  }
}

/* ——— adding PSI data from Explore ——— */

const EXPLORE_ITEMS: Record<string, { id: string; label: string; parent?: string; extra: Partial<GraphNodeData>; note: string }> = {
  'ds_PSI-99_saffire-2': {
    id: RV.saffire2ds,
    label: 'SAFFIRE-2 table',
    parent: RV.saffire2,
    extra: { provenance: 'measured', badge: 'rows 2-5 · 2-8 · 2-9', hint: 'PSI-99_Experimental table_SAFFIRE-2.csv — 9 sample rows + notes' },
    note: 'SIBAL row 2-5 and PMMA rows 2-8 / 2-9 are the closest material rows — select the table to compare them with the rover, then ask me to draw conclusions.',
  },
  'ds_PSI-98_saffire-1': {
    id: RV.saffire1ds,
    label: 'SAFFIRE-1 table',
    parent: RV.saffire1,
    extra: { provenance: 'measured', badge: 'rows S1 · S2', hint: 'PSI-98_Experimental table_SAFFIRE-1.csv — 2 sample rows' },
    note: 'Two large SIBAL samples — burn time differs with flow direction (420 s vs 70 s).',
  },
  'ds_PSI-25_bass-ii': {
    id: RV.bass2ds,
    label: 'BASS-II table',
    parent: RV.bass2,
    extra: { provenance: 'measured', badge: '129 rows · PMMA', hint: 'PSI-25_Experimental table_BASS-II.csv — O₂ 13.6–22.2 %' },
    note: 'Screening context only: lower O₂, airflow fields are free text.',
  },
  'PSI-99': { id: RV.saffire2, label: 'Saffire-II (PSI-99)', extra: { provenance: 'measured', badge: 'direct material · different env', hint: 'PMMA & SIBAL rows · ~22 % O₂ · 20 cm/s' }, note: 'Direct material match, different environment.' },
  'PSI-98': { id: RV.saffire1, label: 'Saffire-I (PSI-98)', extra: { provenance: 'measured', badge: 'direct material · SIBAL', hint: '2 large SIBAL samples · ~21.5–21.7 % O₂ · 20 cm/s' }, note: 'Large SIBAL samples.' },
  'PSI-25': { id: RV.bass2, label: 'BASS-II (PSI-25)', extra: { provenance: 'measured', badge: 'screening context', hint: '129 rows · PMMA films/rods · O₂ 13.6–22.2 %' }, note: 'Screening context.' },
}

/** Does the rover scenario place this Explore record itself? */
export const isScenarioExploreItem = (ref: string) => Boolean(EXPLORE_ITEMS[ref])

/** Add a record chosen in Explore to the rover canvas, in its evidence lane. Returns the node id. */
export function addFromExplore(sessionId: string, ref: string): string {
  const item = EXPLORE_ITEMS[ref]
  const parentRef = item.parent ? Object.keys(EXPLORE_ITEMS).find((k) => EXPLORE_ITEMS[k].id === item.parent) : undefined
  if (item.parent && parentRef) addFromExplore(sessionId, parentRef)
  const already = sess(sessionId)?.nodes.some((n) => n.id === item.id)
  const id = upsertNode(sessionId, evidenceNode(item.id, item.label, item.extra), false)
  if (item.parent) upsertEdge(sessionId, item.parent, id, 'table')
  else if (sess(sessionId)?.nodes.some((n) => n.id === RV.root)) upsertEdge(sessionId, RV.root, id, 'relates to')
  if (!already && item.parent) {
    const mid = msgId()
    st().addMessage(sessionId, {
      id: mid,
      role: 'agent',
      text: `Added ${item.label} from Explore to the evidence lane. ${item.note}`,
      at: Date.now(),
      chips: [{ nodeId: id, label: item.label }],
      links: [{ view: 'visualize', label: 'Evidence figures in Visualize' }],
    })
    st().setStreamingMsgId(mid)
  }
  return id
}

/* ——— optional follow-up nodes (offered as chips) ——— */

export const OFFERS: Partial<Record<string, (sessionId: string) => void>> = {
  [RV.flex]: (sid) => {
    upsertNode(sid, evidenceNode(RV.flex, 'FLEX (PSI-69)', { provenance: 'context', color: VIOLET, badge: 'suppression follow-up', hint: '274 droplet tests · not material flammability evidence' }), false)
    upsertEdge(sid, RV.root, RV.flex, 'suppression follow-up')
  },
  [RV.same]: (sid) => {
    upsertNode(sid, evidenceNode(RV.same, 'SAME (PSI-102)', { provenance: 'context', color: VIOLET, badge: 'detection follow-up', hint: 'Smoke / detector response · not flammability evidence' }), false)
    upsertEdge(sid, RV.root, RV.same, 'detection follow-up')
  },
  [RV.daft]: (sid) => {
    upsertNode(sid, evidenceNode(RV.daft, 'DAFT (PSI-47)', { provenance: 'context', color: VIOLET, badge: 'dust vs smoke', hint: 'Dust aerosol measurement feasibility · not alarm qualification' }), false)
    upsertEdge(sid, RV.root, RV.daft, 'detection follow-up')
  },
}

export function suppressionReply(sessionId: string): ScriptedReply {
  return {
    apply: () => OFFERS[RV.flex]!(sessionId),
    text:
      'Added FLEX (PSI-69) as a separate suppression follow-up — PSI-69_Experimental table_FLEX.csv, 274 liquid-droplet tests with O₂/CO₂/He fractions; outcomes 186 Extinction, 61 Disruption, 27 Completion.\n\nMethanol/heptane droplet tests do not establish solid-material flammability or rover material limits, so FLEX stays outside the material branch.',
    chips: [{ nodeId: RV.flex, label: 'FLEX' }],
    hrefs: [{ label: 'PSI-69 record', href: PSI_URL('PSI-69') }],
    highlight: [RV.flex],
  }
}

export function detectionReply(sessionId: string): ScriptedReply {
  return {
    apply: () => {
      OFFERS[RV.same]!(sessionId)
      OFFERS[RV.daft]!(sessionId)
    },
    text:
      'Added a detection follow-up: SAME (PSI-102) for smoke behaviour and detector response, and DAFT (PSI-47) for dust-vs-smoke discrimination — relevant to rover nuisance alarms.\n\nDetection evidence is not material flammability evidence, and DAFT is a measurement-feasibility study, not a lunar rover smoke-alarm qualification.',
    chips: [{ nodeId: RV.same, label: 'SAME' }, { nodeId: RV.daft, label: 'DAFT' }],
    hrefs: [{ label: 'PSI-102', href: PSI_URL('PSI-102') }, { label: 'PSI-47', href: PSI_URL('PSI-47') }],
    highlight: [RV.same, RV.daft],
  }
}

/* ——— step 5: evidence-gap branch ——— */

export const BRANCH_MEMBERS = [RV.mission, RV.pmma, RV.textile, RV.saffire2, RV.saffire2ds, RV.saffire1, RV.c1, RV.c2, RV.c3]

export function createEvidenceBranch(sessionId: string): string | null {
  const s = sess(sessionId)
  if (!s) return null
  const existing = s.branches.find((b) => b.name === BRANCH_NAME)
  if (existing) return existing.id
  const ids = BRANCH_MEMBERS.filter((id) => s.nodes.some((n) => n.id === id))
  if (ids.length < 2) return null
  st().addBranch(sessionId, { name: BRANCH_NAME, nodeIds: ids, color: '#ffb454' })
  return sess(sessionId)?.branches.find((b) => b.name === BRANCH_NAME)?.id ?? null
}

export function branchReply(sessionId: string): ScriptedReply {
  const s = sess(sessionId)
  const hasEvidence = s?.nodes.some((n) => n.id === RV.saffire2)
  if (!hasEvidence) {
    return {
      text: 'There is no PSI evidence on the canvas yet. Ask me to find the closest PSI evidence for PMMA and cotton-fiberglass first, then I can build the evidence-gap branch.',
    }
  }
  return {
    apply: () => {
      const id = createEvidenceBranch(sessionId)
      if (id) {
        st().setSelectedNode(null)
        st().setFocusedBranchId(id)
      }
    },
    text:
      `Created the branch "${BRANCH_NAME}" from the mission inputs, the rover materials, the Saffire evidence and the conclusions. The right panel now separates what PSI measured, what you supplied, and what is not covered.\n\nNo fire probability or "risk match" percentage is shown — these files contain no calibrated rover-risk model.`,
    highlight: BRANCH_MEMBERS,
  }
}

/* ——— engineering conclusions (agent interpretation of measured rows) ——— */

export interface Conclusion {
  id: string
  short: string
  title: string
  confidence: string
  data: { node: string; alt?: string; text: string }[]
  rover: string
  decision: string
  decisionShort: string
  from: string[]
}

export const CONCLUSIONS: Conclusion[] = [
  {
    id: RV.c1,
    short: 'C1',
    title: 'Seat textile spreads fastest',
    confidence: 'Lower bound — tested at ~22 % O₂, same airflow',
    data: [{ node: RV.saffire2ds, alt: RV.saffire2, text: 'Saffire-II 2-5: 29 cm strip burned in 145 s · 2.1 mm/s at 20 cm/s, ~22 % O₂' }],
    rover: 'Seats & stowage: 0.35 mm cotton-fiberglass, 3.8 m², airflow up to 20 cm/s',
    decision: 'Priority 1 — evaluate a lower-flammability textile or reduce airflow at the seats; keep fans-off on smoke alarm (< 5 s) as a critical requirement.',
    decisionShort: 'Replace the seat textile or cut airflow at the seats',
    from: [RV.saffire2ds, RV.saffire2],
  },
  {
    id: RV.c2,
    short: 'C2',
    title: 'Flow direction changes the burn 6×',
    confidence: 'Lower bound — meaning of burn time to verify in report',
    data: [{ node: RV.saffire1ds, alt: RV.saffire1, text: 'Saffire-I S1 vs S2: 420 s concurrent vs 70 s opposed — same SIBAL sample, 20 cm/s' }],
    rover: 'Cabin flow forward → aft, parallel to seats and panels',
    decision: 'Confirm the flow direction at the seats in ventilation CFD case V-07 before ranking the risk.',
    decisionShort: 'Confirm flow direction at the seats (CFD V-07)',
    from: [RV.saffire1ds, RV.saffire1],
  },
  {
    id: RV.c3,
    short: 'C3',
    title: 'PMMA pane: slow but persistent flame',
    confidence: 'Lower bound — 2-9 material cell blank, verify',
    data: [{ node: RV.saffire2ds, alt: RV.saffire2, text: 'Saffire-II 2-8 / 2-9: anchored flame, regression 0.01–0.04 mm/s, 600–900 s burning' }],
    rover: 'Viewport pane: cast PMMA 6.0 mm with acrylic hard coat',
    decision: 'Treat the pane as a long-lived fuel, not a fast spreader — keep ignition sources away from its edges and frame.',
    decisionShort: 'Keep ignition sources away from the pane edges',
    from: [RV.saffire2ds, RV.saffire2],
  },
]

export function conclusionsReply(sessionId: string): ScriptedReply {
  const s = sess(sessionId)
  if (!s?.nodes.some((n) => n.id === RV.saffire2)) {
    return { text: 'There is no measured evidence on the canvas yet. Ask me to find the closest PSI evidence first, then I can draw conclusions from the rows.' }
  }
  return {
    apply: () => {
      for (const c of CONCLUSIONS) {
        upsertNode(sessionId, node('conclusion', c.id, { label: `${c.short} · ${c.title}`, hint: c.decision, provenance: 'agent', badge: 'decision' }))
        // link to the most specific evidence on the canvas (table, else investigation)
        const src = c.from.find((f) => sess(sessionId)?.nodes.some((n) => n.id === f))
        if (src) upsertEdge(sessionId, src, c.id, 'supports')
      }
    },
    text:
      'Engineering conclusions from the measured rows. The Saffire tests ran at ~22 % O₂; your cabin is at 30 %. More oxygen makes ignition and flame spread easier (general combustion behaviour, not taken from these tables), so treat these rows as a lower bound — the rover materials should burn at least this readily. Airflow (20 cm/s) is inside your 5–20 cm/s range.\n\n' +
      CONCLUSIONS.map((c) => `${c.short} · ${c.title}\nData: ${c.data[0].text}\nRover: ${c.rover}\n→ ${c.decision}`).join('\n\n') +
      '\n\nC4 · Not answerable from PSI data: behaviour at 30 % O₂ and 1/6 g\n→ Plan mission-specific material testing at 30 % O₂ / 10.2 psia and keep partial gravity as an open item.',
    chips: CONCLUSIONS.map((c) => ({ nodeId: c.id, label: `${c.short} · ${c.title}` })),
    links: [{ view: 'visualize', label: 'Evidence figures in Visualize' }],
    highlight: [RV.c1, RV.c2, RV.c3],
  }
}

/* ——— step 6: next engineering actions ——— */

export const NEXT_ACTIONS = [
  'Verify cabin pressure and fan-flow values against the signed design basis (PLR-DB-001 Rev B).',
  'C1 — evaluate a lower-flammability seat textile or reduced airflow at the seats; keep fans-off on smoke alarm (< 5 s) as a critical requirement.',
  'C2 — confirm the flow direction at the seats in ventilation CFD case V-07 before ranking the risk.',
  'C3 — keep ignition sources away from the PMMA pane edges and frame; detection must catch a small, steady flame.',
  'Retrieve the Saffire-II report (PSI-99) for the PMMA notes, the blank material cell in row 2-9 and the "?-g" headers.',
  'Plan mission-specific material testing at 30 % O₂ / 10.2 psia and log 1/6 g as an open item — no PSI data covers these conditions.',
]

export function nextActionsReply(sessionId: string): ScriptedReply {
  return {
    apply: () => {
      upsertNode(sessionId, node('gap', RV.gap, {
        label: 'Uncovered: 30 % O₂ · 1/6 g',
        hint: 'No PSI solid-material test covers 30 % O₂ or partial gravity. An evidence gap — not a predicted failure.',
        provenance: 'agent',
        badge: 'evidence gap',
      }))
      upsertEdge(sessionId, RV.root, RV.gap, 'uncovered condition')
      upsertEdge(sessionId, RV.saffire2, RV.gap, 'tested at ~22 % O₂ only')
      const b = sess(sessionId)?.branches.find((x) => x.name === BRANCH_NAME)
      if (b && !b.nodeIds.includes(RV.gap)) {
        useAppStore.setState((s0) => ({
          sessions: s0.sessions.map((x) =>
            x.id === sessionId
              ? { ...x, branches: x.branches.map((y) => (y.id === b.id ? { ...y, nodeIds: [...y.nodeIds, RV.gap] } : y)) }
              : x,
          ),
        }))
      }
    },
    text:
      'Proposed next engineering actions — an evidence-backed to-do list, not a clearance decision:\n\n' +
      NEXT_ACTIONS.map((a, i) => `${i + 1}. ${a}`).join('\n') +
      '\n\nI marked the uncovered condition on the canvas in red as an open issue.',
    chips: [{ nodeId: RV.gap, label: 'Evidence gap' }, { nodeId: RV.saffire2ds, label: 'SAFFIRE-2 table' }],
    hrefs: [{ label: 'Saffire-II report (PSI-99)', href: PSI_URL('PSI-99') }, { label: 'DOI 10.60555/2chp-m469', href: `https://doi.org/${DOI['PSI-99']}` }],
    links: [{ view: 'visualize', label: 'Evidence figures in Visualize' }],
    highlight: [RV.gap],
  }
}

export function safetyVerdictReply(): ScriptedReply {
  return {
    text:
      'I can’t label the rover materials safe or unsafe, and I won’t give a risk percentage. The PSI bundle has no lunar-gravity material test, no PMMA or SIBAL result at 30 % O₂, and no calibrated rover-risk model.\n\nWhat the data does support: Saffire-II (PSI-99) rows 2-5, 2-8, 2-9 show both materials burning at ~22 % O₂ — a lower bound for 30 %. Ask me to "draw conclusions" for the decisions this supports.',
    chips: [{ nodeId: RV.saffire2ds, label: 'SAFFIRE-2 table' }],
  }
}

export function goalFirstReply(): ScriptedReply {
  return {
    text: 'Let’s define the goal of this review first — what should the evidence answer? Use the goal card in the middle of the canvas; then I can search the PSI index against it.',
  }
}

export function helpReply(): ScriptedReply {
  return {
    text:
      'For this review I can:\n• find the closest PSI evidence for the rover materials and compare O₂, flow, geometry and results,\n• draw engineering conclusions from the measured rows,\n• build the "30 % O₂ rover material evidence" branch,\n• propose next engineering actions,\n• add a suppression (FLEX) or detection (SAME / DAFT) follow-up.\n\nUpload the design basis and BOM PDFs with "Add data" on the right.',
  }
}

/* ——— rover inputs for comparisons ——— */

export function roverInputs(session: Session) {
  const get = (id: string) => session.nodes.find((n) => n.id === id)?.data
  const val = (id: string) => {
    const d = get(id)
    if (!d || !d.value) return { text: 'Unknown — not stated or not confirmed', prov: 'unknown' as Provenance }
    return { text: d.value, prov: (d.provenance ?? 'engineer') as Provenance }
  }
  return {
    gravity: val(RV.g),
    o2: val(RV.o2),
    pressure: val(RV.p),
    flow: val(RV.flow),
    pmma: get(RV.pmma),
    textile: get(RV.textile),
  }
}
