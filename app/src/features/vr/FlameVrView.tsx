import {
  Eye,
  Flame,
  Glasses,
  Info,
  Maximize,
  Pause,
  Play,
  Rewind,
  RotateCcw,
  Settings2,
  SkipBack,
  SkipForward,
  TriangleAlert,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'
import { PALETTE_NAMES, FlameEngine, type FlameVrState } from './flameEngine'

/* ————————————————————————————————————————————————————————————
   Flame VR — volumetric 3D flame visualisation (WebXR-ready).

   The ε(r,z) field is SYNTHETIC (mock): the repo ships no PSI-159
   The default 3D field is an axisymmetric Abel reconstruction from the
   real PSI-159 HOBJ frames; a fluid+combustion solver is the fallback.
   Colours are explicitly false-colour, not temperature.
   VR/AR paths are implemented but have NOT been verified on a physical
   Quest 3 — the UI records frame/error counters so this stays honest.
   ———————————————————————————————————————————————————————————— */

const PALETTE_LABELS = ['Flame', 'Inferno', 'Ice']

interface RealFrame {
  i: number
  src: number
  file: string
  tMs: number
}

interface TestPoint {
  id: string
  label: string
  frames?: number
  params?: {
    fuel: string
    o2: number
    p: number
    burnSec: number
    outcome: string
    tBurnerC: number
    tadK: number
    note?: string
  }
}

export function FlameVrView() {
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<FlameEngine | null>(null)
  const [state, setState] = useState<FlameVrState | null>(null)
  const [gravity, setGravity] = useState(0.8)
  const [palette, setPalette] = useState(0)
  const [threshold, setThreshold] = useState(0.15)
  const [density, setDensity] = useState(170)
  const [gamma, setGamma] = useState(1)
  const [quality, setQuality] = useState(2)
  const [showTuning, setShowTuning] = useState(false)
  const [realFrames, setRealFrames] = useState<RealFrame[] | null>(null)
  const [tests, setTests] = useState<TestPoint[]>([{ id: '21088A1', label: '21088A1' }])
  const testsRef = useRef<TestPoint[]>(tests)
  useEffect(() => {
    testsRef.current = tests
  }, [tests])
  const [selectedTest, setSelectedTest] = useState(
    () => new URLSearchParams(location.search).get('test') ?? '21088A1',
  )

  // test-point catalog (PSI-159 CFI-G)
  useEffect(() => {
    fetch('/psi159/tests.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { tests: TestPoint[] }) => {
        if (Array.isArray(j.tests) && j.tests.length) setTests(j.tests)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const engine = new FlameEngine(host, 0.8)
    engineRef.current = engine
    engine.onState(setState)
    engine.checkSupport()
    engine.onTestSwitchChange((dir) => {
      setSelectedTest((prev) => {
        const list = testsRef.current
        const i = list.findIndex((t) => t.id === prev)
        if (i < 0 || list.length < 2) return prev
        return list[(i + dir + list.length) % list.length].id
      })
    })
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  // load the selected real-HOBJ test point: frame manifest + epsilon(r,z) LUT
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    let cancelled = false
    ;(async () => {
      try {
        const framesMeta = await fetch(`/psi159/${selectedTest}/index.json`).then((r) => {
          if (!r.ok) throw new Error(String(r.status))
          return r.json()
        })
        const lutMeta = await fetch(`/psi159/${selectedTest}/lut-index.json`).then((r) => r.json())
        const buf = await (await fetch(`/psi159/${selectedTest}/lut.bin`)).arrayBuffer()
        const sensors = await fetch(`/psi159/${selectedTest}/sensors.json`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
        if (cancelled) return
        const frames = framesMeta.frames as RealFrame[]
        setRealFrames(frames)
        engine.setRealLut(buf, lutMeta)
        engine.setFramePreview(`/psi159/${selectedTest}/frames/`, frames.map((f) => f.file))
        if (sensors) engine.setSensors(sensors)
      } catch {
        if (!cancelled) setRealFrames(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedTest])

  // push the selected test + its experiment parameters to the in-VR HUD
  useEffect(() => {
    const tp = tests.find((x) => x.id === selectedTest)
    const p = tp?.params
    const info = p
      ? `${p.fuel} · O₂ ${(p.o2 * 100).toFixed(1)}% · ${p.p.toFixed(2)} bar · ${p.burnSec}s · ${p.outcome}`
      : ''
    engineRef.current?.setTestId(selectedTest, info)
  }, [selectedTest, tests])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        engineRef.current?.togglePlay()
      } else if (e.code === 'ArrowRight') {
        engineRef.current?.step(1)
      } else if (e.code === 'ArrowLeft') {
        engineRef.current?.step(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const frames = state?.frameCount ?? 0
  const progress = frames > 1 ? (state?.frameIndex ?? 0) / (frames - 1) : 0
  const realFrame = realFrames?.[state?.frameIndex ?? 0] ?? null
  const seconds = realFrame
    ? (realFrame.tMs / 1000).toFixed(2)
    : state
      ? (state.tMs / 1000).toFixed(2)
      : '0.00'
  const isRewinding = Boolean(state?.playing && state.direction === -1)

  // move the chart playhead to the current real-frame timestamp
  useEffect(() => {
    if (realFrame) engineRef.current?.setPlayhead(realFrame.tMs / 1000)
  }, [realFrame])

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink">
      {/* three.js canvas */}
      <div ref={hostRef} className="absolute inset-0" />

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 border-b border-edge/60 bg-panel/80 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-sm bg-flame/20">
            <Flame className="size-3.5 text-flame" strokeWidth={2.4} />
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight text-text">Flame VR</p>
            <p className="text-[10px] leading-tight text-faint">
              axisymmetric ε(r,z) · ray-marched volume · WebXR
            </p>
          </div>
        </div>

        <div className="pointer-events-auto ml-auto flex items-center gap-2">
          <span className="text-[10px] text-faint">Test</span>
          <select
            value={selectedTest}
            onChange={(e) => setSelectedTest(e.target.value)}
            className="h-7 rounded-md border border-edge bg-panel2 px-1.5 text-[11px] text-text focus:outline-2 focus:outline-bright"
            aria-label="Test point"
          >
            {tests.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          {(() => {
            const p = tests.find((x) => x.id === selectedTest)?.params
            return p ? (
              <span className="hidden max-w-[320px] truncate text-[9px] text-faint xl:inline">
                {p.fuel} · O₂ {(p.o2 * 100).toFixed(1)}% · {p.p.toFixed(2)} bar · burn {p.burnSec}s · {p.outcome}
              </span>
            ) : null
          })()}
          <div className="mx-1 h-5 w-px bg-edge" />
          <button
            onClick={() => engineRef.current?.enterVR()}
            disabled={state?.vrSupported === false || state?.presenting}
            className="flex h-8 items-center gap-1.5 rounded-md bg-bright/15 px-3 text-xs font-medium text-bright transition-colors hover:bg-bright/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Glasses className="size-3.5" />
            {state?.presenting && !state.arMode ? 'In VR' : 'Enter VR'}
          </button>
          <button
            onClick={() => engineRef.current?.enterAR()}
            disabled={state?.arSupported === false || state?.presenting}
            className="flex h-8 items-center gap-1.5 rounded-md border border-edge px-3 text-xs font-medium text-dim transition-colors hover:border-edge2 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Eye className="size-3.5" />
            {state?.presenting && state.arMode ? 'In AR' : 'Enter AR'}
          </button>
          {state?.presenting && (
            <button
              onClick={() => engineRef.current?.exitXR()}
              className="flex h-8 items-center gap-1.5 rounded-md border border-flame/40 px-3 text-xs font-medium text-flame transition-colors hover:bg-flame/10"
            >
              Exit
            </button>
          )}
        </div>
      </div>

      {/* control deck */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3">
        <div className="pointer-events-auto w-[min(680px,calc(100%-16px))] rounded-lg border border-edge bg-panel/90 p-3 shadow-pop backdrop-blur-sm">
          {/* transport */}
          <div className="flex items-center gap-2">
            <IconBtn onClick={() => engineRef.current?.step(-1)} label="Previous frame (←)">
              <SkipBack className="size-4" />
            </IconBtn>
            <IconBtn
              onClick={() => (isRewinding ? engineRef.current?.pause() : engineRef.current?.rewind())}
              label="Rewind — play backwards"
              active={isRewinding}
            >
              <Rewind className="size-4" />
            </IconBtn>
            <IconBtn
              onClick={() => engineRef.current?.togglePlay()}
              label="Play forward / pause (Space)"
              accent
            >
              {state?.playing && !isRewinding ? <Pause className="size-4" /> : <Play className="size-4" />}
            </IconBtn>
            <IconBtn onClick={() => engineRef.current?.step(1)} label="Next frame (→)">
              <SkipForward className="size-4" />
            </IconBtn>
            <IconBtn onClick={() => engineRef.current?.seekFraction(0)} label="Restart">
              <RotateCcw className="size-4" />
            </IconBtn>

            <div className="mx-1 h-6 w-px bg-edge" />

            <input
              type="range"
              min={0}
              max={1}
              step={frames > 1 ? 1 / (frames - 1) : 1}
              value={progress}
              onChange={(e) => engineRef.current?.seekFraction(Number(e.target.value))}
              className="min-w-0 flex-1 accent-[#4da3ff]"
              aria-label="Timeline"
            />
            <span className="tnum w-32 shrink-0 text-right font-mono text-[11px] text-dim">
              {(state?.frameIndex ?? 0) + 1}/{frames} · {seconds}s
            </span>

            <IconBtn onClick={() => setShowTuning((v) => !v)} label="Tuning" active={showTuning}>
              <Settings2 className="size-4" />
            </IconBtn>
          </div>

          {/* camera + hints (always visible) */}
          <div className="mt-2 flex items-center gap-2 border-t border-edge pt-2">
            <IconBtn onClick={() => engineRef.current?.zoomBy(1.18)} label="Zoom out">
              <ZoomOut className="size-4" />
            </IconBtn>
            <IconBtn onClick={() => engineRef.current?.zoomBy(0.85)} label="Zoom in">
              <ZoomIn className="size-4" />
            </IconBtn>
            <IconBtn onClick={() => engineRef.current?.resetView()} label="Reset view">
              <Maximize className="size-4" />
            </IconBtn>
            <p className="ml-1 text-[10px] leading-tight text-faint">
              LPM obrót · PPM przesuń · rolka zoom · ←/→ klatka · Spacja play/pauza
            </p>
          </div>

          {/* tuning */}
          {showTuning && (
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-edge pt-3">
              <div>
                <Slider
                  label="Gravity (0 = µg)"
                  value={gravity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => {
                    setGravity(v)
                    engineRef.current?.setGravity(v)
                  }}
                />
                <button
                  onClick={() => engineRef.current?.resimulate()}
                  className="mt-1 flex h-7 w-full items-center justify-center gap-1.5 rounded-md border border-bright/40 bg-bright/10 text-[11px] font-medium text-bright transition-colors hover:bg-bright/20"
                >
                  <Flame className="size-3" /> Re-simulate
                </button>
              </div>
              <Field label="False colour">
                <select
                  value={palette}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setPalette(v)
                    engineRef.current?.setPalette(v)
                  }}
                  className="h-7 w-full rounded-md border border-edge bg-panel2 px-1.5 text-[11px] text-text focus:outline-2 focus:outline-bright"
                >
                  {PALETTE_LABELS.map((p, i) => (
                    <option key={p} value={i}>{p}</option>
                  ))}
                </select>
              </Field>
              <Slider label="Threshold" value={threshold} min={0} max={0.9} step={0.01} onChange={(v) => { setThreshold(v); engineRef.current?.setThreshold(v) }} />
              <Slider label="Density" value={density} min={10} max={2000} step={10} onChange={(v) => { setDensity(v); engineRef.current?.setDensity(v) }} />
              <Slider label="Gamma" value={gamma} min={0.4} max={3} step={0.05} onChange={(v) => { setGamma(v); engineRef.current?.setGamma(v) }} />
              <Slider label="Ray quality" value={quality} min={0.25} max={1.6} step={0.05} onChange={(v) => { setQuality(v); engineRef.current?.setQuality(v) }} />
            </div>
          )}
        </div>
      </div>

      {/* status rail (left) */}
      <div className="pointer-events-none absolute left-3 top-12 flex flex-col gap-2">
        <StatusChip>
          <span className="tnum font-mono">rendered {state?.framesRendered ?? 0}</span>
        </StatusChip>
        <StatusChip tone={state?.source === 'real' ? 'ok' : 'muted'}>
          {state?.source === 'real' ? 'field: real HOBJ (Abel)' : 'field: fallback simulation'}
        </StatusChip>
        {state?.presenting ? (
          <StatusChip tone="ok">
            presenting {state.arMode ? 'immersive-ar' : 'immersive-vr'}
          </StatusChip>
        ) : (
          <StatusChip tone="muted">
            {state?.vrSupported == null ? 'XR: checking…' : state.vrSupported ? 'XR ready' : 'no WebXR'}
          </StatusChip>
        )}
        {state?.xrError && (
          <StatusChip tone="bad" className="max-w-[240px]">
            {state.xrError}
          </StatusChip>
        )}
        {(state?.renderErrors.length ?? 0) > 0 && (
          <StatusChip tone="bad">render errors: {state?.renderErrors.length}</StatusChip>
        )}

        {/* real DataCam frame — synced with the simulation timeline */}
        <div className="pointer-events-auto w-[200px] rounded-md border border-edge bg-panel/85 p-2 backdrop-blur-sm">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-text">
            <Eye className="size-3 text-bright" /> Real frame · DataCam
          </p>
          {realFrame ? (
            <img
              src={`/psi159/${selectedTest}/frames/${realFrame.file}`}
              alt={`Real DataCam frame ${realFrame.src}`}
              className="w-full rounded-sm border border-edge bg-black"
              draggable={false}
            />
          ) : (
            <div className="flex h-[150px] items-center justify-center text-[10px] text-faint">
              loading…
            </div>
          )}
          <p className="tnum mt-1 text-[9px] leading-tight text-faint">
            src #{realFrame?.src ?? '—'} · {seconds}s
            <br />
            raw 1360×1024 · fixed 0–2000 scale
          </p>
        </div>
      </div>

      {/* provenance / disclaimer (right) */}
      <div className="pointer-events-none absolute right-3 top-12 max-w-[300px]">
        <div className="pointer-events-auto rounded-md border border-edge bg-panel/85 p-2.5 text-[10px] leading-relaxed text-dim backdrop-blur-sm">
          <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-text">
            <Info className="size-3 text-bright" /> Provenance &amp; limits
          </p>
          <p>
            <span className="text-faint">3D:</span> axisymmetric Abel reconstruction from the real
            PSI-159 HOBJ frames (fallback: fluid + combustion simulation).
          </p>
          <p className="mt-1">
            <span className="text-faint">2D:</span> real DataCam frames from PSI-159 test 21088A1
            (120 sampled HOBJ frames, synced to the timeline).
          </p>
          <p className="mt-1">
            <span className="text-faint">Colour:</span> explicit false-colour ({PALETTE_NAMES[palette]}) —
            not temperature, not measured RGB.
          </p>
          <p className="mt-1">
            <span className="text-faint">Source:</span> PSI-159 ACME CFI-G · DOI 10.60555/cyt1-kh64 ·
            CC0 · test 21088A1 (Intensified 2017 fr · ACME 696 · IPSU1 1076).
          </p>
          <p className="mt-1 flex items-start gap-1 text-amber">
            <TriangleAlert className="mt-0.5 size-3 shrink-0" />
            VR/AR implemented but not yet verified on a physical Quest 3.
          </p>
        </div>
      </div>
    </div>
  )
}

function IconBtn({ children, onClick, label, accent, active }: {
  children: React.ReactNode
  onClick: () => void
  label: string
  accent?: boolean
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'flex size-8 items-center justify-center rounded-md border transition-colors',
        accent
          ? 'border-bright/40 bg-bright/15 text-bright hover:bg-bright/25'
          : active
            ? 'border-edge2 bg-panel2 text-bright'
            : 'border-edge text-dim hover:border-edge2 hover:text-text',
      )}
    >
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] text-faint">{label}</span>
      {children}
    </label>
  )
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-0.5 flex justify-between text-[10px] text-faint">
        {label}
        <span className="tnum font-mono text-dim">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#4da3ff]"
      />
    </label>
  )
}

function StatusChip({ children, tone = 'muted', className }: {
  children: React.ReactNode
  tone?: 'muted' | 'ok' | 'bad'
  className?: string
}) {
  return (
    <div
      className={cn(
        'pointer-events-auto rounded-md border px-2 py-1 text-[10px] backdrop-blur-sm',
        tone === 'ok' && 'border-teal/40 bg-teal/10 text-teal',
        tone === 'bad' && 'border-flame/40 bg-flame/10 text-flame',
        tone === 'muted' && 'border-edge bg-panel/80 text-dim',
        className,
      )}
    >
      {children}
    </div>
  )
}
