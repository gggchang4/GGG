"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
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
  const controllerRef = useRef(createDiscController());
  const gestureRef = useRef({ startX: 0, startY: 0, crossedThreshold: false });
  const [isDragging, setIsDragging] = useState(false);
  const [discInMotion, setDiscInMotion] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const handleDiscSettled = useCallback(() => setDiscInMotion(false), []);

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
          .from("[data-reveal='header']", { autoAlpha: 0, y: -14, duration: 0.72 })
          .from(
            "[data-reveal='disc']",
            { autoAlpha: 0, y: 28, scale: 0.94, duration: 1.08 },
            0.08,
          )
          .from(
            "[data-reveal='meta']",
            { autoAlpha: 0, y: 12, duration: 0.62, stagger: 0.08 },
            0.42,
          )
          .from("[data-reveal='rule']", { scaleX: 0, duration: 0.8 }, 0.16);
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

    if (!gestureRef.current.crossedThreshold) {
      setDiscInMotion(false);
    }

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

    event.currentTarget.setPointerCapture(event.pointerId);
    beginDiscDrag(controllerRef.current, event.pointerId, trackballPoint, event.timeStamp);
    controllerRef.current.requestFrame?.();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (
      !controllerRef.current.pointerDown ||
      controllerRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const trackballPoint = projectPointerToTrackball(event.clientX, event.clientY, bounds);
    const movedDistance = Math.hypot(
      event.clientX - gestureRef.current.startX,
      event.clientY - gestureRef.current.startY,
    );

    if (!gestureRef.current.crossedThreshold && movedDistance > 6) {
      gestureRef.current.crossedThreshold = true;
      setIsDragging(true);
      setDiscInMotion(true);
    }

    updateDiscDrag(controllerRef.current, trackballPoint, event.timeStamp);
    controllerRef.current.requestFrame?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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
      setDiscInMotion(true);
      nudgeDisc(controllerRef.current, action.axis, action.direction);
      return;
    }

    if (event.key === "Escape" || event.key === "Home") {
      event.preventDefault();

      if (
        controllerRef.current.orientation.angleTo(controllerRef.current.restOrientation) > 0.001
      ) {
        setDiscInMotion(true);
      }

      resetDisc(controllerRef.current);
    }
  };

  return (
    <main ref={rootRef} className={styles.page}>
      <div className={styles.backgroundTexture} aria-hidden="true" />
      <div className={styles.verticalRule} data-reveal="rule" aria-hidden="true" />

      <header className={styles.header} data-reveal="header">
        <Link className={styles.wordmark} href="/" aria-label="Profile Index home">
          <span>Profile</span>
          <span>Index</span>
        </Link>

        <div className={styles.headerMeta}>
          <span className={styles.liveDot} aria-hidden="true" />
          <span>Frontend / Motion / 3D</span>
          <span className={styles.headerDivider} aria-hidden="true" />
          <span>Edition 001</span>
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="home-title">
        <h1 id="home-title" className="sr-only">
          An interactive index of personal profile perspectives
        </h1>

        <p className={styles.leftMeta} data-reveal="meta">
          A personal digital gallery
          <br />
          built through interaction.
        </p>

        <div className={styles.discAssembly} data-reveal="disc">
          <div
            className={`${styles.discStage} ${
              !reducedMotion && isDragging ? styles.discStageDragging : ""
            } ${reducedMotion ? styles.discStageReduced : ""}`}
            role="group"
            tabIndex={0}
            aria-label="Interactive glass profile lens"
            aria-describedby="disc-instructions"
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
          >
            <DiscSceneBoundary fallback={<StaticGlassLens />}>
              {reducedMotion ? (
                <StaticGlassLens />
              ) : (
                <GlassLensScene
                  controllerRef={controllerRef}
                  onSettled={handleDiscSettled}
                />
              )}
            </DiscSceneBoundary>

            <DiscNavigation
              profiles={stylesConfig}
              isDragging={!reducedMotion && discInMotion}
            />
          </div>

          <p id="disc-instructions" className={styles.discInstructions}>
            <span>{reducedMotion ? "Static mode" : "Drag to rotate"}</span>
            <span aria-hidden="true">·</span>
            <span>{reducedMotion ? "Motion preference respected" : "Release to reset"}</span>
          </p>
        </div>

        <div className={styles.rightMeta} data-reveal="meta">
          <span>Perspectives</span>
          <strong>{String(stylesConfig.length).padStart(2, "0")}</strong>
          <span>Currently reserved</span>
        </div>
      </section>

      <footer className={styles.footer}>
        <p data-reveal="meta">
          Personal identity,
          <br />
          rendered three ways.
        </p>

        <p className={styles.footerStatus} data-reveal="meta">
          <span>System</span>
          <strong>Ready for experiments</strong>
        </p>
      </footer>
    </main>
  );
}
