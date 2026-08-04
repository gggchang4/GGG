"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  type WheelEvent,
} from "react";
import gsap from "gsap";
import { vinylAlbums, type VinylAlbum } from "@/data/records";
import styles from "@/components/music/music-player.module.css";

type PlayerPhase =
  | "browsing"
  | "extracting"
  | "showcase"
  | "loading"
  | "playing"
  | "closing"
  | "returning";

type GestureState = {
  pointerId: number | null;
  startX: number;
  startPosition: number;
  tapIndex: number | null;
  moved: boolean;
};

type PlaybackSpeed = 33 | 45;

type TonearmGestureState = {
  pointerId: number | null;
  moved: boolean;
  startX: number;
  startY: number;
};

const INITIAL_ALBUM_INDEX = 5;
const TONEARM_HOME_ANGLE = -77;
const TONEARM_PLAY_ANGLE = -27;
const TONEARM_MIN_ANGLE = -79;
const TONEARM_MAX_ANGLE = -20;
const TONEARM_RECORD_THRESHOLD = -62;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function wrapAlbumIndex(index: number) {
  const count = vinylAlbums.length;
  return ((index % count) + count) % count;
}

function getWrappedRelative(index: number, position: number) {
  const count = vinylAlbums.length;
  const half = count / 2;
  return ((index - position + half) % count + count) % count - half;
}

function getNearestVirtualPosition(index: number, currentPosition: number) {
  const wrappedIndex = wrapAlbumIndex(index);
  const cycle = Math.round(
    (currentPosition - wrappedIndex) / vinylAlbums.length,
  );
  return wrappedIndex + cycle * vinylAlbums.length;
}

function getShelfGap() {
  const compact = window.innerWidth < 720;

  return compact
    ? clamp(window.innerWidth * 0.27, 92, 124)
    : clamp(window.innerWidth * 0.17, 154, 220);
}

function getShowcasePose(size: number) {
  const compact = window.innerWidth < 720;

  return {
    x: compact
      ? -window.innerWidth * 0.38
      : -Math.min(window.innerWidth * 0.16, 250),
    y: compact ? window.innerHeight * 0.11 : window.innerHeight * 0.13,
    recordX: compact ? size * 0.39 : size * 0.44,
  };
}

function VinylSurface({
  album,
  labelSizes,
}: {
  album: VinylAlbum;
  labelSizes: string;
}) {
  return (
    <span className={styles.vinylSurface} aria-hidden="true">
      <span className={styles.grooves} />
      <span className={styles.recordSheen} />
      <span className={styles.recordLabel}>
        <Image
          src={album.cover}
          alt=""
          fill
          sizes={labelSizes}
          loading="eager"
          draggable={false}
        />
      </span>
      <span className={styles.spindleHole} />
    </span>
  );
}

