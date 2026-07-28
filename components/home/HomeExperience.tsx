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
import { StaticGlassLens } from "@/components/home/StaticGlassLens";
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
  const controllerRef = useRef(createDiscController());
  const gestureRef = useRef({ startX: 0, startY: 0, crossedThreshold: false });
  const [isDragging, setIsDragging] = useState(false);
  const [isPointerFocused, setIsPointerFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const handleDiscSettled = useCallback(() => undefined, []);

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
    setIsDragging(false);

    controllerRef.current.requestFrame?.();

    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || event.button !== 0 || controllerRef.current.pointerDown) {
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
    event.currentTarget.setPointerCapture(event.pointerId);
    beginDiscDrag(controllerRef.current, event.pointerId, trackballPoint, event.timeStamp);
    controllerRef.current.requestFrame?.();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
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
    setIsPointerFocused(false);

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

  return (
    <main ref={rootRef} className={styles.page}>
      <section className={styles.hero} aria-labelledby="home-title">
        <h1 id="home-title" className="sr-only">
          GGG Cheese glass lens
        </h1>

        <div className={styles.discAssembly} data-reveal="disc">
          <div
            className={`${styles.discStage} ${
              !reducedMotion && isDragging ? styles.discStageDragging : ""
            } ${reducedMotion ? styles.discStageReduced : ""} ${
              isPointerFocused ? styles.discStagePointerFocused : ""
            }`}
            role="group"
            tabIndex={0}
            aria-label="Interactive GGG Cheese glass lens"
            aria-describedby="lens-instructions"
            onKeyDown={handleKeyDown}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishGesture}
            onPointerCancel={finishGesture}
            onLostPointerCapture={() => {
              if (controllerRef.current.pointerDown) {
                endDiscDrag(controllerRef.current);
                setIsDragging(false);
                controllerRef.current.requestFrame?.();
              }
            }}
            onBlur={() => setIsPointerFocused(false)}
          >
            <DiscSceneBoundary fallback={<StaticGlassLens />}>
              <GlassLensScene
                controllerRef={controllerRef}
                onSettled={handleDiscSettled}
                reducedMotion={reducedMotion}
              />
            </DiscSceneBoundary>
          </div>

          <p id="lens-instructions" className="sr-only">
            {reducedMotion
              ? "Static glass lens. Motion is disabled by your preference."
              : "Drag or use the arrow keys to rotate. Press Home or Escape to reset."}
          </p>
        </div>
      </section>
    </main>
  );
}
