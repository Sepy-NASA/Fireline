import type { GraphNode, NodeKind, Session } from '../../types'
import { buildRoverSession } from './roverScenario'

/* ————————————————————————————————————————————
   Session seeder. The demo session is the
   lunar-rover cabin material evidence review
   (see roverScenario.ts).
   ———————————————————————————————————————————— */

const nid = (kind: string, ref: string) => `n_${kind}_${ref}`

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
  return buildRoverSession()
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
