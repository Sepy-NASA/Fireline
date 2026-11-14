/* ————————————————————————————————————————————
   Fireline data pipeline (mock backend).
   Reads PSI data from ../data, merges curated
   knowledge from ./curated.mjs, computes derived
   metrics, and emits typed modules into
   ../src/generated/. Run:  npm run build:data
   ———————————————————————————————————————————— */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SAFETY_AREAS,
  INVESTIGATION_FUELS,
  HARDWARE_BY_INV,
  TARGETS_BY_INV,
  MATERIAL_ENV_RELEVANCE,
  MATERIALS,
  HARDWARE,
  PLATFORMS,
  ENVIRONMENTS,
  INCIDENTS,
  INCIDENT_EDGES,
  EXTERNAL_SOURCES,
} from './curated.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const OUT_DIR = join(__dirname, '..', 'src', 'generated')

/* ——— tiny CSV parser (handles quoted fields) ——— */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

function csvToObjects(text) {
  const rows = parseCsv(text)
  if (!rows.length) return []
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).map((r) => {
    const o = {}
    headers.forEach((h, i) => { o[h] = (r[i] ?? '').replace(/\r/g, '').trim() })
    return o
  })
}

const num = (s) => s.trim() || null

/* ——— numeric parsing helpers ——— */
/** Extract all numbers from a possibly-messy cell: "21; 26.5; 40", "30 cm/s", "~ 21.5", "22.1 to 22.0". */
function numbersIn(cell) {
  const matches = String(cell).match(/-?\d+(?:\.\d+)?/g)
  if (!matches) return []
  return matches.map(Number).filter((n) => Number.isFinite(n))
}

/** Cells that are placeholders, not numbers — skip them entirely. */
const PLACEHOLDER_CELL = /ramp|low o2|l?o2? low|n\/a|^na$|^none$|^blank$|^ext$|^-$|^--$|extinct|to be determined/i

/** Parse a value column (percent vs fraction, unit conversions). */
function colStats(colName, values, opts = {}) {
  const minmax = { min: null, max: null, count: 0 }
  const name = colName.toLowerCase()
  // O2 composition columns: exclude flow-rate columns and the CO/CO2/N ambient columns
  const isO2 =
    /(^|[^a-z])o2([^a-z]|$)|oxygen|percent o2|% o2|xo2|(^|[^a-z])o initial|calibrated.*o2/.test(name) &&
    !/flow\s*rate|fuel\s*rate/.test(name)
  const isPressure = /pressure|pinit|pmean|pfinal|approx p|\(bar\)|\(atm\)|psia/.test(name)
  const isFlow = /air flow|air rate|air speed|co.?flow|flow rate/.test(name) && !name.includes('fuel')
  let scale = 1
  let unit = ''
  if (opts.role === 'pressure') {
    if (name.includes('mmhg')) { scale = 1 / 760; unit = 'atm' }
    else if (name.includes('bar')) { scale = 0.986923; unit = 'atm' }
    else unit = 'atm'
  }
  // Collect raw numeric values, skipping placeholder cells.
  const rowsRaw = []
  for (const v of values) {
    if (PLACEHOLDER_CELL.test(String(v).trim())) continue
    rowsRaw.push(numbersIn(v))
  }
  const all = rowsRaw.flat()
  if (!all.length) return { ...minmax, unit, isO2, isPressure, isFlow }

  // O2: detect fraction-mode when every clean value is <= 5 (e.g. 0.21, 0.85)
  let o2PercentMode = false
  if (opts.role === 'o2') {
    o2PercentMode = all.some((n) => n > 5)
    scale = o2PercentMode ? 1 : 100
  }

  for (const nums of rowsRaw) {
    if (!nums.length) continue
    const mapped = nums
      .map((n) => {
        if (opts.role === 'o2') {
          // percent-mode: clamp typo "3400%" → 34; ignore stray fractions
          return o2PercentMode ? (n > 100 ? n / 100 : n > 5 ? n : n * 100) : n * 100
        }
        if (opts.role === 'pressure' && n === 0) return null // FLEX missing-pressure placeholder
        return n * scale
      })
      .filter((n) => n !== null)
    if (!mapped.length) continue
    const lo = Math.min(...mapped)
    const hi = Math.max(...mapped)
    minmax.min = minmax.min === null ? lo : Math.min(minmax.min, lo)
    minmax.max = minmax.max === null ? hi : Math.max(minmax.max, hi)
    minmax.count += 1
  }
  return { ...minmax, unit, isO2, isPressure, isFlow }
}

/* ——— load investigations catalog ——— */
const catalog = csvToObjects(readFileSync(join(DATA_DIR, 'investigations-catalog.csv'), 'utf8'))
const detail = JSON.parse(readFileSync(join(DATA_DIR, 'investigations-detail.json'), 'utf8'))

