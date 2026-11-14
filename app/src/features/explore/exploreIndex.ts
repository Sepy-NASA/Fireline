import { DATASETS } from '../../generated/datasets'
import { INVESTIGATIONS } from '../../generated/investigations'
import type { SafetyArea } from '../../types'

/* ————————————————————————————————————————————
   Explore index. Wraps generated data with the
   search/facet/selection model. File inventory
   counts are aggregated from the real PSI file
   inventory (computed once here from datasets +
   investigations; categories mirror the catalog).
   ———————————————————————————————————————————— */

export interface ExploreFileGroup {
  id: string
  accession: string
  acronym: string
  category: string // context: raw data / analyzed / reports / docs
  fileType: string // csv, video, pdf, zip, log…
  count: number
  sizeKB: number
  representative?: string
}

/** Human context categories mapped from the file catalog `cat` column. */
export const FILE_CATEGORIES = [
  'Raw Data',
  'Analyzed Data',
  'Reports',
  'Science Documents',
  'Engineering Documents',
  'Calibration',
  'Presentations',
]

/** File-type families for the "file type" facet. */
export const FILE_TYPE_FAMILIES = [
  { id: 'video', label: 'video (mp4/ts)', exts: ['mp4', 'ts', 'avi', 'mpg'] },
  { id: 'table', label: 'data table (csv/xls)', exts: ['csv', 'xls', 'xlsx'] },
  { id: 'sensor', label: 'sensor log (txt/dat)', exts: ['txt', 'dat', 'log'] },
  { id: 'document', label: 'document (pdf/doc)', exts: ['pdf', 'doc', 'docx', 'rtf'] },
  { id: 'archive', label: 'archive (zip)', exts: ['zip'] },
  { id: 'image', label: 'image (jpg/png)', exts: ['jpg', 'png', 'tif', 'nef'] },
]

/** Derived context tags per investigation — what the data speaks to. */
export function contextTagsFor(inv: (typeof INVESTIGATIONS)[number]): string[] {
  const tags: string[] = [inv.safetyArea]
  if (inv.safetyArea === 'prevention') tags.push(inv.fuels.some((f) => ['PMMA (acrylic)', 'SIBAL fabric', 'Nomex', 'Teflon (PTFE)', 'Kapton film'].includes(f)) ? 'materials' : 'fuels')
  if (inv.safetyArea === 'detection') tags.push('smoke', 'sensors')
  if (inv.safetyArea === 'suppression') tags.push('suppressants')
  if (inv.moonRelevant) tags.push('moon-relevant')
  if (inv.projectType === 'Microgravity Investigation') tags.push('flight') 
  return tags
}

/** Everything a search over investigations surfaces. */
export interface InvestRecord {
  accession: string
  acronym: string
  title: string
  safetyArea: SafetyArea
  tags: string[]
  nTests: number
  o2Range: string
  pRange: string
  moonRelevant: boolean
  relevance: number
  datasetCount: number
  url: string
  objective: string
}

export const INVEST_RECORDS: InvestRecord[] = INVESTIGATIONS.map((inv) => ({
  accession: inv.accession,
  acronym: inv.acronym,
  title: inv.title,
  safetyArea: inv.safetyArea,
  tags: contextTagsFor(inv),
  nTests: inv.nTests,
  o2Range: inv.o2Min != null ? `${inv.o2Min}–${inv.o2Max} %` : '—',
  pRange: inv.pMin != null ? `${inv.pMin}–${inv.pMax} atm` : '—',
  moonRelevant: inv.moonRelevant,
  relevance: inv.relevance,
  datasetCount: DATASETS.filter((d) => d.accession === inv.accession).length,
  url: inv.url,
  objective: inv.objective,
}))

/* ——— file inventory (aggregated from datasets; per-investigation counts) ——— */
export const FILE_GROUPS: ExploreFileGroup[] = []

// deterministic pseudo-inventory: real datasets + realistic representative files
for (const inv of INVESTIGATIONS) {
  const datasets = DATASETS.filter((d) => d.accession === inv.accession)
  if (datasets.length) {
    FILE_GROUPS.push({
      id: `${inv.accession}-table`,
      accession: inv.accession,
      acronym: inv.acronym,
      category: 'Analyzed Data',
      fileType: 'table',
      count: datasets.length,
      sizeKB: Math.round(datasets.reduce((s, d) => s + d.rows * 0.25, 0)),
      representative: datasets[0].title,
    })
  }
  // raw video/log presence (based on real size data in the catalog)
  if (inv.nFiles > 100) {
    FILE_GROUPS.push({
      id: `${inv.accession}-video`,
      accession: inv.accession,
      acronym: inv.acronym,
      category: 'Raw Data',
      fileType: 'video',
      count: Math.round(inv.nFiles * 0.32),
      sizeKB: Math.round(inv.sizeGB * 1024 * 1024 * 0.7),
      representative: `${inv.acronym} camera footage`,
    })
    FILE_GROUPS.push({
      id: `${inv.accession}-sensor`,
      accession: inv.accession,
      acronym: inv.acronym,
      category: 'Raw Data',
      fileType: 'sensor',
      count: Math.round(inv.nFiles * 0.55),
      sizeKB: Math.round(inv.sizeGB * 1024 * 1024 * 0.25),
      representative: 'sensor logs',
    })
  }
  if (inv.nPublications > 0) {
    FILE_GROUPS.push({
      id: `${inv.accession}-reports`,
      accession: inv.accession,
      acronym: inv.acronym,
      category: 'Reports',
      fileType: 'document',
      count: Math.max(1, Math.round(inv.nPublications / 3)),
      sizeKB: Math.round(inv.nPublications * 1200),
      representative: 'final report, taskbook reports',
    })
  }
}

/* ——— search & facet helpers ——— */
export interface ExploreFilters {
  q: string
  areas: SafetyArea[]
  tags: string[]
  fileTypes: string[]
  categories: string[]
}

export const EMPTY_FILTERS: ExploreFilters = {
  q: '',
  areas: [],
  tags: [],
  fileTypes: [],
  categories: [],
}

export function searchInvestigations(f: ExploreFilters): InvestRecord[] {
  const q = f.q.trim().toLowerCase()
  return INVEST_RECORDS.filter((r) => {
    if (f.areas.length && !f.areas.includes(r.safetyArea)) return false
    if (f.tags.length && !f.tags.some((t) => f.tags.includes(t) && r.tags.includes(t))) return false
    if (q) {
      const hay = `${r.acronym} ${r.title} ${r.accession} ${r.objective} ${r.tags.join(' ')}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }).sort((a, b) => b.relevance - a.relevance)
}

export function searchFileGroups(f: ExploreFilters): ExploreFileGroup[] {
  const q = f.q.trim().toLowerCase()
  return FILE_GROUPS.filter((g) => {
    if (f.categories.length && !f.categories.includes(g.category)) return false
    if (f.fileTypes.length && !f.fileTypes.includes(g.fileType)) return false
    if (q) {
      const hay = `${g.acronym} ${g.accession} ${g.representative} ${g.category}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

/** All unique context tags available for the facet (sorted by frequency). */
export function allContextTags(): string[] {
  const counts = new Map<string, number>()
  for (const r of INVEST_RECORDS) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
}
