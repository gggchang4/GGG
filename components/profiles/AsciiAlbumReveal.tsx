"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ScanLine } from "lucide-react";
import styles from "@/components/profiles/ascii-profile.module.css";

const COVER_SRC = "/media/asen/cover.jpg";
const ASCII_SRC = "/media/asen/cover-ascii.txt";
const ASCII_COLUMNS = 400;
const ASCII_ROWS = 220;

type LensState = {
  currentRadius: number;
  currentX: number;
  currentY: number;
  height: number;
  targetRadius: number;
  targetX: number;
  targetY: number;
  width: number;
};

type TouchStart = {
  pointerId: number;
  x: number;
  y: number;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const lerp = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

const quantizeChannel = (value: number) =>
  clamp(Math.round(value / 12) * 12, 0, 255);

function liftSampledColor(red: number, green: number, blue: number) {
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  const average = (red + green + blue) / 3;
  const saturation = 1.16;
  const shadowLift = luminance < 52 ? (58 - luminance) * 0.82 : 12;

  return [
    quantizeChannel((average + (red - average) * saturation) * 1.06 + shadowLift),
    quantizeChannel(
      (average + (green - average) * saturation) * 1.06 + shadowLift,
    ),
    quantizeChannel(
      (average + (blue - average) * saturation) * 1.06 + shadowLift,
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

  if (!context) {
    return null;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.fillStyle = "#03070b";
  context.fillRect(0, 0, width, height);

  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = ASCII_COLUMNS;
  sampleCanvas.height = ASCII_ROWS;
  const sampleContext = sampleCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!sampleContext) {
    return layer;
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
      context.globalAlpha = symbol === "." || symbol === ":" ? 0.78 : 0.96;
      context.fillText(
        symbol,
        (renderedColumn + 0.5) * cellWidth,
        (renderedRow + 0.5) * cellHeight,
      );
    }
  }

  context.globalAlpha = 1;
  return layer;
}

export function AsciiAlbumReveal() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const asciiLayerRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const scheduleRef = useRef<(() => void) | null>(null);
  const touchStartRef = useRef<TouchStart | null>(null);
  const touchLockedRef = useRef(false);
  const lensRef = useRef<LensState>({
    currentRadius: 0,
    currentX: 0,
    currentY: 0,
    height: 1,
    targetRadius: 0,
    targetX: 0,
    targetY: 0,
    width: 1,
  });
  const [isActive, setIsActive] = useState(false);
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
      state.currentX = lerp(
        state.currentX,
        state.targetX,
        reducedMotion ? 1 : 0.2,
      );
      state.currentY = lerp(
        state.currentY,
        state.targetY,
        reducedMotion ? 1 : 0.2,
      );
      state.currentRadius = lerp(
        state.currentRadius,
        state.targetRadius,
        reducedMotion
          ? 1
          : state.targetRadius > state.currentRadius
            ? 0.16
            : 0.2,
      );

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);

      if (asciiLayerRef.current && state.currentRadius > 0.35) {
        const x = state.currentX * dpr;
        const y = state.currentY * dpr;
        const radius = state.currentRadius * dpr;
        context.drawImage(asciiLayerRef.current, 0, 0);
        context.globalCompositeOperation = "destination-in";
        const mask = context.createRadialGradient(x, y, 0, x, y, radius);
        mask.addColorStop(0, "rgba(0, 0, 0, 1)");
        mask.addColorStop(0.68, "rgba(0, 0, 0, 1)");
        mask.addColorStop(0.88, "rgba(0, 0, 0, 0.78)");
        mask.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = mask;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.globalCompositeOperation = "source-over";

        const ringOpacity = clamp(state.currentRadius / 90, 0, 0.7);
        context.strokeStyle = `rgba(199, 255, 74, ${ringOpacity})`;
        context.lineWidth = dpr;
        context.setLineDash([9 * dpr, 10 * dpr]);
        context.beginPath();
        context.arc(x, y, radius * 0.94, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);

        context.fillStyle = `rgba(199, 255, 74, ${ringOpacity + 0.16})`;
        context.fillRect(x - 5 * dpr, y - 0.5 * dpr, 10 * dpr, dpr);
        context.fillRect(x - 0.5 * dpr, y - 5 * dpr, dpr, 10 * dpr);
      }

      const moving =
        Math.abs(state.currentX - state.targetX) > 0.08 ||
        Math.abs(state.currentY - state.targetY) > 0.08 ||
        Math.abs(state.currentRadius - state.targetRadius) > 0.35;

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
        setIsActive(false);
        schedule();
        return;
      }

      const bounds = stage.getBoundingClientRect();
      const state = lensRef.current;
      state.targetX = clamp(event.clientX - bounds.left, 0, bounds.width);
      state.targetY = clamp(event.clientY - bounds.top, 0, bounds.height);
      state.targetRadius = clamp(
        Math.min(bounds.width, bounds.height) * 0.19,
        104,
        218,
      );
      setIsActive(true);
      schedule();
    };
    const handleWindowScroll = () => {
      if (touchLockedRef.current || lensRef.current.targetRadius === 0) {
        return;
      }

      lensRef.current.targetRadius = 0;
      setIsActive(false);
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
      asciiLayerRef.current = createAsciiLayer(
        asciiLines,
        sourceImage,
        width,
        height,
        dpr,
        fontFamily,
      );
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
      state.targetX =
        previousWidth > 1 ? (state.targetX / previousWidth) * width : width / 2;
      state.targetY =
        previousHeight > 1
          ? (state.targetY / previousHeight) * height
          : height / 2;
      if (state.targetRadius > 0) {
        const previousTargetRadius = state.targetRadius;
        const nextTargetRadius = clamp(
          Math.min(width, height) * 0.19,
          104,
          218,
        );
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
    state.targetX = clamp(clientX - bounds.left, 0, bounds.width);
    state.targetY = clamp(clientY - bounds.top, 0, bounds.height);
    state.targetRadius = clamp(
      Math.min(bounds.width, bounds.height) * 0.19,
      104,
      218,
    );
    scheduleRef.current?.();
  };

  const hideLens = () => {
    lensRef.current.targetRadius = 0;
    setIsActive(false);
    scheduleRef.current?.();
  };

  const handlePointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || touchLockedRef.current) {
      return;
    }

    updateLensPosition(event.clientX, event.clientY);
    setIsActive(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || touchLockedRef.current) {
      return;
    }

    updateLensPosition(event.clientX, event.clientY);
    setIsActive(true);
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
    setIsActive(true);
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
    state.targetX = state.width / 2;
    state.targetY = state.height / 2;
    state.targetRadius = clamp(
      Math.min(state.width, state.height) * 0.19,
      104,
      218,
    );
    touchLockedRef.current = true;
    setTouchLocked(true);
    setIsActive(true);
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
    state.width = bounds.width;
    state.height = bounds.height;
    state.targetX = clamp(baseX + direction[0] * step, 0, bounds.width);
    state.targetY = clamp(baseY + direction[1] * step, 0, bounds.height);
    state.targetRadius = clamp(
      Math.min(bounds.width, bounds.height) * 0.19,
      104,
      218,
    );
    touchLockedRef.current = true;
    setTouchLocked(true);
    setIsActive(true);
    scheduleRef.current?.();
  };

  return (
    <figure
      className={styles.albumFigure}
      data-active={isActive ? "true" : "false"}
      data-ready={isReady ? "true" : "false"}
    >
      <div
        ref={stageRef}
        className={styles.albumStage}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleStageKeyDown}
        role="group"
        tabIndex={0}
        aria-label="Interactive album artwork with a source-mapped ASCII scanner"
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
          RGB / ASCII
        </div>
        <button
          type="button"
          className={styles.albumScanToggle}
          aria-label="Lock ASCII scan"
          aria-pressed={touchLocked}
          onClick={(event) => {
            event.stopPropagation();
            toggleLockedScan();
          }}
        >
          <ScanLine aria-hidden="true" />
          {touchLocked ? "Release scan" : "Lock scan"}
        </button>
      </div>
      <figcaption
        id="asen-scan-instructions"
        className={styles.albumCaption}
      >
        <span>Move to decode / arrows to steer / Enter or tap to lock</span>
        <span>Original image ↔ source-mapped ASCII</span>
      </figcaption>
    </figure>
  );
}
