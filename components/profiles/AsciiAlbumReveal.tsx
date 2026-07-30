"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Waves } from "lucide-react";
import styles from "@/components/profiles/ascii-profile.module.css";

const COVER_SRC = "/media/asen/cover.jpg";
const ASCII_SRC = "/media/asen/cover-ascii.txt";
const ASCII_COLUMNS = 400;
const ASCII_ROWS = 220;

type LensState = {
  angle: number;
  currentAngle: number;
  currentRadius: number;
  currentX: number;
  currentY: number;
  height: number;
  lastPaintedAt: number;
  lastMovedAt: number;
  targetRadius: number;
  targetX: number;
  targetY: number;
  velocityX: number;
  velocityY: number;
  wakeTailX: number;
  wakeTailY: number;
  wakeX: number;
  wakeY: number;
  width: number;
};

type TouchStart = {
  pointerId: number;
  x: number;
  y: number;
};

type WakeRibbonPoint = {
  halfWidth: number;
  normalX: number;
  normalY: number;
  x: number;
  y: number;
};

const TRAIL_SETTLE_TIME = 460;
const WAKE_CAPTURE_WINDOW = 72;
const FRAME_DURATION = 1000 / 60;
const RESTING_ANGLE = -0.045;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const lerp = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

const getFrameLerp = (amount: number, frameRatio: number) =>
  1 - Math.pow(1 - amount, frameRatio);

const getAngleDistance = (from: number, to: number) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));

const lerpAngle = (from: number, to: number, amount: number) =>
  from + getAngleDistance(from, to) * amount;

const getRevealRadius = (width: number, height: number) =>
  clamp(Math.min(width, height) * 0.1, 46, 106);

function setLensTarget(
  state: LensState,
  nextX: number,
  nextY: number,
  width: number,
  height: number,
  timestamp: number,
) {
  const clampedX = clamp(nextX, 0, width);
  const clampedY = clamp(nextY, 0, height);
  const wasInactive = state.targetRadius <= 0;
  const deltaX = clampedX - state.targetX;
  const deltaY = clampedY - state.targetY;
  const distance = Math.hypot(deltaX, deltaY);

  if (wasInactive) {
    state.currentX = clampedX;
    state.currentY = clampedY;
    state.wakeX = clampedX;
    state.wakeY = clampedY;
    state.wakeTailX = clampedX;
    state.wakeTailY = clampedY;
    state.velocityX = 0;
    state.velocityY = 0;
    state.lastMovedAt = timestamp;
  } else if (distance > 0.75) {
    const elapsed = timestamp - state.lastMovedAt;
    const staleMotion = elapsed > TRAIL_SETTLE_TIME;
    const normalizedFrame = staleMotion
      ? 1
      : clamp(16.67 / Math.max(elapsed, 1), 0.5, 2);
    const normalizedDeltaX = deltaX * normalizedFrame;
    const normalizedDeltaY = deltaY * normalizedFrame;
    state.velocityX = staleMotion
      ? normalizedDeltaX
      : lerp(state.velocityX, normalizedDeltaX, 0.46);
    state.velocityY = staleMotion
      ? normalizedDeltaY
      : lerp(state.velocityY, normalizedDeltaY, 0.46);
    state.angle = Math.atan2(deltaY, deltaX);
    state.lastMovedAt = timestamp;
  }

  state.width = width;
  state.height = height;
  state.targetX = clampedX;
  state.targetY = clampedY;
  state.targetRadius = getRevealRadius(width, height);
}

const quantizeChannel = (value: number) =>
  clamp(Math.round(value / 12) * 12, 0, 255);

