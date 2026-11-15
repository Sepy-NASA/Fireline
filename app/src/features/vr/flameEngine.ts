import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { FLAME_FRAGMENT, FLAME_VERTEX } from './flameShader'
import { decodeLut, emptySequence, LUT_R, LUT_Z, type FlameSequence, type LutMetadata } from './flameField'
import { bracketTime, nearestTimeIndex, validateTimes } from './flameTime'
import { eyeOriginInVolume } from './flameCamera'
import { HandManipulation, PinchGesture, handSliderPoint, pickHandTarget, type HandTarget } from './flameHands'
import { drawExperimentCard, drawPlaybackHeading, drawPlaybackSurface, drawPlaybackTimeline, drawPlayerButton, drawSensorPanel, timelineFraction, type ExperimentOption, type PlayerIcon } from './flamePanels'

/* ————————————————————————————————————————————————————————————
   three.js engine for the axisymmetric flame volume:
   • desktop orbit camera + raymarched ε(r,z) LUT
   • WebXR immersive-vr / immersive-ar (Quest 3 target), stereo
     rendering of the same scene, controller fallback controls
   • honest counters: framesRendered increments only AFTER a
     successful render; render errors are captured and surfaced.
   ———————————————————————————————————————————————————————————— */

export interface FlameVrState {
  vrSupported: boolean | null
  arSupported: boolean | null
  presenting: boolean
  arMode: boolean
  playing: boolean
  /** +1 = forward, −1 = rewinding */
  direction: 1 | -1
  gravity: number
  frameIndex: number
  frameCount: number
  fps: number
  tMs: number
  durationMs: number
  startMs: number
  magnification: number
  exposure: number
  framesRendered: number
  renderErrors: string[]
  xrError: string | null
  threshold: number
  density: number
  gamma: number
  palette: number
  quality: number
  trackedHands: number
  handHint: string
}

export interface SensorSeries {
  name: string
  min: number
  max: number
  v: (number | null)[]
}
export interface SensorData {
  testpoint: string
  t: number[]
  series: SensorSeries[]
}

const PALETTE_NAMES = ['blue emission (illustrative)', 'INTNS grayscale', 'inferno (false colour)'] as const

const HAND_JOINTS = [
  'wrist',
  'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip',
] as const

const HAND_BONES: [XRHandJoint, XRHandJoint][] = [
  ['wrist', 'thumb-metacarpal'], ['thumb-metacarpal', 'thumb-phalanx-proximal'],
  ['thumb-phalanx-proximal', 'thumb-phalanx-distal'], ['thumb-phalanx-distal', 'thumb-tip'],
  ['wrist', 'index-finger-metacarpal'], ['index-finger-metacarpal', 'index-finger-phalanx-proximal'],
  ['index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate'],
  ['index-finger-phalanx-intermediate', 'index-finger-phalanx-distal'], ['index-finger-phalanx-distal', 'index-finger-tip'],
  ['wrist', 'middle-finger-metacarpal'], ['middle-finger-metacarpal', 'middle-finger-phalanx-proximal'],
  ['middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate'],
  ['middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal'], ['middle-finger-phalanx-distal', 'middle-finger-tip'],
  ['wrist', 'ring-finger-metacarpal'], ['ring-finger-metacarpal', 'ring-finger-phalanx-proximal'],
  ['ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate'],
  ['ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal'], ['ring-finger-phalanx-distal', 'ring-finger-tip'],
  ['wrist', 'pinky-finger-metacarpal'], ['pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal'],
  ['pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate'],
  ['pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal'], ['pinky-finger-phalanx-distal', 'pinky-finger-tip'],
]

/** start playback on a bright, stable burn frame (pre-ignition is empty) */
const INITIAL_FRAME_FRACTION = 0.6

export class FlameEngine {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls | null = null
  private box!: THREE.Mesh
  private burner!: THREE.Mesh
  private support!: THREE.Mesh
  private flameGroup = new THREE.Group()
  private material!: THREE.ShaderMaterial
  private uniforms: Record<string, THREE.IUniform>
  private tmp = new THREE.Vector3()
  private inverseVolume = new THREE.Matrix4()
  private shaderFailed = false
  private resizeObserver: ResizeObserver | null = null

  private sequence: FlameSequence = emptySequence()
  private times: number[] = [0]
  private timeMs = 0
  private reference: FlameSequence | null = null
  private experimentLoading = false
  private experimentLoadError: string | null = null
  private playing = false
  private direction: 1 | -1 = 1
  private uploadedA = -1
  private uploadedB = -1
  private lastTick = 0

  private controllerR: THREE.XRTargetRaySpace
  private controllerL: THREE.XRTargetRaySpace

  private threshold = 0
  private density = 0
  private exposure = 2
  private gamma = 1.0
  private palette = 0
  private quality = 1.0

  private vrSupported: boolean | null = null
  private arSupported: boolean | null = null
  private presenting = false
  private arMode = false
  private xrError: string | null = null

  private framesRendered = 0
  private renderErrors: string[] = []

