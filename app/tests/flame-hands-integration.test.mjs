import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { Box3, Box3Helper, BoxGeometry, Group, Mesh, PlaneGeometry, Scene, Vector3 } from 'three'
import { createServer } from 'vite'
import { HandManipulation } from '../src/features/vr/flameHands.ts'

let server, FlameEngine, panelHelpers
before(async () => {
  server = await createServer({ configFile: false, root: fileURLToPath(new URL('../', import.meta.url)),
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom',
  })
  ;({ FlameEngine } = await server.ssrLoadModule('/src/features/vr/flameEngine.ts'))
  panelHelpers = await server.ssrLoadModule('/src/features/vr/flamePanels.ts')
})
after(async () => { await server?.close() })

function harness() {
  // Exercise real engine joint processing without requiring a WebGL/XR device.
  const engine = Object.create(FlameEngine.prototype)
  const hands = [new Group(), new Group()], rays = [new Group(), new Group()]
  for (const hand of hands) {
    hand.joints = {}
    for (const name of ['wrist', 'thumb-tip', 'index-finger-tip']) {
      const joint = new Group()
      hand.joints[name] = joint
      hand.add(joint)
    }
  }
  Object.assign(engine, {
    scene: new Scene(), handVisuals: [], handButtons: [], handScrubs: new Map(), hoveredPlayerMeshes: new Set(),
    panels: [], previewMesh: null, toolbar: new Group(), flameGroup: new Group(),
    box: new Mesh(new BoxGeometry(1, 1, 1)), manipulation: new HandManipulation(),
    hoverOutline: new Box3Helper(new Box3()), trackedHands: 0, handHint: '',
    times: [0, 1000, 3000], timeMs: 1500, playing: false, direction: 1,
    onStateCb: null,
    renderer: { xr: { getHand: i => hands[i], getController: i => rays[i], getSession: () => ({ visibilityState: 'visible' }) } },
  })
  engine.flameGroup.add(engine.box)
  engine.scene.add(engine.flameGroup, engine.toolbar)
  engine.buildHandVisuals()
  function connect(i, handedness) {
    const source = { hand: new Map(), handedness }
    hands[i].dispatchEvent({ type: 'connected', data: source })
    rays[i].visible = false
    return source
  }
  function fingers(i, x, distance = 0.06, y = 0) {
    hands[i].joints['thumb-tip'].position.set(x - distance / 2, y, 0)
    hands[i].joints['index-finger-tip'].position.set(x + distance / 2, y, 0)
    hands[i].visible = true
  }
  function frame(dt = 1) { engine.updateHands(dt); engine.manipulation.update() }
  return { engine, hands, connect, fingers, frame }
}

test('right hand connected first is tracked and pinches to grab without changing playback', () => {
  const h = harness(), source = h.connect(0, 'right')
  h.fingers(0, 0); h.frame()
  assert.equal(h.engine.trackedHands, 1)
  assert.equal(h.engine.handVisuals[0].source, source)
  h.fingers(0, 0, 0.01); h.frame()
  assert.equal(h.engine.manipulation.held(h.engine.handVisuals[0].pose).object, h.engine.flameGroup)
  assert.equal(h.engine.playing, false)
  h.fingers(0, 0.2, 0.01); h.frame()
  assert.ok(Math.abs(h.engine.flameGroup.position.x - 0.2) < 1e-8)
  h.hands[0].joints.wrist.rotation.y = Math.PI / 4
  h.frame()
  assert.ok(h.engine.flameGroup.quaternion.angleTo(h.hands[0].joints.wrist.quaternion) < 1e-7)
})

test('two pinching hands resize; losing either hand releases it without a snap or phantom regrab', () => {
  const h = harness()
  h.connect(0, 'right'); h.connect(1, 'left')
  h.fingers(0, -0.2); h.fingers(1, 0.2); h.frame()
  h.fingers(0, -0.2, 0.01); h.fingers(1, 0.2, 0.01); h.frame()
  h.fingers(0, -0.4, 0.01); h.fingers(1, 0.4, 0.01); h.frame()
  assert.ok(Math.abs(h.engine.flameGroup.scale.x - 2) < 1e-8)
  const before = h.engine.flameGroup.position.clone()
  h.hands[0].visible = false
  h.frame(0)
  assert.equal(h.engine.trackedHands, 1)
  assert.equal(h.engine.manipulation.held(h.engine.handVisuals[0].pose), null)
  assert.ok(h.engine.flameGroup.position.distanceTo(before) < 1e-8)
  h.hands[0].visible = true
  h.frame()
  assert.equal(h.engine.manipulation.held(h.engine.handVisuals[0].pose), null)
  h.fingers(0, -0.4); h.frame()
  h.fingers(0, -0.4, 0.01); h.frame()
  assert.ok(h.engine.manipulation.held(h.engine.handVisuals[0].pose))
})

