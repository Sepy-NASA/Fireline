import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { FLAME_FRAGMENT, FLAME_VERTEX } from './flameShader'
import { LUT_R, LUT_Z } from './flameField'
import { simulateFlameSequence, type FlameSimSequence } from './flameSim'

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
  source: 'real' | 'simulation'
  frameIndex: number
  frameCount: number
  fps: number
  tMs: number
  framesRendered: number
  renderErrors: string[]
  xrError: string | null
  threshold: number
  density: number
  gamma: number
  palette: number
  quality: number
}

const PALETTE_NAMES = ['flame', 'inferno', 'ice'] as const

/** start playback on a bright, stable burn frame (pre-ignition is empty) */
const INITIAL_FRAME_FRACTION = 0.6

export class FlameEngine {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls | null = null
  private box!: THREE.Mesh
  private material!: THREE.ShaderMaterial
  private uniforms: Record<string, THREE.IUniform>
  private tmp = new THREE.Vector3()
  private resizeObserver: ResizeObserver | null = null

  private sequence: FlameSimSequence
  private frameFloat = 0
  private playing = false
  private direction: 1 | -1 = 1
  private gravity = 0.8
  private simSeed = 1
  private source: 'real' | 'simulation' = 'simulation'
  private uploadedA = -1
  private uploadedB = -1
  private lastTick = 0

  private controllerR: THREE.XRTargetRaySpace
  private controllerL: THREE.XRTargetRaySpace

  private threshold = 0.0
  private density = 8
  private gamma = 1.0
  private palette = 0
  private quality = 1.4

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
  private hud: THREE.Sprite | null = null
  private hudCanvas: HTMLCanvasElement | null = null
  private hudTex: THREE.CanvasTexture | null = null
  private lastStick = 0

  constructor(container: HTMLElement, gravity = 0.8) {
    this.container = container
    this.gravity = gravity
    this.sequence = this.runSimulation()
    this.frameFloat = (this.sequence.frames.length - 1) * INITIAL_FRAME_FRACTION

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(0x05070b, 1)
    this.renderer.xr.enabled = true
    this.renderer.xr.setReferenceSpaceType('local')

    container.appendChild(this.renderer.domElement)
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.style.display = 'block'

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 20)
    this.camera.position.set(0.85, 0.7, 1.35)
    this.camera.lookAt(0, 0, 0)

