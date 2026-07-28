"use client";

import { useEffect, useRef, type RefObject } from "react";
import styles from "@/components/home/home.module.css";

type WaterSurfaceProps = {
  lensRef: RefObject<HTMLDivElement | null>;
  interactionLockedRef: RefObject<boolean>;
  reducedMotion: boolean;
};

type LensCircle = {
  centerX: number;
  centerY: number;
  radius: number;
};

type GridLens = {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
};

type WaveMetrics = {
  rmsHeight: number;
  rmsVelocity: number;
  maxSlope: number;
};

type WaveField = {
  width: number;
  height: number;
  current: Float32Array;
  previous: Float32Array;
  next: Float32Array;
  source: Float32Array;
  solid: Uint8Array;
  edgeDamping: Float32Array;
  imageData: ImageData;
  lens: GridLens | null;
  stepCount: number;
};

type PointerSource = {
  active: boolean;
  initialized: boolean;
  targetX: number;
  targetY: number;
  simulatedX: number;
  simulatedY: number;
  lastCssX: number;
  lastCssY: number;
  lastEventAt: number;
  filteredSpeed: number;
  directionX: number;
  directionY: number;
};

const GRID_CELL_SIZE = 5;
const MIN_GRID_WIDTH = 192;
const MAX_GRID_WIDTH = 480;
const MAX_GRID_HEIGHT = 320;
const FIXED_STEP_MS = 1000 / 60;
const FIXED_STEP_SECONDS = 1 / 60;
const MAX_SUBSTEPS = 2;
const RENDER_INTERVAL = 1000 / 45;
const WAVE_SPEED = 185;
const WAVE_DAMPING = Math.exp(-0.72 * FIXED_STEP_SECONDS);
const SPONGE_WIDTH = 12;
const SPONGE_DAMPING = 5.5;
const SOURCE_SIGMA = 1.75;
const SOURCE_DELTA = 1.35;
const SOURCE_RADIUS = 7;
const SOURCE_SPACING = 0.75;
const POINTER_FORCE_TIMEOUT = 170;
const POINTER_PATH_RESET = 140;
const MIN_WAVE_LIFETIME = 2200;
const MAX_WAVE_LIFETIME = 7200;
const QUIET_STEP_TARGET = 54;
const LENS_EXCLUSION_SCALE = 0.47;
const LENS_EXCLUSION_PADDING = 4;
const LENS_PHYSICS_INSET_CELLS = 2;
const LENS_EDGE_FEATHER_CELLS = 1.5;

const LIGHT_X = -0.4508;
const LIGHT_Y = -0.6211;
const LIGHT_Z = 0.6411;
const HALF_X = -0.2488;
const HALF_Y = -0.3428;
const HALF_Z = 0.9060;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const progress = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function pow32(value: number) {
  const squared = value * value;
  const fourth = squared * squared;
  const eighth = fourth * fourth;
  const sixteenth = eighth * eighth;
  return sixteenth * sixteenth;
}

const FLAT_SPECULAR = pow32(HALF_Z);

function createWaveField(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): WaveField {
  const length = width * height;
  const edgeDamping = new Float32Array(length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const edgeDistance = Math.min(x, y, width - 1 - x, height - 1 - y);
      const edgeStrength = clamp(1 - edgeDistance / SPONGE_WIDTH, 0, 1);
      edgeDamping[index] = Math.exp(
        -SPONGE_DAMPING *
          FIXED_STEP_SECONDS *
          edgeStrength *
          edgeStrength,
      );
    }
  }

  return {
    width,
    height,
    current: new Float32Array(length),
    previous: new Float32Array(length),
    next: new Float32Array(length),
    source: new Float32Array(length),
    solid: new Uint8Array(length),
    edgeDamping,
    imageData: context.createImageData(width, height),
    lens: null,
    stepCount: 0,
  };
}