function Turntable({
  phase,
  album,
  onStop,
  motorOn,
  speed,
  pitch,
  tonearmAngle,
  tonearmRaised,
  tonearmDragging,
  onToggleMotor,
  onToggleSpeed,
  onPitchChange,
  onToggleCue,
  onTonearmPointerDown,
  onTonearmPointerMove,
  onTonearmPointerUp,
  onTonearmKeyDown,
  platterRef,
  deckRecordRef,
  tonearmBaseRef,
  tonearmRef,
  stylusRef,
}: {
  phase: PlayerPhase;
  album: VinylAlbum | null;
  onStop: () => void;
  motorOn: boolean;
  speed: PlaybackSpeed;
  pitch: number;
  tonearmAngle: number;
  tonearmRaised: boolean;
  tonearmDragging: boolean;
  onToggleMotor: () => void;
  onToggleSpeed: () => void;
  onPitchChange: (value: number) => void;
  onToggleCue: () => void;
  onTonearmPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onTonearmPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onTonearmPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onTonearmKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  platterRef: RefObject<HTMLDivElement | null>;
  deckRecordRef: RefObject<HTMLButtonElement | null>;
  tonearmBaseRef: RefObject<HTMLDivElement | null>;
  tonearmRef: RefObject<HTMLButtonElement | null>;
  stylusRef: RefObject<HTMLSpanElement | null>;
}) {
  const spinDuration =
    (60 / (speed === 33 ? 33 + 1 / 3 : 45)) / (1 + pitch / 100);
  const spinStyle = {
    animationDuration: `${spinDuration}s`,
    animationPlayState: motorOn ? "running" : "paused",
  } as CSSProperties;
  const controlsLocked = phase === "loading" || phase === "returning";

  const updatePitchFromPointer = (event: PointerEvent<HTMLInputElement>) => {
    if (controlsLocked) {
      return;
    }

    event.preventDefault();
    const input = event.currentTarget;

    if (event.type === "pointerdown") {
      input.focus({ preventScroll: true });
      input.setPointerCapture(event.pointerId);
    } else if (!input.hasPointerCapture(event.pointerId)) {
      return;
    }

    const bounds = input.getBoundingClientRect();
    const progress = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
    onPitchChange(Math.round(8 - progress * 16));
  };

  const finishPitchGesture = (event: PointerEvent<HTMLInputElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePitchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const direction =
      event.key === "ArrowUp" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowDown" || event.key === "ArrowLeft"
          ? -1
          : 0;
    const nextPitch =
      event.key === "Home" ? -8 : event.key === "End" ? 8 : pitch + direction;

    if (direction === 0 && event.key !== "Home" && event.key !== "End") {
      return;
    }

    event.preventDefault();
    onPitchChange(clamp(nextPitch, -8, 8));
  };

  return (
    <section
      className={styles.turntableScene}
      aria-label="Interactive record player"
      data-motor={motorOn ? "on" : "off"}
    >
      <div className={styles.turntableShadow} aria-hidden="true" />

      <div className={styles.deck}>
        <div className={styles.deckGrain} aria-hidden="true" />
        <span className={styles.deckMark} aria-hidden="true">
          DIRECT DRIVE
        </span>

        <div ref={platterRef} className={styles.platter}>
          <span className={styles.platterRim} aria-hidden="true" />
          <span
            className={`${styles.platterStrobe} ${styles.isSpinning}`}
            style={spinStyle}
            aria-hidden="true"
          />
          <span className={styles.platterMat} aria-hidden="true" />

          <button
            ref={deckRecordRef}
            type="button"
            className={styles.deckRecord}
            onClick={onStop}
            disabled={phase !== "playing"}
            aria-label={
              album
                ? `Stop ${album.title} and return the record to its sleeve`
                : "Record platter"
            }
          >
            {album ? (
              <span
                className={`${styles.deckRecordSpin} ${styles.isSpinning}`}
                style={spinStyle}
              >
                <VinylSurface album={album} labelSizes="54px" />
              </span>
            ) : null}
          </button>

          <span className={styles.spindle} aria-hidden="true" />
        </div>

        <div className={styles.startControls}>
          <button
            type="button"
            className={styles.startStopKnob}
            onClick={onToggleMotor}
            disabled={controlsLocked}
            aria-label={motorOn ? "Stop platter" : "Start platter"}
            aria-pressed={motorOn}
          >
            <span className={styles.knobCap} aria-hidden="true">
              <span />
            </span>
            <span className={styles.controlLegend} aria-hidden="true">
              START / STOP
            </span>
          </button>

          <button
            type="button"
            className={styles.speedKnob}
            onClick={onToggleSpeed}
            disabled={controlsLocked}
            aria-label={`Switch platter speed. Current speed ${speed} RPM`}
          >
            <span className={styles.speedDial} data-speed={speed} aria-hidden="true">
              <span />
            </span>
            <span className={styles.speedValues} aria-hidden="true">
              <span>33</span>
              <span>45</span>
            </span>
          </button>
        </div>

        <label className={styles.pitchControl}>
          <span className={styles.controlLegend}>PITCH</span>
          <span className={styles.pitchValue}>{pitch > 0 ? "+" : ""}{pitch}%</span>
          <input
            type="range"
            min="-8"
            max="8"
            step="1"
            value={pitch}
            onInput={(event) => onPitchChange(Number(event.currentTarget.value))}
            onPointerDown={updatePitchFromPointer}
            onPointerMove={updatePitchFromPointer}
            onPointerUp={finishPitchGesture}
            onPointerCancel={finishPitchGesture}
            onKeyDown={handlePitchKeyDown}
            disabled={controlsLocked}
            aria-label="Pitch adjustment"
          />
          <span className={styles.pitchScale} aria-hidden="true" />
        </label>

        <div ref={tonearmBaseRef} className={styles.tonearmBase}>
          <span className={styles.tonearmBaseRing} aria-hidden="true" />
          <button
            ref={tonearmRef}
            type="button"
            className={styles.tonearm}
            data-dragging={tonearmDragging}
            data-raised={tonearmRaised}
            disabled={!album || phase !== "playing"}
            role="slider"
            aria-label="Tonearm position"
            aria-valuemin={TONEARM_HOME_ANGLE}
            aria-valuemax={TONEARM_MAX_ANGLE}
            aria-valuenow={Math.round(tonearmAngle)}
            aria-valuetext={
              tonearmAngle < TONEARM_RECORD_THRESHOLD
                ? "On arm rest"
                : "Over the record"
            }
            onPointerDown={onTonearmPointerDown}
            onPointerMove={onTonearmPointerMove}
            onPointerUp={onTonearmPointerUp}
            onPointerCancel={onTonearmPointerUp}
            onKeyDown={onTonearmKeyDown}
          >
            <span className={styles.counterweight} aria-hidden="true" />
            <svg
              className={styles.armTube}
              viewBox="0 0 360 74"
              aria-hidden="true"
            >
              <path d="M18 37 C 96 37, 137 58, 206 48 S 284 20, 333 37" />
              <path d="M20 34 C 97 34, 138 55, 205 45 S 282 17, 332 34" />
            </svg>
            <span ref={stylusRef} className={styles.stylus} aria-hidden="true">
              <span />
            </span>
          </button>

          <button
            type="button"
            className={styles.cueLever}
            onClick={onToggleCue}
            disabled={!album || phase !== "playing"}
            aria-label={tonearmRaised ? "Lower tonearm" : "Raise tonearm"}
            aria-pressed={tonearmRaised}
          >
            <span aria-hidden="true" />
          </button>
        </div>

        <span className={styles.stylusLamp} aria-hidden="true" />
      </div>
    </section>
  );
}