function createSoftRevealBrush() {
  const size = 512;
  const brush = document.createElement("canvas");
  brush.width = size;
  brush.height = size;
  const context = brush.getContext("2d");

  if (!context) {
    return brush;
  }

  const center = size / 2;
  const outerRadius = size * 0.485;
  const pixels = context.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const deltaX = x + 0.5 - center;
      const deltaY = y + 0.5 - center;
      const angle = Math.atan2(deltaY, deltaX);
      const edge =
        outerRadius *
        (1 +
          Math.sin(angle * 3 + 0.72) * 0.032 +
          Math.sin(angle * 5 - 1.08) * 0.016);
      const normalizedDistance = Math.hypot(deltaX, deltaY) / edge;
      const feather = clamp((normalizedDistance - 0.5) / 0.5, 0, 1);
      const smoothFeather =
        feather *
        feather *
        feather *
        (feather * (feather * 6 - 15) + 10);
      const alpha = Math.round((1 - smoothFeather) * 255);
      const pixelIndex = (y * size + x) * 4;

      pixels.data[pixelIndex] = 255;
      pixels.data[pixelIndex + 1] = 255;
      pixels.data[pixelIndex + 2] = 255;
      pixels.data[pixelIndex + 3] = alpha;
    }
  }

  context.putImageData(pixels, 0, 0);

  return brush;
}

function drawMaskBrush(
  context: CanvasRenderingContext2D,
  brush: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
  scaleX: number,
  scaleY: number,
  rotation: number,
  opacity: number,
) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.scale(scaleX, scaleY);
  context.globalAlpha = opacity;
  context.drawImage(brush, -radius, -radius, radius * 2, radius * 2);
  context.restore();
}

function getQuadraticPoint(
  start: number,
  control: number,
  end: number,
  progress: number,
) {
  const inverse = 1 - progress;
  return (
    inverse * inverse * start +
    2 * inverse * progress * control +
    progress * progress * end
  );
}

function drawWaterWake(
  context: CanvasRenderingContext2D,
  pattern: CanvasPattern,
  headX: number,
  headY: number,
  controlX: number,
  controlY: number,
  tailX: number,
  tailY: number,
  radius: number,
  strength: number,
) {
  const centerWakeLength = Math.hypot(headX - tailX, headY - tailY);

  if (strength < 0.015 || centerWakeLength < radius * 0.08) {
    return;
  }

  const approachX =
    Math.abs(headX - controlX) + Math.abs(headY - controlY) > 0.001
      ? headX - controlX
      : headX - tailX;
  const approachY =
    Math.abs(headX - controlX) + Math.abs(headY - controlY) > 0.001
      ? headY - controlY
      : headY - tailY;
  const approachLength = Math.max(0.001, Math.hypot(approachX, approachY));
  const joinOffset = Math.min(radius * 0.34, centerWakeLength * 0.3);
  const wakeHeadX = headX - (approachX / approachLength) * joinOffset;
  const wakeHeadY = headY - (approachY / approachLength) * joinOffset;
  const rawWakeLength = Math.hypot(wakeHeadX - tailX, wakeHeadY - tailY);
  const maximumWakeLength = radius * 1.72;
  const tailScale = Math.min(1, maximumWakeLength / rawWakeLength);
  const boundedTailX = wakeHeadX + (tailX - wakeHeadX) * tailScale;
  const boundedTailY = wakeHeadY + (tailY - wakeHeadY) * tailScale;
  const controlDistance = Math.hypot(
    wakeHeadX - controlX,
    wakeHeadY - controlY,
  );
  const controlScale =
    controlDistance > 0
      ? Math.min(1, (maximumWakeLength * 0.58) / controlDistance)
      : 1;
  const boundedControlX =
    wakeHeadX + (controlX - wakeHeadX) * controlScale;
  const boundedControlY =
    wakeHeadY + (controlY - wakeHeadY) * controlScale;
  const samples = 16;
  const wakeScale = Math.sqrt(strength);
  const points: WakeRibbonPoint[] = [];

  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const previousProgress = Math.max(0, progress - 1 / samples);
    const nextProgress = Math.min(1, progress + 1 / samples);
    const x = getQuadraticPoint(
      boundedTailX,
      boundedControlX,
      wakeHeadX,
      progress,
    );
    const y = getQuadraticPoint(
      boundedTailY,
      boundedControlY,
      wakeHeadY,
      progress,
    );
    const previousX = getQuadraticPoint(
      boundedTailX,
      boundedControlX,
      wakeHeadX,
      previousProgress,
    );
    const previousY = getQuadraticPoint(
      boundedTailY,
      boundedControlY,
      wakeHeadY,
      previousProgress,
    );
    const nextX = getQuadraticPoint(
      boundedTailX,
      boundedControlX,
      wakeHeadX,
      nextProgress,
    );
    const nextY = getQuadraticPoint(
      boundedTailY,
      boundedControlY,
      wakeHeadY,
      nextProgress,
    );
    const tangentX = nextX - previousX;
    const tangentY = nextY - previousY;
    const tangentLength = Math.max(0.001, Math.hypot(tangentX, tangentY));
    const widthGrowth =
      progress *
      progress *
      progress *
      (progress * (progress * 6 - 15) + 10);

    points.push({
      halfWidth:
        radius *
        widthGrowth *
        0.15 *
        (0.3 + wakeScale * 0.7),
      normalX: -tangentY / tangentLength,
      normalY: tangentX / tangentLength,
      x,
      y,
    });
  }

  const drawRibbonLayer = (widthScale: number, opacity: number) => {
    context.save();
    context.fillStyle = pattern;
    context.globalAlpha = opacity;
    context.beginPath();

    points.forEach((point, index) => {
      const x = point.x + point.normalX * point.halfWidth * widthScale;
      const y = point.y + point.normalY * point.halfWidth * widthScale;

      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });

    for (let index = points.length - 1; index >= 0; index -= 1) {
      const point = points[index];
      context.lineTo(
        point.x - point.normalX * point.halfWidth * widthScale,
        point.y - point.normalY * point.halfWidth * widthScale,
      );
    }

    context.closePath();
    context.fill();
    context.restore();
  };

  drawRibbonLayer(1.48, strength * 0.07);
  drawRibbonLayer(1.2, strength * 0.14);
  drawRibbonLayer(1, strength * 0.38);
}