function resetWaveField(field: WaveField) {
  field.current.fill(0);
  field.previous.fill(0);
  field.next.fill(0);
  field.source.fill(0);
  field.imageData.data.fill(0);
  field.stepCount = 0;
}

function gridLensChanged(previous: GridLens | null, next: GridLens | null) {
  if (!previous || !next) {
    return previous !== next;
  }

  return (
    Math.abs(previous.centerX - next.centerX) > 0.25 ||
    Math.abs(previous.centerY - next.centerY) > 0.25 ||
    Math.abs(previous.radiusX - next.radiusX) > 0.25 ||
    Math.abs(previous.radiusY - next.radiusY) > 0.25
  );
}

function updateSolidMask(field: WaveField, lens: GridLens | null) {
  if (!gridLensChanged(field.lens, lens)) {
    return;
  }

  field.lens = lens;
  field.solid.fill(0);

  if (!lens) {
    return;
  }

  const physicsRadiusX = Math.max(
    1,
    lens.radiusX - LENS_PHYSICS_INSET_CELLS,
  );
  const physicsRadiusY = Math.max(
    1,
    lens.radiusY - LENS_PHYSICS_INSET_CELLS,
  );
  const minimumX = Math.max(
    0,
    Math.floor(lens.centerX - physicsRadiusX - 1),
  );
  const maximumX = Math.min(
    field.width - 1,
    Math.ceil(lens.centerX + physicsRadiusX + 1),
  );
  const minimumY = Math.max(
    0,
    Math.floor(lens.centerY - physicsRadiusY - 1),
  );
  const maximumY = Math.min(
    field.height - 1,
    Math.ceil(lens.centerY + physicsRadiusY + 1),
  );

  for (let y = minimumY; y <= maximumY; y += 1) {
    const normalizedY = (y + 0.5 - lens.centerY) / physicsRadiusY;

    for (let x = minimumX; x <= maximumX; x += 1) {
      const normalizedX = (x + 0.5 - lens.centerX) / physicsRadiusX;

      if (normalizedX * normalizedX + normalizedY * normalizedY > 1) {
        continue;
      }

      const index = y * field.width + x;
      field.solid[index] = 1;
      field.current[index] = 0;
      field.previous[index] = 0;
      field.next[index] = 0;
      field.source[index] = 0;
    }
  }
}

function sampleFluidNeighbor(
  values: Float32Array,
  solid: Uint8Array,
  index: number,
  fallback: number,
) {
  return solid[index] ? fallback : values[index];
}

function removeHeightDrift(field: WaveField) {
  let total = 0;
  let count = 0;

  for (let index = 0; index < field.current.length; index += 1) {
    if (field.solid[index]) {
      continue;
    }

    total += field.current[index];
    count += 1;
  }

  if (!count) {
    return;
  }

  const mean = total / count;

  for (let index = 0; index < field.current.length; index += 1) {
    if (field.solid[index]) {
      continue;
    }

    field.current[index] -= mean;
    field.previous[index] -= mean;
  }
}

