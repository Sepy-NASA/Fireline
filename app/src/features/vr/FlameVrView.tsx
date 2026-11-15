import { Eye, Flame, Glasses, Info, Maximize, Pause, Play, Rewind, RotateCcw, Settings2, SkipBack, SkipForward, TriangleAlert, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/utils'
import { PALETTE_NAMES, FlameEngine, type FlameVrState, type SensorData } from './flameEngine'
import type { LutMetadata } from './flameField'
import { nearestTimeIndex } from './flameTime'
import modelCalibration from '../../../public/psi159/model-calibration.json'
import { ExperimentPicker } from './ExperimentPicker'
import type { ExperimentOption } from './flamePanels'

interface RealFrame { i: number; src: number; file: string; tMs: number }
interface PreviewIndex {
  testpoint: string; camera: string; totalFrames: number; w: number; h: number
  displayCounts: number; path: string; frames: RealFrame[]
}
interface TestPoint {
  id: string; label: string
  params?: { fuel: string; o2: number; p: number; burnSec: number; outcome: string
    massFlowMgS: number; fuelMoleFraction: number; configuration: 'normal' | 'inverse' }
}
type SourceMode = 'real' | 'physics'

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Cannot load ${url}: HTTP ${response.status}`)
  return response.json() as Promise<T>
}
async function fetchField(url: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Cannot load emission data: HTTP ${response.status}`)
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  // Servers may already apply Content-Encoding. Avoid decompressing twice.
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return buffer
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).arrayBuffer()
}

