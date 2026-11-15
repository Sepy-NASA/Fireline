import { Matrix4, Vector3 } from 'three'

/** The renderer supplies the active eye's world matrix, including XR rig
 * transforms. Reading it directly avoids recomputing an XR eye's local pose. */
export function eyeOriginInVolume(eyeWorld: Matrix4, volumeWorld: Matrix4, target: Vector3, inverse: Matrix4): Vector3 {
  return target.setFromMatrixPosition(eyeWorld).applyMatrix4(inverse.copy(volumeWorld).invert())
}