function stepWaveField(field: WaveField, lambdaSquared: number): WaveMetrics {
  const {
    width,
    height,
    current,
    previous,
    next,
    source,
    solid,
    edgeDamping,
  } = field;
  let sumHeightSquared = 0;
  let sumVelocitySquared = 0;
  let maxSlope = 0;
  let fluidCount = 0;

  next.fill(0);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;

      if (solid[index]) {
        continue;
      }

      const center = current[index];
      const left = sampleFluidNeighbor(current, solid, index - 1, center);
      const right = sampleFluidNeighbor(current, solid, index + 1, center);
      const up = sampleFluidNeighbor(current, solid, index - width, center);
      const down = sampleFluidNeighbor(current, solid, index + width, center);
      const upperLeft = sampleFluidNeighbor(
        current,
        solid,
        index - width - 1,
        center,
      );
      const upperRight = sampleFluidNeighbor(
        current,
        solid,
        index - width + 1,
        center,
      );
      const lowerLeft = sampleFluidNeighbor(
        current,
        solid,
        index + width - 1,
        center,
      );
      const lowerRight = sampleFluidNeighbor(
        current,
        solid,
        index + width + 1,
        center,
      );
      const laplacian =
        (4 * (left + right + up + down) +
          upperLeft +
          upperRight +
          lowerLeft +
          lowerRight -
          20 * center) /
        6;
      const velocity = center - previous[index];
      const nextHeight =
        center +
        velocity * WAVE_DAMPING * edgeDamping[index] +
        lambdaSquared * laplacian +
        clamp(source[index], -0.14, 0.14);

      next[index] = nextHeight;
      const nextVelocity = nextHeight - center;
      const slope = Math.max(
        Math.abs(right - left) * 0.5,
        Math.abs(down - up) * 0.5,
      );
      sumHeightSquared += nextHeight * nextHeight;
      sumVelocitySquared += nextVelocity * nextVelocity;
      maxSlope = Math.max(maxSlope, slope);
      fluidCount += 1;
    }
  }

  const recycled = field.previous;
  field.previous = field.current;
  field.current = field.next;
  field.next = recycled;
  field.source.fill(0);
  field.stepCount += 1;

  if (field.stepCount % 30 === 0) {
    removeHeightDrift(field);
  }

  const divisor = Math.max(1, fluidCount);

  return {
    rmsHeight: Math.sqrt(sumHeightSquared / divisor),
    rmsVelocity: Math.sqrt(sumVelocitySquared / divisor),
    maxSlope,
  };
}

function addBalancedDipole(
  field: WaveField,
  centerX: number,
  centerY: number,
  directionX: number,
  directionY: number,
  amplitude: number,
) {
  const minimumX = Math.max(1, Math.floor(centerX - SOURCE_RADIUS));
  const maximumX = Math.min(
    field.width - 2,
    Math.ceil(centerX + SOURCE_RADIUS),
  );
  const minimumY = Math.max(1, Math.floor(centerY - SOURCE_RADIUS));
  const maximumY = Math.min(
    field.height - 2,
    Math.ceil(centerY + SOURCE_RADIUS),
  );
  const denominator = 2 * SOURCE_SIGMA * SOURCE_SIGMA;
  let positiveTotal = 0;
  let negativeTotal = 0;

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const index = y * field.width + x;

      if (field.solid[index]) {
        continue;
      }

      const offsetX = x + 0.5 - centerX;
      const offsetY = y + 0.5 - centerY;
      const positiveX = offsetX - SOURCE_DELTA * directionX;
      const positiveY = offsetY - SOURCE_DELTA * directionY;
      const negativeX = offsetX + SOURCE_DELTA * directionX;
      const negativeY = offsetY + SOURCE_DELTA * directionY;
      positiveTotal += Math.exp(
        -(positiveX * positiveX + positiveY * positiveY) / denominator,
      );
      negativeTotal += Math.exp(
        -(negativeX * negativeX + negativeY * negativeY) / denominator,
      );
    }
  }

  if (positiveTotal < 0.0001 || negativeTotal < 0.0001) {
    return;
  }

  const sharedTotal = Math.min(positiveTotal, negativeTotal);
  const positiveScale = sharedTotal / positiveTotal;
  const negativeScale = sharedTotal / negativeTotal;

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const index = y * field.width + x;

      if (field.solid[index]) {
        continue;
      }

      const offsetX = x + 0.5 - centerX;
      const offsetY = y + 0.5 - centerY;
      const positiveX = offsetX - SOURCE_DELTA * directionX;
      const positiveY = offsetY - SOURCE_DELTA * directionY;
      const negativeX = offsetX + SOURCE_DELTA * directionX;
      const negativeY = offsetY + SOURCE_DELTA * directionY;
      const positive =
        Math.exp(
          -(positiveX * positiveX + positiveY * positiveY) / denominator,
        ) * positiveScale;
      const negative =
        Math.exp(
          -(negativeX * negativeX + negativeY * negativeY) / denominator,
        ) * negativeScale;

      field.source[index] += amplitude * (positive - negative);
    }
  }
}

