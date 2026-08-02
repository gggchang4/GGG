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
  moved: boolean;
};

const INITIAL_ALBUM_INDEX = 2;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getShelfGap() {
  return clamp(window.innerWidth * 0.033, 30, 50);
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
  platterRef,
  deckRecordRef,
  tonearmRef,
  stylusRef,
}: {
  phase: PlayerPhase;
  album: VinylAlbum | null;
  onStop: () => void;
  platterRef: RefObject<HTMLDivElement | null>;
  deckRecordRef: RefObject<HTMLButtonElement | null>;
  tonearmRef: RefObject<HTMLDivElement | null>;
  stylusRef: RefObject<HTMLSpanElement | null>;
}) {
  return (
    <section className={styles.turntableScene} aria-label="Record player">
      <div className={styles.turntableShadow} aria-hidden="true" />

      <div className={styles.deck}>
        <div className={styles.deckGrain} aria-hidden="true" />
        <div ref={platterRef} className={styles.platter}>
          <span className={styles.platterRim} aria-hidden="true" />
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
                className={`${styles.deckRecordSpin} ${
                  phase === "playing" || phase === "loading" || phase === "returning"
                    ? styles.isSpinning
                    : ""
                }`}
              >
                <VinylSurface album={album} labelSizes="54px" />
              </span>
            ) : null}
          </button>

          <span className={styles.spindle} aria-hidden="true" />
        </div>

        <div className={styles.pitchRail} aria-hidden="true">
          <span />
        </div>

        <div className={styles.powerControl} aria-hidden="true">
          <span />
        </div>

        <div className={styles.tonearmBase} aria-hidden="true">
          <span className={styles.tonearmBaseRing} />
          <div ref={tonearmRef} className={styles.tonearm}>
            <span className={styles.counterweight} />
            <span className={styles.armTube} />
            <span ref={stylusRef} className={styles.stylus}>
              <span />
            </span>
          </div>
        </div>

        <div className={styles.deckFrontLip} aria-hidden="true" />
      </div>
    </section>
  );
}

