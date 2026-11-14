import type { GraphEdge, GraphNode, NodeKind, Session } from '../../types'
import { INVESTIGATIONS } from '../../generated/investigations'
import { DATASETS } from '../../generated/datasets'

/* ————————————————————————————————————————————
   Session seeder. Builds a demo "Moon base fire
   scenario" session and a fresh-session starter.
   ———————————————————————————————————————————— */

let seq = 0
const nid = (kind: string, ref: string) => `n_${kind}_${ref}`

function inv(acc: string) {
  return INVESTIGATIONS.find((i) => i.accession === acc)!
}

const positions = {
  root: { x: 460, y: 260 },
  flex: { x: 700, y: 140 },
  saffire: { x: 720, y: 300 },
  cfig: { x: 700, y: 455 },
  bass2: { x: 940, y: 200 },
  sibie: { x: 980, y: 400 },
  moon: { x: 180, y: 260 },
  bre: { x: 100, y: 100 },
  flexds: { x: 1050, y: 90 },
  prevention: { x: 460, y: 30 },
}

function graphNode(
  kind: NodeKind,
  ref: string,
  label: string,
  hint: string,
  position: { x: number; y: number },
): GraphNode {
  return { id: nid(kind, ref), type: kind, position, data: { kind, ref, label, hint } }
}

export function buildDemoSession(): Session {
  seq = 0
  const f = inv('PSI-69')
  const s = inv('PSI-98')
  const c = inv('PSI-159')
  const b = inv('PSI-25')
  const moon = { id: 'env_moon', name: 'Lunar base & pressurized rover (planned)' }
  const flexds = DATASETS.find((d) => d.accession === 'PSI-69')

  const nodes: GraphNode[] = [
    graphNode('researchQuestion', 'sg_q', 'How oxygen-enriched are lunar-habitat atmospheres — and which materials keep burning?', 'Session anchor — the problem statement.', positions.root),
    graphNode('investigation', f.accession, 'FLEX', `${f.nTests} droplet tests · O₂ 12–34 % · extinction 186/274`, positions.flex),
    graphNode('investigation', s.accession, 'Saffire-I', `${s.nTests} large-sample tests · SIBAL fabric · 21.5 % O₂`, positions.saffire),
    graphNode('investigation', c.accession, 'CFI-G', `${c.nTests} tests · O₂ up to 85 % · moon-relevant`, positions.cfig),
    graphNode('investigation', b.accession, 'BASS-II', `${b.nTests} solid-fuel tests · O₂ 13.6–22.2 %`, positions.bass2),
    graphNode('dataset', flexds?.id ?? 'ds_psi69', 'FLEX table', `${flexds?.rows ?? 274} test rows · conditions + outcomes`, positions.flexds),
    graphNode('environment', 'env_moon', moon.name, `${moon.id}`, positions.moon),
  ]

  const edges: GraphEdge[] = [
    { id: `e_${++seq}`, source: nid('researchQuestion', 'sg_q'), target: nid('investigation', f.accession), label: 'suppresses how?', type: 'RELATES_TO' },
    { id: `e_${++seq}`, source: nid('researchQuestion', 'sg_q'), target: nid('investigation', s.accession), label: 'materials at', type: 'RELATES_TO' },
    { id: `e_${++seq}`, source: nid('researchQuestion', 'sg_q'), target: nid('investigation', c.accession), label: 'oxygen ceiling', type: 'RELATES_TO' },
    { id: `e_${++seq}`, source: nid('investigation', f.accession), target: nid('dataset', flexds?.id ?? 'ds_psi69'), label: 'produced', type: 'PRODUCED' },
    { id: `e_${++seq}`, source: nid('researchQuestion', 'sg_q'), target: nid('environment', 'env_moon'), label: 'targets', type: 'TARGETS' },
  ]

  const demo: Session = {
    id: `ses_demo_${Date.now().toString(36)}`,
    name: 'Moon base fire scenario',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    researchStatement:
      'Lunar habitats operate at higher oxygen (≥ 30 %) and lower pressure (≤ 10.2 psia) than ISS. Which PSI investigations constrain the flammability of crew-habitat materials under those conditions — and what does suppression look like there?',
    nodes,
    edges,
    branches: [
      { id: 'br_materials', name: 'Material flammability', nodeIds: [nid('investigation', s.accession), nid('investigation', b.accession), nid('researchQuestion', 'sg_q')], color: '#ffb454' },
    ],
    messages: [
      {
        id: 'm0',
        role: 'agent',
        text: 'I have the full PSI combustion index — investigations, test condition ranges, datasets, and the links between them. I can add nodes, build branches, and pull supporting records from Explore.',
        at: Date.now(),
        chips: [],
      },
    ],
  }
  return demo
}

export function buildFreshSession(name: string, researchStatement: string): Session {
  // Fresh session: just the research-question anchor node.
  const id = `ses_new_${Date.now().toString(36)}`
  const root = graphNode(
    'researchQuestion',
    'sg_anchor',
    researchStatement || 'Define the research problem…',
    'Session anchor — the problem statement. Edit it any time.',
    { x: 460, y: 260 },
  )
  return {
    id,
    name: name || 'Untitled session',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    researchStatement,
    nodes: [root],
    edges: [],
    branches: [],
    messages: [],
  }
}