function injectPointerSource(
  field: WaveField,
  pointer: PointerSource,
  now: number,
) {
  if (
    !pointer.active ||
    !pointer.initialized ||
    now - pointer.lastEventAt > POINTER_FORCE_TIMEOUT
  ) {
    return false;
  }

  const deltaX = pointer.targetX - pointer.simulatedX;
  const deltaY = pointer.targetY - pointer.simulatedY;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance < 0.035) {
    return false;
  }

  const directionX = deltaX / distance;
  const directionY = deltaY / distance;
  const sampleCount = Math.min(
    72,
    Math.max(1, Math.ceil(distance / SOURCE_SPACING)),
  );
  const speedResponse = smoothstep(40, 700, pointer.filteredSpeed);
  const amplitude = 0.014 + speedResponse * 0.035;

  for (let sampleIndex = 1; sampleIndex <= sampleCount; sampleIndex += 1) {
    const progress = sampleIndex / sampleCount;
    const x = pointer.simulatedX + deltaX * progress;
    const y = pointer.simulatedY + deltaY * progress;

    addBalancedDipole(
      field,
      x,
      y,
      directionX,
      directionY,
      amplitude,
    );
  }

  pointer.simulatedX = pointer.targetX;
  pointer.simulatedY = pointer.targetY;
  pointer.directionX = directionX;
  pointer.directionY = directionY;
  return true;
}

function renderWaveField(field: WaveField) {
  const { width, height, current, previous, solid, lens } = field;
  const pixels = field.imageData.data;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const pixelIndex = index * 4;
      let lensVisibility = 1;

      if (
        lens &&
        Math.abs(x + 0.5 - lens.centerX) <
          lens.radiusX + LENS_EDGE_FEATHER_CELLS &&
        Math.abs(y + 0.5 - lens.centerY) <
          lens.radiusY + LENS_EDGE_FEATHER_CELLS
      ) {
        const normalizedX = (x + 0.5 - lens.centerX) / lens.radiusX;
        const normalizedY = (y + 0.5 - lens.centerY) / lens.radiusY;
        const edgeDistance =
          (Math.hypot(normalizedX, normalizedY) - 1) *
          Math.min(lens.radiusX, lens.radiusY);
        lensVisibility = smoothstep(
          0,
          LENS_EDGE_FEATHER_CELLS,
          edgeDistance,
        );
      }

      if (
        x === 0 ||
        y === 0 ||
        x === width - 1 ||
        y === height - 1 ||
        solid[index] ||
        lensVisibility <= 0
      ) {
        pixels[pixelIndex] = 0;
        pixels[pixelIndex + 1] = 0;
        pixels[pixelIndex + 2] = 0;
        pixels[pixelIndex + 3] = 0;
        continue;
      }

      const center = current[index];
      const left = sampleFluidNeighbor(current, solid, index - 1, center);
      const right = sampleFluidNeighbor(current, solid, index + 1, center);
      const up = sampleFluidNeighbor(
        current,
        solid,
        index - width,
        center,
      );
      const down = sampleFluidNeighbor(
        current,
        solid,
        index + width,
        center,
      );
      const gradientX = (right - left) * 0.5;
      const gradientY = (down - up) * 0.5;
      const curvature =
        left +
        right +
        up +
        down -
        4 * center;
      const normalX = -3 * gradientX;
      const normalY = -3 * gradientY;
      const inverseNormalLength =
        1 / Math.sqrt(normalX * normalX + normalY * normalY + 1);
      const normalizedX = normalX * inverseNormalLength;
      const normalizedY = normalY * inverseNormalLength;
      const normalizedZ = inverseNormalLength;
      const diffuse =
        normalizedX * LIGHT_X +
        normalizedY * LIGHT_Y +
        normalizedZ * LIGHT_Z -
        LIGHT_Z;
      const halfDot = Math.max(
        0,
        normalizedX * HALF_X +
          normalizedY * HALF_Y +
          normalizedZ * HALF_Z,
      );
      const specular = Math.max(pow32(halfDot) - FLAT_SPECULAR, 0);
      const velocity = current[index] - previous[index];
      const alpha = clamp(
        Math.abs(diffuse) * 0.92 +
          Math.abs(curvature) * 0.72 +
          specular * 0.32 +
          Math.abs(current[index]) * 0.025 +
          Math.abs(velocity) * 0.07,
        0,
        0.145,
      );

      if (alpha < 0.0008) {
        pixels[pixelIndex] = 0;
        pixels[pixelIndex + 1] = 0;
        pixels[pixelIndex + 2] = 0;
        pixels[pixelIndex + 3] = 0;
        continue;
      }

      const highlight =
        diffuse + curvature * 0.16 + specular * 0.18 >= 0;
      const weightedAlpha =
        alpha * (highlight ? 1 : 0.55) * lensVisibility;
      pixels[pixelIndex] = highlight ? 255 : 72;
      pixels[pixelIndex + 1] = highlight ? 255 : 102;
      pixels[pixelIndex + 2] = highlight ? 252 : 106;
      pixels[pixelIndex + 3] = Math.round(weightedAlpha * 255);
    }
  }
}

