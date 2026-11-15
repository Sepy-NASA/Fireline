import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

/* ————————————————————————————————————————————
   PSI evidence figures (DATA_ANAL.md §8), redrawn
   in the app style. Every value below is copied
   from the experimental tables in data/ — the
   same values as figures/fig1–3.png. Only the
   styling differs; "Original" shows the PNG.
   ———————————————————————————————————————————— */

const C = {
  grid: '#1c2430',
  axis: '#5b6472',
  text: '#e9eef5',
  dim: '#8b95a5',
  solid: '#3ad7a3',
  pmma: '#ffb454',
  saffire1: '#4da3ff',
  gas: '#a78bfa',
  liquid: '#4da3ff',
  index: '#8b95a5',
  rover: '#ff6b6b',
}

function FigureCard({
  n,
  title,
  sub,
  source,
  png,
  children,
}: {
  n: number
  title: string
  sub: string
  source: string
  png: string
  children: ReactNode
}) {
  const [original, setOriginal] = useState(false)
  return (
    <div className="rounded-lg border border-edge bg-panel p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-bright">Fig. {n}</p>
          <p className="text-[15px] font-semibold text-text">{title}</p>
          <p className="text-[12px] text-dim">{sub}</p>
        </div>
        <div className="flex shrink-0 rounded-md border border-edge p-0.5 text-[11px]">
          {(['App style', 'Original'] as const).map((l, i) => (
            <button
              key={l}
              onClick={() => setOriginal(i === 1)}
              className={cn('rounded px-2 py-0.5', original === (i === 1) ? 'bg-bright/15 text-bright' : 'text-dim hover:text-text')}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      {original ? <img src={png} alt={title} className="w-full rounded bg-white" /> : children}
      <p className="mt-2 text-[10.5px] text-faint">{source}</p>
    </div>
  )
}

/* ——— Fig. 1 — condition coverage ——— */

// Saffire-II rows (PSI-99), initial O₂ as tabulated, all at 20 cm/s
const SAFFIRE2 = [
  { id: '2-1', mat: 'Silicone', o2: 21.5, pmma: false },
  { id: '2-2', mat: 'Silicone', o2: 22.1, pmma: false },
  { id: '2-3', mat: 'Silicone', o2: 22.1, pmma: false },
  { id: '2-4', mat: 'Silicone', o2: 22.1, pmma: false },
  { id: '2-5', mat: 'SIBAL', o2: 22.1, pmma: false },
  { id: '2-6', mat: '(blank)', o2: 22.1, pmma: false },
  { id: '2-7', mat: 'PMMA & Nomex', o2: 22.1, pmma: true },
  { id: '2-8', mat: 'PMMA', o2: 22.1, pmma: true },
  { id: '2-9', mat: '(blank, 1 cm)', o2: 22.0, pmma: true },
]
// Saffire-I (PSI-98): "21.5 - 21.7" and "~ 21.5", both 20 cm/s
const SAFFIRE1 = [
  { id: 'S1', o2: 21.5 },
  { id: 'S2', o2: 21.5 },
]

function Fig1() {
  const W = 760
  const H = 430
  const L = 56
  const R = 16
  const T = 16
  const B = 44
  const x0 = 0
  const x1 = 36
  const y0 = 12
  const y1 = 36
  const sx = (v: number) => L + ((v - x0) / (x1 - x0)) * (W - L - R)
  const sy = (v: number) => T + ((y1 - v) / (y1 - y0)) * (H - T - B)
  const [hover, setHover] = useState<string | null>(null)
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Condition coverage map">
        {/* uncovered region for solid materials and BASS-II band */}
        <rect x={sx(0)} y={sy(34)} width={sx(36) - sx(0)} height={sy(22.2) - sy(34)} fill={C.rover} fillOpacity={0.08} />
        <rect x={sx(0.7)} y={sy(22.2)} width={sx(35.3) - sx(0.7)} height={sy(13.6) - sy(22.2)} fill={C.solid} fillOpacity={0.07} />
        {[0, 5, 10, 15, 20, 25, 30, 35].map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} x2={sx(t)} y1={T} y2={H - B} stroke={C.grid} />
            <text x={sx(t)} y={H - B + 16} textAnchor="middle" fontSize="11" fill={C.axis}>{t}</text>
          </g>
        ))}
        {[15, 20, 25, 30, 35].map((t) => (
          <g key={`y${t}`}>
            <line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} stroke={C.grid} />
            <text x={L - 8} y={sy(t) + 4} textAnchor="end" fontSize="11" fill={C.axis}>{t}</text>
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" fontSize="11.5" fill={C.dim}>Airflow velocity (cm/s)</text>
        <text x={14} y={(T + H - B) / 2} textAnchor="middle" fontSize="11.5" fill={C.dim} transform={`rotate(-90 14 ${(T + H - B) / 2})`}>
          Oxygen concentration (% by volume)
        </text>

        {/* rover target */}
        <line x1={L} x2={W - R} y1={sy(30)} y2={sy(30)} stroke={C.rover} strokeWidth={2} strokeDasharray="7 5" />
        <text x={sx(0.5)} y={sy(30) - 8} fontSize="11" fontWeight={700} fill={C.rover}>Rover cabin target: 30 % O₂ (1/6 g — no partial-gravity tests exist in PSI)</text>
        <path
          d={(() => {
            const cx = sx(20)
            const cy = sy(30)
            const pts: string[] = []
            for (let i = 0; i < 10; i++) {
              const r = i % 2 === 0 ? 11 : 4.5
              const a = (Math.PI / 5) * i - Math.PI / 2
              pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`)
            }
            return `M${pts.join('L')}Z`
          })()}
          fill={C.rover}
        />
        <text x={sx(24.2)} y={sy(32.2)} fontSize="11.5" fontWeight={700} fill={C.rover}>Rover condition</text>
        <text x={sx(24.2)} y={sy(32.2) + 14} fontSize="11" fill={C.rover}>(30 % O₂ · 1/6 g · flow TBD)</text>
        <text x={sx(35.6)} y={sy(28.4)} textAnchor="end" fontSize="11.5" fontWeight={700} fill={C.rover}>
          UNCOVERED for solid materials: &gt;22.2 % (no test, any flow, any gravity)
        </text>
        <text x={sx(35.3)} y={sy(17.6)} textAnchor="end" fontSize="11" fill={C.solid}>BASS-II solid-sample tests</text>
        <text x={sx(35.3)} y={sy(17.6) + 14} textAnchor="end" fontSize="10.5" fill={C.solid}>
          O₂ span 13.6–22.2 % (129 tests; airflow not tabulated in cm/s)
        </text>

        {/* points (all Saffire rows sit at 20 cm/s; spread sideways only so they stay visible) */}
        {SAFFIRE2.map((p, i) => {
          const cx = sx(20) + (i - 4) * 5
          return (
            <circle
              key={p.id}
              cx={cx}
              cy={sy(p.o2)}
              r={5.5}
              fill={p.pmma ? C.pmma : C.solid}
              stroke="#0e1218"
              strokeWidth={1.5}
              onMouseEnter={() => setHover(`Saffire-II ${p.id} · ${p.mat} · ${p.o2} % O₂ · 20 cm/s`)}
              onMouseLeave={() => setHover(null)}
            />
          )
        })}
        {SAFFIRE1.map((p, i) => {
          const cx = sx(20) + (i - 0.5) * 12
          const cy = sy(p.o2)
          return (
            <rect
              key={p.id}
              x={cx - 6}
              y={cy - 6}
              width={12}
              height={12}
              transform={`rotate(45 ${cx} ${cy})`}
              fill={C.saffire1}
              stroke="#0e1218"
              strokeWidth={1.5}
              onMouseEnter={() => setHover(`Saffire-I ${p.id} · SIBAL 40.6 × 94 cm · ${p.o2} % O₂ · 20 cm/s`)}
              onMouseLeave={() => setHover(null)}
            />
          )
        })}
        <path
          d={`M${sx(30)},${sy(21.5) - 9}L${sx(30) + 8},${sy(21.5) + 6}L${sx(30) - 8},${sy(21.5) + 6}Z`}
          fill="none"
          stroke={C.saffire1}
          strokeWidth={2.5}
          onMouseEnter={() => setHover('Saffire-III · SIBAL · 30 cm/s · O₂ not tabulated in table')}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      {hover && <div className="pointer-events-none absolute left-16 top-3 rounded border border-edge bg-panel px-2 py-1 text-[11px] text-text shadow-pop">{hover}</div>}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-dim">
        <span><span className="mr-1 inline-block size-2.5 rounded-full" style={{ background: C.solid }} />Saffire-II — SIBAL / silicone samples (µg, Cygnus)</span>
        <span><span className="mr-1 inline-block size-2.5 rounded-full" style={{ background: C.pmma }} />Saffire-II — PMMA samples (spread rate unresolved — Note 3/4)</span>
        <span><span className="mr-1 inline-block size-2.5 rotate-45" style={{ background: C.saffire1 }} />Saffire-I — SIBAL 40.6 × 94 cm (µg)</span>
        <span><span className="mr-1 inline-block" style={{ color: C.saffire1 }}>△</span>Saffire-III — SIBAL, 30 cm/s (O₂ not tabulated in table)</span>
      </div>
    </div>
  )
}

/* ——— Fig. 2 — flow direction & buoyancy ——— */

const FLOW_BARS = [
  { label: 'Saffire-I S1', sub: 'concurrent', v: 420, color: C.saffire1 },
  { label: 'Saffire-I S2', sub: 'opposed', v: 70, color: C.saffire1 },
  { label: 'Saffire-II 2-5', sub: 'concurrent', v: 145, color: C.solid },
]
// Silicone, Saffire-II 2-1…2-4: µg burn length "~ 0"; 1-g burn length Complete / 7.6 cm / ~ 0 / Complete
const SILICONE = [
  { id: '2-1', thk: '0.27 mm', ug: 0, g1: 29, g1Label: 'Complete' },
  { id: '2-2', thk: '0.61 mm', ug: 0, g1: 7.6, g1Label: '7.6 cm' },
  { id: '2-3', thk: '1.03 mm', ug: 0, g1: 0, g1Label: '0 cm' },
  { id: '2-4', thk: '0.37* mm', ug: 0, g1: 29, g1Label: 'Complete' },
]

function Fig2() {
  const H = 270
  const T = 24
  const B = 60
  const L = 46
  const W = 360
  const yb = (v: number, max: number) => T + (1 - v / max) * (H - T - B)
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="mb-1 text-[12.5px] font-semibold text-text">Same material (SIBAL), same O₂ (~21.5 %) — flow direction alone changed the burn time 6×</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {[0, 100, 200, 300, 400].map((t) => (
            <g key={t}>
              <line x1={L} x2={W - 8} y1={yb(t, 470)} y2={yb(t, 470)} stroke={C.grid} />
              <text x={L - 6} y={yb(t, 470) + 4} textAnchor="end" fontSize="10.5" fill={C.axis}>{t}</text>
            </g>
          ))}
          <text x={12} y={(T + H - B) / 2} textAnchor="middle" fontSize="11" fill={C.dim} transform={`rotate(-90 12 ${(T + H - B) / 2})`}>Burn time (s)</text>
          {FLOW_BARS.map((b, i) => {
            const bw = 62
            const x = L + 20 + i * ((W - L - 30) / 3)
            return (
              <g key={b.label}>
                <rect x={x} y={yb(b.v, 470)} width={bw} height={H - B - yb(b.v, 470)} rx={3} fill={b.color} />
                <text x={x + bw / 2} y={yb(b.v, 470) - 6} textAnchor="middle" fontSize="12" fontWeight={700} fill={C.text}>{b.v} s</text>
                <text x={x + bw / 2} y={H - B + 16} textAnchor="middle" fontSize="11" fill={C.text}>{b.label}</text>
                <text x={x + bw / 2} y={H - B + 30} textAnchor="middle" fontSize="10" fill={C.dim}>{b.sub}</text>
                <text x={x + bw / 2} y={H - B + 43} textAnchor="middle" fontSize="10" fill={C.dim}>20 cm/s</text>
              </g>
            )
          })}
          {(() => {
            const step = (W - L - 30) / 3
            const s2 = L + 20 + step + 31
            const ax = L + 20 + step * 1.5 + 31
            return (
              <>
                <text x={ax} y={yb(330, 470)} textAnchor="middle" fontSize="11" fontWeight={700} fill={C.rover}>~6× difference</text>
                <text x={ax} y={yb(330, 470) + 13} textAnchor="middle" fontSize="10" fill={C.rover}>only flow direction changed</text>
                <line x1={ax - 10} y1={yb(330, 470) + 19} x2={s2} y2={yb(70, 470) - 20} stroke={C.rover} strokeWidth={1.2} />
              </>
            )
          })()}
        </svg>
        <p className="text-[10.5px] text-faint">Saffire-I samples: 40.6 × 94 cm fabric. Saffire-II 2-5: 29 × 5 cm. µg, Cygnus.</p>
      </div>
      <div>
        <p className="mb-1 text-[12.5px] font-semibold text-text">Silicone (Saffire-II 2-1…2-4): barely burned in microgravity, consumed in 1-g controls</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {[0, 10, 20, 30].map((t) => (
            <g key={t}>
              <line x1={L} x2={W - 8} y1={yb(t, 33)} y2={yb(t, 33)} stroke={C.grid} />
              <text x={L - 6} y={yb(t, 33) + 4} textAnchor="end" fontSize="10.5" fill={C.axis}>{t}</text>
            </g>
          ))}
          <line x1={L} x2={W - 8} y1={yb(29, 33)} y2={yb(29, 33)} stroke={C.dim} strokeDasharray="2 3" />
          <text x={12} y={(T + H - B) / 2} textAnchor="middle" fontSize="11" fill={C.dim} transform={`rotate(-90 12 ${(T + H - B) / 2})`}>Burn length (cm)</text>
          {SILICONE.map((s, i) => {
            const gx = L + 14 + i * ((W - L - 20) / 4)
            const bw = 26
            return (
              <g key={s.id}>
                <text x={gx + 4} y={H - B - 4} textAnchor="middle" fontSize="11" fontWeight={700} fill={C.solid}>≈0</text>
                {s.g1 > 0 && <rect x={gx + 22} y={yb(s.g1, 33)} width={bw} height={H - B - yb(s.g1, 33)} rx={2} fill={C.index} fillOpacity={0.55} />}
                <text x={gx + 22 + bw / 2} y={s.g1 > 0 ? yb(s.g1, 33) - 6 : H - B - 4} textAnchor="middle" fontSize="10.5" fontWeight={700} fill={C.dim}>{s.g1Label}</text>
                <text x={gx + 22} y={H - B + 16} textAnchor="middle" fontSize="11" fill={C.text}>{s.id}</text>
                <text x={gx + 22} y={H - B + 30} textAnchor="middle" fontSize="10" fill={C.dim}>{s.thk}</text>
              </g>
            )
          })}
        </svg>
        <div className="flex flex-wrap gap-x-4 gap-y-1 whitespace-nowrap text-[10.5px] text-dim">
          <span><span className="mr-1 inline-block size-2 rounded-sm" style={{ background: C.solid }} />Microgravity (~0-g)</span>
          <span><span className="mr-1 inline-block size-2 rounded-sm" style={{ background: C.index, opacity: 0.55 }} />1-g control (same sample card)</span>
          <span>··· full 29 cm sample consumed</span>
          <span>* table lists “037 mm”</span>
        </div>
      </div>
    </div>
  )
}

/* ——— Fig. 3 — material × O₂ matrix (914 records) ——— */

const BANDS = ['≤16 %', '16–20 %', '20–22.2 %', '22.2–27 %', '27–34 %', '34–85 %', 'not tabulated']
const MATRIX: { label: string; sub: string; kind: 'solid' | 'index' | 'gas' | 'liquid'; counts: (number | null)[] }[] = [
  { label: 'SAFFIRE-I (PSI-98)', sub: 'solid — SIBAL', kind: 'solid', counts: [null, null, 2, null, null, null, null] },
  { label: 'SAFFIRE-II (PSI-99)', sub: 'solid — SIBAL, PMMA, silicone', kind: 'solid', counts: [null, null, 9, null, null, null, null] },
  { label: 'SAFFIRE-III (PSI-100)', sub: 'solid — SIBAL', kind: 'solid', counts: [null, null, null, null, null, null, 2] },
  { label: 'BASS-II (PSI-25)', sub: 'solid — PMMA, SIBAL, Nomex', kind: 'solid', counts: [18, 69, 42, null, null, null, null] },
  { label: 'BASS (PSI-26)', sub: 'sample index only', kind: 'index', counts: [null, null, null, null, null, null, 122] },
  { label: 'ACME BRE (PSI-20)', sub: 'GAS — ethylene / methane', kind: 'gas', counts: [null, null, 5, 15, 13, 10, null] },
  { label: 'CFI-G (PSI-159)', sub: 'GAS — light fuels', kind: 'gas', counts: [9, 5, 83, 6, 11, 219, null] },
  { label: 'FLEX (PSI-69)', sub: 'LIQUID droplets', kind: 'liquid', counts: [58, 94, 54, 44, 24, null, null] },
]
const KIND_COLOR = { solid: C.solid, index: C.index, gas: C.gas, liquid: C.liquid }

function Fig3() {
  const max = 219
  const total = MATRIX.reduce((s, r) => s + r.counts.reduce<number>((a, b) => a + (b ?? 0), 0), 0)
  return (
    <div>
      <div className="grid grid-cols-[190px_repeat(7,1fr)] text-[11.5px]">
        <div />
        {BANDS.map((b, i) => (
          <div key={b} className={cn('px-1 pb-1 text-center text-dim', i === 4 && 'font-semibold text-flame')}>
            {b}
          </div>
        ))}
        {MATRIX.map((row) => (
          <div key={row.label} className="contents">
            <div className="flex flex-col justify-center border-t border-edge py-1.5 pr-2 text-right">
              <span className="font-semibold" style={{ color: KIND_COLOR[row.kind] }}>{row.label}</span>
              <span className="text-[10px] text-faint">{row.sub}</span>
            </div>
            {row.counts.map((c, i) => (
              <div
                key={i}
                className={cn('flex items-center justify-center border-t border-l border-edge font-mono text-[13px] font-semibold', i === 4 && 'border-x-2 border-x-flame/70')}
                style={{ background: c ? `color-mix(in oklch, ${KIND_COLOR[row.kind]} ${Math.round(12 + (c / max) * 70)}%, #0e1218)` : 'transparent' }}
                title={c ? `${row.label} · ${BANDS[i]} · ${c} records` : ''}
              >
                <span className={c ? 'text-text' : ''}>{c ?? ''}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-dim">
        <span className="font-semibold text-flame">▌ rover target (30 % O₂) band — gas-flame and droplet tests only</span>
        <span><span className="mr-1 inline-block size-2 rounded-sm" style={{ background: C.solid }} />solid-material tests</span>
        <span><span className="mr-1 inline-block size-2 rounded-sm" style={{ background: C.gas }} />gas flames (not material tests)</span>
        <span><span className="mr-1 inline-block size-2 rounded-sm" style={{ background: C.liquid }} />liquid droplets</span>
        <span><span className="mr-1 inline-block size-2 rounded-sm" style={{ background: C.index }} />index / no O₂ data</span>
        <span className="ml-auto font-mono">{total} records</span>
      </div>
    </div>
  )
}

export function EvidenceFigures() {
  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-[1180px] space-y-4">
        <div>
          <p className="text-[16px] font-semibold text-text">PSI evidence figures</p>
          <p className="text-[12px] text-dim">Generated from the experimental tables — values unchanged from DATA_ANAL.md §8. Switch any figure to “Original” to see the source image.</p>
        </div>
        <FigureCard
          n={1}
          title="Condition coverage — every solid-material test vs. the lunar rover cabin target"
          sub="Solid-material tests cluster at ~21.5–22.1 % O₂; the rover target sits in uncovered territory."
          source="Sources: PSI-99, PSI-98, PSI-100, PSI-25 experimental tables. Airflow-free BASS-II shown as O₂ band only. No 1/6-g data exists."
          png="/figures/fig1_condition_coverage.png"
        >
          <Fig1 />
        </FigureCard>
        <FigureCard
          n={2}
          title="Airflow direction and buoyancy — not material name — drive the outcome"
          sub="Saffire family, PSI-98 / PSI-99 — same sample cards as the evidence rows."
          source="Sources: PSI-98 and PSI-99 experimental tables (burn time; µg and 1-g burn length)."
          png="/figures/fig2_flow_direction_buoyancy.png"
        >
          <Fig2 />
        </FigureCard>
        <FigureCard
          n={3}
          title="Where the test mass sits — 914 test records by investigation and oxygen level"
          sub="Solid materials never above 22.2 % O₂; the 27–34 % band holds only gas-flame and droplet tests."
          source="Sources: PSI-98/99/100/25/26/20/159/69 experimental tables. BASS-II corrupted O₂ entry (M3, ‘223’) excluded."
          png="/figures/fig3_material_o2_matrix.png"
        >
          <Fig3 />
        </FigureCard>
      </div>
    </div>
  )
}