export function FlameVrView() {
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<FlameEngine | null>(null)
  const [state, setState] = useState<FlameVrState | null>(null)
  const [tests, setTests] = useState<TestPoint[]>([{ id: '21088A1', label: '21088A1' }])
  const testsRef = useRef(tests)
  const [selectedTest, setSelectedTest] = useState(() => new URLSearchParams(location.search).get('test') ?? '21088A1')
  const [mode, setMode] = useState<SourceMode>(() => new URLSearchParams(location.search).get('model') === 'physics' ? 'physics' : 'real')
  const [metadata, setMetadata] = useState<LutMetadata | null>(null)
  const [preview, setPreview] = useState<PreviewIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showTuning, setShowTuning] = useState(false)
  const [showEvidence, setShowEvidence] = useState(false)
  const [retry, setRetry] = useState(0)
  const experimentOptions = useMemo<ExperimentOption[]>(() => tests.map((test) => ({
    id: test.id,
    label: test.id,
    summary: test.params ? `${test.params.fuel} · O₂ ${(test.params.o2 * 100).toFixed(1)}% · ${test.params.p.toFixed(3)} bar` : test.label,
    detail: test.params ? `${test.params.configuration} configuration · ${test.params.massFlowMgS} mg/s · ${test.params.burnSec.toFixed(1)} s burn` : 'Recorded experiment',
  })), [tests])
  useEffect(() => { testsRef.current = tests }, [tests])
  useEffect(() => {
    const url = new URL(location.href)
    url.searchParams.set('test', selectedTest)
    if (mode === 'physics') url.searchParams.set('model', 'physics')
    else url.searchParams.delete('model')
    history.replaceState(null, '', url)
  }, [selectedTest, mode])

  useEffect(() => {
    const abort = new AbortController()
    fetchJson<{ tests: TestPoint[] }>('/psi159/tests.json', abort.signal)
      .then((catalog) => {
        if (catalog.tests?.length) {
          setTests(catalog.tests)
          setSelectedTest((id) => catalog.tests.some((test) => test.id === id) ? id : catalog.tests[0].id)
        }
      })
      .catch((error: unknown) => { if (!abort.signal.aborted) setLoadError(String(error)) })
    return () => abort.abort()
  }, [])

  useEffect(() => {
    if (!hostRef.current) return
    const engine = new FlameEngine(hostRef.current)
    engineRef.current = engine
    engine.onState(setState)
    engine.onExperimentSelectChange(setSelectedTest)
    void engine.checkSupport()
    engine.onTestSwitchChange((direction) => {
      setSelectedTest((id) => {
        const list = testsRef.current
        const index = list.findIndex((test) => test.id === id)
        return list[(Math.max(0, index) + direction + list.length) % list.length].id
      })
    })
    return () => { engine.dispose(); engineRef.current = null }
  }, [])

  useEffect(() => { engineRef.current?.setExperimentCatalog(experimentOptions) }, [experimentOptions])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const abort = new AbortController()
    engine.clearExperiment()
    setLoading(true)
    setLoadError(null)
    setMetadata(null)
    setPreview(null)
    const base = `/psi159/${selectedTest}/`
    void (async () => {
      try {
        const [meta, index, sensors] = await Promise.all([
          fetchJson<LutMetadata>(base + 'lut-index.json', abort.signal),
          fetchJson<PreviewIndex>(base + 'index.json', abort.signal),
          fetchJson<SensorData>(base + 'sensors.json', abort.signal),
        ])
        if (meta.testpoint !== selectedTest || index.testpoint !== selectedTest || sensors.testpoint !== selectedTest) throw new Error('Experiment manifests do not match the selected test')
        const field = await fetchField(base + meta.file, abort.signal)
        if (abort.signal.aborted) return
        engine.setRealLut(field, meta)
        engine.setFramePreview(base + index.path, index.frames.map((frame) => frame.file), index.frames.map((frame) => frame.tMs))
        engine.setSensors(sensors)
        setMetadata(meta)
        setPreview(index)
        setLoading(false)
      } catch (error) {
        if (abort.signal.aborted) return
        setLoading(false)
        const message = error instanceof Error ? error.message : String(error)
        engine.setExperimentLoadError(message)
        setLoadError(message)
      }
    })()
    return () => abort.abort()
  }, [selectedTest, retry])

  const params = tests.find((test) => test.id === selectedTest)?.params
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || metadata?.testpoint !== selectedTest) return
    if (mode === 'real') { engine.showReference(); return }
    if (!params) return
    engine.setPhysicsFlame({
      oxygen: params.o2, pressure: params.p, massFlowMgS: params.massFlowMgS,
      fuelMoleFraction: params.fuelMoleFraction, configuration: params.configuration,
      ignitionMs: metadata.ignitionMs, flowOnMs: metadata.flowOnMs, flowOffMs: metadata.flowOffMs,
      burnSeconds: params.burnSec, frameTimesMs: metadata.timesMs,
      durationMs: metadata.durationMs, geometry: metadata.geometry,
      ...modelCalibration.parameters,
    })
  }, [mode, metadata, params, selectedTest])

  useEffect(() => {
    engineRef.current?.setTestId(selectedTest, params
      ? `${params.fuel} · ${params.configuration} · O₂ ${(params.o2 * 100).toFixed(1)}% · ${params.p.toFixed(3)} bar · ${params.massFlowMgS} mg/s`
      : selectedTest)
  }, [selectedTest, params])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input,select,button,textarea,a,[contenteditable="true"]')) return
      if (event.code === 'Space') { event.preventDefault(); engineRef.current?.togglePlay() }
      else if (event.code === 'ArrowRight') engineRef.current?.step(1)
      else if (event.code === 'ArrowLeft') engineRef.current?.step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const seconds = ((state?.tMs ?? 0) / 1000).toFixed(2)
  const progress = state?.durationMs ? (state.tMs - state.startMs) / state.durationMs : 0
  const realFrame = preview?.frames[nearestTimeIndex(preview.frames.map((frame) => frame.tMs), state?.tMs ?? 0)]
  const quality = state?.source === 'real' ? metadata?.quality[state.frameIndex] : null
  const modelValidation = (modelCalibration.validation as Record<string, { relativeRadiusRmse: number; radiusRmseMeters: number; emissionProxyNrmse: number }>)[selectedTest]
  const isRewinding = state?.playing && state.direction === -1

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 border-b border-edge/60 bg-panel/80 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Flame className="size-5 text-flame" />
          <div><p className="text-[13px] font-semibold text-text">Flame VR</p><p className="text-[10px] text-faint">µg · spherical burner · experiment clock</p></div>
        </div>
        <div className="pointer-events-auto ml-auto flex items-center gap-2">
          <ExperimentPicker options={experimentOptions} selectedId={selectedTest} onSelect={setSelectedTest} />
          <label className="flex items-center gap-2 text-[10px] text-faint">Source
            <select aria-label="Flame source" value={mode} onChange={(event) => setMode(event.target.value as SourceMode)} className="h-8 rounded-md border border-edge bg-panel2 px-2 text-[11px] text-text">
              <option value="real">INTNS reconstruction</option><option value="physics">1D transport model</option>
            </select>
          </label>
          <button type="button" aria-label="Enter VR" onClick={() => void engineRef.current?.enterVR()} disabled={!state?.vrSupported || state.presenting} className="flex h-8 items-center gap-1 rounded-md border border-edge px-2 text-xs text-bright disabled:opacity-30"><Glasses className="size-4" /><span className="hidden md:inline">Enter VR</span></button>
          <button type="button" aria-label="Enter AR" onClick={() => void engineRef.current?.enterAR()} disabled={!state?.arSupported || state.presenting} className="flex h-8 items-center gap-1 rounded-md border border-edge px-2 text-xs text-dim disabled:opacity-30"><Eye className="size-4" /><span className="hidden md:inline">Enter AR</span></button>
          <button type="button" aria-label="Experiment evidence" aria-controls="flame-evidence" aria-expanded={showEvidence} onClick={() => setShowEvidence((value) => !value)} className="flex h-8 items-center rounded-md border border-edge px-2 text-dim lg:hidden"><Info className="size-4" /></button>
          {state?.presenting && <button type="button" onClick={() => void engineRef.current?.exitXR()} className="h-8 px-2 text-xs text-flame">Exit XR</button>}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 inset-x-0 flex justify-center px-2">
        <div className="pointer-events-auto w-full max-w-3xl rounded-xl border border-edge2 bg-panel/95 shadow-pop">
          <div className="flex items-center justify-between gap-3 border-b border-edge px-4 py-3">
            <div className="flex items-center gap-2 text-xs"><span className="text-dim">Experiment</span><span className="font-mono font-medium text-text">{selectedTest}</span><span className="hidden border-l border-edge2 pl-2 text-faint sm:inline">{state?.source === 'real' ? 'INTNS recording' : 'Transport model'}</span></div>
            <span className={cn('rounded-full px-2 py-1 text-[10px] font-medium', state?.playing ? 'bg-bright/10 text-bright' : 'bg-panel2 text-dim')}>{loading ? 'Loading…' : isRewinding ? 'Rewinding' : state?.playing ? 'Playing' : 'Paused'}</span>
          </div>
          <div className="px-4 pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <span data-testid="experiment-time" className="tnum font-mono text-lg text-text">{seconds}<span className="text-xs text-dim">s / {((state?.durationMs ?? 0) / 1000).toFixed(2)}s</span></span>
              <span className="tnum font-mono text-[10px] text-dim">Frame {(state?.frameIndex ?? 0) + 1} / {state?.frameCount ?? 0}</span>
            </div>
            <input type="range" aria-label="Timeline" aria-valuetext={`${seconds} seconds`} min={0} max={1} step={0.0001} value={progress} disabled={loading || !!loadError} onChange={(event) => engineRef.current?.seekFraction(Number(event.target.value))} className="h-7 w-full accent-[#4da3ff] disabled:opacity-40" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3">
            <div className="flex items-center gap-2">
              <IconBtn onClick={() => engineRef.current?.seekFraction(0)} label="Restart" disabled={loading || !!loadError}><RotateCcw className="size-4" /></IconBtn>
              <IconBtn onClick={() => engineRef.current?.step(-1)} label="Previous frame (←)" disabled={loading || !!loadError}><SkipBack className="size-4" /></IconBtn>
              <IconBtn onClick={() => isRewinding ? engineRef.current?.pause() : engineRef.current?.rewind()} label="Rewind — play backwards" active={!!isRewinding} disabled={loading || !!loadError}><Rewind className="size-4" /></IconBtn>
              <IconBtn onClick={() => engineRef.current?.togglePlay()} label={state?.playing && !isRewinding ? 'Pause playback (Space)' : 'Play forward (Space)'} accent disabled={loading || !!loadError}>{state?.playing && !isRewinding ? <Pause className="size-5" /> : <Play className="size-5" />}</IconBtn>
              <IconBtn onClick={() => engineRef.current?.step(1)} label="Next frame (→)" disabled={loading || !!loadError}><SkipForward className="size-4" /></IconBtn>
            </div>
            <div className="flex items-center gap-1.5">
              <IconBtn onClick={() => engineRef.current?.zoomBy(1.18)} label="Zoom out"><ZoomOut className="size-4" /></IconBtn>
              <IconBtn onClick={() => engineRef.current?.zoomBy(0.85)} label="Zoom in"><ZoomIn className="size-4" /></IconBtn>
              <IconBtn onClick={() => engineRef.current?.resetView()} label="Reset view"><Maximize className="size-4" /></IconBtn>
              <IconBtn onClick={() => setShowTuning((value) => !value)} label="Display settings" active={showTuning}><Settings2 className="size-4" /></IconBtn>
            </div>
          </div>
          {showTuning && <div className="grid grid-cols-2 gap-3 border-t border-edge p-4">
            <Field label="Emission palette"><select aria-label="Emission palette" value={state?.palette ?? 0} onChange={(event) => engineRef.current?.setPalette(Number(event.target.value))} className="h-7 w-full rounded border border-edge bg-panel2 text-[11px] text-text">{PALETTE_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}</select></Field>
            <Slider label="Exposure (fixed across time)" value={state?.exposure ?? 2} min={0.1} max={12} step={0.1} onChange={(value) => engineRef.current?.setExposure(value)} />
            <Slider label="Absorption (independent of emission)" value={state?.density ?? 0} min={0} max={4} step={0.05} onChange={(value) => engineRef.current?.setDensity(value)} />
            <Slider label="Display gamma" value={state?.gamma ?? 1} min={0.5} max={2} step={0.05} onChange={(value) => engineRef.current?.setGamma(value)} />
            <Slider label="Display signal cutoff" value={state?.threshold ?? 0} min={0} max={0.05} step={0.001} onChange={(value) => engineRef.current?.setThreshold(value)} />
            <Slider label="Ray quality" value={state?.quality ?? 1} min={0.3} max={1.6} step={0.05} onChange={(value) => engineRef.current?.setQuality(value)} />
          </div>}
        </div>
      </div>

      <div className="pointer-events-none absolute left-3 top-12 flex w-[200px] flex-col gap-2">
        <StatusChip><span className="font-mono">rendered {state?.framesRendered ?? 0} · {state?.frameCount ?? 0} fields</span></StatusChip>
        <StatusChip tone={loading || state?.busy || loadError ? 'muted' : 'ok'}>{loading ? 'Loading experiment…' : loadError ? 'No experiment loaded' : state?.busy ? `Computing model ${Math.round(state.modelProgress * 100)}%` : state?.source === 'real' ? 'field: measured INTNS + inference' : 'field: reduced 1D hot-flame model'}</StatusChip>
        <StatusChip>{state?.presenting ? `presenting ${state.arMode ? 'AR' : 'VR'}` : state?.vrSupported ? 'WebXR ready' : 'desktop · no WebXR'}</StatusChip>
        {state?.presenting && <StatusChip tone={state.trackedHands ? 'ok' : 'muted'}>Hands: {state.trackedHands}/2 · {state.handHint}</StatusChip>}
        {quality && quality.saturatedFraction > 0.01 && <StatusChip tone="bad">Saturated camera frame · limited radiometry</StatusChip>}
        {quality?.inferredFromPrior && <StatusChip tone="bad">Limited frame · spherical inference</StatusChip>}
        {(state?.xrError || state?.modelError) && <StatusChip tone="bad">{state.xrError || state.modelError}</StatusChip>}
        {!!state?.renderErrors.length && <StatusChip tone="bad">render errors: {state.renderErrors.length}</StatusChip>}
        <div className="pointer-events-auto rounded-md border border-edge bg-panel/85 p-2 backdrop-blur-sm">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-text"><Eye className="size-3 text-bright" />Reference · {preview?.camera ?? 'INTNS'}</p>
          {realFrame && preview ? <img src={`/psi159/${selectedTest}/${preview.path}${realFrame.file}`} alt={`INTNS frame ${realFrame.src} at ${(realFrame.tMs / 1000).toFixed(3)} seconds`} className="w-full rounded-sm border border-edge bg-black" draggable={false} /> : <div className="h-32 text-[10px] text-faint">{loading ? 'Loading reference…' : 'Reference unavailable'}</div>}
          <p className="mt-1 text-[9px] leading-relaxed text-faint">src #{realFrame?.src ?? '—'} · {realFrame ? (realFrame.tMs / 1000).toFixed(3) : '—'}s<br />{preview ? `${preview.w}×${preview.h} · fixed 0–${preview.displayCounts} counts` : 'Mono16 intensified camera'}</p>
        </div>
      </div>

      <div id="flame-evidence" className={cn('pointer-events-none absolute right-3 top-12 max-w-[270px]', showEvidence ? 'block' : 'hidden lg:block')}>
        <div className="pointer-events-auto space-y-2 rounded-md border border-edge bg-panel/85 p-3 text-[10px] leading-relaxed text-dim backdrop-blur-sm">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-text"><Info className="size-3 text-bright" />Experiment & evidence</p>
          <p>{selectedTest} · {params?.fuel ?? 'ethane'} · {params?.configuration ?? 'normal'}<br />O₂ {((params?.o2 ?? 0) * 100).toFixed(2)}% · {params?.p.toFixed(4)} bar · {params?.massFlowMgS} mg/s · µg</p>
          {metadata && <p>{metadata.frames} source frames · {metadata.fps.toFixed(2)} samples/s<br />Acquisition clock shared with reference and sensors.</p>}
          <p>{loading ? 'Loading INTNS reference and acquisition metadata.' : state?.source === 'real' ? 'Masked Abel reconstruction. Hidden regions use a spherical prior; they are inferred.' : 'Finite-volume radial transport, finite-rate hot reaction, radiation and burner heat exchange. Cool-flame chemistry is outside this reduced model.'}</p>
          {metadata && state?.source === 'real' && <p>Projection error: {metadata.validation.medianProjectionNrmse == null ? 'unavailable' : `${(metadata.validation.medianProjectionNrmse * 100).toFixed(1)}% median NRMSE`} over {metadata.validation.framesCompared} usable frames.</p>}
          {metadata && !loading && state?.source === 'physics' && modelValidation && <p>Radius RMSE vs INTNS: {(modelValidation.radiusRmseMeters * 1000).toFixed(2)} mm ({(modelValidation.relativeRadiusRmse * 100).toFixed(1)}%). Emission-proxy NRMSE: {(modelValidation.emissionProxyNrmse * 100).toFixed(0)}%. Coefficients fit on A1; B1/C1 are holdouts. Self-extinction is not calibrated.</p>}
          <p>Scale: {metadata?.geometry.scaleStatus ?? 'estimated'} · display enlarged {state?.magnification.toFixed(1)}×. Absolute radiance and temperature are uncalibrated.</p>
          <p>Palette: {PALETTE_NAMES[state?.palette ?? 0]}. Colour is illustrative.</p>
          <div className="space-y-1 border-t border-edge pt-2">
            <p className="font-semibold text-text">Hand controls in VR / AR</p>
            <p>Enable hand tracking in your headset. Point at an object or bring your hand to its surface. Pinch your thumb and index finger to grab the flame, a chart or the preview.</p>
            <p>Move your hand to reposition the object and turn your wrist to rotate it. Grab the same object with both hands and move them apart or together to resize it. Turn the line between your hands to rotate the object.</p>
            <p>Open your fingers to release. Pinch the buttons below the scene for play / pause, rewind, flame size, reset layout, frames and tests. The experiment name is shown on the playback panel.</p>
            <p>To scrub the recording, pinch the timeline below the buttons and move your hand left or right. Open your fingers to leave the recording paused at the selected time.</p>
          </div>
          <p className="text-faint">NASA PSI-159 ACME CFI-G · DOI 10.60555/cyt1-kh64 · CC0.</p>
          <p className="flex gap-1 text-amber"><TriangleAlert className="mt-0.5 size-3 shrink-0" />Physical headset validation pending.</p>
        </div>
      </div>
      {loading && <div role="status" className="pointer-events-none absolute inset-x-0 bottom-40 text-center text-sm text-dim">Loading {selectedTest}…</div>}
      {loadError && <div role="alert" className="absolute inset-x-0 bottom-40 mx-auto max-w-lg rounded border border-flame/40 bg-panel p-4 text-sm text-text">{loadError}<button type="button" onClick={() => setRetry((value) => value + 1)} className="ml-3 underline">Retry</button></div>}
    </div>
  )
}

function IconBtn({ children, onClick, label, accent, active, disabled }: {
  children: React.ReactNode
  onClick: () => void
  label: string
  accent?: boolean
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center rounded-lg border disabled:opacity-40',
        accent
          ? 'size-11 border-bright bg-bright text-ink hover:bg-bright/80'
          : active
            ? 'size-9 border-bright/40 bg-bright/10 text-bright'
            : 'size-9 border-edge text-dim hover:border-edge2 hover:bg-panel2 hover:text-text',
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
        <span className="tnum font-mono text-dim">{value.toFixed(step < 0.01 ? 3 : 2)}</span>
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
