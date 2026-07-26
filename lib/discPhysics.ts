import { Euler, Quaternion, Vector3 } from "three";

const MAX_ANGULAR_SPEED = 6;
const REST_EULER = new Euler(-0.11, 0.18, -0.035, "XYZ");

export type DiscController = {
  orientation: Quaternion;
  restOrientation: Quaternion;
  angularVelocity: Vector3;
  lastTrackballPoint: Vector3;
  lastPointerTime: number;
  pointerId: number | null;
  pointerDown: boolean;
  reducedMotion: boolean;
  requestFrame?: () => void;
};

export function createDiscController(): DiscController {
  const restOrientation = new Quaternion().setFromEuler(REST_EULER);

  return {
    orientation: restOrientation.clone(),
    restOrientation,
    angularVelocity: new Vector3(),
    lastTrackballPoint: new Vector3(0, 0, 1),
    lastPointerTime: 0,
    pointerId: null,
    pointerDown: false,
    reducedMotion: false,
  };
}

export function projectPointerToTrackball(
  clientX: number,
  clientY: number,
  bounds: DOMRect,
) {
  const radius = Math.max(1, Math.min(bounds.width, bounds.height) * 0.48);
  const x = (clientX - (bounds.left + bounds.width / 2)) / radius;
  const y = ((bounds.top + bounds.height / 2) - clientY) / radius;
  const lengthSquared = x * x + y * y;

  if (lengthSquared <= 1) {
    return new Vector3(x, y, Math.sqrt(1 - lengthSquared)).normalize();
  }

  return new Vector3(x, y, 0).normalize();
}

export function beginDiscDrag(
  controller: DiscController,
  pointerId: number,
  point: Vector3,
  now: number,
) {
  controller.pointerId = pointerId;
  controller.pointerDown = true;
  controller.lastTrackballPoint.copy(point);
  controller.lastPointerTime = now;
  controller.angularVelocity.set(0, 0, 0);
}

export function updateDiscDrag(controller: DiscController, point: Vector3, now: number) {
  if (!controller.pointerDown) {
    return;
  }

  const delta = new Quaternion().setFromUnitVectors(controller.lastTrackballPoint, point);

  controller.orientation.premultiply(delta).normalize();

  const dt = Math.max((now - controller.lastPointerTime) / 1000, 1 / 240);
  const normalizedDelta = delta.w < 0
    ? new Quaternion(-delta.x, -delta.y, -delta.z, -delta.w)
    : delta;
  const angle = 2 * Math.acos(Math.min(1, Math.max(-1, normalizedDelta.w)));
  const sinHalfAngle = Math.sqrt(Math.max(0, 1 - normalizedDelta.w ** 2));

  if (angle > 0.0001 && sinHalfAngle > 0.0001) {
    const sampledVelocity = new Vector3(
      normalizedDelta.x / sinHalfAngle,
      normalizedDelta.y / sinHalfAngle,
      normalizedDelta.z / sinHalfAngle,
    ).multiplyScalar(angle / dt);

    if (sampledVelocity.length() > MAX_ANGULAR_SPEED) {
      sampledVelocity.setLength(MAX_ANGULAR_SPEED);
    }

    controller.angularVelocity.lerp(sampledVelocity, 0.42);
  }

  controller.lastTrackballPoint.copy(point);
  controller.lastPointerTime = now;
}

export function endDiscDrag(controller: DiscController, pointerId?: number) {
  if (pointerId !== undefined && controller.pointerId !== pointerId) {
    return;
  }

  controller.pointerDown = false;
  controller.pointerId = null;

  if (controller.reducedMotion) {
    controller.angularVelocity.set(0, 0, 0);
  }
}

export function nudgeDisc(
  controller: DiscController,
  axis: "x" | "y",
  direction: 1 | -1,
) {
  const vector = axis === "x" ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const delta = new Quaternion().setFromAxisAngle(vector, direction * 0.18);

  controller.pointerDown = false;
  controller.pointerId = null;
  controller.angularVelocity.set(0, 0, 0);
  controller.orientation.premultiply(delta).normalize();
  controller.requestFrame?.();
}

export function resetDisc(controller: DiscController) {
  controller.pointerDown = false;
  controller.pointerId = null;
  controller.angularVelocity.set(0, 0, 0);

  if (controller.reducedMotion) {
    controller.orientation.copy(controller.restOrientation);
  }

  controller.requestFrame?.();
}

export function stepDiscPhysics(controller: DiscController, rawDelta: number) {
  if (controller.pointerDown) {
    return false;
  }

  const dt = Math.min(rawDelta, 1 / 30);
  const inverseCurrent = controller.orientation.clone().invert();
  const error = controller.restOrientation.clone().multiply(inverseCurrent);

  if (error.w < 0) {
    error.set(-error.x, -error.y, -error.z, -error.w);
  }

  const errorAngle = 2 * Math.acos(Math.min(1, Math.max(-1, error.w)));
  const sinHalfAngle = Math.sqrt(Math.max(0, 1 - error.w ** 2));
  const errorAxis = sinHalfAngle > 0.0001
    ? new Vector3(error.x, error.y, error.z).divideScalar(sinHalfAngle)
    : new Vector3();

  if (controller.reducedMotion) {
    const amount = 1 - Math.exp(-22 * dt);
    controller.orientation.slerp(controller.restOrientation, amount);

    if (errorAngle < 0.001) {
      controller.orientation.copy(controller.restOrientation);
      return false;
    }

    return true;
  }

  const spring = 48;
  const damping = 11.5;
  const acceleration = errorAxis
    .multiplyScalar(errorAngle * spring)
    .addScaledVector(controller.angularVelocity, -damping);

  controller.angularVelocity.addScaledVector(acceleration, dt);

  if (controller.angularVelocity.length() > MAX_ANGULAR_SPEED) {
    controller.angularVelocity.setLength(MAX_ANGULAR_SPEED);
  }

  const speed = controller.angularVelocity.length();

  if (speed > 0.0001) {
    const rotationAxis = controller.angularVelocity.clone().normalize();
    const delta = new Quaternion().setFromAxisAngle(rotationAxis, speed * dt);
    controller.orientation.premultiply(delta).normalize();
  }

  if (errorAngle < 0.0015 && speed < 0.012) {
    controller.orientation.copy(controller.restOrientation);
    controller.angularVelocity.set(0, 0, 0);
    return false;
  }

  return true;
}
