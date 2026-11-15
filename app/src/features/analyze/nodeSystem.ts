import type { NodeKind, SafetyArea } from '../../types'

/* ————————————————————————————————————————————
   Visual system for graph nodes & the palette.
   Color, icon, and short label per node kind.
   ———————————————————————————————————————————— */

export interface NodeKindMeta {
  kind: NodeKind
  label: string
  plural: string
  color: string
  /** css class for node fill/ring */
  ring: string
  text: string
  /** short description shown in palette */
  desc: string
  /** whether palette "add" creates this kind */
  addable: boolean
}

export const KIND_META: Record<NodeKind, NodeKindMeta> = {
  researchQuestion: {
    kind: 'researchQuestion',
    label: 'Research question',
    plural: 'Research questions',
    color: '#0b3d91',
    ring: 'border-[#0b3d91] text-[#9cc3ff]',
    text: 'text-[#9cc3ff]',
    desc: 'Anchor the session around a problem statement.',
    addable: true,
  },
  investigation: {
    kind: 'investigation',
    label: 'Investigation',
    plural: 'Investigations',
    color: '#4da3ff',
    ring: 'border-[#4da3ff] text-bright',
    text: 'text-bright',
    desc: 'A PSI flight or ground investigation (e.g. FLEX, Saffire).',
    addable: true,
  },
  safetyArea: {
    kind: 'safetyArea',
    label: 'Safety area',
    plural: 'Safety areas',
    color: '#7a8bff',
    ring: 'border-[#7a8bff] text-[#a5b1ff]',
    text: 'text-[#a5b1ff]',
    desc: 'Prevention, detection, suppression, or supporting.',
    addable: true,
  },
  material: {
    kind: 'material',
    label: 'Material / fuel',
    plural: 'Materials & fuels',
    color: '#ffb454',
    ring: 'border-amber text-amber',
    text: 'text-amber',
    desc: 'Fuels and materials studied across investigations.',
    addable: true,
  },
  hardware: {
    kind: 'hardware',
    label: 'Hardware',
    plural: 'Hardware',
    color: '#7a8bff',
    ring: 'border-[#7a8bff] text-[#a5b1ff]',
    text: 'text-[#a5b1ff]',
    desc: 'Racks, gloveboxes, and apparatus used.',
    addable: true,
  },
  platform: {
    kind: 'platform',
    label: 'Platform',
    plural: 'Platforms & missions',
    color: '#9ad84a',
    ring: 'border-lime text-lime',
    text: 'text-lime',
    desc: 'Where the experiment flew (ISS, Cygnus, ground).',
    addable: true,
  },
  environment: {
    kind: 'environment',
    label: 'Environment',
    plural: 'Crew environments',
    color: '#3ad7a3',
    ring: 'border-teal text-teal',
    text: 'text-teal',
    desc: 'Habitat atmospheres: ISS, lunar base, spacesuit…',
    addable: true,
  },
  incident: {
    kind: 'incident',
    label: 'Incident',
    plural: 'Historical incidents',
    color: '#ff6b6b',
    ring: 'border-flame text-flame',
    text: 'text-flame',
    desc: 'Real fires that shaped fire-safety priorities.',
    addable: true,
  },
  dataset: {
    kind: 'dataset',
    label: 'Dataset',
    plural: 'Datasets',
    color: '#3ad7a3',
    ring: 'border-teal text-teal',
    text: 'text-teal',
    desc: 'Experimental tables derived from PSI.',
    addable: true,
  },
  publication: {
    kind: 'publication',
    label: 'Publication',
    plural: 'Publications',
    color: '#8b95a5',
    ring: 'border-dim text-dim',
    text: 'text-dim',
    desc: 'Peer-reviewed papers tied to investigations.',
    addable: true,
  },
  note: {
    kind: 'note',
    label: 'Note',
    plural: 'Notes',
    color: '#e9eef5',
    ring: 'border-text text-text',
    text: 'text-text',
    desc: 'Free-form research note or annotation.',
    addable: true,
  },
  externalSource: {
    kind: 'externalSource',
    label: 'External source',
    plural: 'External sources',
    color: '#9ad84a',
    ring: 'border-lime text-lime',
    text: 'text-lime',
    desc: 'Standards, documents, or MCP-linked data.',
    addable: true,
  },
  missionParam: {
    kind: 'missionParam',
    label: 'Mission input',
    plural: 'Mission inputs',
    color: '#4da3ff',
    ring: 'border-bright text-bright',
    text: 'text-bright',
    desc: 'Engineer-provided mission assumption — an input, not an experimental result.',
    addable: false,
  },
  conclusion: {
    kind: 'conclusion',
    label: 'Conclusion',
    plural: 'Conclusions',
    color: '#7a8bff',
    ring: 'border-violet text-[#a5b1ff]',
    text: 'text-[#a5b1ff]',
    desc: 'Engineering conclusion drawn from measured rows — agent interpretation with a decision.',
    addable: false,
  },
  gap: {
    kind: 'gap',
    label: 'Evidence gap',
    plural: 'Evidence gaps',
    color: '#ff6b6b',
    ring: 'border-flame text-flame',
    text: 'text-flame',
    desc: 'Unresolved issue / uncovered condition — not a predicted failure.',
    addable: false,
  },
}

/** Provenance styling — measured vs engineer input vs agent vs unknown. */
export const PROVENANCE_META: Record<string, { label: string; cls: string }> = {
  measured: { label: 'Measured · PSI', cls: 'border-teal/50 bg-teal/10 text-teal' },
  engineer: { label: 'Engineer input', cls: 'border-bright/50 bg-bright/10 text-bright' },
  provisional: { label: 'Provisional', cls: 'border-amber/50 bg-amber/10 text-amber' },
  unknown: { label: 'Unknown', cls: 'border-dashed border-faint bg-transparent text-dim' },
  agent: { label: 'Agent interpretation', cls: 'border-violet/50 bg-violet/10 text-[#a5b1ff]' },
  context: { label: 'Context · different fuel', cls: 'border-[#a78bfa]/50 bg-[#a78bfa]/10 text-[#c4b5fd]' },
}

export const SAFETY_AREA_LABELS: Record<SafetyArea, string> = {
  prevention: 'Prevention',
  detection: 'Detection',
  suppression: 'Suppression',
  supporting: 'Supporting',
}

export const safetyAreaColor: Record<SafetyArea, string> = {
  prevention: '#4da3ff',
  detection: '#7a8bff',
  suppression: '#ff6b6b',
  supporting: '#8b95a5',
}

export const EDGE_LABELS: Record<string, string> = {
  FILED_UNDER: 'filed under',
  STUDIES: 'studies',
  USED: 'used',
  FLOWN_ON: 'flown on',
  TARGETS: 'targets',
  PRODUCED: 'produced',
  DERIVED_FROM: 'derived from',
  MOTIVATED_BY: 'motivated by',
  RELEVANT_TO: 'relevant to',
  CITED_IN: 'cited in',
  RELATES_TO: 'relates to',
  INDEXED_IN: 'indexed in',
}

/** The palette groups, in display order. */
export const PALETTE_GROUPS: { title: string; kinds: NodeKind[] }[] = [
  { title: 'Problem', kinds: ['researchQuestion', 'note'] },
  { title: 'Investigations', kinds: ['investigation'] },
  { title: 'Science & data', kinds: ['safetyArea', 'material', 'dataset'] },
  { title: 'Systems', kinds: ['hardware', 'platform', 'environment'] },
  { title: 'Context', kinds: ['incident', 'publication', 'externalSource'] },
]
