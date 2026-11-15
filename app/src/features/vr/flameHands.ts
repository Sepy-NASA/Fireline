import { Box3, Matrix4, Object3D, Plane, Quaternion, Ray, Vector3, type Mesh } from 'three'

export interface HandTarget {
  mesh: Mesh
  object: Object3D
  label: string
  minScale: number
  maxScale: number
  action?: () => void
  onSlide?: (point: Vector3) => void
}

/** Continue scrubbing past the ends of a slider without losing the pinch. */
export function handSliderPoint(mesh: Mesh, point: Vector3, ray: Ray | null): Vector3 | null {
  mesh.updateWorldMatrix(true, false)
  const plane = new Plane().setFromNormalAndCoplanarPoint(
    new Vector3(0, 0, 1).applyQuaternion(mesh.getWorldQuaternion(new Quaternion())),
    mesh.getWorldPosition(new Vector3()),
  )
  return ray ? ray.intersectPlane(plane, new Vector3()) : plane.projectPoint(point, new Vector3())
}

/** Separate close/open thresholds prevent noisy fingertips from dropping a grab.
 * After tracking loss, an open hand is required before another grab can start. */
export class PinchGesture {
  pinching = false
  private armed = false

  update(distance: number | null): 'start' | 'end' | null {
    if (distance === null || !Number.isFinite(distance)) {
      const wasPinching = this.pinching
      this.pinching = false
      this.armed = false
      return wasPinching ? 'end' : null
    }
    if (distance > 0.035) {
      const wasPinching = this.pinching
      this.pinching = false
      this.armed = true
      return wasPinching ? 'end' : null
    }
    if (this.armed && !this.pinching && distance < 0.022) {
      this.pinching = true
      return 'start'
    }
    return null
  }
}

/** Prefer touching an object's surface over distant pointing. Intersect in mesh
 * space so the flame's BackSide shader and rotated panels pick consistently. */
export function pickHandTarget(targets: HandTarget[], point: Vector3, ray: Ray | null) {
  let near: { target: HandTarget; point: Vector3; distance: number } | null = null
  let far: { target: HandTarget; point: Vector3; distance: number } | null = null
  for (const target of targets) {
    const mesh = target.mesh
    if (!mesh.visible || !target.object.visible) continue
    mesh.updateWorldMatrix(true, false)
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    const bounds = mesh.geometry.boundingBox as Box3
    const inverse = new Matrix4().copy(mesh.matrixWorld).invert()
    const local = point.clone().applyMatrix4(inverse)
    const closest = bounds.clampPoint(local, new Vector3()).applyMatrix4(mesh.matrixWorld)
    const distance = closest.distanceTo(point)
    if (distance <= 0.065 && (!near || distance < near.distance)) near = { target, point: closest, distance }
    if (!ray) continue
    const hit = ray.clone().applyMatrix4(inverse).intersectBox(bounds, new Vector3())
    if (!hit) continue
    hit.applyMatrix4(mesh.matrixWorld)
    const rayDistance = hit.distanceTo(ray.origin)
    if (rayDistance <= 5 && (!far || rayDistance < far.distance)) far = { target, point: hit, distance: rayDistance }
  }
  return near ?? far
}

interface Grab {
  pose: Object3D
  target: HandTarget
  offset: Vector3
  rotation: Quaternion
}

/** World-space manipulation shared by either hand. A release rebases the other
 * hand at the current transform, including after a two-hand resize. */
export class HandManipulation {
  private grabs: Grab[] = []
  private pair: {
    object: Object3D
    direction: Vector3
    distance: number
    offset: Vector3
    scale: Vector3
    rotation: Quaternion
  } | null = null

  held(pose: Object3D) { return this.grabs.find((grab) => grab.pose === pose)?.target ?? null }

  begin(pose: Object3D, target: HandTarget): boolean {
    if (target.action || target.onSlide || this.held(pose)) return false
    const grab: Grab = { pose, target, offset: new Vector3(), rotation: new Quaternion() }
    this.rebase(grab)
    const other = this.grabs.find((g) => g.target.object === target.object)
    if (other) {
      const a = other.pose.getWorldPosition(new Vector3())
      const b = pose.getWorldPosition(new Vector3())
      const distance = a.distanceTo(b)
      // Near-coincident fingertips cannot define a stable scaling axis.
      if (distance < 0.08) return false
      this.pair = {
        object: target.object, direction: b.clone().sub(a).normalize(), distance,
        offset: target.object.getWorldPosition(new Vector3()).sub(a.add(b).multiplyScalar(0.5)),
        scale: target.object.getWorldScale(new Vector3()),
        rotation: target.object.getWorldQuaternion(new Quaternion()),
      }
    }
    this.grabs.push(grab)
    return true
  }

  release(pose?: Object3D) {
    const object = pose ? this.held(pose)?.object : null
    this.grabs = pose ? this.grabs.filter((g) => g.pose !== pose) : []
    if (!pose || this.pair?.object === object) this.pair = null
    for (const grab of this.grabs) if (grab.target.object === object) this.rebase(grab)
  }

  private rebase(grab: Grab) {
    const q = grab.pose.getWorldQuaternion(new Quaternion()).invert()
    grab.offset.copy(grab.target.object.getWorldPosition(new Vector3()))
      .sub(grab.pose.getWorldPosition(new Vector3())).applyQuaternion(q)
    grab.rotation.copy(q).multiply(grab.target.object.getWorldQuaternion(new Quaternion()))
  }

  private setWorld(object: Object3D, position: Vector3, rotation: Quaternion, scale: Vector3) {
    const matrix = new Matrix4().compose(position, rotation, scale)
    if (object.parent) {
      object.parent.updateWorldMatrix(true, false)
      matrix.premultiply(new Matrix4().copy(object.parent.matrixWorld).invert())
    }
    matrix.decompose(object.position, object.quaternion, object.scale)
    object.updateWorldMatrix(false, true)
  }

  update() {
    const pair = this.pair
    if (pair) {
      const same = this.grabs.filter((g) => g.target.object === pair.object)
      const a = same[0].pose.getWorldPosition(new Vector3())
      const b = same[1].pose.getWorldPosition(new Vector3())
      const direction = b.clone().sub(a)
      // Keep the last valid transform when the two hands cross or overlap.
      if (direction.length() >= 0.04) {
        const desired = pair.scale.x * direction.length() / pair.distance
        const scale = Math.max(same[0].target.minScale, Math.min(same[0].target.maxScale, desired))
        const ratio = scale / pair.scale.x
        const rotation = new Quaternion().setFromUnitVectors(pair.direction, direction.normalize())
        const position = a.add(b).multiplyScalar(0.5).add(pair.offset.clone().multiplyScalar(ratio).applyQuaternion(rotation))
        this.setWorld(pair.object, position, rotation.multiply(pair.rotation), pair.scale.clone().multiplyScalar(ratio))
      }
    }
    for (const grab of this.grabs) {
      if (pair?.object === grab.target.object) continue
      const q = grab.pose.getWorldQuaternion(new Quaternion())
      const p = grab.pose.getWorldPosition(new Vector3()).add(grab.offset.clone().applyQuaternion(q))
      this.setWorld(grab.target.object, p, q.multiply(grab.rotation), grab.target.object.getWorldScale(new Vector3()))
    }
  }
}