test('a hand button activates only once during a held pinch', () => {
  const h = harness(); h.connect(0, 'left')
  h.engine.flameGroup.visible = false
  let clicks = 0
  const button = new Mesh(new PlaneGeometry(1, 0.2))
  h.engine.toolbar.add(button)
  h.engine.handButtons.push({ mesh: button, object: h.engine.toolbar, label: 'Play', minScale: 1, maxScale: 1, action: () => clicks++ })
  h.fingers(0, 0); h.frame()
  h.fingers(0, 0, 0.01)
  for (let i = 0; i < 5; i++) h.frame()
  assert.equal(clicks, 1)
  h.fingers(0, 0); h.frame(); h.fingers(0, 0, 0.01); h.frame()
  assert.equal(clicks, 2)
})

test('a pinched timeline pauses and follows the hand past either endpoint until release', () => {
  const h = harness(); h.connect(0, 'left')
  h.engine.flameGroup.visible = false
  const slider = new Mesh(new PlaneGeometry(1, 0.2))
  h.engine.toolbar.add(slider)
  h.engine.handButtons.push({ mesh: slider, object: h.engine.toolbar, label: 'Timeline', minScale: 1, maxScale: 1,
    onSlide: point => h.engine.seekFraction(slider.worldToLocal(point.clone()).x + 0.5),
  })
  h.engine.playing = true
  h.fingers(0, 0); h.frame(); h.fingers(0, 0, 0.01); h.frame()
  assert.equal(h.engine.playing, false)
  assert.equal(h.engine.timeMs, 1500)
  h.fingers(0, 0.9, 0.01); h.frame()
  assert.equal(h.engine.timeMs, 3000)
  h.fingers(0, -0.9, 0.01); h.frame()
  assert.equal(h.engine.timeMs, 0)
  h.fingers(0, 0, 0.01); h.frame()
  assert.ok(Math.abs(h.engine.timeMs - 1500) < 1e-8)
  h.fingers(0, 0); h.frame()
  assert.equal(h.engine.handScrubs.size, 0)
  h.fingers(0, 0.3); h.frame()
  assert.ok(Math.abs(h.engine.timeMs - 1500) < 1e-8)
})

test('disconnect clears the grab, gesture and visible feedback', () => {
  const h = harness(); const source = h.connect(0, 'right')
  h.fingers(0, 0); h.frame(); h.fingers(0, 0, 0.01); h.frame()
  h.hands[0].dispatchEvent({ type: 'disconnected', data: source })
  h.frame()
  assert.equal(h.engine.trackedHands, 0)
  assert.equal(h.engine.manipulation.held(h.engine.handVisuals[0].pose), null)
  assert.equal(h.engine.handVisuals[0].cursor.visible, false)
  assert.equal(h.engine.handVisuals[0].lines.visible, false)
})

test('Play changes reverse playback to forward; a second press pauses', () => {
  const { engine } = harness()
  engine.playing = true; engine.direction = -1
  engine.togglePlay()
  assert.equal(engine.playing, true)
  assert.equal(engine.direction, 1)
  engine.togglePlay()
  assert.equal(engine.playing, false)
})

test('timeline hit coordinates match the inset visual track and clamp beyond its ends', () => {
  assert.equal(panelHelpers.timelineFraction(0.035), 0)
  assert.equal(panelHelpers.timelineFraction(0.5), 0.5)
  assert.equal(panelHelpers.timelineFraction(0.965), 1)
  assert.equal(panelHelpers.timelineFraction(-0.2), 0)
  assert.equal(panelHelpers.timelineFraction(1.2), 1)
})

test('uncalibrated readouts preserve faint thermocouple signals and missing samples', () => {
  assert.equal(panelHelpers.formatSignal(0.000047), '4.70e-5')
  assert.equal(panelHelpers.formatSignal(0.010873), '0.01087')
  assert.equal(panelHelpers.formatSignal(null), '—')
})
