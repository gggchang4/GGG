"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";

export type AsciiScene = "self" | "field" | "orbit" | "noise";

export type AsciiPalette = {
  id: string;
  name: string;
  colors: readonly string[];
};

export const asciiPalettes: readonly AsciiPalette[] = [
  {
    id: "spectral",
    name: "Spectral",
    colors: [
      "#ff4f9a",
      "#ff7a45",
      "#ffd447",
      "#c7ff4a",
      "#4fffd2",
      "#54b8ff",
      "#a87cff",
    ],
  },
  {
    id: "ultraviolet",
    name: "Ultraviolet",
    colors: [
      "#ff63d8",
      "#d85cff",
      "#916cff",
      "#537cff",
      "#4fc9ff",
      "#60ffe4",
      "#f4ff8a",
    ],
  },
  {
    id: "solar",
    name: "Solar flare",
    colors: [
      "#ff3d2e",
      "#ff6a28",
      "#ff9f1c",
      "#ffd23f",
      "#efff68",
      "#76ffd1",
      "#f8f0df",
    ],
  },
] as const;

export type AsciiFieldHandle = {
  exportFrame: () => void;
  injectPulse: (x?: number, y?: number) => void;
};

type AsciiFieldProps = {
  density: number;
  palette: AsciiPalette;
  paused: boolean;
  reducedMotion: boolean;
  scene: AsciiScene;
};

type PointerState = {
  active: boolean;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
};

type Pulse = {
  born: number;
  x: number;
  y: number;
};

type FieldSample = {
  energy: number;
  hue: number;
  symbol: number;
};

const RAMP = " .,:;irsXA253hMHGS#9B&@";
const SCENE_ORDER: readonly AsciiScene[] = [
  "self",
  "field",
  "orbit",
  "noise",
];
const TAU = Math.PI * 2;

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

const lerp = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const fract = (value: number) => value - Math.floor(value);

const hash = (x: number, y: number) =>
  fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);

