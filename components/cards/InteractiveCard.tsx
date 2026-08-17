"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { SportsCard } from "@/data/sportsCards";
import { SportsCardArtwork } from "@/components/cards/SportsCardArtwork";
import styles from "@/components/cards/sports-cards.module.css";

type InteractiveCardProps = {
  card: SportsCard;
  flipSignal: number;
  reducedMotion: boolean;
  onFaceChange: (face: "front" | "back") => void;
};

type CardTransform = CSSProperties & {
  "--card-transform": string;
  "--glare-x": string;
  "--glare-y": string;
  "--glare-angle": string;
  "--glare-opacity": string;
  "--foil-x": string;
  "--foil-y": string;
  "--foil-angle": string;
  "--foil-hue": string;
  "--foil-incidence": string;
  "--foil-opacity": string;
  "--coat-opacity": string;
  "--fresnel-opacity": string;
  "--specular-strength": string;
  "--broad-specular": string;
  "--view-grazing": string;
  "--sparkle-opacity": string;
  "--spectral-shift": string;
  "--relief-x": string;
  "--relief-y": string;
  "--light-azimuth": string;
  "--shadow-x": string;
  "--shadow-y": string;
  "--shadow-scale": string;
  "--shadow-opacity": string;
};

type CardMotionState = {
  orientation: Quaternion;
  angularVelocity: Vector3;
  target: Quaternion | null;
  returnToRest: boolean;
  coastElapsed: number;
  lastArcPoint: Vector3;
  lastPointerTime: number;
  lightX: number;
  lightY: number;
};

const DEG_TO_RAD = Math.PI / 180;
const DEFAULT_LIGHT_X = -0.34;
const DEFAULT_LIGHT_Y = 0.42;
const FACE_HYSTERESIS = 0.04;
const ARC_RADIUS_FACTOR = 0.5;
const MAX_ANGULAR_SPEED = 12;
const MAX_RELEASE_ANGULAR_SPEED = 5.75;
const MIN_ANGULAR_SPEED = 0.015;
const INERTIA_DAMPING = 2.8;
const RETURN_COAST_DURATION = 0.085;
const RETURN_COAST_DAMPING = 6.5;
const RETURN_COAST_MIN_SPEED = 0.18;
const RETURN_LIGHT_DAMPING = 7.5;
const VELOCITY_SMOOTHING = 24;
const SPRING_STIFFNESS = 72;
const SPRING_DAMPING_RATIO = 0.86;
const SPRING_DAMPING =
  2 * Math.sqrt(SPRING_STIFFNESS) * SPRING_DAMPING_RATIO;
const SPRING_POSITION_EPSILON = 0.002;
const SPRING_VELOCITY_EPSILON = 0.02;
const MAX_FRAME_DELTA = 1 / 30;
const SPRING_STEP = 1 / 120;

const LOCAL_X = new Vector3(1, 0, 0);
const LOCAL_Y = new Vector3(0, 1, 0);
const LOCAL_Z = new Vector3(0, 0, 1);
const WORLD_X = new Vector3(1, 0, 0);
const WORLD_Y = new Vector3(0, 1, 0);
const VIEW_DIRECTION = new Vector3(0, 0, 1);

const INITIAL_ORIENTATION = new Quaternion().setFromEuler(
  new Euler(-2 * DEG_TO_RAD, 5 * DEG_TO_RAD, 0, "XYZ"),
);
const INITIAL_TRANSFORM = `matrix3d(${new Matrix4()
  .makeRotationFromQuaternion(INITIAL_ORIENTATION)
  .elements.map((value) => value.toFixed(8))
  .join(",")})`;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function createMotionState(): CardMotionState {
  return {
    orientation: INITIAL_ORIENTATION.clone(),
    angularVelocity: new Vector3(),
    target: null,
    returnToRest: false,
    coastElapsed: 0,
    lastArcPoint: new Vector3(0, 0, 1),
    lastPointerTime: 0,
    lightX: DEFAULT_LIGHT_X,
    lightY: DEFAULT_LIGHT_Y,
  };
}

function negateQuaternion(quaternion: Quaternion) {
  quaternion.set(
    -quaternion.x,
    -quaternion.y,
    -quaternion.z,
    -quaternion.w,
  );
}

