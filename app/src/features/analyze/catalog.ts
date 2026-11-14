import { NODES, NODE_INDEX } from '../../generated/graph'
import { DATASETS } from '../../generated/datasets'
import { INVESTIGATIONS } from '../../generated/investigations'
import type { GraphNode, NodeKind } from '../../types'

/* ————————————————————————————————————————————
   Catalog: resolves generated graph nodes into
   palette entries / chat chips / canvas additions.
   ———————————————————————————————————————————— */

export interface CatalogEntry {
  /** the generated graph node id (stable across sessions) */
  stableId: string
  kind: NodeKind
  ref: string
  label: string
  hint: string
}

/** All catalog entries, grouped by kind, in a stable order. */export function catalogByKind(): Partial<Record<NodeKind, CatalogEntry[]>> {
  const out: Partial<Record<NodeKind, CatalogEntry[]>> = {}
  for (const n of NODES) {
    const kind = n.kind as NodeKind
    if (!out[kind]) out[kind] = []
    out[kind]!.push({ stableId: n.id, kind, ref: n.ref, label: n.label, hint: n.hint })
  }
  // sort investigations by relevance, others alphabetically
  for (const kind of Object.keys(out) as NodeKind[]) {
    out[kind]!.sort((a, b) => {
      if (kind === 'investigation') {
        const ai = INVESTIGATIONS.find((i) => i.accession === a.ref)
        const bi = INVESTIGATIONS.find((i) => i.accession === b.ref)
        return (bi?.relevance ?? 0) - (ai?.relevance ?? 0)
      }
      if (kind === 'material' || kind === 'hardware') return a.label.localeCompare(b.label)
      return a.label.localeCompare(b.label)
    })
  }
  return out
}

const CATALOG = catalogByKind()

export function catalogForKind(kind: NodeKind): CatalogEntry[] {
  return CATALOG[kind] ?? []
}

/** Instantly add a catalog node to the session canvas at a position, reusing expand. */
export function entryToGraphNode(entry: CatalogEntry, position: { x: number; y: number }): GraphNode {
  return {
    id: entry.stableId,
    type: entry.kind,
    position,
    data: { kind: entry.kind, ref: entry.ref, label: entry.label, hint: entry.hint },
  }
}

/** Find the entity record attached to a node (investigation or dataset). */
export function entityForNode(node: { kind: string; ref: string }) {
  if (node.kind === 'investigation') return INVESTIGATIONS.find((i) => i.accession === node.ref)
  if (node.kind === 'dataset') return DATASETS.find((d) => d.id === node.ref)
  // dataset nodes created from a dataset id may arrive with ref = id
  const byId = DATASETS.find((d) => d.id === node.ref)
  if (byId) return byId
  return undefined
}

/** Resolve a stableId to its catalog entry (used when hydrating chat chips). */
export function entryForStableId(stableId: string): CatalogEntry | undefined {
  const def = NODE_INDEX[stableId]
  if (!def) return undefined
  return { stableId: def.id, kind: def.kind, ref: def.ref, label: def.label, hint: def.hint }
}

let seqForNew = 0
export const newId = (kind: NodeKind, ref: string) =>
  `n_${kind}_${ref}_${++seqForNew}_${Date.now().toString(36)}`
