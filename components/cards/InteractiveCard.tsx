"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
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
  "--shadow-x": string;
  "--shadow-y": string;
};

const MAX_TILT_X = 24;
const DRAG_TO_ROTATION = 0.34;

function normalizeAngle(value: number) {
  let angle = value % 360;
  if (angle > 180) angle -= 360;
  if (angle < -180) angle += 360;
  return angle;
}

function closestFaceRotation(value: number) {
  const normalized = ((value % 360) + 360) % 360;
  return normalized > 90 && normalized < 270 ? 180 : 0;
}

export function InteractiveCard({
  card,
  flipSignal,
  reducedMotion,
  onFaceChange,
}: InteractiveCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const pointerTimeRef = useRef(0);
  const previousFlipSignalRef = useRef(flipSignal);
  const visibleFaceRef = useRef<"front" | "back">("front");
  const [visibleFace, setVisibleFace] = useState<"front" | "back">("front");
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const stateRef = useRef({
    x: -2,
    y: 5,
    velocityX: 0,
    velocityY: 0,
    targetX: -2,
    targetY: 5,
    settling: false,
  });

  const renderCard = useCallback(() => {
    const element = cardRef.current;
    if (!element) return;

    const state = stateRef.current;
    const normalizedY = normalizeAngle(state.y);
    const frontness = Math.abs(Math.cos((state.y * Math.PI) / 180));
    const glareX = 50 + Math.sin((state.y * Math.PI) / 180) * 42;
    const glareY = 50 + Math.sin((state.x * Math.PI) / 180) * 38;
    const face = Math.abs(normalizedY) > 90 ? "back" : "front";

    element.style.setProperty(
      "--card-transform",
      `rotateX(${state.x.toFixed(3)}deg) rotateY(${state.y.toFixed(3)}deg)`,
    );
    element.style.setProperty("--glare-x", `${glareX.toFixed(2)}%`);
    element.style.setProperty("--glare-y", `${glareY.toFixed(2)}%`);
    element.style.setProperty(
      "--glare-angle",
      `${(118 + state.y * 0.65 - state.x * 0.35).toFixed(2)}deg`,
    );
    element.style.setProperty(
      "--glare-opacity",
      `${Math.min(0.9, 0.28 + (1 - frontness) * 0.5).toFixed(3)}`,
    );
    element.style.setProperty("--shadow-x", `${(-state.y * 0.24).toFixed(2)}px`);
    element.style.setProperty("--shadow-y", `${(24 + state.x * 0.18).toFixed(2)}px`);
    stageRef.current?.style.setProperty(
      "--shadow-x",
      `${(-state.y * 0.24).toFixed(2)}px`,
    );
    stageRef.current?.style.setProperty(
      "--shadow-y",
      `${(24 + state.x * 0.18).toFixed(2)}px`,
    );
    element.dataset.face = face;
    if (visibleFaceRef.current !== face) {
      visibleFaceRef.current = face;
      setVisibleFace(face);
      onFaceChange(face);
    }
  }, [onFaceChange]);

  const stopAnimation = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const tick = useCallback(
    function animateCard(time: number) {
      const state = stateRef.current;
      const rawDelta = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 1 / 60;
      const delta = Math.min(0.034, rawDelta);
      lastTimeRef.current = time;

      if (!draggingRef.current) {
        state.x += state.velocityX * delta;
        state.y += state.velocityY * delta;
        state.velocityX *= Math.pow(0.0007, delta);
        state.velocityY *= Math.pow(0.0007, delta);

        const spring = reducedMotion ? 48 : 30;
        const damping = reducedMotion ? 0.7 : 0.84;
        const errorX = state.targetX - state.x;
        const errorY = state.targetY - state.y;
        state.velocityX = (state.velocityX + errorX * spring * delta) * damping;
        state.velocityY = (state.velocityY + errorY * spring * delta) * damping;
        state.x = Math.max(-MAX_TILT_X, Math.min(MAX_TILT_X, state.x));
      }

      renderCard();

      const settled =
        !draggingRef.current &&
        Math.abs(state.x - state.targetX) < 0.035 &&
        Math.abs(state.y - state.targetY) < 0.035 &&
        Math.abs(state.velocityX) < 0.08 &&
        Math.abs(state.velocityY) < 0.08;

      if (settled) {
        state.x = state.targetX;
        state.y = state.targetY;
        state.velocityX = 0;
        state.velocityY = 0;
        state.settling = false;
        renderCard();
        frameRef.current = null;
        return;
      }

      frameRef.current = requestAnimationFrame(animateCard);
    },
    [reducedMotion, renderCard],
  );

  const startAnimation = useCallback(() => {
    if (frameRef.current !== null) return;
    lastTimeRef.current = 0;
    frameRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const settleToNearestFace = useCallback(() => {
    const state = stateRef.current;
    const projected = state.y + state.velocityY * 0.08;
    const turns = Math.round((projected - closestFaceRotation(projected)) / 360);
    const face = closestFaceRotation(projected);
    state.targetY = face + turns * 360;
    state.targetX = -2;
    state.settling = true;
    if (reducedMotion) {
      state.x = state.targetX;
      state.y = state.targetY;
      state.velocityX = 0;
      state.velocityY = 0;
      renderCard();
      return;
    }
    startAnimation();
  }, [reducedMotion, renderCard, startAnimation]);

  const flipCard = useCallback(() => {
    const state = stateRef.current;
    const direction = state.velocityY < -0.5 ? -1 : 1;
    state.targetY += direction * 180;
    state.targetX = -2;
    state.velocityY += direction * (reducedMotion ? 0 : 34);
    state.settling = true;
    if (reducedMotion) {
      state.x = state.targetX;
      state.y = state.targetY;
      state.velocityX = 0;
      state.velocityY = 0;
      renderCard();
      return;
    }
    startAnimation();
  }, [reducedMotion, renderCard, startAnimation]);

  const resetCard = useCallback(() => {
    const state = stateRef.current;
    state.targetX = -2;
    state.targetY = Math.round(state.y / 360) * 360 + 5;
    state.velocityX = 0;
    state.velocityY = 0;
    state.settling = true;
    startAnimation();
  }, [startAnimation]);

  useEffect(() => {
    const state = stateRef.current;
    state.x = -2;
    state.y = 5;
    state.targetX = -2;
    state.targetY = 5;
    state.velocityX = 0;
    state.velocityY = 0;
    visibleFaceRef.current = "front";
    setVisibleFace("front");
    onFaceChange("front");
    renderCard();
    return stopAnimation;
  }, [card.id, onFaceChange, renderCard, stopAnimation]);

  useEffect(() => {
    if (flipSignal !== previousFlipSignalRef.current) {
      previousFlipSignalRef.current = flipSignal;
      flipCard();
    }
  }, [flipSignal, flipCard]);

  useEffect(() => {
    const cancel = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      pointerIdRef.current = null;
      settleToNearestFace();
    };
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, [settleToNearestFace]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || draggingRef.current) return;
    stopAnimation();
    draggingRef.current = true;
    pointerIdRef.current = event.pointerId;
    lastPointRef.current = { x: event.clientX, y: event.clientY };
    pointerTimeRef.current = event.timeStamp;
    stateRef.current.velocityX = 0;
    stateRef.current.velocityY = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = "true";
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || pointerIdRef.current !== event.pointerId) return;
    const state = stateRef.current;
    const dx = event.clientX - lastPointRef.current.x;
    const dy = event.clientY - lastPointRef.current.y;
    const delta = Math.max(8, event.timeStamp - pointerTimeRef.current);

    state.y += dx * DRAG_TO_ROTATION;
    state.x = Math.max(-MAX_TILT_X, Math.min(MAX_TILT_X, state.x - dy * DRAG_TO_ROTATION));
    state.velocityY = reducedMotion ? 0 : (dx * DRAG_TO_ROTATION * 1000) / delta;
    state.velocityX = reducedMotion ? 0 : (-dy * DRAG_TO_ROTATION * 1000) / delta;
    lastPointRef.current = { x: event.clientX, y: event.clientY };
    pointerTimeRef.current = event.timeStamp;
    renderCard();
  };

  const finishPointer = (event?: PointerEvent<HTMLDivElement>) => {
    if (event && pointerIdRef.current !== event.pointerId) return;
    draggingRef.current = false;
    pointerIdRef.current = null;
    if (event) {
      delete event.currentTarget.dataset.dragging;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
    settleToNearestFace();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const state = stateRef.current;
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
    const step = event.shiftKey ? 12 : 5;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      state.targetY += event.key === "ArrowLeft" ? -step : step;
      startAnimation();
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      state.targetX = Math.max(
        -MAX_TILT_X,
        Math.min(MAX_TILT_X, state.targetX + (event.key === "ArrowUp" ? step : -step)),
      );
      startAnimation();
    }
  };

  const transformStyle: CardTransform = {
    "--card-transform": "rotateX(-2deg) rotateY(5deg)",
    "--glare-x": "54%",
    "--glare-y": "48%",
    "--glare-angle": "118deg",
    "--glare-opacity": "0.34",
    "--shadow-x": "-1px",
    "--shadow-y": "24px",
  };

  return (
    <div ref={stageRef} className={styles.inspectCardStage}>
      <div
        ref={cardRef}
        className={styles.interactiveCard}
        style={transformStyle}
        tabIndex={0}
        role="group"
        aria-label={`${card.player} card. Drag to rotate. Press F or Space to flip. Use arrow keys to tilt.`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onLostPointerCapture={() => {
          if (draggingRef.current) finishPointer();
        }}
        onKeyDown={handleKeyDown}
        onDoubleClick={flipCard}
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
        <span className={`${styles.cardEdge} ${styles.cardEdgeLeft}`} aria-hidden="true" />
        <span className={`${styles.cardEdge} ${styles.cardEdgeRight}`} aria-hidden="true" />
        <span className={`${styles.cardEdge} ${styles.cardEdgeTop}`} aria-hidden="true" />
        <span className={`${styles.cardEdge} ${styles.cardEdgeBottom}`} aria-hidden="true" />
      </div>
      <span className={styles.cardGroundShadow} aria-hidden="true" />
    </div>
  );
}