/* ——— load experimental tables ——— */
const tableFiles = readdirSync(join(DATA_DIR, 'experimental-tables')).filter((f) =>
  f.endsWith('.csv'),
)

const datas = (acc) => catalog.find((c) => c.accession === acc)
const datasets = []
const investAgg = {}

for (const file of tableFiles) {
  const rows = csvToObjects(readFileSync(join(DATA_DIR, 'experimental-tables', file), 'utf8'))
  const header = rows.length ? Object.keys(rows[0]) : []
  const acc = file.match(/PSI-\d+/)?.[0]
  const sizeLabel = file
    .replace(/^PSI-\d+_Experimental table_/, '')
    .replace(/\.csv$/, '')
    .replace(/[_]/g, ' ')

  // numeric column stats
  const numeric = {}
  for (const col of header) {
    const values = rows.map((r) => r[col])
    let role = null
    let opts = {}
    const cn = col.toLowerCase()
    if (/o2|oxygen|xo2|(^|[^a-z])o initial|calibrated.*o2|percent o2/.test(cn) && !/flow\s*rate|fuel\s*rate/.test(cn)) { role = 'o2'; opts = { role: 'o2' } }
    else if (/pressure|pinit|pmean|pfinal|psia|atm|bar|approx p/.test(cn)) { role = 'pressure'; opts = { role: 'pressure' } }
    else if (/air flow|air rate|air speed|co.?flow|flow rate/.test(cn) && !/fuel/.test(cn)) { role = 'flow'; opts = { role: 'flow' } }
    if (role) {
      numeric[col] = colStats(col, values, { role })
    }
  }

  // data-quality flags
  const dataQuality = []
  const dupCount = rows.length - new Set(rows.map((r) => JSON.stringify(r))).size
  if (dupCount > 0) dataQuality.push(`${dupCount} exact duplicate rows (possibly transcription artifacts)`)
  if (rows.some((r) => Object.values(r).some((v) => /ramped|ramp\b/i.test(String(v)))))
    dataQuality.push('placeholder values (RAMPED / RAMP) present in condition columns')
  if (rows.some((r) => Object.values(r).some((v) => /^n\/a$|^na$|-|blank/i.test(String(v)))))
    dataQuality.push('blank or n/a values in some cells')
  if (rows.some((r) => Object.values(r).some((v) => /\\d+\\s*;\\s*\\d+/.test(String(v)))))
    dataQuality.push('multiple values packed into single cells (e.g. "21; 26.5; 40")')

  const colsForSample = header.slice()
  // evenly sample up to 250 rows so charts have substance without ballooning the bundle
  const sampleCap = 250
  const stride = rows.length > sampleCap ? Math.ceil(rows.length / sampleCap) : 1
  const sampleRows = rows
    .filter((_, i) => i % stride === 0)
    .slice(0, sampleCap)
    .map((r) => Object.fromEntries(colsForSample.map((c) => [c, r[c]])))

  const o2 = numeric[Object.keys(numeric).find((k) => numeric[k].isO2)] ?? null
  const p = numeric[Object.keys(numeric).find((k) => numeric[k].isPressure)] ?? null
  const f = numeric[Object.keys(numeric).find((k) => numeric[k].isFlow)] ?? null

  const id = `ds_${acc}_${file.replace(/^PSI-\d+_Experimental table_/, '').replace(/\.csv$/, '').replace(/[_ ]+/g, '_').toLowerCase()}`
  datasets.push({
    id,
    accession: acc,
    title: sizeLabel,
    fileName: file,
    rows: rows.length,
    columns: header,
    sample: sampleRows,
    numeric,
    ranges: {
      o2: o2 ? { min: o2.min, max: o2.max, unit: '%' } : null,
      pressure: p ? { min: p.min, max: p.max, unit: p.unit } : null,
      flow: f ? { min: f.min, max: f.max, unit: 'cm/s' } : null,
    },
  })

  // per-accession aggregated range
  if (!investAgg[acc]) investAgg[acc] = { o2: { min: null, max: null }, p: { min: null, max: null }, f: { min: null, max: null }, quality: new Set(), nTests: 0 }
  const a = investAgg[acc]
  a.nTests += rows.length
  if (o2?.min != null) { a.o2.min = a.o2.min === null ? o2.min : Math.min(a.o2.min, o2.min); a.o2.max = a.o2.max === null ? o2.max : Math.max(a.o2.max, o2.max) }
  if (p?.min != null) { a.p.min = a.p.min === null ? p.min : Math.min(a.p.min, p.min); a.p.max = a.p.max === null ? p.max : Math.max(a.p.max, p.max) }
  if (f?.min != null) { a.f.min = a.f.min === null ? f.min : Math.min(a.f.min, f.min); a.f.max = a.f.max === null ? f.max : Math.max(a.f.max, f.max) }
  dataQuality.forEach((d) => a.quality.add(d))
}

