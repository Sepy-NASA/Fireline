import { DATASETS } from '../../generated/datasets'
import { INVESTIGATIONS } from '../../generated/investigations'
import type { Dataset, SafetyArea } from '../../types'

/* ————————————————————————————————————————————
   Explore index. Wraps generated data with the
   search/facet/selection model.

   · Data tab  → one record per experimental table
                 (DATASETS), enriched with its
                 investigation.
   · Files tab → one record per *file* from the real
                 PSI file inventory (lazy-loaded from
                 ./data/fileInventory.json).
   ———————————————————————————————————————————— */

/** Human context categories from the PSI file inventory `cat` column. */
export const FILE_CATEGORIES = [
  'Raw Data',
  'Analyzed Data',
  'Reports',
  'Science Documents',
  'Engineering Documents',
  'Calibration',
  'Presentations',
  'Reference Data',
  'Experimental table',
  'Representative Image(s)',
  'metadata',
]

/** File-type families for the "file type" facet. */
export const FILE_TYPE_FAMILIES = [
  { id: 'video', label: 'video (mp4/ts)', exts: ['mp4', 'ts', 'avi', 'mpg', 'mov', 'webm'] },
  { id: 'table', label: 'data table (csv/xls)', exts: ['csv', 'xls', 'xlsx'] },
  { id: 'sensor', label: 'sensor log (txt/dat)', exts: ['txt', 'dat', 'log', 'asc'] },
  { id: 'document', label: 'document (pdf/doc)', exts: ['pdf', 'doc', 'docx', 'rtf', 'ppt', 'pptx'] },
  { id: 'archive', label: 'archive (zip)', exts: ['zip'] },
  { id: 'image', label: 'image (jpg/png)', exts: ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'nef', 'bmp', 'gif'] },
  { id: 'other', label: 'other', exts: [] as string[] },
]

const EXT_FAMILY = new Map<string, string>()
for (const fam of FILE_TYPE_FAMILIES) for (const e of fam.exts) EXT_FAMILY.set(e, fam.id)
export const familyForExt = (ext: string) => EXT_FAMILY.get(ext.toLowerCase()) ?? 'other'

/* ——— preview capabilities ——— */
const TEXT_EXTS = new Set(['txt', 'log', 'csv', 'dat', 'asc', 'meta', 'metadata', 'json', 'xml', 'md', 'tsv', 'ini', 'cfg'])
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'm4v', 'ts', 'ogv'])
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'])

export type PreviewKind = 'text' | 'video' | 'image' | 'pdf' | 'none'
export function previewKindFor(ext: string): PreviewKind {
  const e = ext.toLowerCase()
  if (TEXT_EXTS.has(e)) return 'text'
  if (VIDEO_EXTS.has(e)) return 'video'
  if (IMAGE_EXTS.has(e)) return 'image'
  // PSI serves files as attachments, so PDFs are fetched as a blob and shown from a blob: URL
  if (e === 'pdf') return 'pdf'
  return 'none'
}

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

const INVEST_BY_ACC = new Map(INVEST_RECORDS.map((r) => [r.accession, r]))
export const investFor = (acc: string) => INVEST_BY_ACC.get(acc)

/* ——— spatial-ready (VR Preview) ———
   A dataset is spatial-ready when its investigation recorded the same event
   from several cameras (multi-view video → reconstructable in VR) or with a
   distributed sensor array (thermocouples + radiometers / PMTs placed around
   the flame). Signals are explicit and shown to the user as reasons. */

const VIDEO_COUNTS = (import.meta.glob('./data/videoCounts.json', { eager: true, import: 'default' })[
  './data/videoCounts.json'
] ?? {}) as Record<string, number>

export const videoCountFor = (acc: string) => VIDEO_COUNTS[acc] ?? 0

export interface SpatialInfo {
  ready: boolean
  multiCamera: boolean
  sensorArray: boolean
  reasons: string[]
}

/** min. video files before a "cameras" mention counts as multi-camera footage */
const MIN_VIDEOS = 10

export function spatialFor(d: Dataset): SpatialInfo {
  const inv = INVESTIGATIONS.find((i) => i.accession === d.accession)
  const text = inv ? `${inv.approach} ${inv.objective} ${inv.hardware}`.toLowerCase() : ''
  const videos = videoCountFor(d.accession)
  const reasons: string[] = []

  const camCols = d.columns.filter((c) => /camera\s*\d/i.test(c))
  const camText = /\b(two|multiple|several|suite of|stereo)\b[^.]{0,30}\bcameras\b|\bcameras\b/.test(text)
  let multiCamera = false
  if (camCols.length >= 2) {
    multiCamera = true
    reasons.push(`${camCols.length} camera views logged per test (${camCols.join(', ')})`)
  } else if (camText && videos >= MIN_VIDEOS) {
    multiCamera = true
    reasons.push(`multi-camera imaging described in the investigation · ${videos} video files on PSI`)
  }
  if (multiCamera && camCols.length >= 2 && videos > 0) reasons.push(`${videos} video files on PSI`)

  const sensors = ['thermocouples', 'radiometers', 'photomultiplier tubes'].filter((k) => text.includes(k))
  const sensorArray = sensors.length >= 2
  if (sensorArray) reasons.push(`distributed sensor array: ${sensors.join(', ')}`)

  return { ready: multiCamera || sensorArray, multiCamera, sensorArray, reasons }
}

/* ——— data records (experimental tables) ——— */
export interface DataRecord {
  id: string
  dataset: Dataset
  inv: InvestRecord | undefined
  acronym: string
  o2Range: string
  pRange: string
  spatial: SpatialInfo
}