export function MusicPlayerExperience() {
  const rootRef = useRef<HTMLElement>(null);
  const rackRef = useRef<HTMLElement>(null);
  const slotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const sleeveRef = useRef<HTMLDivElement>(null);
  const floatingRecordRef = useRef<HTMLButtonElement>(null);
  const platterRef = useRef<HTMLDivElement>(null);
  const deckRecordRef = useRef<HTMLButtonElement>(null);
  const tonearmRef = useRef<HTMLDivElement>(null);
  const stylusRef = useRef<HTMLSpanElement>(null);
  const sequenceRef = useRef<gsap.core.Timeline | null>(null);
  const shelfTweenRef = useRef<gsap.core.Tween | null>(null);
  const positionRef = useRef({ value: INITIAL_ALBUM_INDEX });
  const phaseRef = useRef<PlayerPhase>("browsing");
  const gestureRef = useRef<GestureState>({
    pointerId: null,
    startX: 0,
    startPosition: INITIAL_ALBUM_INDEX,
    moved: false,
  });
  const clickSuppressedRef = useRef(false);
  const delayedSelectionRef = useRef<number | null>(null);
  const wheelTimeRef = useRef(0);

  const [phase, setPhaseState] = useState<PlayerPhase>("browsing");
  const [activeIndex, setActiveIndex] = useState(INITIAL_ALBUM_INDEX);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loadedIndex, setLoadedIndex] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

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

    slotRefs.current.forEach((slot, index) => {
      if (!slot) {
        return;
      }

      const relative = index - position;
      const distance = Math.abs(relative);
      const scale = clamp(1.14 - distance * 0.105, 0.72, 1.14);
      const translateY = Math.min(distance * 8.5, 29);
      const sleeve = slot.querySelector<HTMLElement>("[data-shelf-sleeve]");

      gsap.set(slot, {
        x: relative * gap,
        y: translateY,
        scale,
        opacity: clamp(1 - distance * 0.11, 0.38, 1),
        zIndex: Math.round(100 - distance * 10),
        filter: `brightness(${clamp(1.04 - distance * 0.055, 0.76, 1.04)})`,
      });

      if (sleeve) {
        gsap.set(sleeve, {
          rotationY: -clamp(84.5 + distance * 0.75, 84.5, 88),
          rotationZ: clamp(relative * -0.42, -2.4, 2.4),
        });
      }
    });
  }, []);

  const animateShelfTo = useCallback(
    (index: number, onComplete?: () => void) => {
      const target = clamp(index, 0, vinylAlbums.length - 1);

      shelfTweenRef.current?.kill();
      shelfTweenRef.current = gsap.to(positionRef.current, {
        value: target,
        duration: reducedMotion ? 0.16 : 0.52,
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

      const target = clamp(index, 0, vinylAlbums.length - 1);
      setActiveIndex(target);

      animateShelfTo(target, () => {
        if (!extract || phaseRef.current !== "browsing") {
          return;
        }

        if (delayedSelectionRef.current !== null) {
          window.clearTimeout(delayedSelectionRef.current);
        }

        delayedSelectionRef.current = window.setTimeout(
          () => {
            delayedSelectionRef.current = null;

            if (phaseRef.current !== "browsing") {
              return;
            }

            setSelectedIndex(target);
            updatePhase("extracting");
          },
          reducedMotion ? 0 : 70,
        );
      });
    },
    [animateShelfTo, reducedMotion, updatePhase],
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
    const slotBounds = selectedSlot?.getBoundingClientRect();
    const sleeveBounds = sleeve.getBoundingClientRect();
    const size = sleeveBounds.width;
    const pose = getShowcasePose(size);
    const startY = slotBounds
      ? slotBounds.top + slotBounds.height / 2 - window.innerHeight / 2
      : window.innerHeight * 0.33;
    const startScale = slotBounds
      ? clamp(slotBounds.height / Math.max(size, 1), 0.48, 0.78)
      : 0.65;
    const duration = reducedMotion ? 0.22 : 1;

    sequenceRef.current?.kill();
    gsap.set(sleeve, {
      x: 0,
      y: startY,
      scale: startScale,
      rotationY: reducedMotion ? -8 : -86,
      rotationZ: -0.6,
      autoAlpha: reducedMotion ? 0 : 1,
    });
    gsap.set(record, {
      x: 0,
      y: startY,
      scale: startScale * 0.96,
      rotationX: 0,
      rotationY: reducedMotion ? -8 : -86,
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
  }, [phase, reducedMotion, selectedIndex, updatePhase]);

  useEffect(() => {
    return () => {
      sequenceRef.current?.kill();
      shelfTweenRef.current?.kill();

      if (delayedSelectionRef.current !== null) {
        window.clearTimeout(delayedSelectionRef.current);
      }
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
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startPosition: positionRef.current.value,
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

    if (!gesture.moved && Math.abs(delta) > 6) {
      gesture.moved = true;
    }

    positionRef.current.value = clamp(
      gesture.startPosition - delta / getShelfGap(),
      -0.32,
      vinylAlbums.length - 0.68,
    );
    layoutShelf();
  };

  const finishRackGesture = (event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;

    if (gesture.pointerId !== event.pointerId) {
      return;
    }

    const target = clamp(
      Math.round(positionRef.current.value),
      0,
      vinylAlbums.length - 1,
    );
    clickSuppressedRef.current = gesture.moved;
    gestureRef.current.pointerId = null;
    setActiveIndex(target);
    animateShelfTo(target);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    window.setTimeout(() => {
      clickSuppressedRef.current = false;
    }, 0);
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
      focusAlbum(activeIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusAlbum(activeIndex + 1);
    } else if (
      event.target === event.currentTarget &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      focusAlbum(activeIndex, true);
    }
  };

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
      onComplete: () => updatePhase("playing"),
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
          rotationX: reducedMotion ? 0 : 54,
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
          rotationZ: 13.5,
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
    const slotBounds = selectedSlot?.getBoundingClientRect();
    const sleeveBounds = sleeve.getBoundingClientRect();
    const targetY = slotBounds
      ? slotBounds.top + slotBounds.height / 2 - window.innerHeight / 2
      : window.innerHeight * 0.33;
    const targetScale = slotBounds
      ? clamp(slotBounds.height / Math.max(sleeveBounds.width, 1), 0.48, 0.78)
      : 0.65;
    const duration = reducedMotion ? 0.18 : 0.72;

    sequenceRef.current?.kill();
    const sequence = gsap.timeline({
      onComplete: () => {
        setSelectedIndex(null);
        updatePhase("browsing");
        layoutShelf();
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
        [sleeve, record],
        {
          x: 0,
          y: targetY,
          scale: targetScale,
          rotationY: reducedMotion ? -8 : -86,
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
  }, [layoutShelf, reducedMotion, selectedIndex, updatePhase]);

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

    const sleeve = sleeveRef.current;
    const record = floatingRecordRef.current;
    const deckRecord = deckRecordRef.current;
    const selectedSlot = slotRefs.current[selectedIndex];
    const slotBounds = selectedSlot?.getBoundingClientRect();
    const sleeveSize = sleeve.getBoundingClientRect().width;
    const platterBounds = platterRef.current.getBoundingClientRect();
    const pose = getShowcasePose(sleeveSize);
    const platterX =
      platterBounds.left + platterBounds.width / 2 - window.innerWidth / 2;
    const platterY =
      platterBounds.top + platterBounds.height / 2 - window.innerHeight / 2;
    const platterScale =
      (platterBounds.width * 0.82) / Math.max(sleeveSize, 1);
    const shelfY = slotBounds
      ? slotBounds.top + slotBounds.height / 2 - window.innerHeight / 2
      : window.innerHeight * 0.33;
    const shelfScale = slotBounds
      ? clamp(slotBounds.height / Math.max(sleeveSize, 1), 0.48, 0.78)
      : 0.65;
    const duration = reducedMotion ? 0.2 : 1;

    sequenceRef.current?.kill();
    const sequence = gsap.timeline({
      onComplete: () => {
        setSelectedIndex(null);
        setLoadedIndex(null);
        updatePhase("browsing");
        layoutShelf();
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
          rotationZ: -20,
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
      .set(
        record,
        {
          x: platterX,
          y: platterY,
          scale: platterScale,
          rotationX: reducedMotion ? 0 : 54,
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
        [sleeve, record],
        {
          x: 0,
          y: shelfY - (reducedMotion ? 0 : 22),
          scale: shelfScale,
          rotationY: reducedMotion ? -8 : -86,
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
  }, [layoutShelf, reducedMotion, selectedIndex, updatePhase]);

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

      <div data-turntable>
        <Turntable
          phase={phase}
          album={loadedAlbum}
          onStop={returnRecord}
          platterRef={platterRef}
          deckRecordRef={deckRecordRef}
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
                data-active={index === activeIndex}
                aria-label={`Select ${album.title}, ${album.year}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => {
                  if (!clickSuppressedRef.current) {
                    focusAlbum(index, true);
                  }
                }}
              >
                <span className={styles.shelfSleeve} data-shelf-sleeve>
                  <Image
                    src={album.cover}
                    alt=""
                    fill
                    sizes="40px"
                    priority={index === INITIAL_ALBUM_INDEX}
                    draggable={false}
                  />
                  <span className={styles.sleeveSpine}>
                    <span>{album.title}</span>
                  </span>
                  <span className={styles.sleeveEdge} />
                </span>
              </button>
            );
          })}
        </div>
        <div className={styles.shelfLedge} aria-hidden="true" />
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

          <div ref={sleeveRef} className={styles.presentedSleeve}>
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
          </div>
        </div>
      ) : null}

      <p id="vinyl-status" className="sr-only" aria-live="polite">
        {statusText}
      </p>
    </main>
  );
}