/* ——— assemble investigations ——— */
const round = (n, d = 2) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d)

const investigations = catalog.map((c) => {
  const acc = c.accession
  const d = detail[acc] ?? {}
  const agg = investAgg[acc] ?? { o2: { min: null, max: null }, p: { min: null, max: null }, f: { min: null, max: null }, quality: new Set(), nTests: 0 }
  const pubs = (d.publications ?? []).map((p) => ({ title: p.title ?? '', authors: p.authorList ?? '', doi: p.doi ?? '' }))
  const safetyArea = SAFETY_AREAS[acc] ?? 'supporting'
  const fuelIds = INVESTIGATION_FUELS[acc] ?? []
  const fuelNames = fuelIds.map((id) => MATERIALS.find((m) => m.id === id)?.name).filter(Boolean)
  const moonRelevant = agg.o2.max != null && agg.o2.max >= 30

  // transparent relevance score
  const reasons = []
  let r = 0
  if (safetyArea !== 'supporting') { r += 3; reasons.push('direct match to a crew fire-safety need') }
  if (moonRelevant) { r += 3; reasons.push('tests conditions near predicted lunar atmosphere (≥ 30 % O₂)') }
  if (agg.nTests >= 100) { r += 2; reasons.push(`large structured test set (${agg.nTests} tests)`) }
  else if (agg.nTests >= 30) { r += 1.5; reasons.push(`structured test set (${agg.nTests} tests)`) }
  if (Number(c.n_analyzed_files) > 0) { r += 1; reasons.push('analyzed data products available') }
  if (Number(c.n_publications) >= 10) { r += 1; reasons.push('strong peer-reviewed publication record') }
  const relevance = round(Math.min(10, r), 1)

  return {
    accession: acc,
    acronym: c.acronym || acc.replace('PSI-', 'PSI '),
    title: c.title || acc,
    subArea: c.sub_area,
    projectType: c.project_type,
    platform: c.platform,
    hardware: c.hardware,
    start: c.start,
    end: c.end,
    related: c.related,
    nFiles: Number(num(c.n_files) ?? 0),
    sizeGB: Number(num(c.size_GB) ?? 0),
    hasExperimentalTable: c.has_experimental_table === 'True',
    nAnalyzed: Number(num(c.n_analyzed_files) ?? 0),
    nPublications: Number(num(c.n_publications) ?? 0),
    doi: c.doi,
    url: c.url,
    objective: c.objective,
    approach: d.approach ?? '',
    hypothesis: d.hypothesis ?? '',
    researchImpacts: d.researchImpacts ?? '',
    publications: pubs,
    safetyArea,
    fuels: fuelNames,
    fuelIds,
    nTests: agg.nTests,
    o2Min: round(agg.o2.min, 1),
    o2Max: round(agg.o2.max, 1),
    pMin: round(agg.p.min),
    pMax: round(agg.p.max),
    flowMin: agg.f.min == null ? null : round(agg.f.min),
    flowMax: agg.f.max == null ? null : round(agg.f.max),
    moonRelevant,
    dataQuality: [...agg.quality],
    relevance,
    relevanceReasons: reasons,
  }
})

/* ——— build graph ——— */
const nodes = []
const edges = []
const nodeId = (kind, ref) => `n_${kind}_${ref}`

function addNode(kind, ref, label, hint, entity = null) {
  const id = nodeId(kind, ref)
  nodes.push({ id, kind, ref, label, hint, entity })
  return id
}

// safety areas
const SAFETY_NODES = {
  prevention: 'Prevention — solid material flammability',
  detection: 'Detection — smoke & aerosol sensing',
  suppression: 'Suppression — extinguishment agents',
  supporting: 'Supporting — modeling & characterization',
}
const safetyNodeId = {}
for (const [areaKey, label] of Object.entries(SAFETY_NODES)) {
  safetyNodeId[areaKey] = addNode('safetyArea', `safety_${areaKey}`, label, 'NASA fire-safety need this area serves')
}

