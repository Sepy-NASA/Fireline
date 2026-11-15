import test from 'node:test'
import assert from 'node:assert/strict'
import { BackSide, BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, Ray, Vector3 } from 'three'
import { HandManipulation, PinchGesture, handSliderPoint, pickHandTarget } from '../src/features/vr/flameHands.ts'

const close = (a, b, epsilon = 1e-8) => assert.ok(a.distanceTo(b) < epsilon, `${a.toArray()} != ${b.toArray()}`)
const pose = (x, y = 0, z = 0) => { const hand = new Group(); hand.position.set(x, y, z); return hand }
const target = (mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ side: BackSide }))) =>
  ({ mesh, object: mesh, label: 'test', minScale: 0.35, maxScale: 2.5 })

test('pinch requires open fingers, tolerates jitter and fires once per gesture', () => {
  const pinch = new PinchGesture()
  assert.equal(pinch.update(0.01), null)
  assert.equal(pinch.update(0.05), null)
  assert.equal(pinch.update(0.02), 'start')
  for (const distance of [0.024, 0.03, 0.021, 0.028]) assert.equal(pinch.update(distance), null)
  assert.equal(pinch.pinching, true)
  assert.equal(pinch.update(0.04), 'end')
  assert.equal(pinch.update(0.04), null)
})

test('tracking loss releases a pinch and requires reopening before reacquisition', () => {
  const pinch = new PinchGesture()
  pinch.update(0.05); pinch.update(0.01)
  assert.equal(pinch.update(null), 'end')
  assert.equal(pinch.update(0.01), null)
  assert.equal(pinch.update(Number.NaN), null)
  pinch.update(0.05)
  assert.equal(pinch.update(0.01), 'start')
})

test('far pointing hits the nearest volume front despite BackSide rendering', () => {
  const flame = target(), panel = target(new Mesh(new PlaneGeometry(1, 1)))
  flame.mesh.position.z = -2
  panel.mesh.position.z = -3
  const hit = pickHandTarget([panel, flame], new Vector3(), new Ray(new Vector3(), new Vector3(0, 0, -1)))
  assert.equal(hit.target, flame)
  close(hit.point, new Vector3(0, 0, -1.5))
})

test('a nearby rotated panel takes priority over a distant pointed volume', () => {
  const flame = target(), panel = target(new Mesh(new PlaneGeometry(1, 1)))
  flame.mesh.position.z = -2
  panel.mesh.position.set(0.4, 0, 0)
  panel.mesh.rotation.y = Math.PI / 2
  const hit = pickHandTarget([flame, panel], new Vector3(0.42, 0, 0), new Ray(new Vector3(), new Vector3(0, 0, -1)))
  assert.equal(hit.target, panel)
  close(hit.point, new Vector3(0.4, 0, 0))
  panel.mesh.visible = false
  assert.equal(pickHandTarget([panel], new Vector3(0.42, 0, 0), null), null)
})

test('one hand moves and rotates flame around its held point without a start jump', () => {
  const interaction = new HandManipulation(), flame = target(), hand = pose(0)
  flame.object.position.set(0, 0, -2)
  assert.ok(interaction.begin(hand, flame))
  interaction.update()
  close(flame.object.position, new Vector3(0, 0, -2))
  hand.position.x = 1
  hand.rotation.y = Math.PI / 2
  interaction.update()
  close(flame.object.position, new Vector3(-1, 0, 0))
  assert.ok(flame.object.quaternion.angleTo(hand.quaternion) < 1e-8)
})

test('panels rotate with the wrist just like the flame', () => {
  const interaction = new HandManipulation(), panel = target(new Mesh(new PlaneGeometry(1, 1))), hand = pose(0)
  interaction.begin(hand, panel)
  hand.rotation.z = Math.PI / 3
  interaction.update()
  assert.ok(panel.object.quaternion.angleTo(hand.quaternion) < 1e-7)
})

test('two hands translate, scale and rotate the same object', () => {
  const interaction = new HandManipulation(), flame = target(), left = pose(-0.5), right = pose(0.5)
  interaction.begin(left, flame); interaction.begin(right, flame)
  left.position.set(1, -1, 0); right.position.set(1, 1, 0)
  interaction.update()
  close(flame.object.position, new Vector3(1, 0, 0))
  close(flame.object.scale, new Vector3(2, 2, 2))
  close(new Vector3(1, 0, 0).applyQuaternion(flame.object.quaternion), new Vector3(0, 1, 0))
})