function sampleScene(
  scene: AsciiScene,
  x: number,
  y: number,
  time: number,
): FieldSample {
  const radius = Math.hypot(x, y);
  const angle = Math.atan2(y, x);

  if (scene === "self") {
    const headDistance = Math.hypot(x / 0.5, (y + 0.17) / 0.67);
    const head = 1 - smoothstep(0.78, 1.04, headDistance);
    const headContour = Math.exp(-Math.abs(headDistance - 0.9) * 20);
    const shouldersDistance = Math.hypot(x / 1.03, (y - 0.8) / 0.56);
    const shoulders =
      (1 - smoothstep(0.72, 1.06, shouldersDistance)) *
      smoothstep(0.22, 0.62, y);
    const leftEye = Math.exp(
      -(
        Math.pow((x + 0.19) / 0.095, 2) +
        Math.pow((y + 0.23) / 0.045, 2)
      ) *
        1.8,
    );
    const rightEye = Math.exp(
      -(
        Math.pow((x - 0.19) / 0.095, 2) +
        Math.pow((y + 0.23) / 0.045, 2)
      ) *
        1.8,
    );
    const nose = Math.exp(
      -(Math.pow(x / 0.045, 2) + Math.pow((y + 0.02) / 0.25, 2)) * 1.4,
    );
    const mouth = Math.exp(
      -(
        Math.pow(x / 0.22, 2) +
        Math.pow((y - 0.22 - 0.04 * Math.cos(x * 12)) / 0.035, 2)
      ) *
        1.6,
    );
    const facialSignal =
      0.5 +
      0.5 *
        Math.sin(
          x * 13 +
            Math.sin(y * 8 - time * 0.65) * 2.1 -
            time * 0.45,
        );
    const halo =
      Math.exp(-Math.abs(Math.hypot(x / 0.79, (y + 0.08) / 0.92) - 1) * 17) *
      (0.5 + 0.5 * Math.sin(angle * 9 - time));
    const crown =
      Math.exp(-Math.abs(radius - 1.08) * 15) *
      smoothstep(-0.58, 0.2, -y) *
      (0.45 + 0.55 * Math.sin(angle * 18 + time * 0.8));
    const silhouette = Math.max(head, shoulders * 0.82);
    const energy =
      silhouette * (0.26 + facialSignal * 0.68) +
      headContour * 0.5 +
      halo * 0.72 +
      crown * 0.33 +
      (leftEye + rightEye) * 0.82 +
      nose * 0.28 +
      mouth * 0.68;

    return {
      energy,
      hue: fract(
        0.62 +
          angle / TAU +
          facialSignal * 0.32 +
          headDistance * 0.18 +
          time * 0.025,
      ),
      symbol: facialSignal + headContour * 0.45 + mouth * 0.6,
    };
  }

  if (scene === "field") {
    const waveA = Math.sin(x * 4.5 + Math.sin(y * 3.2 - time * 0.8) * 2.3);
    const waveB = Math.cos(y * 6.2 - Math.sin(x * 2.7 + time * 0.6) * 2.4);
    const interference = Math.abs(waveA + waveB) * 0.5;
    const contour = Math.pow(
      1 - Math.abs(fract((interference + radius * 0.13) * 4.5) - 0.5) * 2,
      4,
    );
    const diagonal =
      0.5 + 0.5 * Math.sin((x + y) * 5.4 - time * 0.75);
    const aperture = 1 - smoothstep(0.25, 1.65, radius);

    return {
      energy:
        0.08 +
        interference * 0.45 +
        contour * 0.72 +
        diagonal * aperture * 0.33,
      hue: fract(0.15 + interference * 0.74 + angle / TAU + time * 0.018),
      symbol: contour + diagonal * 0.4,
    };
  }

  if (scene === "orbit") {
    const rings =
      Math.exp(-Math.abs(radius - 0.38) * 22) +
      Math.exp(-Math.abs(radius - 0.72) * 17) * 0.82 +
      Math.exp(-Math.abs(radius - 1.08) * 14) * 0.64 +
      Math.exp(-Math.abs(radius - 1.44) * 12) * 0.42;
    const spokes =
      Math.pow(0.5 + 0.5 * Math.sin(angle * 12 + radius * 7 - time), 7) *
      (1 - smoothstep(0.12, 1.6, radius));
    const satelliteA = Math.exp(
      -Math.pow(
        Math.hypot(
          x - Math.cos(time * 0.42) * 0.72,
          y - Math.sin(time * 0.42) * 0.72,
        ),
        2,
      ) * 60,
    );
    const satelliteB = Math.exp(
      -Math.pow(
        Math.hypot(
          x - Math.cos(-time * 0.3 + 2.2) * 1.08,
          y - Math.sin(-time * 0.3 + 2.2) * 1.08,
        ),
        2,
      ) * 48,
    );

    return {
      energy:
        rings * (0.46 + 0.54 * Math.sin(angle * 7 - time * 0.65) ** 2) +
        spokes * 0.75 +
        satelliteA +
        satelliteB,
      hue: fract(0.52 + angle / TAU + radius * 0.16 + time * 0.025),
      symbol: rings + spokes + satelliteA * 1.4 + satelliteB * 1.2,
    };
  }

  const columns = Math.pow(
    0.5 + 0.5 * Math.sin(x * 16 + Math.sin(y * 2 - time) * 3),
    8,
  );
  const scan = Math.pow(
    0.5 + 0.5 * Math.sin(y * 28 - time * 2.2 + Math.sin(x * 5)),
    12,
  );
  const blocks =
    hash(Math.floor((x + 2) * 7), Math.floor((y + 2) * 10 + time * 0.9)) >
    0.72
      ? 0.9
      : 0;
  const horizon = Math.exp(-Math.abs(y - Math.sin(x * 2 + time * 0.7) * 0.2) * 7);

  return {
    energy: columns * 0.56 + scan * 0.76 + blocks + horizon * 0.5,
    hue: fract(0.82 + y * 0.24 + hash(x * 4, y * 4) * 0.45 + time * 0.04),
    symbol: columns + scan * 1.2 + blocks,
  };
}