// investigation nodes + area/fuel/hardware/platform/env edges
for (const inv of investigations) {
  const id = addNode(
    'investigation',
    inv.accession,
    inv.acronym ? `${inv.acronym}` : inv.accession,
    `${inv.title} — ${inv.nTests} tests${inv.moonRelevant ? ' · moon-relevant' : ''}`,
    inv,
  )
  edges.push({ source: id, target: safetyNodeId[inv.safetyArea], type: 'FILED_UNDER' })
  for (const fuelId of inv.fuelIds) {
    edges.push({ source: id, target: nodeId('material', fuelId), type: 'STUDIES' })
  }
  for (const hwId of HARDWARE_BY_INV[inv.accession] ?? []) {
    edges.push({ source: id, target: nodeId('hardware', hwId), type: 'USED' })
  }
  for (const envId of TARGETS_BY_INV[inv.accession] ?? []) {
    edges.push({ source: id, target: nodeId('environment', envId), type: 'TARGETS' })
  }
  const platform = inv.platform
  const platformId = platform.includes('ISS')
    ? 'pl_iss'
    : platform.includes('Cygnus') || platform.includes('cygnus')
      ? 'pl_cygnus'
      : 'pl_ground'
  if (platform && platform.toLowerCase() !== 'not applicable') {
    edges.push({ source: id, target: nodeId('platform', platformId), type: 'FLOWN_ON' })
  }
  // dataset edges
  for (const ds of datasets.filter((x) => x.accession === inv.accession)) {
    edges.push({ source: id, target: nodeId('dataset', ds.id), type: 'PRODUCED' })
  }
}

// other entity nodes
for (const m of MATERIALS) addNode('material', m.id, m.name, m.note)
for (const h of HARDWARE) addNode('hardware', h.id, h.name, h.note)
for (const p of PLATFORMS) addNode('platform', p.id, p.name, p.note)
for (const e of ENVIRONMENTS) addNode('environment', e.id, e.name, `${e.pressure} · ${e.o2}`)
for (const inc of INCIDENTS) addNode('incident', inc.id, inc.name, `${inc.year} — ${inc.summary}`)

// dataset nodes
for (const ds of datasets) {
  addNode('dataset', ds.id, ds.title, `${ds.rows} test rows — ${ds.columns.length} columns`, ds)
}

// incident → safety area edges
for (const e of INCIDENT_EDGES) {
  edges.push({ source: nodeId('incident', e.incident), target: safetyNodeId[e.to.replace('safety_', '')], type: 'RELEVANT_TO' })
}

// material → environment relevance
for (const [matId, envId] of MATERIAL_ENV_RELEVANCE) {
  edges.push({ source: nodeId('material', matId), target: nodeId('environment', envId), type: 'RELEVANT_TO' })
}

/* ——— emit modules ——— */
mkdirSync(OUT_DIR, { recursive: true })

const fmt = (obj) => JSON.stringify(obj, null, 2)

const graphNodes = nodes.map(({ entity, ...rest }) => rest)

writeFileSync(join(OUT_DIR, 'investigations.ts'), `// Generated by scripts/build-data.mjs — do not edit.\nimport type { Investigation } from '../types'\nexport const INVESTIGATIONS: Investigation[] = ${fmt(investigations)}\n`)
writeFileSync(join(OUT_DIR, 'datasets.ts'), `// Generated by scripts/build-data.mjs — do not edit.\nimport type { Dataset } from '../types'\nexport const DATASETS: Dataset[] = ${fmt(datasets)}\n`)
writeFileSync(join(OUT_DIR, 'graph.ts'), `// Generated by scripts/build-data.mjs — do not edit.\nimport type { NodeKind } from '../types'\nexport interface GraphNodeDef { id: string; kind: NodeKind; ref: string; label: string; hint: string }\nexport const NODES: GraphNodeDef[] = ${fmt(graphNodes)}\nexport const NODE_INDEX: Record<string, GraphNodeDef> = ${fmt(Object.fromEntries(graphNodes.map((n) => [n.id, n])))}\nexport const EDGES: { source: string; target: string; type: string }[] = ${fmt(edges)}\nexport const MATERIALS = ${fmt(MATERIALS)}\nexport const HARDWARE = ${fmt(HARDWARE)}\nexport const PLATFORMS = ${fmt(PLATFORMS)}\nexport const ENVIRONMENTS = ${fmt(ENVIRONMENTS)}\nexport const INCIDENTS = ${fmt(INCIDENTS)}\nexport const EXTERNAL_SOURCES = ${fmt(EXTERNAL_SOURCES)}\n`)
writeFileSync(join(OUT_DIR, 'index.ts'), `// Generated by scripts/build-data.mjs — do not edit.\nexport * from './investigations'\nexport * from './datasets'\nexport * from './graph'\n`)

console.log('✓ generated')
console.log(`  investigations: ${investigations.length}`)
console.log(`  datasets: ${datasets.length} (${datasets.reduce((s, d) => s + d.rows, 0)} test rows total)`)
console.log(`  graph nodes: ${nodes.length}, edges: ${edges.length}`)
console.log(`  moon-relevant investigations: ${investigations.filter((i) => i.moonRelevant).length}`)