for (const releaseLeft of [true, false]) test(`releasing ${releaseLeft ? 'left' : 'right'} hand after resizing does not snap the object`, () => {
  const interaction = new HandManipulation(), flame = target(), left = pose(-0.5), right = pose(0.5)
  flame.object.position.z = -2
  interaction.begin(left, flame); interaction.begin(right, flame)
  left.position.set(-1, 0.2, 0); right.position.set(1, 0.4, 0)
  interaction.update()
  const position = flame.object.position.clone(), rotation = flame.object.quaternion.clone(), scale = flame.object.scale.clone()
  interaction.release(releaseLeft ? left : right)
  interaction.update()
  close(flame.object.position, position)
  close(flame.object.scale, scale)
  assert.ok(flame.object.quaternion.angleTo(rotation) < 1e-7)
  const remaining = releaseLeft ? right : left
  remaining.position.y += 0.3
  interaction.update()
  close(flame.object.position, position.add(new Vector3(0, 0.3, 0)))
})

test('absolute scale limits survive repeated two-hand grabs', () => {
  const interaction = new HandManipulation(), flame = target(), left = pose(-0.1), right = pose(0.1)
  for (let i = 0; i < 3; i++) {
    left.position.x = -0.1; right.position.x = 0.1
    interaction.begin(left, flame); interaction.begin(right, flame)
    left.position.x = -2; right.position.x = 2
    interaction.update()
    assert.equal(flame.object.scale.x, 2.5)
    interaction.release()
  }
  left.position.x = -1; right.position.x = 1
  interaction.begin(left, flame); interaction.begin(right, flame)
  left.position.x = -0.03; right.position.x = 0.03
  interaction.update()
  assert.equal(flame.object.scale.x, 0.35)
})

test('coincident hands cannot create unstable resize transforms', () => {
  const interaction = new HandManipulation(), flame = target(), left = pose(0), right = pose(0.01)
  interaction.begin(left, flame)
  assert.equal(interaction.begin(right, flame), false)
  interaction.update()
  assert.equal(flame.object.scale.x, 1)
})

test('independent grabs, full release and actions do not interfere', () => {
  const interaction = new HandManipulation(), flame = target(), panel = target(), left = pose(0), right = pose(1)
  interaction.begin(left, flame); interaction.begin(right, panel)
  left.position.y = 0.2; right.position.y = -0.3
  interaction.update()
  assert.equal(flame.object.position.y, 0.2)
  assert.equal(panel.object.position.y, -0.3)
  interaction.release()
  const oldPosition = flame.object.position.clone()
  left.position.x = 4; interaction.update()
  close(flame.object.position, oldPosition)
  assert.equal(interaction.begin(left, { ...flame, action: () => {} }), false)
})

test('world transforms remain correct under a transformed parent', () => {
  const parent = new Group(), interaction = new HandManipulation(), flame = target(), hand = pose(0)
  parent.position.set(1, 2, 3); parent.rotation.y = Math.PI / 4; parent.scale.setScalar(2)
  parent.add(flame.object)
  const before = flame.object.getWorldPosition(new Vector3())
  const orientation = flame.object.getWorldQuaternion(new Quaternion())
  interaction.begin(hand, flame)
  hand.position.x = 0.4
  interaction.update()
  close(flame.object.getWorldPosition(new Vector3()), before.add(new Vector3(0.4, 0, 0)))
  assert.ok(flame.object.getWorldQuaternion(new Quaternion()).angleTo(orientation) < 1e-7)
})

test('a pinched timeline keeps tracking beyond the mesh ends and handles rotation', () => {
  const slider = new Mesh(new PlaneGeometry(1, 0.1))
  slider.position.set(1, 1, -2)
  slider.rotation.y = Math.PI / 4
  const local = new Vector3(0.9, 0, 0)
  const world = slider.localToWorld(local.clone())
  const origin = world.clone().add(new Vector3(0, 0, 1))
  const hit = handSliderPoint(slider, new Vector3(), new Ray(origin, new Vector3(0, 0, -1)))
  close(hit, world)
  close(slider.worldToLocal(hit.clone()), local)
  close(handSliderPoint(slider, world, null), world)
  assert.equal(handSliderPoint(slider, new Vector3(), new Ray(origin, new Vector3(0, 0, 1))), null)
})