function liftSampledColor(red: number, green: number, blue: number) {
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  const average = (red + green + blue) / 3;
  const saturation = 1.14;
  const targetLuminance = clamp(luminance * 1.04 + 28, 48, 244);
  const luminanceScale = targetLuminance / Math.max(luminance, 12);
  const shadowLift = clamp((52 - luminance) * 0.46, 0, 24);

  return [
    quantizeChannel(
      (average + (red - average) * saturation) * luminanceScale + shadowLift,
    ),
    quantizeChannel(
      (average + (green - average) * saturation) * luminanceScale + shadowLift,
    ),
    quantizeChannel(
      (average + (blue - average) * saturation) * luminanceScale + shadowLift,
    ),
  ] as const;
}

function createAsciiLayer(
  lines: string[],
  image: HTMLImageElement,
  width: number,
  height: number,
  dpr: number,
  fontFamily: string,
) {
  const layer = document.createElement("canvas");
  layer.width = Math.round(width * dpr);
  layer.height = Math.round(height * dpr);
  const context = layer.getContext("2d", { alpha: false });
  const glyphLayer = document.createElement("canvas");
  glyphLayer.width = layer.width;
  glyphLayer.height = layer.height;
  const glyphContext = glyphLayer.getContext("2d");

  if (!context || !glyphContext) {
    return null;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.fillStyle = "#07131b";
  context.fillRect(0, 0, width, height);
  glyphContext.setTransform(dpr, 0, 0, dpr, 0, 0);

  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = ASCII_COLUMNS;
  sampleCanvas.height = ASCII_ROWS;
  const sampleContext = sampleCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!sampleContext) {
    return { glyphs: glyphLayer, opaque: layer };
  }

  sampleContext.drawImage(image, 0, 0, ASCII_COLUMNS, ASCII_ROWS);
  const pixels = sampleContext.getImageData(
    0,
    0,
    ASCII_COLUMNS,
    ASCII_ROWS,
  ).data;
  const desiredColumns = clamp(Math.round(width / 5.2), 58, 200);
  const samplingStep = clamp(
    Math.round(ASCII_COLUMNS / desiredColumns),
    1,
    7,
  );
  const renderedColumns = Math.ceil(ASCII_COLUMNS / samplingStep);
  const renderedRows = Math.ceil(ASCII_ROWS / samplingStep);
  const cellWidth = width / renderedColumns;
  const cellHeight = height / renderedRows;
  const fontSize = cellHeight * 0.94;
  const colorCache = new Map<string, string>();

  context.font = `500 ${fontSize}px ${fontFamily}, Consolas, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  glyphContext.font = context.font;
  glyphContext.textAlign = "center";
  glyphContext.textBaseline = "middle";
  glyphContext.lineJoin = "round";
  glyphContext.lineWidth = Math.max(0.45, cellHeight * 0.11);
  glyphContext.strokeStyle = "rgba(3, 7, 11, 0.32)";

  for (
    let sourceRow = 0, renderedRow = 0;
    sourceRow < ASCII_ROWS;
    sourceRow += samplingStep, renderedRow += 1
  ) {
    const line = lines[sourceRow] ?? "";
    const sampleRow = Math.min(
      ASCII_ROWS - 1,
      sourceRow + Math.floor(samplingStep / 2),
    );

    for (
      let sourceColumn = 0, renderedColumn = 0;
      sourceColumn < ASCII_COLUMNS;
      sourceColumn += samplingStep, renderedColumn += 1
    ) {
      const symbol = line[sourceColumn];

      if (!symbol) {
        continue;
      }

      const sampleColumn = Math.min(
        ASCII_COLUMNS - 1,
        sourceColumn + Math.floor(samplingStep / 2),
      );
      const pixelIndex = (sampleRow * ASCII_COLUMNS + sampleColumn) * 4;
      const [red, green, blue] = liftSampledColor(
        pixels[pixelIndex],
        pixels[pixelIndex + 1],
        pixels[pixelIndex + 2],
      );
      const colorKey = `${red}-${green}-${blue}`;
      let color = colorCache.get(colorKey);

      if (!color) {
        color = `rgb(${red} ${green} ${blue})`;
        colorCache.set(colorKey, color);
      }

      context.fillStyle = color;
      glyphContext.fillStyle = color;
      const glyphAlpha = symbol === "." || symbol === ":" ? 0.86 : 1;
      context.globalAlpha = glyphAlpha;
      glyphContext.globalAlpha = glyphAlpha;
      const glyphX = (renderedColumn + 0.5) * cellWidth;
      const glyphY = (renderedRow + 0.5) * cellHeight;
      context.fillText(
        symbol,
        glyphX,
        glyphY,
      );
      glyphContext.strokeText(symbol, glyphX, glyphY);
      glyphContext.fillText(symbol, glyphX, glyphY);
    }
  }

  context.globalAlpha = 1;
  glyphContext.globalAlpha = 1;
  return { glyphs: glyphLayer, opaque: layer };
}

export function AsciiAlbumReveal() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const asciiLayerRef = useRef<HTMLCanvasElement | null>(null);
  const asciiGlyphLayerRef = useRef<HTMLCanvasElement | null>(null);
  const asciiGlyphPatternRef = useRef<CanvasPattern | null>(null);
  const softRevealBrushRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const scheduleRef = useRef<(() => void) | null>(null);
  const touchStartRef = useRef<TouchStart | null>(null);
  const touchLockedRef = useRef(false);
  const lensRef = useRef<LensState>({
    angle: -0.18,
    currentAngle: RESTING_ANGLE,
    currentRadius: 0,
    currentX: 0,
    currentY: 0,
    height: 1,
    lastPaintedAt: 0,
    lastMovedAt: 0,
    targetRadius: 0,
    targetX: 0,
    targetY: 0,
    velocityX: 0,
    velocityY: 0,
    wakeTailX: 0,
    wakeTailY: 0,
    wakeX: 0,
    wakeY: 0,
    width: 1,
  });
  const [isReady, setIsReady] = useState(false);
  const [touchLocked, setTouchLocked] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;

    if (!stage || !canvas) {
      return;
    }

    let disposed = false;
    let resizeFrame: number | null = null;
    let asciiLines: string[] | null = null;
    let sourceImage: HTMLImageElement | null = null;
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let reducedMotion = motionPreference.matches;
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const paint = () => {
      frameRef.current = null;

      if (disposed) {
        return;
      }

      const state = lensRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const timestamp = window.performance.now();
      const frameRatio =
        state.lastPaintedAt > 0
          ? clamp(
              (timestamp - state.lastPaintedAt) / FRAME_DURATION,
              0.45,
              2.5,
            )
          : 1;
      state.lastPaintedAt = timestamp;
      const trailAge = timestamp - state.lastMovedAt;
      const rawTrailEnergy = reducedMotion
        ? 0
        : clamp(1 - trailAge / TRAIL_SETTLE_TIME, 0, 1);
      const trailEnergy =
        rawTrailEnergy *
        rawTrailEnergy *
        (3 - 2 * rawTrailEnergy);
      state.currentX = lerp(
        state.currentX,
        state.targetX,
        reducedMotion ? 1 : getFrameLerp(0.52, frameRatio),
      );
      state.currentY = lerp(
        state.currentY,
        state.targetY,
        reducedMotion ? 1 : getFrameLerp(0.52, frameRatio),
      );
      state.currentRadius = lerp(
        state.currentRadius,
        state.targetRadius,
        reducedMotion
          ? 1
          : state.targetRadius > state.currentRadius
            ? getFrameLerp(0.18, frameRatio)
            : getFrameLerp(0.24, frameRatio),
      );

      if (reducedMotion || rawTrailEnergy <= 0.001) {
        state.wakeX = state.currentX;
        state.wakeY = state.currentY;
        state.wakeTailX = state.currentX;
        state.wakeTailY = state.currentY;
      } else if (
        trailAge <= WAKE_CAPTURE_WINDOW &&
        state.targetRadius > 0
      ) {
        state.wakeX = lerp(
          state.wakeX,
          state.currentX,
          getFrameLerp(0.18, frameRatio),
        );
        state.wakeY = lerp(
          state.wakeY,
          state.currentY,
          getFrameLerp(0.18, frameRatio),
        );
        state.wakeTailX = lerp(
          state.wakeTailX,
          state.wakeX,
          getFrameLerp(0.12, frameRatio),
        );
        state.wakeTailY = lerp(
          state.wakeTailY,
          state.wakeY,
          getFrameLerp(0.12, frameRatio),
        );
      }

      const velocityDecay = Math.pow(0.84, frameRatio);
      state.velocityX *= velocityDecay;
      state.velocityY *= velocityDecay;
      const speed = reducedMotion
        ? 0
        : clamp(
            Math.hypot(state.velocityX, state.velocityY) /
              Math.max(state.currentRadius * 0.55, 1),
            0,
            1,
          );
      const motionAmount = speed * speed * (3 - 2 * speed);
      const targetVisualAngle =
        speed > 0.018 ? state.angle : RESTING_ANGLE;
      state.currentAngle = lerpAngle(
        state.currentAngle,
        targetVisualAngle,
        reducedMotion
          ? 1
          : getFrameLerp(speed > 0.018 ? 0.18 : 0.08, frameRatio),
      );

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
      context.clearRect(0, 0, canvas.width, canvas.height);

      if (
        asciiLayerRef.current &&
        softRevealBrushRef.current &&
        state.currentRadius > 0.35
      ) {
        const softBrush = softRevealBrushRef.current;
        const x = state.currentX * dpr;
        const y = state.currentY * dpr;
        const radius = state.currentRadius * dpr;
        const wakeDistance =
          Math.hypot(
            state.currentX - state.wakeTailX,
            state.currentY - state.wakeTailY,
          ) * dpr;
        const wakeStrength =
          trailEnergy *
          clamp(
            Math.max(speed * 0.9, wakeDistance / Math.max(radius * 1.15, 1)),
            0,
            1,
          );

        drawMaskBrush(
          context,
          softBrush,
          x,
          y,
          radius,
          0.92 + motionAmount * 0.18,
          0.92 + motionAmount * 0.03,
          state.currentAngle,
          1,
        );

        context.globalCompositeOperation = "source-in";
        context.globalAlpha = 1;
        context.drawImage(asciiLayerRef.current, 0, 0);
        context.globalCompositeOperation = "source-over";

        if (asciiGlyphPatternRef.current && wakeStrength > 0.015) {
          drawWaterWake(
            context,
            asciiGlyphPatternRef.current,
            x,
            y,
            state.wakeX * dpr,
            state.wakeY * dpr,
            state.wakeTailX * dpr,
            state.wakeTailY * dpr,
            radius,
            wakeStrength,
          );
        }
      }

      const wakeIsSettled =
        Math.hypot(
          state.currentX - state.wakeTailX,
          state.currentY - state.wakeTailY,
        ) < 0.12;
      const angleIsSettled =
        Math.abs(getAngleDistance(state.currentAngle, targetVisualAngle)) <
        0.002;
      const moving =
        Math.abs(state.currentX - state.targetX) > 0.08 ||
        Math.abs(state.currentY - state.targetY) > 0.08 ||
        Math.abs(state.currentRadius - state.targetRadius) > 0.35 ||
        trailEnergy > 0.01 ||
        !wakeIsSettled ||
        !angleIsSettled;

      if (moving) {
        frameRef.current = window.requestAnimationFrame(paint);
      }
    };

    const schedule = () => {
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(paint);
      }
    };

    scheduleRef.current = schedule;
    const handleWindowPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || touchLockedRef.current) {
        return;
      }

      const target = event.target;
      const pointerIsInside =
        target instanceof Node && stage.contains(target);

      if (!pointerIsInside) {
        if (lensRef.current.targetRadius === 0) {
          return;
        }

        lensRef.current.targetRadius = 0;
        schedule();
        return;
      }

      const bounds = stage.getBoundingClientRect();
      const state = lensRef.current;
      setLensTarget(
        state,
        event.clientX - bounds.left,
        event.clientY - bounds.top,
        bounds.width,
        bounds.height,
        window.performance.now(),
      );
      schedule();
    };
    const handleWindowScroll = () => {
      if (touchLockedRef.current || lensRef.current.targetRadius === 0) {
        return;
      }

      lensRef.current.targetRadius = 0;
      schedule();
    };
    window.addEventListener("pointermove", handleWindowPointerMove, {
      passive: true,
    });
    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    const handleMotionPreference = () => {
      reducedMotion = motionPreference.matches;
      schedule();
    };
    motionPreference.addEventListener("change", handleMotionPreference);

    const rebuild = () => {
      if (!asciiLines || !sourceImage || disposed) {
        return;
      }

      const bounds = stage.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const fontFamily =
        window
          .getComputedStyle(document.body)
          .getPropertyValue("--font-mono")
          .trim() || '"IBM Plex Mono"';
      const asciiLayers = createAsciiLayer(
        asciiLines,
        sourceImage,
        width,
        height,
        dpr,
        fontFamily,
      );
      asciiLayerRef.current = asciiLayers?.opaque ?? null;
      asciiGlyphLayerRef.current = asciiLayers?.glyphs ?? null;
      asciiGlyphPatternRef.current = asciiGlyphLayerRef.current
        ? context.createPattern(asciiGlyphLayerRef.current, "no-repeat")
        : null;
      if (!softRevealBrushRef.current) {
        softRevealBrushRef.current = createSoftRevealBrush();
      }
      const state = lensRef.current;
      const previousWidth = state.width;
      const previousHeight = state.height;
      state.width = width;
      state.height = height;
      state.currentX =
        previousWidth > 1 ? (state.currentX / previousWidth) * width : width / 2;
      state.currentY =
        previousHeight > 1
          ? (state.currentY / previousHeight) * height
          : height / 2;
      state.wakeX =
        previousWidth > 1 ? (state.wakeX / previousWidth) * width : width / 2;
      state.wakeY =
        previousHeight > 1
          ? (state.wakeY / previousHeight) * height
          : height / 2;
      state.wakeTailX =
        previousWidth > 1
          ? (state.wakeTailX / previousWidth) * width
          : width / 2;
      state.wakeTailY =
        previousHeight > 1
          ? (state.wakeTailY / previousHeight) * height
          : height / 2;
      state.targetX =
        previousWidth > 1 ? (state.targetX / previousWidth) * width : width / 2;
      state.targetY =
        previousHeight > 1
          ? (state.targetY / previousHeight) * height
          : height / 2;
      if (state.targetRadius > 0) {
        const previousTargetRadius = state.targetRadius;
        const nextTargetRadius = getRevealRadius(width, height);
        state.currentRadius = clamp(
          state.currentRadius * (nextTargetRadius / previousTargetRadius),
          0,
          nextTargetRadius,
        );
        state.targetRadius = nextTargetRadius;
      }
      setIsReady(true);
      schedule();
    };

    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame);
      }

      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        rebuild();
      });
    });

    resizeObserver.observe(stage);
    const abortController = new AbortController();
    const visibleImage = stage.querySelector("img");
    let intersectionObserver: IntersectionObserver | null = null;
    let removeImageListeners: (() => void) | null = null;
    let assetsStarted = false;

    const waitForVisibleImage = () =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        if (!visibleImage) {
          reject(new Error("Unable to find album artwork."));
          return;
        }

        if (visibleImage.complete && visibleImage.naturalWidth > 0) {
          resolve(visibleImage);
          return;
        }

        const handleLoad = () => {
          removeImageListeners?.();
          resolve(visibleImage);
        };
        const handleError = () => {
          removeImageListeners?.();
          reject(new Error("Unable to load album artwork."));
        };
        removeImageListeners = () => {
          visibleImage.removeEventListener("load", handleLoad);
          visibleImage.removeEventListener("error", handleError);
          removeImageListeners = null;
        };
        visibleImage.addEventListener("load", handleLoad, { once: true });
        visibleImage.addEventListener("error", handleError, { once: true });
      });

    const startArtwork = () => {
      if (assetsStarted || disposed) {
        return;
      }

      assetsStarted = true;
      Promise.all([
        fetch(ASCII_SRC, { signal: abortController.signal }).then((response) => {
          if (!response.ok) {
            throw new Error("Unable to load ASCII artwork.");
          }

          return response.text();
        }),
        waitForVisibleImage(),
        document.fonts.ready,
      ])
        .then(([asciiText, loadedImage]) => {
          if (disposed) {
            return;
          }

          const lines = asciiText.replace(/\r/g, "").split("\n");

          if (lines[lines.length - 1] === "") {
            lines.pop();
          }

          asciiLines = lines;
          sourceImage = loadedImage;
          rebuild();
        })
        .catch((error: unknown) => {
          if (
            !disposed &&
            !(error instanceof DOMException && error.name === "AbortError")
          ) {
            console.error(error);
          }
        });
    };

    if ("IntersectionObserver" in window) {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            intersectionObserver?.disconnect();
            intersectionObserver = null;
            startArtwork();
          }
        },
        { rootMargin: "1000px 0px" },
      );
      intersectionObserver.observe(stage);
    } else {
      startArtwork();
    }

    return () => {
      disposed = true;
      abortController.abort();
      resizeObserver.disconnect();
      intersectionObserver?.disconnect();
      removeImageListeners?.();
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("scroll", handleWindowScroll);
      motionPreference.removeEventListener("change", handleMotionPreference);
      scheduleRef.current = null;
      asciiLayerRef.current = null;
      asciiGlyphLayerRef.current = null;
      asciiGlyphPatternRef.current = null;
      softRevealBrushRef.current = null;

      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame);
      }

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);

  const updateLensPosition = (clientX: number, clientY: number) => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    const bounds = stage.getBoundingClientRect();
    const state = lensRef.current;
    setLensTarget(
      state,
      clientX - bounds.left,
      clientY - bounds.top,
      bounds.width,
      bounds.height,
      window.performance.now(),
    );
    scheduleRef.current?.();
  };

  const hideLens = () => {
    lensRef.current.targetRadius = 0;
    scheduleRef.current?.();
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" && !touchLockedRef.current) {
      hideLens();
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      event.pointerType !== "touch" ||
      (event.target instanceof Element && event.target.closest("button"))
    ) {
      return;
    }

    touchStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const touchStart = touchStartRef.current;

    if (
      event.pointerType !== "touch" ||
      !touchStart ||
      touchStart.pointerId !== event.pointerId
    ) {
      return;
    }

    touchStartRef.current = null;
    const travel = Math.hypot(
      event.clientX - touchStart.x,
      event.clientY - touchStart.y,
    );

    if (travel >= 12) {
      return;
    }

    if (touchLockedRef.current) {
      touchLockedRef.current = false;
      setTouchLocked(false);
      hideLens();
      return;
    }

    updateLensPosition(event.clientX, event.clientY);
    touchLockedRef.current = true;
    setTouchLocked(true);
  };

  const handlePointerCancel = () => {
    touchStartRef.current = null;
  };

  const toggleLockedScan = () => {
    if (touchLockedRef.current) {
      touchLockedRef.current = false;
      setTouchLocked(false);
      hideLens();
      return;
    }

    const state = lensRef.current;
    setLensTarget(
      state,
      state.width / 2,
      state.height / 2,
      state.width,
      state.height,
      window.performance.now(),
    );
    touchLockedRef.current = true;
    setTouchLocked(true);
    scheduleRef.current?.();
  };

  const handleStageKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleLockedScan();
      return;
    }

    if (event.key === "Escape") {
      if (touchLockedRef.current || lensRef.current.targetRadius > 0) {
        event.preventDefault();
        touchLockedRef.current = false;
        setTouchLocked(false);
        hideLens();
      }
      return;
    }

    const key = event.key.toLowerCase();
    const direction =
      key === "arrowleft" || key === "a"
        ? [-1, 0]
        : key === "arrowright" || key === "d"
          ? [1, 0]
          : key === "arrowup" || key === "w"
            ? [0, -1]
            : key === "arrowdown" || key === "s"
              ? [0, 1]
              : null;

    if (!direction) {
      return;
    }

    event.preventDefault();
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    const bounds = stage.getBoundingClientRect();
    const state = lensRef.current;
    const step = clamp(Math.min(bounds.width, bounds.height) * 0.055, 18, 44);
    const baseX = state.targetRadius > 0 ? state.targetX : bounds.width / 2;
    const baseY = state.targetRadius > 0 ? state.targetY : bounds.height / 2;
    setLensTarget(
      state,
      baseX + direction[0] * step,
      baseY + direction[1] * step,
      bounds.width,
      bounds.height,
      window.performance.now(),
    );
    touchLockedRef.current = true;
    setTouchLocked(true);
    scheduleRef.current?.();
  };

  return (
    <figure
      className={styles.albumFigure}
      data-ready={isReady ? "true" : "false"}
    >
      <div
        ref={stageRef}
        className={styles.albumStage}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleStageKeyDown}
        role="group"
        tabIndex={0}
        aria-label="Interactive album artwork with a source-mapped ASCII trace"
        aria-describedby="asen-scan-instructions"
      >
        <Image
          src={COVER_SRC}
          alt="Asen album cover showing the artist seated above a curved city building under a deep blue sky."
          fill
          sizes="(max-width: 760px) calc(100vw - 36px), (max-width: 1200px) 82vw, 1080px"
          className={styles.albumImage}
          draggable={false}
        />
        <canvas
          ref={canvasRef}
          className={styles.albumAsciiCanvas}
          aria-hidden="true"
        />
        <div className={styles.albumScanStatus} aria-hidden="true">
          <span />
          Photo / ASCII
        </div>
        <button
          type="button"
          className={styles.albumScanToggle}
          aria-label={
            touchLocked ? "Release ASCII trace" : "Hold ASCII trace"
          }
          aria-pressed={touchLocked}
          onClick={(event) => {
            event.stopPropagation();
            toggleLockedScan();
          }}
        >
          <Waves aria-hidden="true" />
          {touchLocked ? "Release trace" : "Hold trace"}
        </button>
      </div>
      <figcaption
        id="asen-scan-instructions"
        className={styles.albumCaption}
      >
        <span>Move to translate / arrows to trace / Enter or tap to hold</span>
        <span>Original image ↔ source-mapped ASCII</span>
      </figcaption>
    </figure>
  );
}