const fmtNum = (n: number) => String(Number(n.toPrecision(4)))
const fmtRange = (r: { min: number; max: number; unit: string } | null) =>
  r ? `${fmtNum(r.min)}–${fmtNum(r.max)}${r.unit ? ` ${r.unit}` : ''}` : '—'

export const DATA_RECORDS: DataRecord[] = DATASETS.map((d) => {
  const inv = investFor(d.accession)
  return {
    id: d.id,
    dataset: d,
    inv,
    acronym: inv?.acronym ?? d.accession,
    o2Range: fmtRange(d.ranges.o2),
    pRange: fmtRange(d.ranges.pressure),
    spatial: spatialFor(d),
  }
})

/** investigations with at least one spatial-ready dataset */
const SPATIAL_ACCS = new Set(DATA_RECORDS.filter((r) => r.spatial.ready).map((r) => r.dataset.accession))
export const isSpatialInvestigation = (acc: string) => SPATIAL_ACCS.has(acc)

/* ——— file inventory (one record per real PSI file) ——— */
export interface FileRecord {
  /** stable id: `${accession}::${path}` */
  id: string
  accession: string
  acronym: string
  category: string
  ext: string
  family: string
  size: number
  /** path relative to the category folder */
  path: string
  name: string
  restricted: boolean
}

interface InventoryJson {
  accs: string[]
  acronyms: string[]
  cats: string[]
  exts: string[]
  rows: [number, number, number, number, string, number?][]
}

// lazy chunk — the inventory is ~3 MB of JSON, only loaded when the Files tab opens
const INVENTORY_LOADER = import.meta.glob('./data/fileInventory.json', { import: 'default' })
let inventoryPromise: Promise<FileRecord[]> | null = null

/** Lazy-load the full file inventory (~66k files) once. */
export function loadFileInventory(): Promise<FileRecord[]> {
  if (!inventoryPromise) {
    const loader = INVENTORY_LOADER['./data/fileInventory.json']
    inventoryPromise = loader().then((raw) => {
      const inv = raw as InventoryJson
      return inv.rows.map(([a, c, e, size, path, restricted]) => {
        const accession = inv.accs[a]
        const ext = inv.exts[e]
        return {
          id: `${accession}::${inv.cats[c]}/${path}`,
          accession,
          acronym: inv.acronyms[a],
          category: inv.cats[c],
          ext,
          family: familyForExt(ext),
          size,
          path,
          name: path.split('/').pop() ?? path,
          restricted: restricted === 1,
        }
      })
    })
  }
  return inventoryPromise
}

/* ——— search & facet helpers ——— */
export interface ExploreFilters {
  q: string
  areas: SafetyArea[]
  tags: string[]
  fileTypes: string[]
  categories: string[]
  /** only spatial-ready (VR Preview) data */
  spatialOnly: boolean
}

export const EMPTY_FILTERS: ExploreFilters = {
  q: '',
  areas: [],
  tags: [],
  fileTypes: [],
  categories: [],
  spatialOnly: false,
}

/** investigation-level facets (safety area, context tags) */
function invMatches(f: ExploreFilters, acc: string): boolean {
  if (!f.areas.length && !f.tags.length) return true
  const r = investFor(acc)
  if (!r) return false
  if (f.areas.length && !f.areas.includes(r.safetyArea)) return false
  if (f.tags.length && !f.tags.some((t) => r.tags.includes(t))) return false
  return true
}

export function searchInvestigations(f: ExploreFilters): InvestRecord[] {
  const q = f.q.trim().toLowerCase()
  return INVEST_RECORDS.filter((r) => {
    if (!invMatches(f, r.accession)) return false
    if (q) {
      const hay = `${r.acronym} ${r.title} ${r.accession} ${r.objective} ${r.tags.join(' ')}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }).sort((a, b) => b.relevance - a.relevance)
}

export function searchData(f: ExploreFilters): DataRecord[] {
  const q = f.q.trim().toLowerCase()
  const terms = q ? q.split(/\s+/) : []
  // data tables are csv files in the "Experimental table" category
  if (f.fileTypes.length && !f.fileTypes.includes('table')) return []
  if (f.categories.length && !f.categories.includes('Experimental table')) return []
  return DATA_RECORDS.filter((r) => {
    if (f.spatialOnly && !r.spatial.ready) return false
    if (!invMatches(f, r.dataset.accession)) return false
    if (terms.length) {
      const hay = `${r.acronym} ${r.dataset.title} ${r.dataset.accession} ${r.dataset.fileName} ${r.dataset.columns.join(' ')} ${r.inv?.title ?? ''} ${r.inv?.tags.join(' ') ?? ''}`.toLowerCase()
      if (!terms.every((t) => hay.includes(t))) return false
    }
    return true
  }).sort((a, b) => (b.inv?.relevance ?? 0) - (a.inv?.relevance ?? 0))
}

export function searchFiles(files: FileRecord[], f: ExploreFilters): FileRecord[] {
  const q = f.q.trim().toLowerCase()
  const terms = q ? q.split(/\s+/) : []
  return files.filter((file) => {
    if (f.categories.length && !f.categories.includes(file.category)) return false
    if (f.fileTypes.length && !f.fileTypes.includes(file.family)) return false
    if (f.spatialOnly && !isSpatialInvestigation(file.accession)) return false
    if (!invMatches(f, file.accession)) return false
    if (terms.length) {
      const hay = `${file.acronym} ${file.accession} ${file.path} ${file.category} ${file.ext}`.toLowerCase()
      if (!terms.every((t) => hay.includes(t))) return false
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

export function formatBytes(n: number): string {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`
}