export const AsciiField = forwardRef<AsciiFieldHandle, AsciiFieldProps>(
  function AsciiField(
    { density, palette, paused, reducedMotion, scene },
    forwardedRef,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameRef = useRef<number | null>(null);
    const sizeRef = useRef({ dpr: 1, height: 1, width: 1 });
    const pointerRef = useRef<PointerState>({
      active: false,
      currentX: 0.5,
      currentY: 0.46,
      targetX: 0.5,
      targetY: 0.46,
    });
    const pulsesRef = useRef<Pulse[]>([]);
    const targetSceneRef = useRef<AsciiScene>(scene);
    const previousSceneRef = useRef<AsciiScene>(scene);
    const transitionRef = useRef(1);
    const startTimeRef = useRef<number | null>(null);
    const frozenTimeRef = useRef(0);
    const lastFrameRef = useRef(0);
    const [redrawToken, setRedrawToken] = useState(0);
    const staticModeRef = useRef(paused || reducedMotion);

    useEffect(() => {
      staticModeRef.current = paused || reducedMotion;
    }, [paused, reducedMotion]);

    useEffect(() => {
      if (targetSceneRef.current === scene) {
        return;
      }

      previousSceneRef.current = targetSceneRef.current;
      targetSceneRef.current = scene;
      transitionRef.current = 0;
    }, [scene]);

    useEffect(() => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      let touchStart: {
        pointerId: number;
        x: number;
        y: number;
      } | null = null;

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const width = window.innerWidth;
        const height = window.innerHeight;
        sizeRef.current = { dpr, height, width };
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      };

      const updatePointer = (event: PointerEvent) => {
        if (event.pointerType === "touch") {
          return;
        }

        pointerRef.current.targetX = clamp(event.clientX / window.innerWidth);
        pointerRef.current.targetY = clamp(event.clientY / window.innerHeight);
        pointerRef.current.active = true;
      };

      const pushPulse = (clientX: number, clientY: number) => {
        pulsesRef.current.push({
          born: performance.now(),
          x: clamp(clientX / window.innerWidth),
          y: clamp(clientY / window.innerHeight),
        });
        pulsesRef.current = pulsesRef.current.slice(-6);

        if (staticModeRef.current) {
          setRedrawToken((current) => current + 1);
        }
      };

      const beginPointerPulse = (event: PointerEvent) => {
        const target = event.target;

        if (
          !event.isPrimary ||
          target instanceof Element &&
          target.closest("a, button, input, select, textarea")
        ) {
          return;
        }

        if (event.pointerType === "touch") {
          touchStart = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
          };
          pointerRef.current.active = false;
          return;
        }

        pushPulse(event.clientX, event.clientY);
      };

      const finishTouch = (event: PointerEvent) => {
        if (
          event.pointerType !== "touch" ||
          !touchStart ||
          touchStart.pointerId !== event.pointerId
        ) {
          return;
        }

        const travel = Math.hypot(
          event.clientX - touchStart.x,
          event.clientY - touchStart.y,
        );

        if (travel < 12) {
          pushPulse(event.clientX, event.clientY);
        }

        touchStart = null;
        pointerRef.current.active = false;
      };

      const cancelTouch = (event: PointerEvent) => {
        if (touchStart?.pointerId === event.pointerId) {
          touchStart = null;
        }

        if (event.pointerType === "touch") {
          pointerRef.current.active = false;
        }
      };

      const deactivatePointer = () => {
        pointerRef.current.active = false;
      };

      resize();
      window.addEventListener("resize", resize);
      window.addEventListener("pointermove", updatePointer, { passive: true });
      window.addEventListener("pointerdown", beginPointerPulse, {
        passive: true,
      });
      window.addEventListener("pointerup", finishTouch, { passive: true });
      window.addEventListener("pointercancel", cancelTouch, { passive: true });
      document.documentElement.addEventListener(
        "pointerleave",
        deactivatePointer,
      );

      return () => {
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", updatePointer);
        window.removeEventListener("pointerdown", beginPointerPulse);
        window.removeEventListener("pointerup", finishTouch);
        window.removeEventListener("pointercancel", cancelTouch);
        document.documentElement.removeEventListener(
          "pointerleave",
          deactivatePointer,
        );
      };
    }, []);

    useImperativeHandle(
      forwardedRef,
      () => ({
        exportFrame: () => {
          const canvas = canvasRef.current;

          if (!canvas) {
            return;
          }

          canvas.toBlob((blob) => {
            if (!blob) {
              return;
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `ggg-ascii-${targetSceneRef.current}-${Date.now()}.png`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
          }, "image/png");
        },
        injectPulse: (x = 0.5, y = 0.5) => {
          pulsesRef.current.push({
            born: performance.now(),
            x: clamp(x),
            y: clamp(y),
          });
          pulsesRef.current = pulsesRef.current.slice(-6);

          if (paused || reducedMotion) {
            setRedrawToken((current) => current + 1);
          }
        },
      }),
      [paused, reducedMotion],
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d", { alpha: false });

      if (!canvas || !context) {
        return;
      }

      let disposed = false;
      const monoFamily =
        window
          .getComputedStyle(document.body)
          .getPropertyValue("--font-mono")
          .trim() || '"IBM Plex Mono"';

      if (
        !paused &&
        !reducedMotion &&
        startTimeRef.current !== null
      ) {
        startTimeRef.current =
          performance.now() - frozenTimeRef.current * 1000;
      }

      const render = (now: number) => {
        if (disposed) {
          return;
        }

        if (document.hidden) {
          frameRef.current = null;
          return;
        }

        if (startTimeRef.current === null) {
          startTimeRef.current = now;
        }

        const shouldAnimate = !paused && !reducedMotion;
        const elapsed = (now - startTimeRef.current) / 1000;
        const renderTime = shouldAnimate ? elapsed : frozenTimeRef.current;
        const frameInterval = 1000 / 36;

        if (!shouldAnimate || now - lastFrameRef.current >= frameInterval) {
          lastFrameRef.current = now;

          if (shouldAnimate) {
            frozenTimeRef.current = elapsed;
          }

          const { dpr, height, width } = sizeRef.current;
          const pointer = pointerRef.current;
          const pointerEase = shouldAnimate ? 0.075 : 1;
          pointer.currentX = lerp(
            pointer.currentX,
            pointer.targetX,
            pointerEase,
          );
          pointer.currentY = lerp(
            pointer.currentY,
            pointer.targetY,
            pointerEase,
          );

          if (transitionRef.current < 1) {
            transitionRef.current = Math.min(
              1,
              transitionRef.current + (shouldAnimate ? 0.045 : 1),
            );
          }

          const transition =
            transitionRef.current * transitionRef.current *
            (3 - 2 * transitionRef.current);
          const aspect = width / height;
          const baseCell = [18, 14, 10][density] ?? 14;
          const cell = width < 680 ? Math.max(10, baseCell - 1) : baseCell;
          const fontSize = cell * 0.78;
          const columns = Math.ceil(width / cell) + 1;
          const rows = Math.ceil(height / cell) + 1;
          const pointerX = (pointer.currentX - 0.5) * 2 * aspect;
          const pointerY = (pointer.currentY - 0.5) * 2;
          const livePulses = pulsesRef.current.filter(
            (pulse) => now - pulse.born < 2_100,
          );
          pulsesRef.current = livePulses;

          context.setTransform(dpr, 0, 0, dpr, 0, 0);
          context.globalAlpha = 1;
          context.fillStyle = "#050608";
          context.fillRect(0, 0, width, height);

          const glow = context.createRadialGradient(
            pointer.currentX * width,
            pointer.currentY * height,
            0,
            pointer.currentX * width,
            pointer.currentY * height,
            Math.max(width, height) * 0.52,
          );
          glow.addColorStop(0, `${palette.colors[4]}16`);
          glow.addColorStop(0.42, `${palette.colors[0]}0b`);
          glow.addColorStop(1, "#05060800");
          context.fillStyle = glow;
          context.fillRect(0, 0, width, height);

          context.font = `500 ${fontSize}px ${monoFamily}, Consolas, monospace`;
          context.textAlign = "center";
          context.textBaseline = "middle";

          let previousColor = "";
          let previousAlpha = -1;

          for (let row = 0; row < rows; row += 1) {
            const pixelY = row * cell + cell * 0.5;
            const sourceY = (pixelY / height - 0.5) * 2;

            for (let column = 0; column < columns; column += 1) {
              const pixelX = column * cell + cell * 0.5;
              const sourceX = (pixelX / width - 0.5) * 2 * aspect;
              const dx = sourceX - pointerX;
              const dy = sourceY - pointerY;
              const pointerDistance = Math.hypot(dx, dy);
              const pointerForce = pointer.active
                ? Math.exp(-pointerDistance * pointerDistance * 3.2)
                : 0;
              const swirl = pointerForce * 0.18;
              let x = sourceX + dy * swirl * Math.sin(renderTime * 0.8 + 1);
              let y = sourceY - dx * swirl * Math.cos(renderTime * 0.7);
              let pulseEnergy = 0;
              let pulseHue = 0;

              livePulses.forEach((pulse) => {
                const age = (now - pulse.born) / 1000;
                const pulseX = (pulse.x - 0.5) * 2 * aspect;
                const pulseY = (pulse.y - 0.5) * 2;
                const distance = Math.hypot(sourceX - pulseX, sourceY - pulseY);
                const waveRadius = age * 0.78;
                const ripple =
                  Math.exp(-Math.pow(distance - waveRadius, 2) * 95) *
                  (1 - age / 2.1);
                const direction = Math.atan2(
                  sourceY - pulseY,
                  sourceX - pulseX,
                );
                pulseEnergy += ripple;
                pulseHue += ripple * 0.22;
                x += Math.cos(direction) * ripple * 0.07;
                y += Math.sin(direction) * ripple * 0.07;
              });

              const target = sampleScene(
                targetSceneRef.current,
                x,
                y,
                renderTime,
              );
              const previous =
                transition < 1
                  ? sampleScene(
                      previousSceneRef.current,
                      x,
                      y,
                      renderTime,
                    )
                  : target;
              const grain = hash(column + Math.floor(renderTime * 0.4), row);
              const energy =
                lerp(previous.energy, target.energy, transition) +
                pointerForce * 0.5 +
                pulseEnergy * 0.92 +
                grain * 0.045;

              if (energy < 0.115) {
                continue;
              }

              const hue = fract(
                lerp(previous.hue, target.hue, transition) +
                  pointerForce * 0.16 +
                  pulseHue,
              );
              const symbol = clamp(
                lerp(previous.symbol, target.symbol, transition) * 0.68 +
                  energy * 0.48 +
                  grain * 0.12,
              );
              const rampIndex = Math.min(
                RAMP.length - 1,
                Math.floor(symbol * RAMP.length),
              );
              const paletteIndex = Math.min(
                palette.colors.length - 1,
                Math.floor(hue * palette.colors.length),
              );
              const color = palette.colors[paletteIndex];
              const alpha = Math.round(
                clamp(0.2 + energy * 0.72, 0.22, 1) * 10,
              ) / 10;

              if (color !== previousColor) {
                context.fillStyle = color;
                previousColor = color;
              }

              if (alpha !== previousAlpha) {
                context.globalAlpha = alpha;
                previousAlpha = alpha;
              }

              context.fillText(RAMP[rampIndex], pixelX, pixelY);
            }
          }

          context.globalAlpha = 1;
        }

        if (shouldAnimate) {
          frameRef.current = window.requestAnimationFrame(render);
        } else {
          frameRef.current = null;
        }
      };

      const handleVisibilityChange = () => {
        if (document.hidden) {
          if (frameRef.current !== null) {
            window.cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
          }

          return;
        }

        if (
          !disposed &&
          !paused &&
          !reducedMotion &&
          frameRef.current === null
        ) {
          startTimeRef.current =
            performance.now() - frozenTimeRef.current * 1000;
          frameRef.current = window.requestAnimationFrame(render);
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      frameRef.current = window.requestAnimationFrame(render);

      return () => {
        disposed = true;
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );

        if (frameRef.current !== null) {
          window.cancelAnimationFrame(frameRef.current);
        }
      };
    }, [density, palette, paused, redrawToken, reducedMotion, scene]);

    const canvasStyle = {
      "--ascii-canvas-accent": palette.colors[4],
    } as CSSProperties;

    return (
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        data-ascii-canvas
        style={canvasStyle}
      />
    );
  },
);

AsciiField.displayName = "AsciiField";

export const asciiSceneOrder = SCENE_ORDER;