function metricsAreQuiet(metrics: WaveMetrics) {
  return (
    metrics.rmsHeight < 0.0008 &&
    metrics.rmsVelocity < 0.00015 &&
    metrics.maxSlope < 0.002
  );
}

function deactivatePointer(pointer: PointerSource) {
  pointer.active = false;
  pointer.initialized = false;
  pointer.filteredSpeed = 0;
}

export function WaterSurface({
  lensRef,
  interactionLockedRef,
  reducedMotion,
}: WaterSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (
      !canvas ||
      reducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const context = canvas.getContext("2d", { alpha: true });

    if (!context) {
      return;
    }

    let cssWidth = 1;
    let cssHeight = 1;
    let field: WaveField | null = null;
    let frameId = 0;
    let resizeFrameId = 0;
    let lastSimulationAt = 0;
    let lastRenderAt = 0;
    let lastInputAt = 0;
    let accumulator = 0;
    let quietSteps = 0;
    let metrics: WaveMetrics = {
      rmsHeight: 0,
      rmsVelocity: 0,
      maxSlope: 0,
    };
    const pointer: PointerSource = {
      active: false,
      initialized: false,
      targetX: 0,
      targetY: 0,
      simulatedX: 0,
      simulatedY: 0,
      lastCssX: 0,
      lastCssY: 0,
      lastEventAt: 0,
      filteredSpeed: 0,
      directionX: 1,
      directionY: 0,
    };

    const clearSurface = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
    };

    const getLensCircle = (): LensCircle | null => {
      const lens = lensRef.current;

      if (!lens) {
        return null;
      }

      const bounds = lens.getBoundingClientRect();

      return {
        centerX: bounds.left + bounds.width / 2,
        centerY: bounds.top + bounds.height / 2,
        radius:
          Math.min(bounds.width, bounds.height) * LENS_EXCLUSION_SCALE +
          LENS_EXCLUSION_PADDING,
      };
    };

    const getGridLens = (
      waveField: WaveField,
      canvasBounds: DOMRect,
    ): GridLens | null => {
      const lens = getLensCircle();

      if (!lens) {
        return null;
      }

      return {
        centerX:
          ((lens.centerX - canvasBounds.left) / canvasBounds.width) *
          waveField.width,
        centerY:
          ((lens.centerY - canvasBounds.top) / canvasBounds.height) *
          waveField.height,
        radiusX: (lens.radius / canvasBounds.width) * waveField.width,
        radiusY: (lens.radius / canvasBounds.height) * waveField.height,
      };
    };

    const isOutsideLens = (clientX: number, clientY: number) => {
      const lens = getLensCircle();

      if (!lens) {
        return true;
      }

      return (
        Math.hypot(clientX - lens.centerX, clientY - lens.centerY) >
        lens.radius
      );
    };

    const cutOutLens = (lens: GridLens | null) => {
      if (!lens) {
        return;
      }

      context.save();
      context.globalCompositeOperation = "destination-out";
      context.fillStyle = "#000";
      context.beginPath();
      context.ellipse(
        lens.centerX,
        lens.centerY,
        lens.radiusX,
        lens.radiusY,
        0,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.restore();
    };

    const stopSimulation = (clearField = true) => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }

      if (clearField && field) {
        resetWaveField(field);
      }

      accumulator = 0;
      quietSteps = 0;
      clearSurface();
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      cssWidth = Math.max(1, bounds.width);
      cssHeight = Math.max(1, bounds.height);
      const gridWidth = clamp(
        Math.round(cssWidth / GRID_CELL_SIZE),
        MIN_GRID_WIDTH,
        MAX_GRID_WIDTH,
      );
      const gridHeight = clamp(
        Math.round((gridWidth * cssHeight) / cssWidth),
        72,
        MAX_GRID_HEIGHT,
      );

      stopSimulation();
      canvas.width = gridWidth;
      canvas.height = gridHeight;
      field = createWaveField(context, gridWidth, gridHeight);
      context.imageSmoothingEnabled = true;
      deactivatePointer(pointer);
      lastSimulationAt = performance.now();
      lastRenderAt = 0;
    };

    const scheduleResize = () => {
      if (resizeFrameId) {
        return;
      }

      resizeFrameId = window.requestAnimationFrame(() => {
        resizeFrameId = 0;
        resize();
      });
    };

    const draw = (now: number) => {
      frameId = 0;
      const waveField = field;

      if (!waveField) {
        return;
      }

      const canvasBounds = canvas.getBoundingClientRect();
      const gridLens = getGridLens(waveField, canvasBounds);
      updateSolidMask(waveField, gridLens);

      if (interactionLockedRef.current) {
        deactivatePointer(pointer);
      } else if (pointer.active && now - pointer.lastEventAt > POINTER_FORCE_TIMEOUT) {
        deactivatePointer(pointer);
      }

      const elapsed = Math.min(50, Math.max(0, now - lastSimulationAt));
      lastSimulationAt = now;
      accumulator = Math.min(
        accumulator + elapsed,
        FIXED_STEP_MS * MAX_SUBSTEPS,
      );
      let substeps = 0;
      let injected = false;
      const cellSize = Math.max(
        cssWidth / waveField.width,
        cssHeight / waveField.height,
      );
      const lambda = (WAVE_SPEED * FIXED_STEP_SECONDS) / cellSize;
      const lambdaSquared = Math.min(0.28, lambda * lambda);

      while (
        accumulator >= FIXED_STEP_MS &&
        substeps < MAX_SUBSTEPS
      ) {
        injected =
          injectPointerSource(waveField, pointer, now) || injected;
        if (injected) {
          lastInputAt = pointer.lastEventAt;
        }
        metrics = stepWaveField(waveField, lambdaSquared);
        accumulator -= FIXED_STEP_MS;
        substeps += 1;
      }

      if (
        now - lastInputAt >= MIN_WAVE_LIFETIME &&
        !injected &&
        !pointer.active &&
        metricsAreQuiet(metrics)
      ) {
        quietSteps += substeps;
      } else {
        quietSteps = 0;
      }

      const renderElapsed = now - lastRenderAt;

      if (renderElapsed >= RENDER_INTERVAL) {
        renderWaveField(waveField);
        context.putImageData(waveField.imageData, 0, 0);
        cutOutLens(gridLens);
        lastRenderAt = now - (renderElapsed % RENDER_INTERVAL);
      }

      if (
        quietSteps >= QUIET_STEP_TARGET ||
        (!pointer.active &&
          lastInputAt > 0 &&
          now - lastInputAt > MAX_WAVE_LIFETIME)
      ) {
        stopSimulation();
        return;
      }

      frameId = window.requestAnimationFrame(draw);
    };

    const ensureFrame = () => {
      if (frameId) {
        return;
      }

      lastSimulationAt = performance.now();
      accumulator = FIXED_STEP_MS;
      frameId = window.requestAnimationFrame(draw);
    };

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const waveField = field;

      if (
        !waveField ||
        !event.isPrimary ||
        event.pointerType === "touch" ||
        event.buttons !== 0 ||
        interactionLockedRef.current ||
        !isOutsideLens(event.clientX, event.clientY)
      ) {
        deactivatePointer(pointer);
        return;
      }

      const bounds = canvas.getBoundingClientRect();
      const cssX = event.clientX - bounds.left;
      const cssY = event.clientY - bounds.top;

      if (
        cssX < 0 ||
        cssX > bounds.width ||
        cssY < 0 ||
        cssY > bounds.height
      ) {
        deactivatePointer(pointer);
        return;
      }

      const now = performance.now();
      const gridX = (cssX / bounds.width) * waveField.width;
      const gridY = (cssY / bounds.height) * waveField.height;

      if (
        !pointer.active ||
        now - pointer.lastEventAt > POINTER_PATH_RESET
      ) {
        pointer.active = true;
        pointer.initialized = true;
        pointer.targetX = gridX;
        pointer.targetY = gridY;
        pointer.simulatedX = gridX;
        pointer.simulatedY = gridY;
        pointer.lastCssX = cssX;
        pointer.lastCssY = cssY;
        pointer.lastEventAt = now;
        pointer.filteredSpeed = 0;
        return;
      }

      const elapsed = Math.max(1, now - pointer.lastEventAt);
      const cssDeltaX = cssX - pointer.lastCssX;
      const cssDeltaY = cssY - pointer.lastCssY;
      const distance = Math.hypot(cssDeltaX, cssDeltaY);
      const rawSpeed = (distance / elapsed) * 1000;
      const filterResponse = 1 - Math.exp(-elapsed / 50);
      pointer.filteredSpeed +=
        (clamp(rawSpeed, 0, 1200) - pointer.filteredSpeed) *
        filterResponse;
      pointer.targetX = gridX;
      pointer.targetY = gridY;
      pointer.lastCssX = cssX;
      pointer.lastCssY = cssY;
      pointer.lastEventAt = now;

      const accumulatedGridDistance = Math.hypot(
        pointer.targetX - pointer.simulatedX,
        pointer.targetY - pointer.simulatedY,
      );

      if (accumulatedGridDistance < 0.035) {
        return;
      }

      lastInputAt = now;
      ensureFrame();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        return;
      }

      deactivatePointer(pointer);
      stopSimulation();
    };

    const handlePointerExit = () => {
      deactivatePointer(pointer);
    };

    resize();
    const resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(canvas);
    window.addEventListener("resize", scheduleResize);
    window.visualViewport?.addEventListener("resize", scheduleResize);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("blur", handlePointerExit);
    document.documentElement.addEventListener("mouseleave", handlePointerExit);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleResize);
      window.visualViewport?.removeEventListener("resize", scheduleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", handlePointerExit);
      document.documentElement.removeEventListener(
        "mouseleave",
        handlePointerExit,
      );
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      if (resizeFrameId) {
        window.cancelAnimationFrame(resizeFrameId);
      }

      if (field) {
        resetWaveField(field);
      }

      deactivatePointer(pointer);
      clearSurface();
      field = null;
    };
  }, [interactionLockedRef, lensRef, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.waterSurface}
      aria-hidden="true"
    />
  );
}