export function InteractiveCard({
  card,
  flipSignal,
  reducedMotion,
  onFaceChange,
}: InteractiveCardProps) {
  const opticalAngle = (card.optics?.angle ?? 0) * DEG_TO_RAD;
  const opticalDrift = card.optics?.drift ?? 1;
  const opticalSpectral = card.optics?.spectral ?? 0.62;
  const opticalRoughness = card.optics?.roughness ?? 0.34;
  const opticalFresnel = card.optics?.fresnel ?? 0.72;
  const opticalSparkle = card.optics?.sparkle ?? 0.42;
  const opticalDispersion = card.optics?.dispersion ?? 0.5;
  const cardRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const previousFlipSignalRef = useRef(flipSignal);
  const visibleFaceRef = useRef<"front" | "back">("front");
  const onFaceChangeRef = useRef(onFaceChange);
  const [visibleFace, setVisibleFace] = useState<"front" | "back">("front");
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const stateRef = useRef<CardMotionState>(createMotionState());
  const scratchRef = useRef({
    matrix: new Matrix4(),
    nextArcPoint: new Vector3(),
    deltaQuaternion: new Quaternion(),
    integrationQuaternion: new Quaternion(),
    integrationAxis: new Vector3(),
    inverseQuaternion: new Quaternion(),
    errorQuaternion: new Quaternion(),
    rotationError: new Vector3(),
    acceleration: new Vector3(),
    instantaneousVelocity: new Vector3(),
    frontNormal: new Vector3(),
    surfaceX: new Vector3(),
    surfaceY: new Vector3(),
    surfaceNormal: new Vector3(),
    light: new Vector3(),
    halfVector: new Vector3(),
    keyboardQuaternion: new Quaternion(),
  });

  const projectPointerToArcball = useCallback(
    (clientX: number, clientY: number, target: Vector3) => {
      const stage = stageRef.current;
      const cardElement = cardRef.current;
      if (!stage || !cardElement) return target.set(0, 0, 1);

      const stageRect = stage.getBoundingClientRect();
      const centerX = stageRect.left + stageRect.width / 2;
      const centerY = stageRect.top + stageRect.height / 2;
      const radius = Math.max(80, cardElement.offsetWidth * ARC_RADIUS_FACTOR);
      const x = (clientX - centerX) / radius;
      const y = (centerY - clientY) / radius;
      const distanceSquared = x * x + y * y;
      const z =
        distanceSquared <= 0.5
          ? Math.sqrt(1 - distanceSquared)
          : 0.5 / Math.sqrt(distanceSquared);

      return target.set(x, y, z).normalize();
    },
    [],
  );

  const updatePointerLight = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current;
    const cardElement = cardRef.current;
    if (!stage || !cardElement) return;

    const stageRect = stage.getBoundingClientRect();
    const centerX = stageRect.left + stageRect.width / 2;
    const centerY = stageRect.top + stageRect.height / 2;
    const halfWidth = Math.max(1, cardElement.offsetWidth / 2);
    const halfHeight = Math.max(1, cardElement.offsetHeight / 2);
    const state = stateRef.current;

    state.lightX = clamp((clientX - centerX) / halfWidth, -1.25, 1.25);
    state.lightY = clamp((centerY - clientY) / halfHeight, -1.25, 1.25);
  }, []);

  const renderCard = useCallback(() => {
    const element = cardRef.current;
    if (!element) return;

    const state = stateRef.current;
    const scratch = scratchRef.current;
    const matrix = scratch.matrix.makeRotationFromQuaternion(state.orientation);
    const matrixTransform = `matrix3d(${matrix.elements
      .map((value) => value.toFixed(8))
      .join(",")})`;

    scratch.frontNormal.copy(LOCAL_Z).applyQuaternion(state.orientation);

    let face = visibleFaceRef.current;
    if (face === "front" && scratch.frontNormal.z < -FACE_HYSTERESIS) {
      face = "back";
    } else if (face === "back" && scratch.frontNormal.z > FACE_HYSTERESIS) {
      face = "front";
    }

    const visibleSurfaceSign = scratch.frontNormal.z >= 0 ? 1 : -1;
    scratch.surfaceX
      .copy(LOCAL_X)
      .applyQuaternion(state.orientation)
      .multiplyScalar(visibleSurfaceSign);
    scratch.surfaceY.copy(LOCAL_Y).applyQuaternion(state.orientation);
    scratch.surfaceNormal
      .copy(scratch.frontNormal)
      .multiplyScalar(visibleSurfaceSign);

    scratch.light
      .set(state.lightX * 0.65, state.lightY * 0.65, 1.2)
      .normalize();
    scratch.halfVector
      .copy(scratch.light)
      .add(VIEW_DIRECTION)
      .normalize();

    const halfX = scratch.halfVector.dot(scratch.surfaceX);
    const halfY = scratch.halfVector.dot(scratch.surfaceY);
    const halfZ = Math.max(0.25, scratch.halfVector.dot(scratch.surfaceNormal));
    const glareX = 50 + clamp(halfX / halfZ, -1.15, 1.15) * 46;
    const glareY = 50 - clamp(halfY / halfZ, -1.15, 1.15) * 46;
    const glareAngle = (Math.atan2(-halfY, halfX) * 180) / Math.PI + 90;
    const opticalCos = Math.cos(opticalAngle);
    const opticalSin = Math.sin(opticalAngle);
    const opticalHalfX = (halfX * opticalCos - halfY * opticalSin) * opticalDrift;
    const opticalHalfY = (halfX * opticalSin + halfY * opticalCos) * opticalDrift;
    const foilX = 50 + clamp(opticalHalfX / halfZ, -1.2, 1.2) * 46;
    const foilY = 50 - clamp(opticalHalfY / halfZ, -1.2, 1.2) * 46;
    const foilAngle = (Math.atan2(-opticalHalfY, opticalHalfX) * 180) / Math.PI + 90;
    const normalDotView = clamp(
      scratch.surfaceNormal.dot(VIEW_DIRECTION),
      0,
      1,
    );
    const normalDotHalf = clamp(
      scratch.surfaceNormal.dot(scratch.halfVector),
      0,
      1,
    );
    const normalDotLight = clamp(
      scratch.surfaceNormal.dot(scratch.light),
      0,
      1,
    );
    const grazing = 1 - normalDotView;
    const fresnel = clamp(Math.pow(grazing, 4.2) * opticalFresnel, 0, 1);
    const specularExponent = 9 + (1 - opticalRoughness) * 48;
    const specular = Math.pow(normalDotHalf, specularExponent);
    const broadSpecular = Math.pow(normalDotHalf, 2.6 + opticalRoughness * 5.2);
    const sparkleSpecular = Math.pow(normalDotHalf, 34 + opticalRoughness * 24) * opticalSparkle;
    const incidence = Math.acos(normalDotLight);
    const foilHue =
      ((foilAngle + (incidence * (128 + opticalSpectral * 82 + opticalDispersion * 76)) / Math.PI) % 360 + 360) % 360;
    const foilOpacity = clamp(
      0.055 + broadSpecular * 0.2 + specular * 0.44 + fresnel * 0.16,
      0.04,
      0.78,
    );
    const glareOpacity = clamp(
      0.018 + broadSpecular * 0.12 + specular * 0.72 + fresnel * 0.14,
      0.018,
      0.9,
    );
    const coatOpacity = clamp(0.075 + broadSpecular * 0.11 + specular * 0.24 + fresnel * 0.34, 0.06, 0.66);
    const lightAzimuth = (Math.atan2(state.lightY, state.lightX) * 180) / Math.PI;
    const reliefX = clamp(halfX * (0.7 + grazing), -1, 1) * 2.2;
    const reliefY = clamp(-halfY * (0.7 + grazing), -1, 1) * 2.2;
    const frontness = Math.abs(scratch.frontNormal.z);
    const shadowX = clamp(-scratch.frontNormal.x * 26, -22, 22);
    const shadowY = clamp(24 + scratch.frontNormal.y * 12, 12, 36);
    const shadowScale = 0.64 + frontness * 0.36;
    const shadowOpacity = 0.42 + frontness * 0.25;

    element.style.setProperty("--card-transform", matrixTransform);
    element.style.setProperty("--glare-x", `${glareX.toFixed(2)}%`);
    element.style.setProperty("--glare-y", `${glareY.toFixed(2)}%`);
    element.style.setProperty("--glare-angle", `${glareAngle.toFixed(2)}deg`);
    element.style.setProperty("--glare-opacity", glareOpacity.toFixed(4));
    element.style.setProperty("--foil-x", `${foilX.toFixed(2)}%`);
    element.style.setProperty("--foil-y", `${foilY.toFixed(2)}%`);
    element.style.setProperty("--foil-angle", `${foilAngle.toFixed(2)}deg`);
    element.style.setProperty("--foil-hue", `${foilHue.toFixed(2)}deg`);
    element.style.setProperty("--foil-incidence", `${((incidence * 180) / Math.PI).toFixed(2)}deg`);
    element.style.setProperty("--foil-opacity", foilOpacity.toFixed(4));
    element.style.setProperty("--coat-opacity", coatOpacity.toFixed(4));
    element.style.setProperty("--fresnel-opacity", fresnel.toFixed(4));
    element.style.setProperty("--specular-strength", specular.toFixed(4));
    element.style.setProperty("--broad-specular", broadSpecular.toFixed(4));
    element.style.setProperty("--view-grazing", grazing.toFixed(4));
    element.style.setProperty("--sparkle-opacity", clamp(sparkleSpecular + fresnel * opticalSparkle * 0.16, 0, 0.9).toFixed(4));
    element.style.setProperty("--spectral-shift", `${(foilHue * opticalDispersion).toFixed(2)}deg`);
    element.style.setProperty("--relief-x", `${reliefX.toFixed(3)}px`);
    element.style.setProperty("--relief-y", `${reliefY.toFixed(3)}px`);
    element.style.setProperty("--light-azimuth", `${lightAzimuth.toFixed(2)}deg`);
    element.style.setProperty("--shadow-x", `${shadowX.toFixed(2)}px`);
    element.style.setProperty("--shadow-y", `${shadowY.toFixed(2)}px`);
    element.style.setProperty("--shadow-scale", shadowScale.toFixed(4));
    element.style.setProperty("--shadow-opacity", shadowOpacity.toFixed(4));

    const stage = stageRef.current;
    stage?.style.setProperty("--shadow-x", `${shadowX.toFixed(2)}px`);
    stage?.style.setProperty("--shadow-y", `${shadowY.toFixed(2)}px`);
    stage?.style.setProperty("--shadow-scale", shadowScale.toFixed(4));
    stage?.style.setProperty("--shadow-opacity", shadowOpacity.toFixed(4));

    element.dataset.face = face;
    if (visibleFaceRef.current !== face) {
      visibleFaceRef.current = face;
      setVisibleFace(face);
      onFaceChangeRef.current(face);
    }
  }, [
    opticalAngle,
    opticalDispersion,
    opticalDrift,
    opticalFresnel,
    opticalRoughness,
    opticalSparkle,
    opticalSpectral,
  ]);

  const stopAnimation = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const tick = useCallback(
    function animateCard(time: number) {
      const state = stateRef.current;
      const scratch = scratchRef.current;
      const rawDelta = lastTimeRef.current
        ? (time - lastTimeRef.current) / 1000
        : 1 / 60;
      const frameDelta = Math.min(MAX_FRAME_DELTA, Math.max(0, rawDelta));
      lastTimeRef.current = time;

      if (draggingRef.current) {
        frameRef.current = null;
        return;
      }

      let keepAnimating = false;

      if (state.returnToRest) {
        const lightBlend = 1 - Math.exp(-RETURN_LIGHT_DAMPING * frameDelta);
        state.lightX += (DEFAULT_LIGHT_X - state.lightX) * lightBlend;
        state.lightY += (DEFAULT_LIGHT_Y - state.lightY) * lightBlend;
      }

      if (reducedMotion) {
        if (state.returnToRest) {
          state.orientation.copy(INITIAL_ORIENTATION);
          state.lightX = DEFAULT_LIGHT_X;
          state.lightY = DEFAULT_LIGHT_Y;
        } else if (state.target) {
          state.orientation.copy(state.target);
        }
        state.target = null;
        state.returnToRest = false;
        state.coastElapsed = 0;
        state.angularVelocity.set(0, 0, 0);
      } else if (state.returnToRest && !state.target) {
        const speed = state.angularVelocity.length();
        const coastRemaining = Math.max(
          0,
          RETURN_COAST_DURATION - state.coastElapsed,
        );

        if (speed > RETURN_COAST_MIN_SPEED && coastRemaining > 0) {
          const coastDelta = Math.min(frameDelta, coastRemaining);
          scratch.integrationAxis
            .copy(state.angularVelocity)
            .multiplyScalar(1 / speed);
          scratch.integrationQuaternion.setFromAxisAngle(
            scratch.integrationAxis,
            speed * coastDelta,
          );
          state.orientation
            .premultiply(scratch.integrationQuaternion)
            .normalize();
          state.angularVelocity.multiplyScalar(
            Math.exp(-RETURN_COAST_DAMPING * coastDelta),
          );
          state.coastElapsed += coastDelta;
        } else {
          state.coastElapsed = RETURN_COAST_DURATION;
        }

        if (
          state.coastElapsed >= RETURN_COAST_DURATION ||
          state.angularVelocity.length() <= RETURN_COAST_MIN_SPEED
        ) {
          state.target = INITIAL_ORIENTATION.clone();
        }

        keepAnimating = true;
      } else if (state.target) {
        const substeps = Math.max(1, Math.ceil(frameDelta / SPRING_STEP));
        const delta = frameDelta / substeps;

        for (let index = 0; index < substeps; index += 1) {
          scratch.inverseQuaternion.copy(state.orientation).invert();
          scratch.errorQuaternion
            .copy(state.target)
            .multiply(scratch.inverseQuaternion)
            .normalize();

          if (scratch.errorQuaternion.w < 0) {
            negateQuaternion(scratch.errorQuaternion);
          }

          const sinHalfAngle = Math.hypot(
            scratch.errorQuaternion.x,
            scratch.errorQuaternion.y,
            scratch.errorQuaternion.z,
          );
          const errorAngle = 2 * Math.atan2(
            sinHalfAngle,
            clamp(scratch.errorQuaternion.w, -1, 1),
          );

          if (sinHalfAngle > 1e-7) {
            scratch.rotationError
              .set(
                scratch.errorQuaternion.x,
                scratch.errorQuaternion.y,
                scratch.errorQuaternion.z,
              )
              .multiplyScalar(errorAngle / sinHalfAngle);
          } else {
            scratch.rotationError.set(0, 0, 0);
          }

          scratch.acceleration
            .copy(scratch.rotationError)
            .multiplyScalar(SPRING_STIFFNESS)
            .addScaledVector(state.angularVelocity, -SPRING_DAMPING);
          state.angularVelocity
            .addScaledVector(scratch.acceleration, delta)
            .clampLength(0, MAX_ANGULAR_SPEED);

          const speed = state.angularVelocity.length();
          if (speed > 1e-7) {
            scratch.integrationAxis
              .copy(state.angularVelocity)
              .multiplyScalar(1 / speed);
            scratch.integrationQuaternion.setFromAxisAngle(
              scratch.integrationAxis,
              speed * delta,
            );
            state.orientation
              .premultiply(scratch.integrationQuaternion)
              .normalize();
          }
        }

        scratch.inverseQuaternion.copy(state.orientation).invert();
        scratch.errorQuaternion
          .copy(state.target)
          .multiply(scratch.inverseQuaternion)
          .normalize();
        if (scratch.errorQuaternion.w < 0) {
          negateQuaternion(scratch.errorQuaternion);
        }

        const remainingAngle =
          2 *
          Math.atan2(
            Math.hypot(
              scratch.errorQuaternion.x,
              scratch.errorQuaternion.y,
              scratch.errorQuaternion.z,
            ),
            clamp(scratch.errorQuaternion.w, -1, 1),
          );

        if (
          remainingAngle < SPRING_POSITION_EPSILON &&
          state.angularVelocity.length() < SPRING_VELOCITY_EPSILON
        ) {
          state.orientation.copy(state.target);
          state.target = null;
          state.returnToRest = false;
          state.coastElapsed = 0;
          state.angularVelocity.set(0, 0, 0);
          state.lightX = DEFAULT_LIGHT_X;
          state.lightY = DEFAULT_LIGHT_Y;
        } else {
          keepAnimating = true;
        }
      } else {
        const speed = state.angularVelocity.length();
        if (speed > MIN_ANGULAR_SPEED) {
          scratch.integrationAxis
            .copy(state.angularVelocity)
            .multiplyScalar(1 / speed);
          scratch.integrationQuaternion.setFromAxisAngle(
            scratch.integrationAxis,
            speed * frameDelta,
          );
          state.orientation
            .premultiply(scratch.integrationQuaternion)
            .normalize();
          state.angularVelocity.multiplyScalar(
            Math.exp(-INERTIA_DAMPING * frameDelta),
          );
          keepAnimating = state.angularVelocity.length() > MIN_ANGULAR_SPEED;
        } else {
          state.angularVelocity.set(0, 0, 0);
        }
      }

      renderCard();

      if (keepAnimating) {
        frameRef.current = requestAnimationFrame(animateCard);
      } else {
        frameRef.current = null;
      }
    },
    [reducedMotion, renderCard],
  );

  const startAnimation = useCallback(() => {
    if (frameRef.current !== null) return;
    lastTimeRef.current = 0;
    frameRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const flipCard = useCallback(() => {
    const state = stateRef.current;
    const direction = state.angularVelocity.y < -0.25 ? -1 : 1;
    const baseOrientation = (state.target ?? state.orientation).clone();
    const flipQuaternion = scratchRef.current.keyboardQuaternion.setFromAxisAngle(
      WORLD_Y,
      direction * Math.PI,
    );
    state.returnToRest = false;
    state.coastElapsed = 0;
    state.target = baseOrientation.premultiply(flipQuaternion).normalize();
    state.angularVelocity.multiplyScalar(0.25);

    if (reducedMotion) {
      stopAnimation();
      state.orientation.copy(state.target);
      state.target = null;
      state.angularVelocity.set(0, 0, 0);
      renderCard();
      return;
    }

    startAnimation();
  }, [reducedMotion, renderCard, startAnimation, stopAnimation]);

  const resetCard = useCallback(() => {
    const state = stateRef.current;
    state.returnToRest = false;
    state.coastElapsed = 0;
    state.target = INITIAL_ORIENTATION.clone();
    state.angularVelocity.set(0, 0, 0);

    if (reducedMotion) {
      stopAnimation();
      state.orientation.copy(state.target);
      state.target = null;
      renderCard();
      return;
    }

    startAnimation();
  }, [reducedMotion, renderCard, startAnimation, stopAnimation]);

  const finishPointer = useCallback(
    (
      event?: ReactPointerEvent<HTMLDivElement>,
      cancelled = false,
    ) => {
      if (event && pointerIdRef.current !== event.pointerId) return;

      const pointerId = pointerIdRef.current;
      const element = cardRef.current;
      const state = stateRef.current;
      draggingRef.current = false;
      pointerIdRef.current = null;
      state.lastPointerTime = 0;

      if (element) {
        delete element.dataset.dragging;
        if (
          pointerId !== null &&
          element.hasPointerCapture(pointerId)
        ) {
          element.releasePointerCapture(pointerId);
        }
      }

      if (reducedMotion) {
        stopAnimation();
        state.orientation.copy(INITIAL_ORIENTATION);
        state.angularVelocity.set(0, 0, 0);
        state.target = null;
        state.returnToRest = false;
        state.coastElapsed = 0;
        state.lightX = DEFAULT_LIGHT_X;
        state.lightY = DEFAULT_LIGHT_Y;
        renderCard();
      } else {
        state.returnToRest = true;
        state.coastElapsed = 0;
        state.target = null;
        state.angularVelocity.clampLength(
          0,
          MAX_RELEASE_ANGULAR_SPEED,
        );

        if (
          cancelled ||
          state.angularVelocity.length() <= RETURN_COAST_MIN_SPEED
        ) {
          if (cancelled) state.angularVelocity.set(0, 0, 0);
          state.coastElapsed = RETURN_COAST_DURATION;
          state.target = INITIAL_ORIENTATION.clone();
        }

        startAnimation();
      }
    },
    [reducedMotion, renderCard, startAnimation, stopAnimation],
  );

  const queueKeyboardRotation = useCallback(
    (axis: Vector3, angle: number) => {
      const state = stateRef.current;
      const baseOrientation = (state.target ?? state.orientation).clone();
      const deltaQuaternion =
        scratchRef.current.keyboardQuaternion.setFromAxisAngle(axis, angle);
      state.returnToRest = false;
      state.coastElapsed = 0;
      state.target = baseOrientation
        .premultiply(deltaQuaternion)
        .normalize();
      state.angularVelocity.set(0, 0, 0);

      if (reducedMotion) {
        stopAnimation();
        state.orientation.copy(state.target);
        state.target = null;
        renderCard();
      } else {
        startAnimation();
      }
    },
    [reducedMotion, renderCard, startAnimation, stopAnimation],
  );

  useEffect(() => {
    onFaceChangeRef.current = onFaceChange;
  }, [onFaceChange]);

  useEffect(() => {
    stopAnimation();

    const activePointerId = pointerIdRef.current;
    const element = cardRef.current;
    if (
      element &&
      activePointerId !== null &&
      element.hasPointerCapture(activePointerId)
    ) {
      element.releasePointerCapture(activePointerId);
    }
    if (element) delete element.dataset.dragging;

    const state = stateRef.current;
    state.orientation.copy(INITIAL_ORIENTATION);
    state.angularVelocity.set(0, 0, 0);
    state.target = null;
    state.returnToRest = false;
    state.coastElapsed = 0;
    state.lastArcPoint.set(0, 0, 1);
    state.lastPointerTime = 0;
    state.lightX = DEFAULT_LIGHT_X;
    state.lightY = DEFAULT_LIGHT_Y;
    draggingRef.current = false;
    pointerIdRef.current = null;
    visibleFaceRef.current = "front";
    setVisibleFace("front");
    onFaceChangeRef.current("front");
    renderCard();

    return stopAnimation;
  }, [card.id, renderCard, stopAnimation]);

  useEffect(() => {
    if (flipSignal !== previousFlipSignalRef.current) {
      previousFlipSignalRef.current = flipSignal;
      flipCard();
    }
  }, [flipSignal, flipCard]);

  useEffect(() => {
    if (!reducedMotion) return;

    stopAnimation();
    const state = stateRef.current;
    if (state.returnToRest) {
      state.orientation.copy(INITIAL_ORIENTATION);
    } else if (state.target) {
      state.orientation.copy(state.target);
    }
    state.target = null;
    state.returnToRest = false;
    state.coastElapsed = 0;
    state.angularVelocity.set(0, 0, 0);
    renderCard();
  }, [reducedMotion, renderCard, stopAnimation]);

  useEffect(() => {
    const cancel = () => {
      if (draggingRef.current) finishPointer(undefined, true);
    };

    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, [finishPointer]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || draggingRef.current) return;

    event.preventDefault();
    stopAnimation();
    draggingRef.current = true;
    pointerIdRef.current = event.pointerId;

    const state = stateRef.current;
    state.target = null;
    state.returnToRest = false;
    state.coastElapsed = 0;
    state.angularVelocity.set(0, 0, 0);
    state.lastPointerTime = event.timeStamp;
    projectPointerToArcball(
      event.clientX,
      event.clientY,
      state.lastArcPoint,
    );
    updatePointerLight(event.clientX, event.clientY);

    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = "true";
    renderCard();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const nativeEvent = event.nativeEvent;
    const coalescedEvents = nativeEvent.getCoalescedEvents?.() ?? [];
    const samples =
      coalescedEvents.length > 0 ? coalescedEvents : [nativeEvent];
    const finalSample = samples[samples.length - 1];
    updatePointerLight(finalSample.clientX, finalSample.clientY);

    if (
      !draggingRef.current ||
      pointerIdRef.current !== event.pointerId
    ) {
      renderCard();
      return;
    }

    const state = stateRef.current;
    const scratch = scratchRef.current;

    for (const sample of samples) {
      projectPointerToArcball(
        sample.clientX,
        sample.clientY,
        scratch.nextArcPoint,
      );
      scratch.deltaQuaternion
        .setFromUnitVectors(state.lastArcPoint, scratch.nextArcPoint)
        .normalize();
      state.orientation
        .premultiply(scratch.deltaQuaternion)
        .normalize();

      if (!reducedMotion) {
        const rawDelta = (sample.timeStamp - state.lastPointerTime) / 1000;
        const delta = clamp(
          rawDelta > 0 ? rawDelta : 1 / 120,
          1 / 240,
          1 / 20,
        );
        const sinHalfAngle = Math.hypot(
          scratch.deltaQuaternion.x,
          scratch.deltaQuaternion.y,
          scratch.deltaQuaternion.z,
        );

        if (sinHalfAngle > 1e-7) {
          const angle =
            2 *
            Math.atan2(
              sinHalfAngle,
              clamp(scratch.deltaQuaternion.w, -1, 1),
            );
          scratch.instantaneousVelocity
            .set(
              scratch.deltaQuaternion.x,
              scratch.deltaQuaternion.y,
              scratch.deltaQuaternion.z,
            )
            .multiplyScalar(angle / (sinHalfAngle * delta))
            .clampLength(0, MAX_ANGULAR_SPEED);
          state.angularVelocity
            .lerp(
              scratch.instantaneousVelocity,
              1 - Math.exp(-VELOCITY_SMOOTHING * delta),
            )
            .clampLength(0, MAX_ANGULAR_SPEED);
        }
      } else {
        state.angularVelocity.set(0, 0, 0);
      }

      state.lastArcPoint.copy(scratch.nextArcPoint);
      state.lastPointerTime = sample.timeStamp;
    }

    renderCard();
  };

  const handlePointerLeave = () => {
    if (draggingRef.current) return;
    const state = stateRef.current;
    state.lightX = DEFAULT_LIGHT_X;
    state.lightY = DEFAULT_LIGHT_Y;
    renderCard();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === " " || event.key.toLowerCase() === "f") {
      event.preventDefault();
      flipCard();
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      resetCard();
      return;
    }

    const step = (event.shiftKey ? 12 : 5) * DEG_TO_RAD;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      queueKeyboardRotation(
        WORLD_Y,
        event.key === "ArrowLeft" ? -step : step,
      );
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      queueKeyboardRotation(
        WORLD_X,
        event.key === "ArrowUp" ? step : -step,
      );
    }
  };

  const transformStyle: CardTransform = {
    "--card-transform": INITIAL_TRANSFORM,
    "--glare-x": "54%",
    "--glare-y": "48%",
    "--glare-angle": "118deg",
    "--glare-opacity": "0.34",
    "--foil-x": "54%",
    "--foil-y": "48%",
    "--foil-angle": "118deg",
    "--foil-hue": "0deg",
    "--foil-incidence": "24deg",
    "--foil-opacity": "0.24",
    "--coat-opacity": "0.2",
    "--fresnel-opacity": "0",
    "--specular-strength": "0.35",
    "--broad-specular": "0.42",
    "--view-grazing": "0.04",
    "--sparkle-opacity": "0.08",
    "--spectral-shift": "0deg",
    "--relief-x": "0px",
    "--relief-y": "0px",
    "--light-azimuth": "128deg",
    "--shadow-x": "-1px",
    "--shadow-y": "24px",
    "--shadow-scale": "1",
    "--shadow-opacity": "0.67",
  };

  return (
    <div ref={stageRef} className={styles.inspectCardStage}>
      <div className={styles.inspectCardMotion} data-inspect-motion>
        <div
          ref={cardRef}
          className={styles.interactiveCard}
          style={transformStyle}
          tabIndex={0}
          role="group"
          aria-label={`${card.player} card. Drag to inspect; release to return the card to its resting position. Press F or Space to flip. Use arrow keys to rotate.`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => finishPointer(event)}
          onPointerCancel={(event) => finishPointer(event, true)}
          onPointerLeave={handlePointerLeave}
          onLostPointerCapture={() => {
            if (draggingRef.current) finishPointer(undefined, true);
          }}
          onKeyDown={handleKeyDown}
          onDoubleClick={flipCard}
          onDragStart={(event) => event.preventDefault()}
        >
          <div
            className={`${styles.cardFace} ${styles.cardFaceFront}`}
            aria-hidden={visibleFace === "back"}
          >
            <SportsCardArtwork
              card={card}
              priority
              sizes="(max-width: 640px) calc(100vw - 72px), (max-width: 1024px) 360px, 430px"
            />
          </div>
          <div
            className={`${styles.cardFace} ${styles.cardFaceBack}`}
            aria-hidden={visibleFace === "front"}
          >
            <SportsCardArtwork
              card={card}
              face="back"
              sizes="(max-width: 640px) calc(100vw - 72px), (max-width: 1024px) 360px, 430px"
            />
          </div>
          <span
            className={`${styles.cardEdge} ${styles.cardEdgeLeft}`}
            aria-hidden="true"
          />
          <span
            className={`${styles.cardEdge} ${styles.cardEdgeRight}`}
            aria-hidden="true"
          />
          <span
            className={`${styles.cardEdge} ${styles.cardEdgeTop}`}
            aria-hidden="true"
          />
          <span
            className={`${styles.cardEdge} ${styles.cardEdgeBottom}`}
            aria-hidden="true"
          />
        </div>
        <span className={styles.cardGroundShadow} aria-hidden="true" />
      </div>
    </div>
  );
}
