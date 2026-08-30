"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { RoomInteractionState } from "@/components/room/RoomScene";
import styles from "@/components/room/room.module.css";

const RoomScene = dynamic(
  () => import("@/components/room/RoomScene").then((module) => module.RoomScene),
  {
    ssr: false,
    loading: () => <div className={styles.loading} aria-hidden="true" />,
  },
);

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const createInteractionState = (): RoomInteractionState => ({
  dragging: false,
  targetPitch: 0,
  targetYaw: 0,
  currentPitch: 0,
  currentYaw: 0,
  releasePitchVelocity: 0,
  releaseYawVelocity: 0,
  releaseVersion: 0,
});

export function RoomExperience() {
  const interactionRef = useRef<RoomInteractionState>(createInteractionState());
  const gestureRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    startPitch: 0,
    startYaw: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    velocityPitch: 0,
    velocityYaw: 0,
  });
  const [dragging, setDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);

    updatePreference();
    media.addEventListener("change", updatePreference);

    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const cancelDrag = () => {
      if (!interactionRef.current.dragging) {
        return;
      }

      interactionRef.current.dragging = false;
      interactionRef.current.targetPitch = 0;
      interactionRef.current.targetYaw = 0;
      interactionRef.current.releasePitchVelocity = 0;
      interactionRef.current.releaseYawVelocity = 0;
      interactionRef.current.releaseVersion += 1;
      setDragging(false);
    };

    window.addEventListener("blur", cancelDrag);
    return () => window.removeEventListener("blur", cancelDrag);
  }, []);

  const finishDrag = (event?: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;

    if (
      event &&
      gestureRef.current.pointerId !== -1 &&
      gestureRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    if (!interaction.dragging) {
      return;
    }

    interaction.dragging = false;
    interaction.targetPitch = 0;
    interaction.targetYaw = 0;
    interaction.releasePitchVelocity = gestureRef.current.velocityPitch;
    interaction.releaseYawVelocity = gestureRef.current.velocityYaw;
    interaction.releaseVersion += 1;
    gestureRef.current.pointerId = -1;
    setDragging(false);

    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || interactionRef.current.dragging) {
      return;
    }

    const interaction = interactionRef.current;

    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPitch: interaction.currentPitch,
      startYaw: interaction.currentYaw,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocityPitch: 0,
      velocityYaw: 0,
    };

    interaction.dragging = true;
    interaction.targetPitch = interaction.currentPitch;
    interaction.targetYaw = interaction.currentYaw;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    const gesture = gestureRef.current;

    if (!interaction.dragging || gesture.pointerId !== event.pointerId) {
      return;
    }

    const elapsed = Math.max(8, event.timeStamp - gesture.lastTime);
    const deltaX = event.clientX - gesture.lastX;
    const deltaY = event.clientY - gesture.lastY;
    const viewportScale = Math.min(window.innerWidth, window.innerHeight) < 640 ? 0.82 : 1;
    const yawPerPixel = 0.0043 * viewportScale;
    const pitchPerPixel = 0.003 * viewportScale;

    interaction.targetYaw = clamp(
      gesture.startYaw + (event.clientX - gesture.startX) * yawPerPixel,
      -0.58,
      0.58,
    );
    interaction.targetPitch = clamp(
      gesture.startPitch + (event.clientY - gesture.startY) * pitchPerPixel,
      -0.22,
      0.28,
    );

    gesture.velocityYaw = clamp((deltaX * yawPerPixel * 1000) / elapsed, -1.8, 1.8);
    gesture.velocityPitch = clamp(
      (deltaY * pitchPerPixel * 1000) / elapsed,
      -1.25,
      1.25,
    );
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    gesture.lastTime = event.timeStamp;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    const step = event.shiftKey ? 0.13 : 0.075;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      interaction.dragging = true;
      interaction.targetYaw = clamp(
        interaction.currentYaw + (event.key === "ArrowLeft" ? -step : step),
        -0.58,
        0.58,
      );
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      interaction.dragging = true;
      interaction.targetPitch = clamp(
        interaction.currentPitch + (event.key === "ArrowUp" ? -step : step),
        -0.22,
        0.28,
      );
    }

    if (event.key === "Escape" || event.key === "Home") {
      event.preventDefault();
      interaction.dragging = false;
      interaction.targetPitch = 0;
      interaction.targetYaw = 0;
      interaction.releasePitchVelocity = 0;
      interaction.releaseYawVelocity = 0;
      interaction.releaseVersion += 1;
    }
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!event.key.startsWith("Arrow")) {
      return;
    }

    const interaction = interactionRef.current;
    interaction.dragging = false;
    interaction.targetPitch = 0;
    interaction.targetYaw = 0;
    interaction.releasePitchVelocity = 0;
    interaction.releaseYawVelocity = 0;
    interaction.releaseVersion += 1;
  };

  return (
    <main className={styles.page}>
      <div
        className={`${styles.stage} ${dragging ? styles.dragging : ""}`}
        role="img"
        tabIndex={0}
        aria-label="可拖拽查看的美式青少年房间三维模型"
        aria-describedby="room-interaction-instructions"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={() => finishDrag()}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      >
        <RoomScene
          interactionRef={interactionRef}
          reducedMotion={reducedMotion}
        />
      </div>

      <div className={styles.vignette} aria-hidden="true" />
      <p id="room-interaction-instructions" className={styles.srOnly}>
        拖动鼠标旋转房间，松开后模型会自动回到初始视角。也可以使用方向键查看，按 Home 或 Escape 复位。
      </p>
    </main>
  );
}
