import { useAppStore } from '../../store/appStore'
import { newId } from '../analyze/catalog'
import { buildDemoSession } from '../analyze/sessionSeed'
import { INVESTIGATIONS } from '../../generated/investigations'
import type { EdgeKind, GraphNode, NodeKind, Session } from '../../types'

/* ————————————————————————————————————————————
   Push Explore records onto the Analyze canvas
   (active session). Adds the parent investigation
   too, wired with a PRODUCED edge, so the item
   lands in context.
   ———————————————————————————————————————————— */

export interface AnalyzeItem {
  kind: NodeKind
  ref: string
  label: string
  hint: string
  /** parent investigation accession */
  accession?: string
}

/** Make sure there is an active session to add to; returns it. */
function ensureSession(): Session {
  const st = useAppStore.getState()
  let session = st.sessions.find((s) => s.id === st.activeSessionId)
  if (session) return session
  if (st.sessions.length) {
    session = st.sessions[0]
    st.setActiveSession(session.id)
    return session
  }
  // same seed Analyze would create on first open
  const demo = buildDemoSession()
  useAppStore.setState((s) => ({ sessions: [demo, ...s.sessions], activeSessionId: demo.id }))
  return demo
}

const randomPos = () => ({ x: 320 + Math.random() * 520, y: 100 + Math.random() * 360 })
let edgeSeq = 0
const edgeId = () => `e_x_${Date.now().toString(36)}_${++edgeSeq}`

/** Is a record (by ref) already on the active session's canvas? */
export function isInAnalyze(session: Session | null | undefined, ref: string): boolean {
  return !!session?.nodes.some((n) => n.data.ref === ref)
}

/** Add items to the active Analyze session. Returns the ids of the nodes now representing them. */
export function addToAnalyze(items: AnalyzeItem[]): string[] {
  const session = ensureSession()
  const st = useAppStore.getState()
  const sid = session.id
  // live view of nodes we add during this call
  const nodes: GraphNode[] = [...session.nodes]
  const touched: string[] = []

  const findByRef = (ref: string) => nodes.find((n) => n.data.ref === ref)
  const put = (kind: NodeKind, ref: string, label: string, hint: string): { node: GraphNode; fresh: boolean } => {
    const existing = findByRef(ref)
    if (existing) return { node: existing, fresh: false }
    const node: GraphNode = { id: newId(kind, ref), type: kind, position: randomPos(), data: { kind, ref, label, hint } }
    st.addNode(sid, node)
    nodes.push(node)
    return { node, fresh: true }
  }
  const link = (source: string, target: string, type: EdgeKind, label: string) =>
    st.addEdge(sid, { id: edgeId(), source, target, type, label })

  const anchor = nodes.find((n) => n.type === 'researchQuestion')

  for (const item of items) {
    let parentId: string | null = null
    if (item.accession && item.ref !== item.accession) {
      const inv = INVESTIGATIONS.find((i) => i.accession === item.accession)
      if (inv) {
        const p = put('investigation', inv.accession, inv.acronym, `${inv.title} — ${inv.nTests} tests`)
        parentId = p.node.id
        if (p.fresh && anchor) link(anchor.id, p.node.id, 'RELATES_TO', 'relates to')
        touched.push(p.node.id)
      }
    }
    const { node, fresh } = put(item.kind, item.ref, item.label, item.hint)
    if (fresh) {
      if (parentId) link(parentId, node.id, 'PRODUCED', 'produced')
      else if (anchor) link(anchor.id, node.id, 'RELATES_TO', 'relates to')
    }
    touched.push(node.id)
  }

  st.setHighlight([...new Set(touched)], 2400)
  return touched
}