    this.uniforms = {
      uCamLocal: { value: new THREE.Vector3() },
      uFieldA: { value: this.makeFieldTexture() },
      uFieldB: { value: this.makeFieldTexture() },
      uMix: { value: 0 },
      uThreshold: { value: this.threshold },
      uDensity: { value: this.density },
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
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    })

    this.box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.material)
    this.box.frustumCulled = false
    this.box.renderOrder = 10
    this.box.updateMatrixWorld(true)
    this.scene.add(this.box)

    this.buildScene()
    this.buildHud()

    this.material.onBeforeRender = () => {
      const cam = this.renderer.xr.isPresenting ? this.renderer.xr.getCamera() : this.camera
      this.tmp.copy(cam.position)
      this.box.worldToLocal(this.tmp)
      this.uniforms.uCamLocal.value.copy(this.tmp)
    }

    this.setupControls()

    this.controllerR = this.renderer.xr.getController(0)
    this.controllerL = this.renderer.xr.getController(1)
    this.controllerR.add(this.makeRay())
    this.controllerL.add(this.makeRay())
    this.scene.add(this.controllerR, this.controllerL)

    // controller fallback controls (also used for hand-less headsets)
    this.controllerR.addEventListener('selectstart', () => this.togglePlay())
    this.controllerR.addEventListener('squeezestart', () => this.step(1))
    this.controllerL.addEventListener('squeezestart', () => this.step(-1))

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()

    this.lastTick = performance.now()
    this.renderer.setAnimationLoop(this.tick)
  }

  private buildScene() {
    // burner sphere (opaque, occludes flame behind it)
    const burner = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 40, 40),
      new THREE.MeshStandardMaterial({ color: 0x6a7480, roughness: 0.35, metalness: 0.75 }),
    )
    burner.position.set(0, -0.42, 0)
    this.scene.add(burner)

    // domain box wireframe: the [-0.5, 0.5]³ field bounds
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1))
    const wire = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x2a3442, transparent: true, opacity: 0.55 }),
    )
    this.scene.add(wire)

    // reference floor grid below the flame
    const grid = new THREE.GridHelper(2.2, 22, 0x1c2430, 0x12161d)
    grid.position.y = -0.72
    this.scene.add(grid)

    this.scene.add(new THREE.AmbientLight(0x9aa5b4, 0.7))
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(1.2, 2.2, 1.0)
    this.scene.add(key)
  }

  private setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 0, 0)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 0.7
    this.controls.maxDistance = 4.0
    this.controls.update()
  }

  private makeFieldTexture(): THREE.DataTexture {
    const tex = new THREE.DataTexture(
      new Uint8Array(LUT_Z * LUT_R),
      LUT_R,
      LUT_Z,
      THREE.RedFormat,
      THREE.UnsignedByteType,
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
      this.frameFloat += this.direction * (dt / 1000) * this.sequence.fps
      const n = this.sequence.frames.length
      if (this.frameFloat > n - 1) this.frameFloat = this.direction > 0 ? 0 : n - 1
      if (this.frameFloat < 0) this.frameFloat = this.direction < 0 ? n - 1 : 0
    }
    this.updateFieldUniforms()

    if (this.presenting) {
      this.pollGamepads()
      this.updateHud()
    }

    this.controls?.update()

    try {
      this.renderer.render(this.scene, this.camera)
      this.framesRendered++
    } catch (err) {
      this.pushError(err)
    }

    this.emitState(false)
  }

  private updateFieldUniforms() {
    const seq = this.sequence
    const n = seq.frames.length
    const ff = Math.min(Math.max(this.frameFloat, 0), n - 1)
    const i0 = Math.min(Math.floor(ff), n - 1)
    const i1 = Math.min(i0 + 1, n - 1)
    this.uniforms.uMix.value = ff - i0

    if (i0 !== this.uploadedA) {
      this.uploadFrame(this.uniforms.uFieldA.value as THREE.DataTexture, seq.frames[i0].data)
      this.uploadedA = i0
    }
    if (i1 !== this.uploadedB) {
      this.uploadFrame(this.uniforms.uFieldB.value as THREE.DataTexture, seq.frames[i1].data)
      this.uploadedB = i1
    }
  }

  private uploadFrame(tex: THREE.DataTexture, data: Uint8Array) {
    ;(tex.image.data as Uint8Array).set(data)
    tex.needsUpdate = true
  }

  private pushError(err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    this.renderErrors = [...this.renderErrors.slice(-19), msg]
  }

  /* ——— public playback API ——— */

  /** buoyancy strength for the next run: 0 = microgravity, 1 = terrestrial */
  setGravity(g: number) {
    this.gravity = g
    this.emitState(true)
  }

  /** re-run the fluid + combustion solver with a fresh seed */
  resimulate() {
    this.simSeed = (this.simSeed + 1) >>> 0
    this.source = 'simulation'
    this.sequence = this.runSimulation()
    this.frameFloat = (this.sequence.frames.length - 1) * INITIAL_FRAME_FRACTION
    this.uploadedA = -1
    this.uploadedB = -1
    this.emitState(true)
  }

  private runSimulation(): FlameSimSequence {
    return simulateFlameSequence({
      frames: 180,
      fps: 12,
      gravity: this.gravity,
      vorticity: 1.2,
      seed: this.simSeed,
    })
  }

  /** replace the field with the real HOBJ-derived LUT (uint8 [frame][z][r]) */
  setRealLut(
    buffer: ArrayBuffer,
    meta: { frames: number; z: number; r: number; fps: number },
  ): boolean {
    if (meta.z !== LUT_Z || meta.r !== LUT_R) return false
    const bytes = new Uint8Array(buffer)
    if (bytes.length !== meta.frames * LUT_Z * LUT_R) return false
    const per = LUT_Z * LUT_R
    const frames = []
    for (let i = 0; i < meta.frames; i++) {
      const start = i * per
      const data = new Uint8Array(per)
      for (let j = 0; j < per; j++) {
        // display-only gamma stretch so the faint HOBJ layers read in 3D
        data[j] = Math.round(255 * Math.pow(bytes[start + j] / 255, 0.45))
      }
      frames.push({ index: i, tMs: Math.round((i / meta.fps) * 1000), data })
    }
    this.sequence = { frames, fps: meta.fps, globalMax: 255, kind: 'simulation' }
    this.source = 'real'
    this.frameFloat = (frames.length - 1) * INITIAL_FRAME_FRACTION
    this.uploadedA = -1
    this.uploadedB = -1
    this.emitState(true)
    return true
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
    this.playing = true
    this.direction = 1
    this.emitState(true)
  }

  /** rewind: play backwards through the sequence */
  rewind() {
    this.playing = true
    this.direction = -1
    this.emitState(true)
  }

  pause() {
    this.playing = false
    this.emitState(true)
  }

  togglePlay() {
    this.playing = !this.playing
    if (this.playing) this.direction = 1
    this.emitState(true)
  }

  step(dir: 1 | -1) {
    this.playing = false
    this.frameFloat = Math.min(
      Math.max(this.frameFloat + dir, 0),
      this.sequence.frames.length - 1,
    )
    this.emitState(true)
  }

  seekFraction(f: number) {
    this.frameFloat = Math.min(Math.max(f, 0), 1) * (this.sequence.frames.length - 1)
    this.emitState(true)
  }

  /** dolly in/out (mouse-wheel equivalent, also available to touch/controller UI) */
  zoomBy(scale: number) {
    if (!this.controls) return
    const target = this.controls.target
    const offset = this.camera.position.clone().sub(target)
    const dist = Math.min(Math.max(offset.length() * scale, 0.7), 4.0)
    offset.setLength(dist)
    this.camera.position.copy(target).add(offset)
    this.controls.update()
    this.emitState(true)
  }

  /** center the flame and restore the default framing */
  resetView() {
    this.camera.position.set(0.85, 0.7, 1.35)
    this.controls?.target.set(0, 0, 0)
    this.controls?.update()
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
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      })
      session.addEventListener('end', this.onSessionEnd)
      if (ar) this.renderer.setClearColor(0x000000, 0) // AR passthrough
      this.renderer.xr.setSession(session)
      this.arMode = ar
      this.presenting = true
      this.emitState(true)
    } catch (err) {
      this.xrError = err instanceof Error ? err.message : String(err)
      this.emitState(true)
    }
  }

  private onSessionEnd = () => {
    if (this.hud) this.hud.visible = false
    this.renderer.setClearColor(0x05070b, 1)
    this.presenting = false
    this.arMode = false
    this.emitState(true)
  }

  async exitXR() {
    const session = this.renderer.xr.getSession()
    if (session) await session.end().catch(() => undefined)
  }

  /* ——— in-VR test switching ——— */

  onTestSwitchChange(cb: (dir: 1 | -1) => void) {
    this.onTestSwitch = cb
  }

  setTestId(id: string, info = '') {
    if (this.testId === id && this.testInfo === info) return
    this.testId = id
    this.testInfo = info
    this.drawHud()
  }

  private buildHud() {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    this.hudCanvas = canvas
    this.hudTex = new THREE.CanvasTexture(canvas)
    const mat = new THREE.SpriteMaterial({
      map: this.hudTex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    this.hud = new THREE.Sprite(mat)
    this.hud.scale.set(0.56, 0.14, 1)
    this.hud.visible = false
    this.hud.renderOrder = 100
    this.scene.add(this.hud)
    this.drawHud()
  }

  private drawHud() {
    const c = this.hudCanvas
    if (!c || !this.hudTex) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.fillStyle = 'rgba(5,7,11,0.78)'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.strokeStyle = 'rgba(77,163,255,0.6)'
    ctx.lineWidth = 3
    ctx.strokeRect(2, 2, c.width - 4, c.height - 4)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#4da3ff'
    ctx.font = 'bold 34px monospace'
    ctx.fillText(this.testId || '—', c.width / 2, 42)
    ctx.fillStyle = '#e9eef5'
    ctx.font = '18px monospace'
    ctx.fillText(this.testInfo || 'HOBJ reconstruction', c.width / 2, 74)
    ctx.fillStyle = '#8b95a5'
    ctx.font = '16px monospace'
    ctx.fillText('thumbstick ← → switch test', c.width / 2, 104)
    this.hudTex.needsUpdate = true
  }

  private pollGamepads() {
    const session = this.renderer.xr.getSession()
    if (!session) return
    let x = 0
    for (const src of session.inputSources) {
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

  private updateHud() {
    if (!this.hud) return
    this.hud.visible = this.presenting
    if (!this.presenting) return
    const cam = this.renderer.xr.getCamera()
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    this.hud.position.copy(cam.position).addScaledVector(fwd, 0.85)
  }

  /* ——— state / lifecycle ——— */

  onState(cb: (s: FlameVrState) => void) {
    this.onStateCb = cb
    cb(this.snapshot())
  }

  private snapshot(): FlameVrState {
    const seq = this.sequence
    const idx = Math.min(Math.max(Math.round(this.frameFloat), 0), seq.frames.length - 1)
    return {
      vrSupported: this.vrSupported,
      arSupported: this.arSupported,
      presenting: this.presenting,
      arMode: this.arMode,
      playing: this.playing,
      direction: this.direction,
      gravity: this.gravity,
      source: this.source,
      frameIndex: idx,
      frameCount: seq.frames.length,
      fps: seq.fps,
      tMs: seq.frames[idx].tMs,
      framesRendered: this.framesRendered,
      renderErrors: [...this.renderErrors],
      xrError: this.xrError,
      threshold: this.threshold,
      density: this.density,
      gamma: this.gamma,
      palette: this.palette,
      quality: this.quality,
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
    this.renderer.setAnimationLoop(null)
    this.resizeObserver?.disconnect()
    this.controls?.dispose()
    this.hudTex?.dispose()
    this.hud?.material?.dispose()
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