  private disposed = false
  private lastEmit = 0
  private onStateCb: ((s: FlameVrState) => void) | null = null
  private onTestSwitch: ((dir: 1 | -1) => void) | null = null
  private testId = ''
  private testInfo = ''
  private playbackTitleCanvas: HTMLCanvasElement | null = null
  private playbackTitleTexture: THREE.CanvasTexture | null = null
  private playbackTitleTarget: HandTarget | null = null
  private playerTextures = new Set<THREE.Texture>()
  private playerMain = new THREE.Group()
  private playerPicker = new THREE.Group()
  private hoveredPlayerMeshes = new Set<THREE.Mesh>()
  private playerControls: { key: string; icon: PlayerIcon; label: string; primary: boolean; canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; mesh: THREE.Mesh; signature: string }[] = []
  private experimentOptions: ExperimentOption[] = []
  private experimentTargets: HandTarget[] = []
  private experimentCards: { option: ExperimentOption; canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; mesh: THREE.Mesh; signature: string }[] = []
  private experimentPickerOpen = false
  private onExperimentSelect: ((id: string) => void) | null = null
  private lastStick = 0
  private sensorData: SensorData | null = null
  private panels: {
    mesh: THREE.Mesh
    canvas: HTMLCanvasElement
    tex: THREE.CanvasTexture
    series: SensorSeries[]
    title: string
  }[] = []
  private manipulation = new HandManipulation()
  private trackedHands = 0
  private handHint = 'Show your hands in front of the headset'
  private toolbar = new THREE.Group()
  private handButtons: HandTarget[] = []
  private handScrubs = new Map<THREE.Object3D, { target: HandTarget; distant: boolean }>()
  private timelineCanvas: HTMLCanvasElement | null = null
  private timelineTexture: THREE.CanvasTexture | null = null
  private lastTimelineDraw = 0
  private hoverOutline = new THREE.Box3Helper(new THREE.Box3(), 0x4da3ff)
  private pendingXRLayout = 0
  private desktopView: { position: THREE.Vector3; quaternion: THREE.Quaternion; target: THREE.Vector3 } | null = null
  private savedLayouts = new Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }>()
  private previewMesh: THREE.Mesh | null = null
  private previewBase = ''
  private previewFiles: string[] = []
  private previewTimes: number[] = []
  private previewIndex = -1
  private previewEpoch = 0
  private texCache = new Map<string, THREE.Texture>()
  private playhead = 0
  private lastPanelDraw = 0
  private handVisuals: {
    hand: THREE.XRHandSpace
    ray: THREE.XRTargetRaySpace
    source: XRInputSource | null
    pose: THREE.Group
    gesture: PinchGesture
    tracked: boolean
    pointer: THREE.Line
    cursor: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
    spheres: THREE.Mesh[]
    lines: THREE.LineSegments
  }[] = []

  constructor(container: HTMLElement) {
    this.container = container

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
      this.shaderFailed = true
      this.pushError(new Error([gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment)].filter(Boolean).join('\n') || 'Flame shader compilation failed'))
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.setClearColor(0x05070b, 1)
    this.renderer.xr.enabled = true
    this.renderer.xr.setFoveation(0.5)
    // Scene heights are measured from the floor, not from the initial eye pose.
    this.renderer.xr.setReferenceSpaceType('local-floor')

    container.appendChild(this.renderer.domElement)
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.style.display = 'block'

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 20)
    this.camera.position.set(0, 1.62, 0.06)
    this.camera.lookAt(0, 1.42, -1.7)

    this.uniforms = {
      uCamLocal: { value: new THREE.Vector3() },
      uFieldA: { value: this.makeFieldTexture() },
      uFieldB: { value: this.makeFieldTexture() },
      uMix: { value: 0 },
      uThreshold: { value: this.threshold },
      uDensity: { value: this.density },
      uExposure: { value: this.exposure },
      uBurnerRadius: { value: this.sequence.geometry.burnerRadiusMeters / this.sequence.geometry.domainMeters },
      uGamma: { value: this.gamma },
      uQuality: { value: this.quality },
      uPalette: { value: this.palette },
    }

    this.material = new THREE.ShaderMaterial({
      vertexShader: FLAME_VERTEX,
      fragmentShader: FLAME_FRAGMENT,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      premultipliedAlpha: true,
      depthWrite: false,
      depthTest: false,
    })

    this.box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.material)
    this.box.frustumCulled = false
    this.box.renderOrder = 10
    this.box.updateMatrixWorld(true)
    this.flameGroup.add(this.box)
    this.scene.add(this.flameGroup)

    this.buildScene()
    this.buildHandVisuals()
    this.buildHandToolbar()
    this.hoverOutline.visible = false
    ;(this.hoverOutline.material as THREE.Material).depthTest = false
    this.hoverOutline.renderOrder = 90
    this.scene.add(this.hoverOutline)

    this.material.onBeforeRender = (_renderer, _scene, eyeCamera) => {
      eyeOriginInVolume(eyeCamera.matrixWorld, this.box.matrixWorld, this.tmp, this.inverseVolume)
      this.uniforms.uCamLocal.value.copy(this.tmp)
      this.material.uniformsNeedUpdate = true
    }

    this.setupControls()

    this.controllerR = this.renderer.xr.getController(0)
    this.controllerL = this.renderer.xr.getController(1)
    this.controllerR.add(this.makeRay())
    this.controllerL.add(this.makeRay())
    this.scene.add(this.controllerR, this.controllerL)

    // controller fallback controls (also used for hand-less headsets)
    // Hand pinches are processed from joints, never as playback/controller events.
    this.controllerR.addEventListener('selectstart', (event) => { if (!event.data.hand) this.togglePlay() })
    this.controllerL.addEventListener('selectstart', (event) => { if (!event.data.hand) this.togglePlay() })
    this.controllerR.addEventListener('squeezestart', (event) => { if (!event.data.hand && this.presenting) this.tryGrab(this.controllerR) })
    this.controllerL.addEventListener('squeezestart', (event) => { if (!event.data.hand && this.presenting) this.tryGrab(this.controllerL) })
    this.controllerR.addEventListener('squeezeend', () => this.releaseGrab(this.controllerR))
    this.controllerL.addEventListener('squeezeend', () => this.releaseGrab(this.controllerL))

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()

    this.lastTick = performance.now()
    this.renderer.setAnimationLoop(this.tick)
  }

  private buildScene() {
    // place the volume in front of the VR user's head at (0, 1.6, 0) facing −Z:
    // the shader raymarches the box in local space, so moving/scaling the group is safe
    this.flameGroup.position.set(0, 1.5, -1.7)
    this.flameGroup.scale.setScalar(0.62)

    // burner sphere (opaque, occludes flame behind it)
    this.burner = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 24),
      new THREE.MeshStandardMaterial({ color: 0x6a7480, roughness: 0.35, metalness: 0.75 }),
    )
    this.flameGroup.add(this.burner)
    this.support = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 16),
      new THREE.MeshStandardMaterial({ color: 0x414b59, metalness: 0.7, roughness: 0.45 }),
    )
    this.support.rotation.z = Math.PI / 2
    this.support.position.set(-0.25, 0, 0)
    this.flameGroup.add(this.support)
    this.updateGeometry()

    // domain box wireframe: the [-0.5, 0.5]³ field bounds
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1))
    const wire = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x2a3442, transparent: true, opacity: 0.55 }),
    )
    this.flameGroup.add(wire)

    // reference floor grid at the VR floor plane
    const grid = new THREE.GridHelper(2.2, 22, 0x1c2430, 0x12161d)
    grid.position.y = 0
    this.scene.add(grid)

    this.scene.add(new THREE.AmbientLight(0x9aa5b4, 0.7))
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(1.2, 2.2, 1.0)
    this.scene.add(key)
  }

  private setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 1.42, -1.7)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 0.8
    this.controls.maxDistance = 6
    this.controls.update()
  }

  private makeFieldTexture(): THREE.DataTexture {
    const tex = new THREE.DataTexture(
      new Uint16Array(LUT_Z * LUT_R),
      LUT_R,
      LUT_Z,
      THREE.RedFormat,
      THREE.HalfFloatType,
    )
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.generateMipmaps = false
    tex.flipY = false // row 0 = texture v 0 = top of field
    tex.needsUpdate = true
    return tex
  }

  private updateGeometry() {
    const radius = this.sequence.geometry.burnerRadiusMeters / this.sequence.geometry.domainMeters
    this.burner.scale.setScalar(radius)
    this.support.scale.set(radius * 0.18, 0.5, radius * 0.18)
    this.uniforms.uBurnerRadius.value = radius
  }

  private makeRay(): THREE.Line {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -0.45),
    ])
    const m = new THREE.LineBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.55 })
    return new THREE.Line(g, m)
  }

  private resize() {
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private tick = () => {
    if (this.disposed) return
    const now = performance.now()
    const dt = this.lastTick ? now - this.lastTick : 0
    this.lastTick = now

    if (this.playing) {
      const next = this.timeMs + this.direction * dt
      this.timeMs = Math.max(this.times[0], Math.min(this.times.at(-1)!, next))
      if (next !== this.timeMs) this.playing = false
    }
    this.updateFieldUniforms()
    this.updatePreview(nearestTimeIndex(this.previewTimes, this.timeMs))
    this.setPlayhead(this.timeMs / 1000)

    if (this.presenting) {
      if (this.pendingXRLayout > 0 && --this.pendingXRLayout === 0) this.resetLayout()
      this.pollGamepads()
      this.updateHands(Math.min(dt / 1000, 0.05))
      this.drawHandTimeline(now)
    }

    this.manipulation.update()

    if (!this.presenting) this.controls?.update()

    try {
      this.renderer.render(this.scene, this.camera)
      if (!this.shaderFailed) this.framesRendered++
    } catch (err) {
      this.pushError(err)
    }

    this.emitState(false)
  }

  private updateFieldUniforms() {
    const seq = this.sequence
    const { a: i0, b: i1, mix } = bracketTime(this.times, this.timeMs)
    this.uniforms.uMix.value = mix

    if (i0 !== this.uploadedA) {
      this.uploadFrame(this.uniforms.uFieldA.value as THREE.DataTexture, seq.frames[i0].data)
      this.uploadedA = i0
    }
    if (i1 !== this.uploadedB) {
      this.uploadFrame(this.uniforms.uFieldB.value as THREE.DataTexture, seq.frames[i1].data)
      this.uploadedB = i1
    }
  }

  private uploadFrame(tex: THREE.DataTexture, data: Uint16Array) {
    ;(tex.image.data as Uint16Array).set(data)
    tex.needsUpdate = true
  }

  private pushError(err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    this.renderErrors = [...this.renderErrors.slice(-19), msg]
  }

  /* ——— public playback API ——— */

  private install(sequence: FlameSequence, keepTime = true) {
    this.sequence = sequence
    this.times = sequence.frames.map((frame) => frame.tMs)
    validateTimes(this.times, sequence.frames.length)
    this.timeMs = keepTime
      ? Math.max(this.times[0], Math.min(this.times.at(-1)!, this.timeMs))
      : this.times[0] + (this.times.at(-1)! - this.times[0]) * INITIAL_FRAME_FRACTION
    this.uploadedA = this.uploadedB = -1
    this.updateGeometry()
    this.emitState(true)
  }

  clearExperiment() {
    this.experimentLoading = true
    this.experimentLoadError = null
    this.previewEpoch++
    this.playing = false
    this.reference = null
    this.previewFiles = []
    this.previewTimes = []
    if (this.previewMesh) this.previewMesh.visible = false
    for (const texture of this.texCache.values()) texture.dispose()
    this.texCache.clear()
    this.setSensors({ testpoint: '', t: [], series: [] })
    this.install(emptySequence(), false)
  }

  /** Linear binary16 data; acquisition times and amplitudes are preserved. */
  setRealLut(buffer: ArrayBuffer, meta: LutMetadata): void {
    this.reference = decodeLut(buffer, meta)
    this.experimentLoading = false
    this.experimentLoadError = null
    this.install(this.reference, false)
  }

  setExperimentLoadError(message: string) {
    this.experimentLoading = false
    this.experimentLoadError = message
    this.drawHandTimeline(performance.now(), true)
  }

  setExposure(value: number) {
    this.exposure = Math.max(0.05, Math.min(30, value))
    this.uniforms.uExposure.value = this.exposure
    this.emitState(true)
  }

  setThreshold(v: number) {
    this.threshold = v
    this.uniforms.uThreshold.value = v
    this.emitState(true)
  }

  setDensity(v: number) {
    this.density = v
    this.uniforms.uDensity.value = v
    this.emitState(true)
  }

  setGamma(v: number) {
    this.gamma = v
    this.uniforms.uGamma.value = v
    this.emitState(true)
  }

  setPalette(v: number) {
    this.palette = v
    this.uniforms.uPalette.value = v
    this.emitState(true)
  }

  setQuality(v: number) {
    this.quality = v
    this.uniforms.uQuality.value = v
    this.emitState(true)
  }

  play() {
    if (this.timeMs >= this.times.at(-1)!) this.timeMs = this.times[0]
    this.playing = true
    this.direction = 1
    this.emitState(true)
  }

  /** rewind: play backwards through the sequence */
  rewind() {
    if (this.timeMs <= this.times[0]) this.timeMs = this.times.at(-1)!
    this.playing = true
    this.direction = -1
    this.emitState(true)
  }

  pause() {
    this.playing = false
    this.emitState(true)
  }

  togglePlay() {
    this.playing = !this.playing || this.direction === -1
    if (this.playing) {
      this.direction = 1
      if (this.timeMs >= this.times.at(-1)!) this.timeMs = this.times[0]
    }
    this.emitState(true)
  }

  step(dir: 1 | -1) {
    this.playing = false
    const current = nearestTimeIndex(this.times, this.timeMs)
    const index = Math.max(0, Math.min(this.times.length - 1, current + dir))
    this.timeMs = this.times[index]
    this.emitState(true)
  }

  seekFraction(f: number, immediate = true) {
    this.timeMs = this.times[0] + Math.min(Math.max(f, 0), 1) * (this.times.at(-1)! - this.times[0])
    this.emitState(immediate)
  }

  /** dolly in/out (mouse-wheel equivalent, also available to touch/controller UI) */
  zoomBy(scale: number) {
    if (this.presenting) { this.scaleFlameBy(1 / scale); return }
    if (!this.controls) return
    const target = this.controls.target
    const offset = this.camera.position.clone().sub(target)
    const dist = Math.min(Math.max(offset.length() * scale, 0.8), 6)
    offset.setLength(dist)
    this.camera.position.copy(target).add(offset)
    this.controls.update()
    this.emitState(true)
  }

  /** center the flame and restore the default framing */
  resetView() {
    if (this.presenting) { this.resetLayout(); return }
    this.camera.position.set(0, 1.62, 0.06)
    this.controls?.target.set(0, 1.42, -1.7)
    this.controls?.update()
    this.emitState(true)
  }

  scaleFlameBy(factor: number) {
    this.releaseGrab()
    this.flameGroup.scale.setScalar(THREE.MathUtils.clamp(this.flameGroup.scale.x * factor, 0.12, 2))
    this.emitState(true)
  }

  /** Restore the workspace in front of the current viewer, including seated use. */
  resetLayout() {
    this.releaseGrab()
    const camera = this.presenting ? this.renderer.xr.getCamera() : this.camera
    const eye = camera.getWorldPosition(new THREE.Vector3())
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()))
    forward.y = 0
    if (forward.lengthSq() < 0.01) forward.set(0, 0, -1)
    forward.normalize()
    const yaw = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), forward)
    const place = (object: THREE.Object3D, x: number, y: number, z: number, scale: number, face = true) => {
      object.position.set(x, y, z).applyQuaternion(yaw).add(eye)
      object.scale.setScalar(scale)
      object.quaternion.copy(yaw)
      if (face) object.lookAt(eye)
    }
    place(this.flameGroup, 0, -0.12, -1.7, 0.62, false)
    this.panels.forEach((panel, i) => place(panel.mesh, i === 0 ? -0.94 : 0.94, -0.10, -1.65, 1))
    if (this.previewMesh) place(this.previewMesh, 0.94, -0.80, -1.65, 1)
    place(this.toolbar, 0, -0.68, -1.35, 1)
    this.savedLayouts.clear()
    this.emitState(true)
  }

  /* ——— WebXR ——— */

  async checkSupport() {
    const nav = navigator as Navigator & {
      xr?: { isSessionSupported?: (m: string) => Promise<boolean> }
    }
    if (!nav.xr?.isSessionSupported) {
      this.vrSupported = false
      this.arSupported = false
      this.emitState(true)
      return
    }
    try {
      this.vrSupported = await nav.xr.isSessionSupported('immersive-vr')
    } catch {
      this.vrSupported = false
    }
    try {
      this.arSupported = await nav.xr.isSessionSupported('immersive-ar')
    } catch {
      this.arSupported = false
    }
    this.emitState(true)
  }

  async enterVR() {
    await this.enter('immersive-vr', false)
  }

  async enterAR() {
    await this.enter('immersive-ar', true)
  }

  private async enter(mode: 'immersive-vr' | 'immersive-ar', ar: boolean) {
    const nav = navigator as Navigator & { xr?: XRSystem }
    if (!nav.xr) {
      this.xrError = 'WebXR is not available in this browser.'
      this.emitState(true)
      return
    }
    this.xrError = null
    try {
      const session = await nav.xr.requestSession(mode, {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['bounded-floor', 'hand-tracking'],
      })
      session.addEventListener('end', this.onSessionEnd)
      if (ar) this.renderer.setClearColor(0x000000, 0) // AR passthrough
      try {
        await this.renderer.xr.setSession(session)
      } catch (error) {
        await session.end().catch(() => undefined)
        throw error
      }
      this.arMode = ar
      this.presenting = true
      this.desktopView = { position: this.camera.position.clone(), quaternion: this.camera.quaternion.clone(), target: this.controls!.target.clone() }
      if (this.controls) this.controls.enabled = false
      this.pendingXRLayout = 2
      this.emitState(true)
    } catch (err) {
      this.xrError = err instanceof Error ? err.message : String(err)
      this.emitState(true)
    }
  }

  private onSessionEnd = () => {
    this.releaseGrab()
    this.pendingXRLayout = 0
    this.trackedHands = 0
    this.handHint = 'Show your hands in front of the headset'
    this.hoverOutline.visible = false
    this.toolbar.visible = false
    for (const hv of this.handVisuals) this.hideHand(hv)
    this.renderer.setClearColor(0x05070b, 1)
    this.presenting = false
    this.arMode = false
    if (this.desktopView) {
      this.camera.position.copy(this.desktopView.position)
      this.camera.quaternion.copy(this.desktopView.quaternion)
      this.controls?.target.copy(this.desktopView.target)
      this.desktopView = null
    }
    if (this.controls) this.controls.enabled = true
    this.emitState(true)
  }

  async exitXR() {
    const session = this.renderer.xr.getSession()
    if (session) await session.end().catch(() => undefined)
  }

  /* ——— hand skeletons (WebXR hand tracking) ——— */

  private buildHandVisuals() {
    const sphereGeo = new THREE.SphereGeometry(0.0075, 8, 8)
    for (let i = 0; i < 2; i++) {
      const hand = this.renderer.xr.getHand(i)
      const ray = this.renderer.xr.getController(i)
      this.scene.add(hand)
      const sphereMat = new THREE.MeshBasicMaterial({ color: 0x3ad7a3 })
      const spheres = HAND_JOINTS.map(() => {
        const mesh = new THREE.Mesh(sphereGeo, sphereMat)
        mesh.visible = false
        mesh.frustumCulled = false
        this.scene.add(mesh)
        return mesh
      })
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(HAND_BONES.length * 6), 3))
      const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x4da3ff }))
      const pointer = this.makeRay()
      const cursor = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), new THREE.MeshBasicMaterial({ color: 0x4da3ff, depthTest: false }))
      cursor.renderOrder = 100
      lines.visible = pointer.visible = cursor.visible = false
      lines.frustumCulled = false
      this.scene.add(lines, pointer, cursor)
      const hv = { hand, ray, source: null as XRInputSource | null, pose: new THREE.Group(), gesture: new PinchGesture(), tracked: false, spheres, lines, pointer, cursor }
      // XR input indices are assigned by connection order, not handedness.
      hand.addEventListener('connected', (event) => { hv.source = event.data })
      ray.addEventListener('connected', (event) => {
        for (const child of ray.children) child.visible = !event.data.hand
      })
      hand.addEventListener('disconnected', () => { hv.source = null; this.hideHand(hv) })
      this.handVisuals.push(hv)
    }
  }

  private hideHand(hv: (typeof this.handVisuals)[number]) {
    hv.gesture.update(null)
    hv.tracked = false
    this.manipulation.release(hv.pose)
    this.handScrubs.delete(hv.pose)
    hv.lines.visible = hv.pointer.visible = hv.cursor.visible = false
    for (const sphere of hv.spheres) sphere.visible = false
  }

  private handTargets(): HandTarget[] {
    return [
      { mesh: this.box, object: this.flameGroup, label: 'Flame', minScale: 0.12, maxScale: 2 },
      ...this.panels.map((panel) => ({ mesh: panel.mesh, object: panel.mesh, label: 'Data panel', minScale: 0.35, maxScale: 2.5 })),
      ...(this.previewMesh ? [{ mesh: this.previewMesh, object: this.previewMesh, label: 'Camera preview', minScale: 0.35, maxScale: 2.5 }] : []),
      ...(this.playbackTitleTarget ? [this.playbackTitleTarget] : []),
      ...(this.experimentPickerOpen ? this.experimentTargets : this.handButtons),
    ]
  }

  private updateHands(dt: number) {
    const session = this.renderer.xr.getSession()
    if (!session) return
    this.toolbar.visible = true
    this.hoveredPlayerMeshes.clear()
    const targets = this.handTargets()
    let count = 0
    let hint = 'Show your hands in front of the headset'
    let heldHint: string | null = null
    let highlighted: HandTarget | null = null
    for (const hv of this.handVisuals) {
      const joints = hv.hand.joints
      const thumb = joints['thumb-tip'], index = joints['index-finger-tip'], wrist = joints.wrist
      if (!hv.source?.hand || !hv.hand.visible || session.visibilityState !== 'visible' ||
          !thumb?.visible || !index?.visible || !wrist?.visible) {
        this.hideHand(hv)
        continue
      }
      count++
      const thumbPosition = thumb.getWorldPosition(new THREE.Vector3())
      const indexPosition = index.getWorldPosition(new THREE.Vector3())
      const midpoint = thumbPosition.clone().add(indexPosition).multiplyScalar(0.5)
      const orientation = wrist.getWorldQuaternion(new THREE.Quaternion())
      // Low-pass the tracked pose, keeping the gesture thresholds on raw joints.
      const alpha = hv.tracked ? 1 - Math.exp(-30 * dt) : 1
      hv.pose.position.lerp(midpoint, alpha)
      hv.pose.quaternion.slerp(orientation, alpha)
      hv.pose.updateMatrixWorld(true)
      hv.tracked = true
      HAND_JOINTS.forEach((name, j) => {
        const joint = joints[name]
        hv.spheres[j].visible = !!joint?.visible
        if (joint?.visible) joint.getWorldPosition(hv.spheres[j].position)
      })
      const positions = hv.lines.geometry.getAttribute('position') as THREE.BufferAttribute
      HAND_BONES.forEach(([a, b], k) => {
        const valid = joints[a]?.visible && joints[b]?.visible
        const start = valid ? joints[a]!.getWorldPosition(new THREE.Vector3()) : midpoint
        const end = valid ? joints[b]!.getWorldPosition(new THREE.Vector3()) : midpoint
        positions.setXYZ(k * 2, start.x, start.y, start.z)
        positions.setXYZ(k * 2 + 1, end.x, end.y, end.z)
      })
      positions.needsUpdate = true
      hv.lines.visible = true
      const ray = hv.ray.visible ? new THREE.Ray(
        hv.ray.getWorldPosition(new THREE.Vector3()),
        new THREE.Vector3(0, 0, -1).applyQuaternion(hv.ray.getWorldQuaternion(new THREE.Quaternion())),
      ) : null
      const hit = pickHandTarget(targets, midpoint, ray)
      if (hit) this.hoveredPlayerMeshes.add(hit.target.mesh)
      const gesture = hv.gesture.update(thumbPosition.distanceTo(indexPosition))
      if (gesture === 'end') {
        this.manipulation.release(hv.pose)
        this.handScrubs.delete(hv.pose)
      }
      if (gesture === 'start' && hit) {
        if (hit.target.onSlide && !this.handScrubs.size) {
          this.pause()
          this.handScrubs.set(hv.pose, { target: hit.target, distant: hit.distance > 0.065 })
          hit.target.onSlide(hit.point)
        } else if (hit.target.action) hit.target.action()
        else this.manipulation.begin(hv.pose, hit.target)
      }
      const scrub = this.handScrubs.get(hv.pose)
      const sliderPoint = scrub && (!scrub.distant || ray) ? handSliderPoint(scrub.target.mesh, midpoint, scrub.distant ? ray : null) : null
      if (scrub && sliderPoint) scrub.target.onSlide?.(sliderPoint)
      const held = this.manipulation.held(hv.pose)
      if (scrub) {
        highlighted = scrub.target
        heldHint = 'Scrubbing · move along the timeline · open your fingers to finish'
      } else if (held) {
        highlighted = held
        heldHint = `Holding: ${held.label} · turn your wrist · second hand: scale and rotate`
      } else if (hit && !hv.gesture.pinching) {
        highlighted ??= hit.target
        hint = `${hit.target.label} · pinch your thumb and index finger`
      } else if (count === 1) hint = 'Point at or touch an object, then pinch to grab'
      hv.cursor.visible = !!hit || !!held || !!scrub
      hv.cursor.position.copy(sliderPoint ?? hit?.point ?? midpoint)
      hv.cursor.material.color.set(held || scrub ? 0x3ad7a3 : 0x4da3ff)
      hv.cursor.scale.setScalar(hv.gesture.pinching ? 0.8 : 1)
      hv.pointer.visible = !!ray && !held && !scrub && !!hit && hit.distance > 0.065
      if (hv.pointer.visible && ray && hit) {
        const attr = hv.pointer.geometry.getAttribute('position') as THREE.BufferAttribute
        attr.setXYZ(0, ray.origin.x, ray.origin.y, ray.origin.z)
        attr.setXYZ(1, hit.point.x, hit.point.y, hit.point.z)
        attr.needsUpdate = true
        hv.pointer.geometry.computeBoundingSphere()
      }
    }
    this.hoverOutline.visible = !!highlighted && !highlighted.action && !highlighted.onSlide
    if (this.hoverOutline.visible) this.hoverOutline.box.setFromObject(highlighted!.mesh)
    hint = heldHint ?? hint
    if (count !== this.trackedHands || hint !== this.handHint) {
      this.trackedHands = count
      this.handHint = hint
    }
  }

  private playerPlane(canvas: HTMLCanvasElement, width: number, height: number) {
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.generateMipmaps = false
    this.playerTextures.add(texture)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }))
    mesh.renderOrder = 21
    return { mesh, texture }
  }

  private buildHandToolbar() {
    const background = document.createElement('canvas')
    background.width = 1100; background.height = 700
    drawPlaybackSurface(background)
    const backdrop = this.playerPlane(background, 1.1, 0.7).mesh
    backdrop.renderOrder = 20
    backdrop.position.set(0, -0.015, -0.006)
    this.toolbar.add(backdrop, this.playerMain, this.playerPicker)
    this.playerPicker.visible = false

    const titleCanvas = this.playbackTitleCanvas = document.createElement('canvas')
    titleCanvas.width = 1200; titleCanvas.height = 165
    const title = this.playerPlane(titleCanvas, 1.02, 0.14)
    this.playbackTitleTexture = title.texture
    title.mesh.position.y = 0.235
    this.toolbar.add(title.mesh)
    this.playbackTitleTarget = { mesh: title.mesh, object: this.toolbar, label: 'Move player', minScale: 0.65, maxScale: 1.6 }

    const buttons: { key: string; label: string; icon: PlayerIcon; x: number; y: number; width: number; primary?: boolean; action: () => void }[] = [
      { key: 'previous', label: 'Previous frame', icon: 'previous', x: -0.4, y: -0.065, width: 0.176, action: () => this.step(-1) },
      { key: 'rewind', label: 'Rewind', icon: 'rewind', x: -0.2, y: -0.065, width: 0.176, action: () => this.playing && this.direction === -1 ? this.pause() : this.rewind() },
      { key: 'play', label: 'Play', icon: 'play', x: 0, y: -0.065, width: 0.19, primary: true, action: () => this.togglePlay() },
      { key: 'next', label: 'Next frame', icon: 'next', x: 0.2, y: -0.065, width: 0.176, action: () => this.step(1) },
      { key: 'restart', label: 'Restart', icon: 'restart', x: 0.4, y: -0.065, width: 0.176, action: () => this.seekFraction(0) },
      { key: 'smaller', label: 'Smaller', icon: 'smaller', x: -0.42, y: -0.235, width: 0.14, action: () => this.scaleFlameBy(1 / 1.2) },
      { key: 'larger', label: 'Larger', icon: 'larger', x: -0.26, y: -0.235, width: 0.14, action: () => this.scaleFlameBy(1.2) },
      { key: 'reset', label: 'Reset layout', icon: 'reset', x: -0.055, y: -0.235, width: 0.23, action: () => this.resetLayout() },
      { key: 'experiments', label: 'Choose experiment', icon: 'right', x: 0.32, y: -0.235, width: 0.37, action: () => this.showExperimentPicker(true) },
    ]
    for (const button of buttons) {
      const canvas = document.createElement('canvas')
      const height = button.primary ? 0.124 : 0.112
      canvas.width = Math.round(button.width / height * 172); canvas.height = 172
      const { mesh, texture } = this.playerPlane(canvas, button.width, height)
      mesh.position.set(button.x, button.y, 0)
      this.playerMain.add(mesh)
      this.handButtons.push({ mesh, object: this.toolbar, label: button.label, minScale: 1, maxScale: 1, action: () => {
        if (['play', 'rewind', 'previous', 'next', 'restart'].includes(button.key) && (this.experimentLoading || this.experimentLoadError)) return
        button.action()
      } })
      this.playerControls.push({ ...button, primary: !!button.primary, canvas, texture, mesh, signature: '' })
    }
    const timeline = this.timelineCanvas = document.createElement('canvas')
    timeline.width = 1200; timeline.height = 140
    const slider = this.playerPlane(timeline, 1.02, 0.119)
    this.timelineTexture = slider.texture
    slider.mesh.position.y = 0.083
    this.playerMain.add(slider.mesh)
    this.handButtons.push({ mesh: slider.mesh, object: this.toolbar, label: 'Timeline · pinch and drag', minScale: 1, maxScale: 1,
      onSlide: (point) => this.seekFraction(timelineFraction(slider.mesh.worldToLocal(point.clone()).x / 1.02 + 0.5), false),
    })
    this.rebuildExperimentPicker()
    this.drawHandTimeline(performance.now(), true)
    this.toolbar.position.set(0, 0.92, -1.25)
    this.toolbar.lookAt(0, 1.62, 0)
    this.toolbar.visible = false
    this.scene.add(this.toolbar)
  }

  setExperimentCatalog(options: ExperimentOption[]) {
    this.experimentOptions = options
    this.rebuildExperimentPicker()
  }

  onExperimentSelectChange(callback: (id: string) => void) { this.onExperimentSelect = callback }

  private showExperimentPicker(open: boolean) {
    this.releaseGrab()
    this.experimentPickerOpen = open
    this.playerPicker.visible = open
    this.playerMain.visible = !open
    this.drawHandTimeline(performance.now(), true)
  }

  private rebuildExperimentPicker() {
    this.playerControls = this.playerControls.filter((control) => control.key !== 'picker-back')
    for (const child of [...this.playerPicker.children]) {
      const mesh = child as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
      this.playerTextures.delete(mesh.material.map!)
      mesh.material.map?.dispose(); mesh.material.dispose(); mesh.geometry.dispose()
      this.playerPicker.remove(mesh)
    }
    this.experimentCards = []
    this.experimentTargets = []
    const options = this.experimentOptions
    const rowHeight = Math.min(0.14, 0.44 / Math.max(1, options.length))
    options.forEach((option, index) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1200; canvas.height = 160
      const { mesh, texture } = this.playerPlane(canvas, 1.02, rowHeight - 0.012)
      mesh.position.set(0, 0.10 - index * rowHeight, 0.004)
      this.playerPicker.add(mesh)
      const target: HandTarget = { mesh, object: this.toolbar, label: `Select ${option.label}`, minScale: 1, maxScale: 1, action: () => {
        this.showExperimentPicker(false)
        if (option.id !== this.testId) this.onExperimentSelect?.(option.id)
      } }
      this.experimentTargets.push(target)
      this.experimentCards.push({ option, canvas, texture, mesh, signature: '' })
    })
    const canvas = document.createElement('canvas')
    canvas.width = 541; canvas.height = 100
    const { mesh, texture } = this.playerPlane(canvas, 0.4, 0.074)
    mesh.position.set(0, -0.292, 0.004)
    this.playerPicker.add(mesh)
    this.experimentTargets.push({ mesh, object: this.toolbar, label: 'Back to player', minScale: 1, maxScale: 1, action: () => this.showExperimentPicker(false) })
    this.playerControls.push({ key: 'picker-back', icon: 'left', label: 'Back to player', primary: false, canvas, texture, mesh, signature: '' })
    this.drawHandTimeline(performance.now(), true)
  }

  private drawHandTimeline(now: number, force = false) {
    if (!this.timelineCanvas || !this.timelineTexture || (!force && now - this.lastTimelineDraw < 100)) return
    this.lastTimelineDraw = now
    this.drawPlaybackTitle()
    for (const control of this.playerControls) {
      const active = this.playing && (control.key === 'play' ? this.direction === 1 : control.key === 'rewind' && this.direction === -1)
      const hovered = this.hoveredPlayerMeshes.has(control.mesh)
      const disabled = ['play', 'rewind', 'previous', 'next', 'restart'].includes(control.key) && (this.experimentLoading || !!this.experimentLoadError)
      const signature = `${active}:${hovered}:${disabled}`
      if (signature === control.signature) continue
      control.signature = signature
      drawPlayerButton(control.canvas, control.key === 'play' && active ? 'Pause' : control.label, control.key === 'play' && active ? 'pause' : control.icon, control.primary, active, hovered, disabled)
      control.texture.needsUpdate = true
    }
    const slider = this.handButtons.find((target) => target.onSlide)!
    drawPlaybackTimeline(this.timelineCanvas, this.timeMs, this.times[0], this.times.at(-1)!, this.hoveredPlayerMeshes.has(slider.mesh), this.handScrubs.size > 0)
    this.timelineTexture.needsUpdate = true
    for (const card of this.experimentCards) {
      const selected = card.option.id === this.testId, hovered = this.hoveredPlayerMeshes.has(card.mesh)
      const signature = `${selected}:${hovered}`
      if (signature === card.signature) continue
      card.signature = signature
      drawExperimentCard(card.canvas, card.option, selected, hovered)
      card.texture.needsUpdate = true
    }
  }

  private preserveLayout(key: string, object: THREE.Object3D | undefined | null) {
    if (object) this.savedLayouts.set(key, { position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone() })
  }

  private restoreLayout(key: string, object: THREE.Object3D) {
    const layout = this.savedLayouts.get(key)
    if (!layout) return
    object.position.copy(layout.position); object.quaternion.copy(layout.quaternion); object.scale.copy(layout.scale)
  }

  /* ——— continuous-sensor chart panels ——— */

  setSensors(data: SensorData) {
    this.releaseGrab()
    this.sensorData = data
    for (const [i, p] of this.panels.entries()) {
      this.preserveLayout(`panel-${i}`, p.mesh)
      this.scene.remove(p.mesh)
      p.mesh.geometry.dispose()
      ;(p.mesh.material as THREE.Material).dispose()
      p.tex.dispose()
    }
    this.panels = []
    const press = data.series.filter((x) => x.name.startsWith('PTA'))
    const therm = data.series.filter((x) =>
      ['TCBurner', 'TCA', 'TCB', 'MFCA3FuelFlow', 'IonCurrent'].includes(x.name),
    )
    const defs = [
      { title: 'Pressure channels', series: press, pos: [-0.94, 1.52, -1.65] },
      { title: 'Thermal & flow', series: therm, pos: [0.94, 1.52, -1.65] },
    ]
    for (const d of defs) {
      if (!d.series.length) continue
      const canvas = document.createElement('canvas')
      canvas.width = 1024
      canvas.height = 896
      this.drawChart(canvas, d.title, d.series, data.t, this.playhead)
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.minFilter = THREE.LinearFilter
      tex.generateMipmaps = false
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7875), mat)
      mesh.renderOrder = 20
      mesh.position.set(d.pos[0], d.pos[1], d.pos[2])
      mesh.lookAt(0, 1.6, 0)
      this.restoreLayout(`panel-${this.panels.length}`, mesh)
      this.scene.add(mesh)
      this.panels.push({ mesh, canvas, tex, series: d.series, title: d.title })
    }
  }

  setPlayhead(t: number) {
    this.playhead = t
    if (!this.panels.length || !this.sensorData) return
    const now = performance.now()
    if (now - this.lastPanelDraw < 125) return
    this.lastPanelDraw = now
    for (const p of this.panels) {
      this.drawChart(p.canvas, p.title, p.series, this.sensorData.t, t)
      p.tex.needsUpdate = true
    }
  }

  private tryGrab(controller: THREE.XRTargetRaySpace): boolean {
    const origin = controller.getWorldPosition(new THREE.Vector3())
    const ray = new THREE.Ray(origin, new THREE.Vector3(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(new THREE.Quaternion())))
    const hit = pickHandTarget(this.handTargets(), origin, ray)
    if (!hit) return false
    if (hit.target.action) { hit.target.action(); return true }
    return this.manipulation.begin(controller, hit.target)
  }

  private releaseGrab(controller?: THREE.Object3D) {
    this.manipulation.release(controller)
    if (controller) this.handScrubs.delete(controller)
    else this.handScrubs.clear()
  }

  /** plane showing the current real DataCam frame (grabbable/resizable) */
  setFramePreview(base: string, files: string[], times: number[]) {
    this.releaseGrab()
    validateTimes(times, files.length)
    this.previewEpoch++
    this.previewBase = base
    this.previewFiles = files
    this.previewTimes = times
    this.previewIndex = -1
    if (this.previewMesh) {
      this.preserveLayout('preview', this.previewMesh)
      this.scene.remove(this.previewMesh)
      this.previewMesh.geometry.dispose()
      ;(this.previewMesh.material as THREE.Material).dispose()
      this.previewMesh = null
    }
    if (!files.length) return
    const mat = new THREE.MeshBasicMaterial({ color: 0x0e1218, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), mat)
    mesh.position.set(0.94, 0.82, -1.65)
    mesh.lookAt(0, 1.6, 0)
    this.restoreLayout('preview', mesh)
    this.scene.add(mesh)
    this.previewMesh = mesh
    this.updatePreview(nearestTimeIndex(this.previewTimes, this.timeMs))
  }

  private updatePreview(index: number) {
    if (!this.previewMesh || !this.previewFiles.length) return
    const i = Math.max(0, Math.min(this.previewFiles.length - 1, index))
    if (i === this.previewIndex) return
    this.previewIndex = i
    const url = this.previewBase + this.previewFiles[i]
    const m = this.previewMesh.material as THREE.MeshBasicMaterial
    const cached = this.texCache.get(url)
    if (cached) {
      m.map = cached
      m.color.set(0xffffff)
      m.needsUpdate = true
      return
    }
    const epoch = this.previewEpoch
    new THREE.TextureLoader().load(url, (tex) => {
      if (this.disposed || epoch !== this.previewEpoch) {
        tex.dispose()
        return
      }
      this.texCache.set(url, tex)
      if (this.texCache.size > 48) {
        const active = (this.previewMesh?.material as THREE.MeshBasicMaterial | undefined)?.map
        for (const [key, old] of this.texCache) {
          if (old === active || old === tex) continue
          old.dispose()
          this.texCache.delete(key)
          break
        }
      }
      if (!this.previewMesh || this.previewIndex !== i) return
      const mm = this.previewMesh.material as THREE.MeshBasicMaterial
      mm.map = tex
      mm.color.set(0xffffff)
      mm.needsUpdate = true
    })
  }

  private drawChart(canvas: HTMLCanvasElement, title: string, series: SensorSeries[], t: number[], playhead: number) {
    drawSensorPanel(canvas, title, this.sensorData?.testpoint || this.testId, series, t, playhead)
  }

  /* ——— in-VR test switching ——— */

  onTestSwitchChange(cb: (dir: 1 | -1) => void) {
    this.onTestSwitch = cb
  }

  setTestId(id: string, info = '') {
    if (this.testId === id && this.testInfo === info) return
    this.testId = id
    this.testInfo = info
    this.drawPlaybackTitle()
  }

  private drawPlaybackTitle() {
    if (!this.playbackTitleCanvas || !this.playbackTitleTexture) return
    const status = this.experimentLoadError ? 'UNAVAILABLE' : this.experimentLoading ? 'LOADING' : undefined
    drawPlaybackHeading(this.playbackTitleCanvas, this.testId, this.testInfo, this.playing, this.direction, nearestTimeIndex(this.times, this.timeMs), this.experimentLoading || this.experimentLoadError ? 0 : this.sequence.frames.length, status)
    this.playbackTitleTexture.needsUpdate = true
  }

  private pollGamepads() {
    const session = this.renderer.xr.getSession()
    if (!session) return
    let x = 0
    for (const src of session.inputSources) {
      if (src.hand) continue
      const gp = src.gamepad
      if (!gp) continue
      const ax = gp.axes
      const cand =
        ax.length >= 4 ? (Math.abs(ax[2]) > Math.abs(ax[0]) ? ax[2] : ax[0]) : (ax[0] ?? 0)
      if (Math.abs(cand) > Math.abs(x)) x = cand
    }
    if (Math.abs(x) > 0.75) {
      const now = performance.now()
      if (now - this.lastStick > 350) {
        this.lastStick = now
        this.onTestSwitch?.(x > 0 ? 1 : -1)
      }
    }
  }

  /* ——— state / lifecycle ——— */

  onState(cb: (s: FlameVrState) => void) {
    this.onStateCb = cb
    cb(this.snapshot())
  }

  private snapshot(): FlameVrState {
    const seq = this.sequence
    const idx = nearestTimeIndex(this.times, this.timeMs)
    return {
      vrSupported: this.vrSupported,
      arSupported: this.arSupported,
      presenting: this.presenting,
      arMode: this.arMode,
      playing: this.playing,
      direction: this.direction,
      gravity: 0,
      frameIndex: idx,
      frameCount: seq.frames.length,
      fps: seq.fps,
      tMs: this.timeMs,
      durationMs: this.times.at(-1)! - this.times[0],
      startMs: this.times[0],
      magnification: this.flameGroup.scale.x / seq.geometry.domainMeters,
      exposure: this.exposure,
      framesRendered: this.framesRendered,
      renderErrors: [...this.renderErrors],
      xrError: this.xrError,
      threshold: this.threshold,
      density: this.density,
      gamma: this.gamma,
      palette: this.palette,
      quality: this.quality,
      trackedHands: this.trackedHands,
      handHint: this.handHint,
    }
  }

  private emitState(force: boolean) {
    if (!this.onStateCb) return
    const now = performance.now()
    if (!force && now - this.lastEmit < 250) return
    this.lastEmit = now
    this.onStateCb(this.snapshot())
  }

  dispose() {
    this.disposed = true
    this.releaseGrab()
    const session = this.renderer.xr.getSession()
    session?.removeEventListener('end', this.onSessionEnd)
    void session?.end().catch(() => undefined)
    this.renderer.setAnimationLoop(null)
    this.resizeObserver?.disconnect()
    this.controls?.dispose()
    for (const p of this.panels) {
      p.mesh.geometry.dispose()
      ;(p.mesh.material as THREE.Material).dispose()
      p.tex.dispose()
    }
    if (this.previewMesh) {
      this.previewMesh.geometry.dispose()
      ;(this.previewMesh.material as THREE.Material).dispose()
    }
    for (const tex of this.texCache.values()) tex.dispose()
    this.texCache.clear()
    for (const texture of this.playerTextures) texture.dispose()
    this.playerTextures.clear()
    this.material.dispose()
    ;(this.uniforms.uFieldA.value as THREE.Texture).dispose()
    ;(this.uniforms.uFieldB.value as THREE.Texture).dispose()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else if (mat) mat.dispose()
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.onStateCb = null
  }
}

export { PALETTE_NAMES }
