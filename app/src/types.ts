/* ————————————————————————————————————————————
   Fireline domain model
   Shared by: curated knowledge, generated data,
   the zustand store, and all feature views.
   ———————————————————————————————————————————— */

export type View = 'analyze' | 'explore' | 'visualize' | 'vr'

export type SafetyArea = 'prevention' | 'detection' | 'suppression' | 'supporting'

export type NodeKind =
  | 'researchQuestion'
  | 'investigation'
  | 'safetyArea'
  | 'material'
  | 'hardware'
  | 'platform'
  | 'environment'
  | 'incident'
  | 'dataset'
  | 'publication'
  | 'note'
  | 'externalSource'
  | 'missionParam'
  | 'gap'

/** Where a statement on the canvas comes from — kept visually distinct. */
export type Provenance = 'measured' | 'engineer' | 'provisional' | 'unknown' | 'agent' | 'context'

export type EdgeKind =
  | 'FILED_UNDER'
  | 'STUDIES'
  | 'USED'
  | 'FLOWN_ON'
  | 'TARGETS'
  | 'PRODUCED'
  | 'DERIVED_FROM'
  | 'MOTIVATED_BY'
  | 'RELEVANT_TO'
  | 'CITED_IN'
  | 'RELATES_TO'
  | 'INDEXED_IN'

/* ——— entities ——— */

export interface Investigation {
  accession: string
  acronym: string
  title: string
  subArea: string
  projectType: string
  platform: string
  hardware: string
  start: string
  end: string
  related: string
  nFiles: number
  sizeGB: number
  hasExperimentalTable: boolean
  nAnalyzed: number
  nPublications: number
  doi: string
  url: string
  objective: string
  approach: string
  hypothesis: string
  researchImpacts: string
  publications: { title: string; authors: string; doi: string }[]
  /* derived */
  safetyArea: SafetyArea
  fuels: string[]
  fuelIds: string[]
  nTests: number
  o2Min: number | null
  o2Max: number | null
  pMin: number | null
  pMax: number | null
  flowMin: number | null
  flowMax: number | null
  moonRelevant: boolean
  dataQuality: string[]
  relevance: number
  relevanceReasons: string[]
}

export interface Dataset {
  id: string
  accession: string
  title: string
  rows: number
  columns: string[]
  fileName: string
  sample: Record<string, string>[]
  numeric: Record<
    string,
    { min: number | null; max: number | null; count: number; unit: string; isO2: boolean; isPressure: boolean; isFlow: boolean }
  >
  ranges: {
    o2: { min: number; max: number; unit: string } | null
    pressure: { min: number; max: number; unit: string } | null
    flow: { min: number; max: number; unit: string } | null
  }
}

export interface MaterialEntity {
  id: string
  name: string
  kind: 'solid' | 'liquid' | 'gas' | 'dust'
  note: string
}

export interface HardwareEntity {
  id: string
  name: string
  facility: string
  note: string
}

export interface PlatformEntity {
  id: string
  name: string
  kind: string
  note: string
}

export interface EnvironmentEntity {
  id: string
  name: string
  pressure: string
  o2: string
  note: string
  kind: 'flown' | 'planned' | 'chamber'
}

export interface IncidentEntity {
  id: string
  name: string
  year: string
  summary: string
  lesson: string
  source: string
}

/* ——— graph ——— */

export interface GraphNodeData {
  kind: NodeKind
  /** display label */
  label: string
  /** accession / id / slug */
  ref: string
  /** short tooltip fact */
  hint: string
  /** route to the entity record */
  entity?: Investigation | Dataset
  /** provenance badge shown under the node (scenario nodes) */
  provenance?: Provenance
  /** short tag under the node, e.g. "different fuel" */
  badge?: string
  /** override the kind color (e.g. violet for context evidence) */
  color?: string
  /** current value for mission-parameter / material nodes */
  value?: string
  /** extracted fields from an engineer document (mock upload) */
  fields?: { label: string; value: string; source: string; status: 'confirmed' | 'provisional' | 'unknown' }[]
  /** engineer judgement: how the rover material relates to tested rows */
  match?: 'unassessed' | 'same-family' | 'analogue'
}

export interface GraphEdgeData {
  kind: EdgeKind
  label: string
}

/* ——— sessions & working set ——— */

export interface Session {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  researchStatement: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  branches: Branch[]
  messages: ChatMessage[]
}

export interface GraphNode {
  id: string
  type: NodeKind
  position: { x: number; y: number }
  data: GraphNodeData
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label: string
  type: EdgeKind
}

export interface Branch {
  id: string
  name: string
  nodeIds: string[]
  color: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  text: string
  at: number
  /** interactive node chips attached to an agent reply */
  chips?: { nodeId: string; label: string }[]
  /** view-links attached to an agent reply */
  links?: { view: View; label: string; ref?: string }[]
  /** external source links (PSI records, tables) */
  hrefs?: { label: string; href: string }[]
}

/* ——— working set (cross-view selection) ——— */

export interface WorkingItem {
  id: string
  type: 'dataset' | 'investigation' | 'file'
  ref: string
  label: string
  sub: string
  tags: string[]
}

export interface WorkingGroup {
  id: string
  name: string
  itemIds: string[]
}