export function MusicPlayerExperience() {
  const rootRef = useRef<HTMLElement>(null);
  const rackRef = useRef<HTMLElement>(null);
  const slotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const sleeveRef = useRef<HTMLButtonElement>(null);
  const floatingRecordRef = useRef<HTMLButtonElement>(null);
  const platterRef = useRef<HTMLDivElement>(null);
  const deckRecordRef = useRef<HTMLButtonElement>(null);
  const tonearmBaseRef = useRef<HTMLDivElement>(null);
  const tonearmRef = useRef<HTMLButtonElement>(null);
  const stylusRef = useRef<HTMLSpanElement>(null);
  const sequenceRef = useRef<gsap.core.Timeline | null>(null);
  const shelfTweenRef = useRef<gsap.core.Tween | null>(null);
  const positionRef = useRef({ value: INITIAL_ALBUM_INDEX });
  const removedIndexRef = useRef<number | null>(null);
  const gapProgressRef = useRef({ value: 0 });
  const phaseRef = useRef<PlayerPhase>("browsing");
  const gestureRef = useRef<GestureState>({
    pointerId: null,
    startX: 0,
    startPosition: INITIAL_ALBUM_INDEX,
    tapIndex: null,
    moved: false,
  });
  const tonearmGestureRef = useRef<TonearmGestureState>({
    pointerId: null,
    moved: false,
    startX: 0,
    startY: 0,
  });
  const tonearmAngleRef = useRef(TONEARM_HOME_ANGLE);
  const wheelTimeRef = useRef(0);

  const [phase, setPhaseState] = useState<PlayerPhase>("browsing");
  const [activeIndex, setActiveIndex] = useState(INITIAL_ALBUM_INDEX);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loadedIndex, setLoadedIndex] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [motorOn, setMotorOn] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(33);
  const [pitch, setPitch] = useState(0);
  const [tonearmAngle, setTonearmAngle] = useState(TONEARM_HOME_ANGLE);
  const [tonearmRaised, setTonearmRaised] = useState(true);
  const [tonearmDragging, setTonearmDragging] = useState(false);

  const selectedAlbum =
    selectedIndex === null ? null : vinylAlbums[selectedIndex];
  const loadedAlbum = loadedIndex === null ? null : vinylAlbums[loadedIndex];

  const updatePhase = useCallback((nextPhase: PlayerPhase) => {
    phaseRef.current = nextPhase;
    setPhaseState(nextPhase);
  }, []);

  const layoutShelf = useCallback(() => {
    const position = positionRef.current.value;
    const gap = getShelfGap();
    const removedIndex = removedIndexRef.current;
    const gapProgress = gapProgressRef.current.value;

    slotRefs.current.forEach((slot, index) => {
      if (!slot) {
        return;
      }

      if (index === removedIndex) {
        return;
      }

      const wrappedRelative = getWrappedRelative(index, position);
      const removalSide =
        removedIndex === null ? 0 : getWrappedRelative(index, removedIndex);
      const relative =
        wrappedRelative +
        (removalSide < 0
          ? gapProgress * 0.5
          : removalSide > 0
            ? -gapProgress * 0.5
            : 0);
      const distance = Math.abs(relative);
      const scale = clamp(1.04 - distance * 0.105, 0.58, 1.04);
      const sleeve = slot.querySelector<HTMLElement>("[data-shelf-sleeve]");

      gsap.set(slot, {
        x: relative * gap,
        y: distance * 7 + (index % 2 === 0 ? 2 : -2),
        z: -distance * 72,
        scale,
        rotationY: clamp(relative * -5.5, -28, 28),
        rotationZ: clamp(relative * 1.4, -5.5, 5.5),
        autoAlpha: clamp(1 - distance * 0.16, 0.12, 1),
        zIndex: Math.round(100 - distance * 8),
        filter: `brightness(${clamp(1.06 - distance * 0.09, 0.6, 1.06)}) blur(${clamp(
          (distance - 1.35) * 0.75,
          0,
          2.5,
        )}px)`,
      });

      if (sleeve) {
        gsap.set(sleeve, {
          z: 0,
        });
      }
    });
  }, []);

  const animateShelfTo = useCallback(
    (index: number, onComplete?: () => void) => {
      const target = getNearestVirtualPosition(
        index,
        positionRef.current.value,
      );
      const distance = Math.abs(positionRef.current.value - target);

      shelfTweenRef.current?.kill();
      shelfTweenRef.current = gsap.to(positionRef.current, {
        value: target,
        duration: reducedMotion ? 0.14 : clamp(0.2 + distance * 0.08, 0.24, 0.56),
        ease: reducedMotion ? "power1.out" : "power3.out",
        overwrite: true,
        onUpdate: layoutShelf,
        onComplete,
      });
    },
    [layoutShelf, reducedMotion],
  );

  const focusAlbum = useCallback(
    (index: number, extract = false) => {
      if (phaseRef.current !== "browsing") {
        return;
      }

      const target = wrapAlbumIndex(index);
      const virtualTarget = getNearestVirtualPosition(
        target,
        positionRef.current.value,
      );
      setActiveIndex(target);

      const beginExtraction = () => {
        if (!extract || phaseRef.current !== "browsing") {
          return;
        }

        setSelectedIndex(target);
        updatePhase("extracting");
      };

      if (Math.abs(positionRef.current.value - virtualTarget) < 0.025) {
        positionRef.current.value = virtualTarget;
        layoutShelf();
        beginExtraction();
        return;
      }

      animateShelfTo(target, () => {
        beginExtraction();
      });
    },
    [animateShelfTo, layoutShelf, updatePhase],
  );

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);

    updatePreference();
    preference.addEventListener("change", updatePreference);

    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useLayoutEffect(() => {
    layoutShelf();

    const onResize = () => layoutShelf();
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [layoutShelf]);

  useLayoutEffect(() => {
    if (!rootRef.current) {
      return;
    }

    const context = gsap.context(() => {
      const duration = reducedMotion ? 0.01 : 1;

      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .fromTo(
          "[data-turntable]",
          { autoAlpha: 0, y: -28, scale: 0.965 },
          { autoAlpha: 1, y: 0, scale: 1, duration: duration * 1.15 },
          0,
        )
        .fromTo(
          "[data-rack]",
          { autoAlpha: 0, y: 38 },
          { autoAlpha: 1, y: 0, duration: duration * 0.95 },
          duration * 0.16,
        )
        .fromTo(
          "[data-shelf-slot]",
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            duration: duration * 0.48,
            stagger: reducedMotion ? 0 : 0.035,
          },
          duration * 0.28,
        );
    }, rootRef);

    return () => context.revert();
  }, [reducedMotion]);

  const restoreShelfAlbum = useCallback(
    (index: number) => {
      removedIndexRef.current = null;
      gapProgressRef.current.value = 0;

      const slot = slotRefs.current[index];
      if (slot) {
        gsap.set(slot, { visibility: "visible" });
      }

      layoutShelf();
    },
    [layoutShelf],
  );

  useLayoutEffect(() => {
    if (
      phase !== "extracting" ||
      selectedIndex === null ||
      !sleeveRef.current ||
      !floatingRecordRef.current ||
      !rackRef.current
    ) {
      return;
    }

    const sleeve = sleeveRef.current;
    const record = floatingRecordRef.current;
    const selectedSlot = slotRefs.current[selectedIndex];
    const slotBounds = selectedSlot
      ?.querySelector<HTMLElement>("[data-shelf-sleeve]")
      ?.getBoundingClientRect();
    const sleeveBounds = sleeve.getBoundingClientRect();
    const size = sleeveBounds.width;
    const pose = getShowcasePose(size);
    const startX = slotBounds
      ? slotBounds.left + slotBounds.width / 2 - window.innerWidth / 2
      : 0;
    const startY = slotBounds
      ? slotBounds.top + slotBounds.height / 2 - window.innerHeight / 2
      : window.innerHeight * 0.33;
    const startScale = slotBounds
      ? clamp(slotBounds.width / Math.max(size, 1), 0.38, 0.82)
      : 0.65;
    const duration = reducedMotion ? 0.22 : 1;

    removedIndexRef.current = selectedIndex;
    gapProgressRef.current.value = 0;

    sequenceRef.current?.kill();
    gsap.set(sleeve, {
      x: startX,
      y: startY,
      scale: startScale,
      rotationY: 0,
      rotationZ: 0,
      autoAlpha: reducedMotion ? 0 : 1,
    });
    gsap.set(record, {
      x: startX,
      y: startY,
      scale: startScale * 0.96,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      autoAlpha: 0,
    });

    const sequence = gsap.timeline({
      onComplete: () => updatePhase("showcase"),
    });
    sequenceRef.current = sequence;

    if (selectedSlot) {
      sequence
        .to(
          selectedSlot,
          {
            y: "+=2",
            scale: "*=0.985",
            duration: reducedMotion ? 0.01 : 0.09,
            ease: "power1.inOut",
          },
          0,
        )
        .to(
          selectedSlot,
          {
            y: "-=30",
            autoAlpha: 0,
            duration: reducedMotion ? 0.08 : 0.18,
            ease: "power2.out",
          },
          reducedMotion ? 0 : 0.07,
        );
    }

    sequence.to(
      gapProgressRef.current,
      {
        value: 1,
        duration: reducedMotion ? 0.08 : duration * 0.5,
        ease: "power3.inOut",
        onUpdate: layoutShelf,
      },
      reducedMotion ? 0 : 0.1,
    );

    sequence
      .to(
        rackRef.current,
        {
          opacity: 0.3,
          y: reducedMotion ? 8 : 18,
          filter: reducedMotion ? "none" : "blur(1.8px)",
          duration: duration * 0.65,
          ease: "power2.out",
        },
        0.08 * duration,
      )
      .to(
        sleeve,
        {
          x: pose.x,
          y: pose.y,
          scale: 1,
          rotationY: 0,
          rotationZ: -1.2,
          autoAlpha: 1,
          duration,
          ease: reducedMotion ? "power1.out" : "power4.inOut",
        },
        0.12 * duration,
      )
      .set(
        record,
        {
          x: pose.x,
          y: pose.y,
          scale: 0.955,
          rotationX: 0,
          rotationY: 0,
          autoAlpha: 1,
        },
        0.5 * duration,
      )
      .to(
        record,
        {
          x: pose.x + pose.recordX,
          scale: 0.975,
          duration: duration * 0.52,
          ease: "power3.out",
        },
        0.58 * duration,
      );

    return () => {
      if (sequenceRef.current === sequence && sequence.isActive()) {
        sequence.kill();
      }
    };
  }, [layoutShelf, phase, reducedMotion, selectedIndex, updatePhase]);

  useEffect(() => {
    return () => {
      sequenceRef.current?.kill();
      shelfTweenRef.current?.kill();
    };
  }, []);

  const handleRackPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (
      phaseRef.current !== "browsing" ||
      event.button !== 0 ||
      gestureRef.current.pointerId !== null
    ) {
      return;
    }

    shelfTweenRef.current?.kill();
    const pressedSlot = (event.target as Element).closest<HTMLElement>(
      "[data-record-index]",
    );
    const pressedIndex = Number(pressedSlot?.dataset.recordIndex);

    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startPosition: positionRef.current.value,
      tapIndex: Number.isFinite(pressedIndex) ? pressedIndex : null,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleRackPointerMove = (event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;

    if (
      phaseRef.current !== "browsing" ||
      gesture.pointerId !== event.pointerId
    ) {
      return;
    }

    const delta = event.clientX - gesture.startX;

    if (!gesture.moved && Math.abs(delta) > 10) {
      gesture.moved = true;
    }

    positionRef.current.value =
      gesture.startPosition - delta / getShelfGap();
    layoutShelf();
  };

  const finishRackGesture = (event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;

    if (gesture.pointerId !== event.pointerId) {
      return;
    }

    const snapTarget = wrapAlbumIndex(
      Math.round(positionRef.current.value),
    );
    const coordinateTarget = wrapAlbumIndex(
      Math.round(
        gesture.startPosition +
          (event.clientX - window.innerWidth / 2) / getShelfGap(),
      ),
    );
    const tapTarget = gesture.tapIndex ?? coordinateTarget;
    gestureRef.current.pointerId = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (gesture.moved || event.type === "pointercancel") {
      setActiveIndex(snapTarget);
      animateShelfTo(snapTarget);
    } else {
      focusAlbum(tapTarget, true);
    }
  };

  const handleShelfWheel = (event: WheelEvent<HTMLElement>) => {
    if (phaseRef.current !== "browsing") {
      return;
    }

    event.preventDefault();
    const now = performance.now();

    if (now - wheelTimeRef.current < 150) {
      return;
    }

    const delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;

    if (Math.abs(delta) < 4) {
      return;
    }

    wheelTimeRef.current = now;
    focusAlbum(activeIndex + (delta > 0 ? 1 : -1));
  };

  const handleRackKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (phaseRef.current !== "browsing") {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      const nextIndex = wrapAlbumIndex(activeIndex - 1);
      focusAlbum(nextIndex);
      slotRefs.current[nextIndex]?.focus({ preventScroll: true });
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      const nextIndex = wrapAlbumIndex(activeIndex + 1);
      focusAlbum(nextIndex);
      slotRefs.current[nextIndex]?.focus({ preventScroll: true });
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const focusedSlot = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-record-index]",
      );
      const focusedIndex = Number(focusedSlot?.dataset.recordIndex);
      focusAlbum(Number.isFinite(focusedIndex) ? focusedIndex : activeIndex, true);
    }
  };

  const setTonearmVisual = useCallback(
    (nextAngle: number, animate = false, commit = true) => {
      const angle = clamp(nextAngle, TONEARM_MIN_ANGLE, TONEARM_MAX_ANGLE);

      tonearmAngleRef.current = angle;
      if (commit) {
        setTonearmAngle(angle);
      }

      if (!tonearmRef.current) {
        return;
      }

      if (animate) {
        gsap.to(tonearmRef.current, {
          rotationZ: angle,
          duration: reducedMotion ? 0.12 : 0.42,
          ease: "power2.inOut",
          overwrite: true,
        });
      } else {
        gsap.set(tonearmRef.current, { rotationZ: angle });
      }
    },
    [reducedMotion],
  );

  const setCueRaised = useCallback(
    (raised: boolean, animate = true) => {
      setTonearmRaised(raised);

      if (!stylusRef.current) {
        return;
      }

      if (animate) {
        gsap.to(stylusRef.current, {
          y: raised ? -6 : 0,
          duration: reducedMotion ? 0.08 : 0.22,
          ease: raised ? "power2.out" : "power2.inOut",
          overwrite: true,
        });
      } else {
        gsap.set(stylusRef.current, { y: raised ? -6 : 0 });
      }
    },
    [reducedMotion],
  );

  const toggleMotor = useCallback(() => {
    if (phaseRef.current === "loading" || phaseRef.current === "returning") {
      return;
    }

    setMotorOn((running) => !running);
  }, []);

  const toggleSpeed = useCallback(() => {
    if (phaseRef.current === "loading" || phaseRef.current === "returning") {
      return;
    }

    setSpeed((currentSpeed) => (currentSpeed === 33 ? 45 : 33));
  }, []);

  const changePitch = useCallback((value: number) => {
    if (phaseRef.current === "loading" || phaseRef.current === "returning") {
      return;
    }

    setPitch(clamp(value, -8, 8));
  }, []);

  const toggleCue = useCallback(() => {
    if (phaseRef.current !== "playing" || loadedIndex === null) {
      return;
    }

    const nextRaised = !tonearmRaised;
    setCueRaised(nextRaised);

    if (!nextRaised && tonearmAngleRef.current >= TONEARM_RECORD_THRESHOLD) {
      setMotorOn(true);
    }
  }, [loadedIndex, setCueRaised, tonearmRaised]);

  const getTonearmAngleFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const base = tonearmBaseRef.current?.getBoundingClientRect();

      if (!base) {
        return tonearmAngleRef.current;
      }

      const pivotX = base.left + base.width / 2;
      const pivotY = base.top + base.height / 2;
      const rawAngle =
        (Math.atan2(clientY - pivotY, clientX - pivotX) * 180) / Math.PI;
      const normalizedAngle = rawAngle < 0 ? rawAngle + 360 : rawAngle;

      return clamp(
        normalizedAngle - 180,
        TONEARM_MIN_ANGLE,
        TONEARM_MAX_ANGLE,
      );
    },
    [],
  );

  const handleTonearmPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (
        phaseRef.current !== "playing" ||
        loadedIndex === null ||
        event.button !== 0 ||
        tonearmGestureRef.current.pointerId !== null
      ) {
        return;
      }

      event.preventDefault();
      tonearmGestureRef.current = {
        pointerId: event.pointerId,
        moved: false,
        startX: event.clientX,
        startY: event.clientY,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setTonearmDragging(true);
    },
    [loadedIndex],
  );

  const handleTonearmPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const gesture = tonearmGestureRef.current;

      if (
        phaseRef.current !== "playing" ||
        gesture.pointerId !== event.pointerId
      ) {
        return;
      }

      const travel = Math.hypot(
        event.clientX - gesture.startX,
        event.clientY - gesture.startY,
      );

      if (!gesture.moved && travel > 4) {
        gesture.moved = true;
        setCueRaised(true);
      }

      if (gesture.moved) {
        setTonearmVisual(
          getTonearmAngleFromPointer(event.clientX, event.clientY),
          false,
          false,
        );
      }
    },
    [getTonearmAngleFromPointer, setCueRaised, setTonearmVisual],
  );

  const finishTonearmGesture = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const gesture = tonearmGestureRef.current;

      if (gesture.pointerId !== event.pointerId) {
        return;
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      tonearmGestureRef.current.pointerId = null;
      setTonearmDragging(false);

      if (event.type === "pointercancel") {
        setTonearmVisual(tonearmAngleRef.current, true);
        return;
      }

      if (!gesture.moved) {
        toggleCue();
        return;
      }

      if (tonearmAngleRef.current < TONEARM_RECORD_THRESHOLD) {
        setTonearmVisual(TONEARM_HOME_ANGLE, true);
        setCueRaised(true);
        setMotorOn(false);
        return;
      }

      setTonearmVisual(tonearmAngleRef.current, true);
      setCueRaised(false);
      setMotorOn(true);
    },
    [setCueRaised, setTonearmVisual, toggleCue],
  );

  const handleTonearmKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      let nextAngle: number | null = null;

      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        nextAngle = tonearmAngleRef.current + 2;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        nextAngle = tonearmAngleRef.current - 2;
      } else if (event.key === "Home") {
        nextAngle = TONEARM_HOME_ANGLE;
      } else if (event.key === "End") {
        nextAngle = TONEARM_MAX_ANGLE;
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleCue();
        return;
      }

      if (nextAngle === null) {
        return;
      }

      event.preventDefault();
      setCueRaised(true);
      const keyboardAngle = clamp(
        nextAngle,
        TONEARM_HOME_ANGLE,
        TONEARM_MAX_ANGLE,
      );
      setTonearmVisual(keyboardAngle, true);

      if (keyboardAngle <= TONEARM_HOME_ANGLE) {
        setMotorOn(false);
      }
    },
    [setCueRaised, setTonearmVisual, toggleCue],
  );

  const placeRecord = useCallback(() => {
    if (
      phaseRef.current !== "showcase" ||
      selectedIndex === null ||
      !sleeveRef.current ||
      !floatingRecordRef.current ||
      !platterRef.current ||
      !deckRecordRef.current ||
      !tonearmRef.current ||
      !stylusRef.current
    ) {
      return;
    }

    updatePhase("loading");
    setLoadedIndex(selectedIndex);
    setTonearmRaised(true);
    tonearmAngleRef.current = TONEARM_HOME_ANGLE;
    setTonearmAngle(TONEARM_HOME_ANGLE);

    const sleeve = sleeveRef.current;
    const record = floatingRecordRef.current;
    const deckRecord = deckRecordRef.current;
    const platterBounds = platterRef.current.getBoundingClientRect();
    const recordBounds = record.getBoundingClientRect();
    const currentScale = Number(gsap.getProperty(record, "scale")) || 1;
    const deltaX =
      platterBounds.left +
      platterBounds.width / 2 -
      (recordBounds.left + recordBounds.width / 2);
    const deltaY =
      platterBounds.top +
      platterBounds.height / 2 -
      (recordBounds.top + recordBounds.height / 2);
    const landingScale =
      currentScale *
      ((platterBounds.width * 0.82) / Math.max(recordBounds.width, 1));
    const flyDuration = reducedMotion ? 0.24 : 1.08;

    sequenceRef.current?.kill();
    gsap.set(deckRecord, { autoAlpha: 0 });

    const sequence = gsap.timeline({
      onComplete: () => {
        tonearmAngleRef.current = TONEARM_PLAY_ANGLE;
        setTonearmAngle(TONEARM_PLAY_ANGLE);
        setTonearmRaised(false);
        updatePhase("playing");
      },
    });
    sequenceRef.current = sequence;
    sequence
      .to(
        sleeve,
        {
          x: "-=18",
          scale: 0.992,
          duration: reducedMotion ? 0.01 : 0.08,
          ease: "power1.inOut",
        },
        0,
      )
      .to(
        record,
        {
          x: "+=46",
          rotationZ: -3,
          duration: flyDuration * 0.34,
          ease: "power2.inOut",
        },
        reducedMotion ? 0 : 0.07,
      )
      .to(
        sleeve,
        {
          y: "+=32",
          scale: 0.88,
          rotationZ: -2.4,
          autoAlpha: 0,
          duration: flyDuration * 0.56,
          ease: "power2.in",
        },
        flyDuration * 0.28,
      )
      .to(
        record,
        {
          x: `+=${deltaX - 46}`,
          y: `+=${deltaY - (reducedMotion ? 0 : 34)}`,
          scale: landingScale,
          rotationX: 0,
          rotationZ: reducedMotion ? 0 : 23,
          duration: flyDuration * 0.78,
          ease: reducedMotion ? "power1.out" : "power3.inOut",
        },
        flyDuration * 0.31,
      )
      .to(
        record,
        {
          y: `+=${reducedMotion ? 0 : 34}`,
          rotationZ: -3,
          duration: flyDuration * 0.18,
          ease: "power2.in",
        },
        flyDuration * 0.91,
      )
      .set(record, { autoAlpha: 0 })
      .set(deckRecord, { autoAlpha: 1 })
      .call(() => setMotorOn(true))
      .fromTo(
        deckRecord,
        { scale: 1.018 },
        {
          scale: 1,
          duration: reducedMotion ? 0.01 : 0.14,
          ease: "power2.out",
        },
      )
      .to(
        stylusRef.current,
        {
          y: reducedMotion ? -1 : -6,
          duration: reducedMotion ? 0.05 : 0.14,
          ease: "power2.out",
        },
        ">+0.18",
      )
      .to(
        tonearmRef.current,
        {
          rotationZ: TONEARM_PLAY_ANGLE,
          duration: reducedMotion ? 0.18 : 0.66,
          ease: "power2.inOut",
        },
        ">",
      )
      .to(
        stylusRef.current,
        {
          y: 0,
          duration: reducedMotion ? 0.14 : 0.31,
          ease: "power2.inOut",
        },
        ">+0.08",
      );
  }, [reducedMotion, selectedIndex, updatePhase]);

  const closeSleeve = useCallback(() => {
    if (
      phaseRef.current !== "showcase" ||
      selectedIndex === null ||
      !sleeveRef.current ||
      !floatingRecordRef.current ||
      !rackRef.current
    ) {
      return;
    }

    updatePhase("closing");

    const sleeve = sleeveRef.current;
    const record = floatingRecordRef.current;
    const selectedSlot = slotRefs.current[selectedIndex];

    if (selectedSlot) {
      gsap.set(selectedSlot, {
        visibility: "hidden",
      });
    }

    const slotBounds = selectedSlot
      ?.querySelector<HTMLElement>("[data-shelf-sleeve]")
      ?.getBoundingClientRect();
    const sleeveBounds = sleeve.getBoundingClientRect();
    const targetX = slotBounds
      ? slotBounds.left + slotBounds.width / 2 - window.innerWidth / 2
      : 0;
    const targetY = slotBounds
      ? slotBounds.top + slotBounds.height / 2 - window.innerHeight / 2
      : window.innerHeight * 0.33;
    const targetScale = slotBounds
      ? clamp(slotBounds.width / Math.max(sleeveBounds.width, 1), 0.38, 0.82)
      : 0.65;
    const duration = reducedMotion ? 0.18 : 0.72;

    sequenceRef.current?.kill();
    const sequence = gsap.timeline({
      onComplete: () => {
        restoreShelfAlbum(selectedIndex);
        setSelectedIndex(null);
        updatePhase("browsing");
      },
    });
    sequenceRef.current = sequence;
    sequence
      .to(record, {
        x: gsap.getProperty(sleeve, "x") as number,
        duration: duration * 0.42,
        ease: "power2.inOut",
      })
      .to(
        gapProgressRef.current,
        {
          value: 0,
          duration: reducedMotion ? 0.08 : duration * 0.54,
          ease: "power3.inOut",
          onUpdate: layoutShelf,
        },
        `>-${duration * 0.12}`,
      )
      .to(
        rackRef.current,
        {
          opacity: 0.58,
          filter: reducedMotion ? "none" : "blur(0.8px)",
          duration: reducedMotion ? 0.08 : duration * 0.4,
          ease: "power2.out",
        },
        "<",
      )
      .to(
        [sleeve, record],
        {
          x: targetX,
          y: targetY,
          scale: targetScale,
          rotationY: 0,
          rotationZ: 0,
          duration,
          ease: "power3.inOut",
        },
        ">",
      )
      .to(
        [sleeve, record],
        {
          autoAlpha: 0,
          duration: reducedMotion ? 0.01 : 0.1,
        },
        ">-0.1",
      )
      .to(
        rackRef.current,
        {
          opacity: 1,
          y: 0,
          filter: "none",
          duration: duration * 0.58,
          ease: "power2.out",
        },
        `>-${duration * 0.34}`,
      );
  }, [
    layoutShelf,
    reducedMotion,
    restoreShelfAlbum,
    selectedIndex,
    updatePhase,
  ]);

  const returnRecord = useCallback(() => {
    if (
      phaseRef.current !== "playing" ||
      selectedIndex === null ||
      !sleeveRef.current ||
      !floatingRecordRef.current ||
      !platterRef.current ||
      !deckRecordRef.current ||
      !tonearmRef.current ||
      !stylusRef.current ||
      !rackRef.current
    ) {
      return;
    }

    updatePhase("returning");
    setTonearmRaised(true);

    const sleeve = sleeveRef.current;
    const record = floatingRecordRef.current;
    const deckRecord = deckRecordRef.current;
    const selectedSlot = slotRefs.current[selectedIndex];

    if (selectedSlot) {
      gsap.set(selectedSlot, {
        visibility: "hidden",
      });
    }

    const slotBounds = selectedSlot
      ?.querySelector<HTMLElement>("[data-shelf-sleeve]")
      ?.getBoundingClientRect();
    const sleeveSize = sleeve.getBoundingClientRect().width;
    const platterBounds = platterRef.current.getBoundingClientRect();
    const pose = getShowcasePose(sleeveSize);
    const platterX =
      platterBounds.left + platterBounds.width / 2 - window.innerWidth / 2;
    const platterY =
      platterBounds.top + platterBounds.height / 2 - window.innerHeight / 2;
    const platterScale =
      (platterBounds.width * 0.82) / Math.max(sleeveSize, 1);
    const shelfX = slotBounds
      ? slotBounds.left + slotBounds.width / 2 - window.innerWidth / 2
      : 0;
    const shelfY = slotBounds
      ? slotBounds.top + slotBounds.height / 2 - window.innerHeight / 2
      : window.innerHeight * 0.33;
    const shelfScale = slotBounds
      ? clamp(slotBounds.width / Math.max(sleeveSize, 1), 0.38, 0.82)
      : 0.65;
    const duration = reducedMotion ? 0.2 : 1;

    sequenceRef.current?.kill();
    const sequence = gsap.timeline({
      onComplete: () => {
        tonearmAngleRef.current = TONEARM_HOME_ANGLE;
        setTonearmAngle(TONEARM_HOME_ANGLE);
        setTonearmRaised(true);
        setMotorOn(false);
        restoreShelfAlbum(selectedIndex);
        setSelectedIndex(null);
        setLoadedIndex(null);
        updatePhase("browsing");
      },
    });
    sequenceRef.current = sequence;

    sequence
      .to(
        stylusRef.current,
        {
          y: reducedMotion ? -1 : -7,
          duration: reducedMotion ? 0.08 : 0.18,
          ease: "power2.out",
        },
        0,
      )
      .to(
        tonearmRef.current,
        {
          rotationZ: TONEARM_HOME_ANGLE,
          duration: reducedMotion ? 0.2 : 0.7,
          ease: "power2.inOut",
        },
        reducedMotion ? 0.08 : 0.16,
      )
      .to(
        stylusRef.current,
        {
          y: 0,
          duration: reducedMotion ? 0.08 : 0.15,
        },
        ">",
      )
      .to(
        deckRecord,
        {
          autoAlpha: 0,
          duration: reducedMotion ? 0.05 : 0.16,
        },
        ">+0.12",
      )
      .call(() => setMotorOn(false))
      .set(
        record,
        {
          x: platterX,
          y: platterY,
          scale: platterScale,
          rotationX: 0,
          rotationY: 0,
          rotationZ: -3,
          autoAlpha: 1,
        },
        ">",
      )
      .to(
        record,
        {
          x: pose.x + pose.recordX,
          y: pose.y - (reducedMotion ? 0 : 34),
          scale: 0.975,
          rotationX: 0,
          rotationZ: -2,
          duration,
          ease: reducedMotion ? "power1.out" : "power3.inOut",
        },
        ">",
      )
      .to(
        record,
        {
          y: pose.y,
          duration: duration * 0.18,
          ease: "power2.out",
        },
        ">",
      )
      .set(
        sleeve,
        {
          x: pose.x,
          y: pose.y,
          scale: 0.88,
          rotationY: 0,
          rotationZ: -2.4,
          autoAlpha: 1,
        },
        `>-${duration * 0.12}`,
      )
      .to(
        sleeve,
        {
          scale: 1,
          rotationZ: -1.2,
          duration: duration * 0.28,
          ease: "power2.out",
        },
      )
      .to(
        record,
        {
          x: pose.x,
          duration: duration * 0.48,
          ease: "power2.inOut",
        },
        ">",
      )
      .to(
        gapProgressRef.current,
        {
          value: 0,
          duration: reducedMotion ? 0.08 : duration * 0.46,
          ease: "power3.inOut",
          onUpdate: layoutShelf,
        },
        `>-${duration * 0.12}`,
      )
      .to(
        rackRef.current,
        {
          opacity: 0.58,
          filter: reducedMotion ? "none" : "blur(0.8px)",
          duration: reducedMotion ? 0.08 : duration * 0.36,
          ease: "power2.out",
        },
        "<",
      )
      .to(
        [sleeve, record],
        {
          x: shelfX,
          y: shelfY - (reducedMotion ? 0 : 22),
          scale: shelfScale,
          rotationY: 0,
          rotationZ: 0,
          duration: duration * 0.72,
          ease: "power3.inOut",
        },
        ">",
      )
      .to(
        [sleeve, record],
        {
          y: shelfY,
          duration: duration * 0.24,
          ease: "power2.in",
        },
        ">",
      )
      .to(
        [sleeve, record],
        {
          autoAlpha: 0,
          duration: reducedMotion ? 0.01 : 0.1,
        },
        ">-0.05",
      )
      .to(
        rackRef.current,
        {
          opacity: 1,
          y: 0,
          filter: "none",
          duration: duration * 0.55,
          ease: "power2.out",
        },
        `>-${duration * 0.42}`,
      );
  }, [
    layoutShelf,
    reducedMotion,
    restoreShelfAlbum,
    selectedIndex,
    updatePhase,
  ]);

  useEffect(() => {
    const handleGlobalKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (phaseRef.current === "showcase") {
        closeSleeve();
      } else if (phaseRef.current === "playing") {
        returnRecord();
      }
    };

    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [closeSleeve, returnRecord]);

  const statusText = (() => {
    if (!selectedAlbum) {
      return `${vinylAlbums[activeIndex].title} is centered in the record rack.`;
    }

    if (phase === "playing") {
      return `${selectedAlbum.title} is playing.`;
    }

    if (phase === "showcase") {
      return `${selectedAlbum.title} is out of the rack. Select the exposed record to play it.`;
    }

    return `${selectedAlbum.title} is being handled.`;
  })();

  const pageStyle = {
    "--active-spine": vinylAlbums[activeIndex].spine,
  } as CSSProperties;

  return (
    <main
      ref={rootRef}
      className={styles.page}
      style={pageStyle}
      data-phase={phase}
    >
      <div className={styles.ambientLight} aria-hidden="true" />
      <div className={styles.roomGrain} aria-hidden="true" />

      <div className={styles.turntableStage} data-turntable>
        <Turntable
          phase={phase}
          album={loadedAlbum}
          onStop={returnRecord}
          motorOn={motorOn}
          speed={speed}
          pitch={pitch}
          tonearmAngle={tonearmAngle}
          tonearmRaised={tonearmRaised}
          tonearmDragging={tonearmDragging}
          onToggleMotor={toggleMotor}
          onToggleSpeed={toggleSpeed}
          onPitchChange={changePitch}
          onToggleCue={toggleCue}
          onTonearmPointerDown={handleTonearmPointerDown}
          onTonearmPointerMove={handleTonearmPointerMove}
          onTonearmPointerUp={finishTonearmGesture}
          onTonearmKeyDown={handleTonearmKeyDown}
          platterRef={platterRef}
          deckRecordRef={deckRecordRef}
          tonearmBaseRef={tonearmBaseRef}
          tonearmRef={tonearmRef}
          stylusRef={stylusRef}
        />
      </div>

      <section
        ref={rackRef}
        className={styles.recordRack}
        data-rack
        tabIndex={0}
        aria-label="Kanye West record collection"
        aria-describedby="vinyl-status"
        onPointerDown={handleRackPointerDown}
        onPointerMove={handleRackPointerMove}
        onPointerUp={finishRackGesture}
        onPointerCancel={finishRackGesture}
        onWheel={handleShelfWheel}
        onKeyDown={handleRackKeyDown}
      >
        <div className={styles.rackBackdrop} aria-hidden="true">
          <Image
            key={vinylAlbums[activeIndex].id}
            className={styles.rackBackdropImage}
            src={vinylAlbums[activeIndex].cover}
            alt=""
            fill
            sizes="100vw"
            priority
            draggable={false}
          />
        </div>
        <header className={styles.rackHeader} aria-hidden="true">
          <span>Queue</span>
          <span>Drag to browse</span>
        </header>
        <div className={styles.focusGlow} aria-hidden="true" />
        <div className={styles.rackTrack}>
          {vinylAlbums.map((album, index) => {
            const albumStyle = {
              "--spine-color": album.spine,
              "--edge-color": album.edge,
            } as CSSProperties;

            return (
              <button
                key={album.id}
                ref={(node) => {
                  slotRefs.current[index] = node;
                }}
                type="button"
                className={styles.shelfSlot}
                style={albumStyle}
                disabled={phase !== "browsing"}
                data-shelf-slot
                data-record-index={index}
                data-active={index === activeIndex}
                aria-label={`Select ${album.title}, ${album.year}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={(event) => {
                  if (event.detail === 0) {
                    focusAlbum(index, true);
                  }
                }}
              >
                <span className={styles.shelfSleeve} data-shelf-sleeve>
                  <Image
                    src={album.cover}
                    alt=""
                    fill
                    sizes="(max-width: 720px) 34vw, 205px"
                    priority={index === INITIAL_ALBUM_INDEX}
                    draggable={false}
                  />
                  <span className={styles.sleeveSpine}>
                    <span>{album.title}</span>
                  </span>
                  <span className={styles.sleeveEdge} />
                </span>
                <span className={styles.albumMeta} aria-hidden="true">
                  <span className={styles.albumTitle}>{album.title}</span>
                  <span className={styles.albumArtist}>{album.artist}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className={styles.rackProgress} aria-hidden="true">
          <span>{String(activeIndex + 1).padStart(2, "0")}</span>
          <span className={styles.progressTrack}>
            <span
              style={{
                transform: `scaleX(${(activeIndex + 1) / vinylAlbums.length})`,
              }}
            />
          </span>
          <span>{String(vinylAlbums.length).padStart(2, "0")}</span>
        </div>
      </section>

      {selectedAlbum ? (
        <div className={styles.presentationLayer}>
          <button
            ref={floatingRecordRef}
            type="button"
            className={styles.floatingRecord}
            onClick={placeRecord}
            disabled={phase !== "showcase"}
            aria-label={`Take ${selectedAlbum.title} out of its sleeve and play it`}
          >
            <span
              className={`${styles.floatingRecordSpin} ${
                phase === "loading" || phase === "returning"
                  ? styles.isSpinning
                  : ""
              }`}
            >
              <VinylSurface album={selectedAlbum} labelSizes="72px" />
            </span>
          </button>

          <button
            ref={sleeveRef}
            type="button"
            className={styles.presentedSleeve}
            onClick={placeRecord}
            disabled={phase !== "showcase"}
            aria-label={`Play ${selectedAlbum.title}`}
          >
            <span className={styles.sleeveBack} aria-hidden="true" />
            <Image
              src={selectedAlbum.cover}
              alt={`${selectedAlbum.title} album cover`}
              fill
              sizes="(max-width: 720px) 68vw, 330px"
              priority
              draggable={false}
            />
            <span className={styles.sleevePaper} aria-hidden="true" />
            <span className={styles.presentedSpine} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <p id="vinyl-status" className="sr-only" aria-live="polite">
        {statusText}
      </p>
    </main>
  );
}
