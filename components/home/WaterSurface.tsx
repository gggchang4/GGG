"use client";

import { useEffect, useRef, type RefObject } from "react";
import styles from "@/components/home/home.module.css";

type WaterSurfaceProps = {
  lensRef: RefObject<HTMLDivElement | null>;
  interactionLockedRef: RefObject<boolean>;
  reducedMotion: boolean;
};

type Ripple = {
  x: number;
  y: number;
  bornAt: number;
  strength: number;
  phase: number;
  verticalScale: number;
};

const RIPPLE_DURATION = 2800;
const MAX_RIPPLES = 10;
const AMBIENT_INTERVAL = 680;
const POINTER_IDLE_TIMEOUT = 2600;
const FRAME_INTERVAL = 1000 / 45;
const MAX_CANVAS_PIXELS = 4_200_000;
const LENS_EXCLUSION_SCALE = 0.47;
const LENS_EXCLUSION_PADDING = 4;

function createRingPath(
  ripple: Ripple,
  radius: number,
  age: number,
  bandOffset: number,
) {
  const path = new Path2D();
  const pointCount = Math.max(64, Math.min(112, Math.round(radius * 0.58)));
  const phaseDrift = age * 0.0011;

  for (let index = 0; index <= pointCount; index += 1) {
    const angle = (index / pointCount) * Math.PI * 2;
    const irregularity =
      Math.sin(angle * 3 + ripple.phase + phaseDrift) * 1.15 +
      Math.sin(angle * 7 - ripple.phase * 0.7 - phaseDrift * 0.4) * 0.45;
    const ringRadius = radius + bandOffset + irregularity;
    const x = ripple.x + Math.cos(angle) * ringRadius;
    const y = ripple.y + Math.sin(angle) * ringRadius * ripple.verticalScale;

    if (index === 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  }

  path.closePath();
  return path;
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

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frameId = 0;
    let resizeFrameId = 0;
    let lastFrameAt = 0;
    let ripples: Ripple[] = [];
    let pendingStrength = 0;
    let lastPointerMoveAt = 0;
    let lastSpawnAt = 0;
    let lastSpawnX = 0;
    let lastSpawnY = 0;
    const pointer = {
      active: false,
      x: 0,
      y: 0,
    };

    const clearSurface = () => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const pixelBudgetRatio = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));
      pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        1.5,
        Math.max(0.5, pixelBudgetRatio),
      );
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      clearSurface();
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

    const getLensCircle = () => {
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

    const isOutsideLens = (clientX: number, clientY: number) => {
      const lensCircle = getLensCircle();

      if (!lensCircle) {
        return true;
      }

      const distance = Math.hypot(
        clientX - lensCircle.centerX,
        clientY - lensCircle.centerY,
      );

      return distance > lensCircle.radius;
    };

    const spawnRipple = (now: number, strength: number) => {
      ripples.push({
        x: pointer.x,
        y: pointer.y,
        bornAt: now,
        strength,
        phase: ((pointer.x * 0.013 + pointer.y * 0.019 + now * 0.0007) % 1) * Math.PI * 2,
        verticalScale: 0.86 + ((pointer.x + pointer.y) % 17) / 250,
      });

      if (ripples.length > MAX_RIPPLES) {
        ripples = ripples.slice(-MAX_RIPPLES);
      }

      lastSpawnAt = now;
      lastSpawnX = pointer.x;
      lastSpawnY = pointer.y;
    };

    const cutOutLens = () => {
      const lensCircle = getLensCircle();

      if (!lensCircle) {
        return;
      }

      const canvasBounds = canvas.getBoundingClientRect();
      const centerX = lensCircle.centerX - canvasBounds.left;
      const centerY = lensCircle.centerY - canvasBounds.top;

      context.save();
      context.globalCompositeOperation = "destination-out";
      context.fillStyle = "#000";
      context.beginPath();
      context.arc(centerX, centerY, lensCircle.radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
    };

    const drawPointerDimple = (now: number) => {
      const radius = 44 + Math.sin(now * 0.0024) * 2;
      const gradient = context.createRadialGradient(
        pointer.x - 2,
        pointer.y - 2,
        0,
        pointer.x,
        pointer.y,
        radius,
      );

      gradient.addColorStop(0, "rgba(255, 255, 255, 0.045)");
      gradient.addColorStop(0.38, "rgba(255, 255, 255, 0.018)");
      gradient.addColorStop(0.62, "rgba(81, 123, 126, 0.025)");
      gradient.addColorStop(1, "rgba(81, 123, 126, 0)");
      context.fillStyle = gradient;
      context.fillRect(
        pointer.x - radius,
        pointer.y - radius,
        radius * 2,
        radius * 2,
      );
    };

    const drawRipple = (ripple: Ripple, now: number) => {
      const age = now - ripple.bornAt;
      const progress = Math.min(1, age / RIPPLE_DURATION);
      const appear = Math.min(1, age / 180);
      const envelope = appear * Math.pow(1 - progress, 1.45) * ripple.strength;
      const radius = 12 + age * 0.105;
      const bands = [
        { offset: 0, weight: 1 },
        { offset: -11, weight: 0.36 },
        { offset: 9, weight: 0.2 },
      ];

      bands.forEach(({ offset, weight }) => {
        if (radius + offset < 3) {
          return;
        }

        const alpha = envelope * weight;
        const path = createRingPath(ripple, radius, age, offset);

        context.save();
        context.translate(0.7, 1.1);
        context.filter = "blur(0.5px)";
        context.strokeStyle = `rgba(62, 94, 99, ${alpha * 0.16})`;
        context.lineWidth = 1.45;
        context.stroke(path);
        context.restore();

        context.save();
        context.translate(-0.55, -0.8);
        context.filter = "blur(0.2px)";
        context.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.56})`;
        context.lineWidth = 0.85;
        context.stroke(path);
        context.restore();
      });
    };

    const draw = (now: number) => {
      frameId = 0;
      const elapsed = now - lastFrameAt;

      if (elapsed < FRAME_INTERVAL) {
        frameId = window.requestAnimationFrame(draw);
        return;
      }

      lastFrameAt = now - (elapsed % FRAME_INTERVAL);
      clearSurface();

      if (pointer.active) {
        const canvasBounds = canvas.getBoundingClientRect();
        const clientX = pointer.x + canvasBounds.left;
        const clientY = pointer.y + canvasBounds.top;

        if (
          interactionLockedRef.current ||
          now - lastPointerMoveAt >= POINTER_IDLE_TIMEOUT ||
          !isOutsideLens(clientX, clientY)
        ) {
          pointer.active = false;
          pendingStrength = 0;
        }
      }

      if (pendingStrength > 0) {
        spawnRipple(now, pendingStrength);
        pendingStrength = 0;
      } else if (pointer.active && now - lastSpawnAt >= AMBIENT_INTERVAL) {
        spawnRipple(now, 0.68);
      }

      ripples = ripples.filter((ripple) => now - ripple.bornAt < RIPPLE_DURATION);

      if (pointer.active) {
        drawPointerDimple(now);
      }

      ripples.forEach((ripple) => drawRipple(ripple, now));
      cutOutLens();

      if (pointer.active || ripples.length > 0) {
        frameId = window.requestAnimationFrame(draw);
      }
    };

    const ensureFrame = () => {
      if (!frameId) {
        frameId = window.requestAnimationFrame(draw);
      }
    };

    const deactivatePointer = () => {
      pointer.active = false;
      pendingStrength = 0;

      if (ripples.length > 0) {
        ensureFrame();
      }
    };

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (
        !event.isPrimary ||
        event.pointerType === "touch" ||
        event.buttons !== 0 ||
        interactionLockedRef.current ||
        !isOutsideLens(event.clientX, event.clientY)
      ) {
        deactivatePointer();
        return;
      }

      const canvasBounds = canvas.getBoundingClientRect();
      const nextX = event.clientX - canvasBounds.left;
      const nextY = event.clientY - canvasBounds.top;

      if (nextX < 0 || nextX > width || nextY < 0 || nextY > height) {
        deactivatePointer();
        return;
      }

      const wasActive = pointer.active;
      pointer.active = true;
      pointer.x = nextX;
      pointer.y = nextY;

      const now = performance.now();
      lastPointerMoveAt = now;
      const distanceFromLastSpawn = Math.hypot(
        pointer.x - lastSpawnX,
        pointer.y - lastSpawnY,
      );

      if (!wasActive) {
        pendingStrength = 0.92;
      } else if (distanceFromLastSpawn > 24 && now - lastSpawnAt > 105) {
        pendingStrength = Math.max(pendingStrength, 0.52);
      }

      ensureFrame();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pointer.active = false;
        pendingStrength = 0;
        ripples = [];

        if (frameId) {
          window.cancelAnimationFrame(frameId);
          frameId = 0;
        }

        clearSurface();
      }
    };

    resize();
    const resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(canvas);
    window.addEventListener("resize", scheduleResize);
    window.visualViewport?.addEventListener("resize", scheduleResize);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("blur", deactivatePointer);
    document.documentElement.addEventListener("mouseleave", deactivatePointer);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleResize);
      window.visualViewport?.removeEventListener("resize", scheduleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", deactivatePointer);
      document.documentElement.removeEventListener("mouseleave", deactivatePointer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      if (resizeFrameId) {
        window.cancelAnimationFrame(resizeFrameId);
      }

      clearSurface();
    };
  }, [interactionLockedRef, lensRef, reducedMotion]);

  return <canvas ref={canvasRef} className={styles.waterSurface} aria-hidden="true" />;
}
