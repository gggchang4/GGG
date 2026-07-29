"use client";

import dynamic from "next/dynamic";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import gsap from "gsap";
import { DiscNavigation } from "@/components/home/DiscNavigation";
import { StaticGlassLens } from "@/components/home/StaticGlassLens";
import { WaterSurface } from "@/components/home/WaterSurface";
import { stylesConfig } from "@/data/stylesConfig";
import {
  beginDiscDrag,
  createDiscController,
  endDiscDrag,
  nudgeDisc,
  projectPointerToTrackball,
  resetDisc,
  updateDiscDrag,
} from "@/lib/discPhysics";
import styles from "@/components/home/home.module.css";

const GlassLensScene = dynamic(
  () => import("@/components/home/GlassLensScene").then((module) => module.GlassLensScene),
  {
    ssr: false,
    loading: () => <StaticGlassLens />,
  },
);

class DiscSceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function HomeExperience() {
  const rootRef = useRef<HTMLElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const lensInteractionLockedRef = useRef(false);
  const controllerRef = useRef(createDiscController());
  const gestureRef = useRef({ startX: 0, startY: 0, crossedThreshold: false });
  const [isDragging, setIsDragging] = useState(false);
  const [isPointerFocused, setIsPointerFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const handleDiscSettled = useCallback(() => undefined, []);
  const changeSelectMode = useCallback((nextMode: boolean) => {
    const controller = controllerRef.current;

    if (controller.pointerDown) {
      endDiscDrag(controller);
    }

    controller.angularVelocity.set(0, 0, 0);
    lensInteractionLockedRef.current = false;
    setIsDragging(false);
    resetDisc(controller);
    setIsSelectMode(nextMode);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);

    updatePreference();
    media.addEventListener("change", updatePreference);

    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    controllerRef.current.reducedMotion = reducedMotion;

    if (reducedMotion) {
      lensInteractionLockedRef.current = false;
      resetDisc(controllerRef.current);
    }
  }, [reducedMotion]);

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }

    const matchMedia = gsap.matchMedia();
    const context = gsap.context(() => {
      matchMedia.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .from(
            "[data-reveal='brand']",
            { autoAlpha: 0, y: -10, duration: 0.72 },
            0,
          )
          .from(
            "[data-reveal='disc']",
            { autoAlpha: 0, y: 28, scale: 0.94, duration: 1.08 },
            0,
          );
      });

    }, rootRef);

    return () => {
      matchMedia.revert();
      context.revert();
    };
  }, []);

  useEffect(() => {
    const cancelDrag = () => {
      if (!controllerRef.current.pointerDown) {
        return;
      }

      endDiscDrag(controllerRef.current);
      lensInteractionLockedRef.current = false;
      setIsDragging(false);
      controllerRef.current.requestFrame?.();
    };

    window.addEventListener("blur", cancelDrag);
    return () => window.removeEventListener("blur", cancelDrag);
  }, []);

  const finishGesture = (event?: PointerEvent<HTMLDivElement>) => {
    if (event && controllerRef.current.pointerId !== event.pointerId) {
      return;
    }

    const pointerId = event?.pointerId;
    endDiscDrag(controllerRef.current, pointerId);
    lensInteractionLockedRef.current = false;
    setIsDragging(false);

    controllerRef.current.requestFrame?.();

    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (
      isSelectMode ||
      reducedMotion ||
      event.button !== 0 ||
      controllerRef.current.pointerDown
    ) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const trackballPoint = projectPointerToTrackball(event.clientX, event.clientY, bounds);

    gestureRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      crossedThreshold: false,
    };

    setIsPointerFocused(true);
    lensInteractionLockedRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    beginDiscDrag(controllerRef.current, event.pointerId, trackballPoint, event.timeStamp);
    controllerRef.current.requestFrame?.();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (isSelectMode) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const trackballPoint = projectPointerToTrackball(event.clientX, event.clientY, bounds);

    if (
      !controllerRef.current.pointerDown ||
      controllerRef.current.pointerId !== event.pointerId
    ) {
      controllerRef.current.lastTrackballPoint.copy(trackballPoint);
      controllerRef.current.requestFrame?.();
      return;
    }

    const movedDistance = Math.hypot(
      event.clientX - gestureRef.current.startX,
      event.clientY - gestureRef.current.startY,
    );

    if (!gestureRef.current.crossedThreshold && movedDistance > 6) {
      gestureRef.current.crossedThreshold = true;
      setIsDragging(true);
    }

    updateDiscDrag(controllerRef.current, trackballPoint, event.timeStamp);
    controllerRef.current.requestFrame?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      if (isSelectMode && event.key === "Escape") {
        event.preventDefault();
        changeSelectMode(false);
      }

      return;
    }

    setIsPointerFocused(false);

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      changeSelectMode(!isSelectMode);
      return;
    }

    if (isSelectMode) {
      if (event.key === "Escape" || event.key === "Home") {
        event.preventDefault();
        changeSelectMode(false);
      }

      return;
    }

    if (reducedMotion) {
      return;
    }

    const keyMap: Partial<
      Record<typeof event.key, { axis: "x" | "y"; direction: 1 | -1 }>
    > = {
      ArrowUp: { axis: "x", direction: -1 },
      ArrowDown: { axis: "x", direction: 1 },
      ArrowLeft: { axis: "y", direction: -1 },
      ArrowRight: { axis: "y", direction: 1 },
    };
    const action = keyMap[event.key];

    if (action) {
      event.preventDefault();
      nudgeDisc(controllerRef.current, action.axis, action.direction);
      return;
    }

    if (event.key === "Escape" || event.key === "Home") {
      event.preventDefault();
      resetDisc(controllerRef.current);
    }
  };

  const handleLensClick = () => {
    if (
      isSelectMode ||
      (!reducedMotion && gestureRef.current.crossedThreshold)
    ) {
      return;
    }

    changeSelectMode(true);
  };

  return (
    <main ref={rootRef} className={styles.page}>
      <WaterSurface
        lensRef={lensRef}
        interactionLockedRef={lensInteractionLockedRef}
        reducedMotion={reducedMotion}
      />

      <p
        className={styles.homeWordmark}
        data-reveal="brand"
        aria-label="GGG Profile"
      >
        <span aria-hidden="true">GGG</span>
        <span aria-hidden="true">Profile</span>
      </p>

      <section
        className={styles.hero}
        aria-labelledby="home-title"
        onClick={(event) => {
          if (isSelectMode && event.target === event.currentTarget) {
            changeSelectMode(false);
          }
        }}
      >
        <h1 id="home-title" className="sr-only">
          GGG Profile — GGG Cheese glass lens
        </h1>

        <div className={styles.discAssembly} data-reveal="disc">
          <div
            ref={lensRef}
            className={`${styles.discStage} ${
              !reducedMotion && isDragging ? styles.discStageDragging : ""
            } ${reducedMotion ? styles.discStageReduced : ""} ${
              isPointerFocused ? styles.discStagePointerFocused : ""
            } ${isSelectMode ? styles.discStageSelect : ""}`}
            role="group"
            tabIndex={0}
            aria-label={
              isSelectMode
                ? "Profile style selector"
                : "Interactive GGG Cheese glass lens"
            }
            aria-describedby="lens-instructions"
            aria-controls="lens-style-selector"
            onKeyDown={handleKeyDown}
            onClick={handleLensClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishGesture}
            onPointerCancel={finishGesture}
            onLostPointerCapture={() => {
              if (controllerRef.current.pointerDown) {
                endDiscDrag(controllerRef.current);
                lensInteractionLockedRef.current = false;
                setIsDragging(false);
                controllerRef.current.requestFrame?.();
              }
            }}
            onBlur={() => setIsPointerFocused(false)}
          >
            <DiscSceneBoundary
              fallback={<StaticGlassLens isSelectMode={isSelectMode} />}
            >
              <GlassLensScene
                controllerRef={controllerRef}
                onSettled={handleDiscSettled}
                reducedMotion={reducedMotion}
                isSelectMode={isSelectMode}
              />
            </DiscSceneBoundary>

            <DiscNavigation
              profiles={stylesConfig}
              isActive={isSelectMode}
            />
          </div>

          <p id="lens-instructions" className="sr-only">
            {isSelectMode
              ? "Choose one of three profile sections. Links are not assigned yet. Press Escape to return."
              : reducedMotion
                ? "Static glass lens. Press Enter or Space to open the profile style selector."
                : "Click to open the profile style selector. Drag or use the arrow keys to rotate. Press Home or Escape to reset."}
          </p>
        </div>
      </section>
    </main>
  );
}
