"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import {
  ArrowLeft,
  FlipHorizontal2,
  Info,
  Rotate3D,
  X,
} from "lucide-react";
import {
  getCardsBySport,
  getSeriesById,
  getSeriesBySport,
  sports,
  type CardSeriesId,
  type CardSport,
  type SportsCard,
} from "@/data/sportsCards";
import { InteractiveCard } from "@/components/cards/InteractiveCard";
import { SportsCardArtwork } from "@/components/cards/SportsCardArtwork";
import styles from "@/components/cards/sports-cards.module.css";

type RailCardStyle = CSSProperties & {
  "--card-x": string;
  "--card-y": string;
  "--card-z-offset": string;
  "--card-scale": string;
  "--card-opacity": string;
  "--card-z": string;
  "--card-rotate": string;
  "--card-brightness": string;
  "--card-saturation": string;
  "--foil-x": string;
  "--foil-y": string;
};

type RailGestureState = {
  pointerId: number | null;
  startX: number;
  startY: number;
  startOffset: number;
  lastX: number;
  lastTime: number;
  velocityX: number;
  moved: boolean;
  axis: "pending" | "horizontal" | "vertical";
  targetIndex: number;
};

const DRAG_THRESHOLD = 7;
const RAIL_WINDOW = 6;
const RAIL_VELOCITY_SMOOTHING = 20;
const RAIL_RELEASE_DAMPING = 0.02;
type SeriesSelection = CardSeriesId | "all";

const sportLabels: Record<CardSport, string> = {
  nba: "NBA",
  nfl: "NFL",
  football: "FOOTBALL",
};

function clampIndex(index: number, count: number) {
  return Math.max(0, Math.min(count - 1, index));
}

function createRailGestureState(): RailGestureState {
  return {
    pointerId: null,
    startX: 0,
    startY: 0,
    startOffset: 0,
    lastX: 0,
    lastTime: 0,
    velocityX: 0,
    moved: false,
    axis: "pending",
    targetIndex: 0,
  };
}

function getRailCardStyle(position: number, step: number): RailCardStyle {
  const distance = Math.abs(position);
  const focus = Math.exp(-Math.pow(distance / 1.06, 1.55));

  return {
    "--card-x": `${position * step}px`,
    "--card-y": `${((1 - focus) * 22).toFixed(3)}px`,
    "--card-z-offset": `${-Math.min(distance, 4) * 44}px`,
    "--card-scale": (0.64 + focus * 0.44).toFixed(4),
    "--card-opacity": (0.14 + Math.exp(-distance * 0.78) * 0.86).toFixed(4),
    "--card-z": String(Math.max(1, 100 - Math.round(distance * 12))),
    "--card-rotate": `${Math.max(-18, Math.min(18, position * -6.5))}deg`,
    "--card-brightness": (0.54 + focus * 0.46).toFixed(4),
    "--card-saturation": (0.72 + focus * 0.28).toFixed(4),
    "--foil-x": `${50 + Math.max(-1.5, Math.min(1.5, position)) * 20}%`,
    "--foil-y": `${40 + Math.min(distance, 3) * 7}%`,
  };
}

function applyRailCardStyle(element: HTMLElement, style: RailCardStyle) {
  element.style.cssText = Object.entries(style)
    .map(([property, value]) => `${property}:${value}`)
    .join(";");
}

export function SportsCardsExperience() {
  const inspectorRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef(0);
  const railFrameRef = useRef<number | null>(null);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inspectOriginRef = useRef<DOMRect | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const gestureRef = useRef<RailGestureState>(createRailGestureState());
  const [sport, setSport] = useState<CardSport>("nba");
  const [seriesBySport, setSeriesBySport] = useState<Record<CardSport, SeriesSelection>>({
    nba: "all",
    nfl: "all",
    football: "all",
  });
  const [selectedByScope, setSelectedByScope] = useState<Record<string, string>>({});
  const [inspectCard, setInspectCard] = useState<SportsCard | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [face, setFace] = useState<"front" | "back">("front");
  const [flipSignal, setFlipSignal] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [railStep, setRailStep] = useState(236);
  const activeSeriesId = seriesBySport[sport];
  const scopeKey = `${sport}:${activeSeriesId}`;
  const seriesOptions = useMemo(() => getSeriesBySport(sport), [sport]);
  const activeSeries = activeSeriesId === "all" ? null : getSeriesById(activeSeriesId);
  const cards = useMemo(
    () => getCardsBySport(sport, activeSeriesId),
    [activeSeriesId, sport],
  );
  const activeIndex = Math.max(
    0,
    cards.findIndex((card) => card.id === selectedByScope[scopeKey]),
  );
  const activeCard = cards[activeIndex] ?? cards[0];
  const visibleCards = useMemo(() => {
    const start = Math.max(0, activeIndex - RAIL_WINDOW);
    const end = Math.min(cards.length, activeIndex + RAIL_WINDOW + 1);
    return cards.slice(start, end).map((card, offset) => ({ card, index: start + offset }));
  }, [activeIndex, cards]);
  const applyRailDragOffset = useCallback((nextOffset: number) => {
    dragOffsetRef.current = nextOffset;
    const rail = railRef.current;
    if (!rail) return;
    for (const element of rail.querySelectorAll<HTMLElement>("[data-card-index]")) {
      const index = Number(element.dataset.cardIndex);
      const position = index - activeIndex + nextOffset / railStep;
      applyRailCardStyle(element, getRailCardStyle(position, railStep));
    }
  }, [activeIndex, railStep]);

  const cancelRailFrame = useCallback(() => {
    if (railFrameRef.current === null) return;
    cancelAnimationFrame(railFrameRef.current);
    railFrameRef.current = null;
  }, []);

  const setRailDragOffset = useCallback(
    (nextOffset: number) => {
      cancelRailFrame();
      applyRailDragOffset(nextOffset);
    },
    [applyRailDragOffset, cancelRailFrame],
  );

  const queueRailDragOffset = useCallback(
    (nextOffset: number) => {
      dragOffsetRef.current = nextOffset;
      if (railFrameRef.current !== null) return;
      railFrameRef.current = requestAnimationFrame(() => {
        railFrameRef.current = null;
        applyRailDragOffset(dragOffsetRef.current);
      });
    },
    [applyRailDragOffset],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const updateRailStep = () => {
      const width = window.innerWidth;
      if (width <= 640) setRailStep(Math.min(250, Math.max(184, width * 0.55)));
      else if (width <= 1024) setRailStep(Math.min(264, Math.max(218, width * 0.27)));
      else setRailStep(Math.min(258, Math.max(220, width * 0.165)));
    };
    updateRailStep();
    window.addEventListener("resize", updateRailStep);
    return () => window.removeEventListener("resize", updateRailStep);
  }, []);

  useEffect(() => {
    if (!inspectCard) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => {
      inspectorRef.current?.focus({ preventScroll: true });
    });
    return () => {
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [inspectCard]);

  useLayoutEffect(() => {
    if (!inspectCard || reducedMotion) {
      inspectOriginRef.current = null;
      return;
    }

    const motion = inspectorRef.current?.querySelector<HTMLElement>("[data-inspect-motion]");
    const origin = inspectOriginRef.current;
    if (!motion || !origin) return;

    const destination = motion.getBoundingClientRect();
    const deltaX = origin.left + origin.width / 2 - (destination.left + destination.width / 2);
    const deltaY = origin.top + origin.height / 2 - (destination.top + destination.height / 2);
    const scale = origin.width / destination.width;
    const animation = motion.animate(
      [
        {
          opacity: 0.82,
          transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scale})`,
        },
        {
          opacity: 1,
          transform: "translate3d(0, 0, 0) scale(1)",
        },
      ],
      {
        duration: 560,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "both",
      },
    );
    animation.addEventListener("finish", () => {
      inspectOriginRef.current = null;
      animation.cancel();
    }, { once: true });
    return () => animation.cancel();
  }, [inspectCard, reducedMotion]);

  const finishClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    setInspectCard(null);
    setFace("front");
    setShowInfo(false);
    setIsClosing(false);
  }, []);

  const closeInspect = useCallback(() => {
    if (!inspectCard || isClosing) return;
    if (reducedMotion) {
      finishClose();
      return;
    }

    const inspector = inspectorRef.current;
    const motion = inspector?.querySelector<HTMLElement>("[data-inspect-motion]");
    const destination = document.getElementById(`rail-card-${inspectCard.id}`)?.getBoundingClientRect();
    if (!inspector || !motion || !destination) {
      finishClose();
      return;
    }

    const origin = motion.getBoundingClientRect();
    const deltaX = destination.left + destination.width / 2 - (origin.left + origin.width / 2);
    const deltaY = destination.top + destination.height / 2 - (origin.top + origin.height / 2);
    const scale = destination.width / origin.width;
    setIsClosing(true);
    motion.animate(
      [
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
        {
          opacity: 0.9,
          transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scale})`,
        },
      ],
      {
        duration: 420,
        easing: "cubic-bezier(0.32, 0, 0.2, 1)",
        fill: "forwards",
      },
    );
    inspector.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      {
        duration: 330,
        delay: 90,
        easing: "cubic-bezier(0.32, 0, 0.2, 1)",
        fill: "forwards",
      },
    );
    closeTimerRef.current = setTimeout(finishClose, 430);
  }, [finishClose, inspectCard, isClosing, reducedMotion]);

  useEffect(() => () => {
    cancelRailFrame();
    if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, [cancelRailFrame]);

  useEffect(() => {
    const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && inspectCard) {
        event.preventDefault();
        closeInspect();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [closeInspect, inspectCard]);

  const changeIndex = useCallback(
    (nextIndex: number) => {
      const clamped = clampIndex(nextIndex, cards.length);
      cancelRailFrame();
      dragOffsetRef.current = 0;
      setSelectedByScope((current) => ({
        ...current,
        [scopeKey]: cards[clamped].id,
      }));
    },
    [cancelRailFrame, cards, scopeKey],
  );

  const changeSport = (nextSport: CardSport) => {
    if (nextSport === sport) return;
    if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    cancelRailFrame();
    dragOffsetRef.current = 0;
    setSport(nextSport);
  };

  const changeSeries = (nextSeries: SeriesSelection) => {
    if (nextSeries === activeSeriesId) return;
    if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    cancelRailFrame();
    dragOffsetRef.current = 0;
    const nextScope = `${sport}:${nextSeries}`;
    const nextCards = getCardsBySport(sport, nextSeries);
    setSelectedByScope((current) => {
      if (current[nextScope]) return current;
      const retainedCard = nextCards.find((card) => card.id === activeCard.id);
      return {
        ...current,
        [nextScope]: (retainedCard ?? nextCards[0]).id,
      };
    });
    setSeriesBySport((current) => ({ ...current, [sport]: nextSeries }));
  };

  const openInspect = useCallback((card: SportsCard, trigger?: HTMLElement | null) => {
    returnFocusRef.current = trigger ?? (document.activeElement as HTMLElement | null);
    inspectOriginRef.current = document
      .getElementById(`rail-card-${card.id}`)
      ?.getBoundingClientRect() ?? null;
    setIsClosing(false);
    setInspectCard(card);
    setFace("front");
    setShowInfo(false);
  }, []);

  const finishRailGesture = (event?: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (event && gesture.pointerId !== event.pointerId) return;

    if (gesture.axis === "vertical") {
      setRailDragOffset(0);
    } else {
      const releaseTime = event?.timeStamp ?? performance.now();
      const idleTime = Math.max(0, releaseTime - gesture.lastTime);
      const velocity =
        gesture.velocityX * Math.exp(-RAIL_RELEASE_DAMPING * idleTime);
      let step = Math.round(-dragOffsetRef.current / railStep);
      if (Math.abs(velocity) > 0.38) step += velocity < 0 ? 1 : -1;
      step = Math.max(-2, Math.min(2, step));

      if (gesture.moved && step !== 0) changeIndex(activeIndex + step);
      else if (!gesture.moved) {
        if (gesture.targetIndex !== activeIndex) changeIndex(gesture.targetIndex);
        else openInspect(cards[gesture.targetIndex], event?.currentTarget);
      } else setRailDragOffset(0);
    }

    const shouldReleaseCapture = Boolean(
      event && event.currentTarget.hasPointerCapture(event.pointerId),
    );

    gestureRef.current = createRailGestureState();

    if (event && shouldReleaseCapture) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const cancelRailGesture = (event?: PointerEvent<HTMLDivElement>) => {
    if (event && gestureRef.current.pointerId !== event.pointerId) return;
    gestureRef.current = createRailGestureState();
    setRailDragOffset(0);
    if (event) delete event.currentTarget.dataset.dragging;
  };

  const handleRailPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || gestureRef.current.pointerId !== null) return;
    if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    delete event.currentTarget.dataset.scrolling;
    if (Math.abs(dragOffsetRef.current) > 0.01) setRailDragOffset(0);
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: dragOffsetRef.current,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocityX: 0,
      moved: false,
      axis: "pending",
      targetIndex: Number(
        (event.target as HTMLElement).closest<HTMLElement>("[data-card-index]")
          ?.dataset.cardIndex ?? activeIndex,
      ),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = "true";
  };

  const handleRailPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;
    const nativeEvent = event.nativeEvent;
    const coalescedEvents = nativeEvent.getCoalescedEvents?.() ?? [];
    const samples =
      coalescedEvents.length > 0 ? coalescedEvents : [nativeEvent];
    const finalSample = samples[samples.length - 1];
    const deltaX = finalSample.clientX - gesture.startX;
    const deltaY = finalSample.clientY - gesture.startY;
    if (gesture.axis === "pending" && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > DRAG_THRESHOLD) {
      gesture.axis = Math.abs(deltaX) > Math.abs(deltaY) + 2 ? "horizontal" : "vertical";
      gesture.moved = true;
    }

    for (const sample of samples) {
      const elapsed = Math.max(
        4,
        Math.min(50, sample.timeStamp - gesture.lastTime || 8),
      );
      const instantaneousVelocity =
        (sample.clientX - gesture.lastX) / elapsed;
      const velocityBlend =
        1 - Math.exp(-RAIL_VELOCITY_SMOOTHING * (elapsed / 1000));
      gesture.velocityX +=
        (instantaneousVelocity - gesture.velocityX) * velocityBlend;
      gesture.lastX = sample.clientX;
      gesture.lastTime = sample.timeStamp;
    }

    if (gesture.axis !== "horizontal") return;
    queueRailDragOffset(gesture.startOffset + deltaX);
  };

  const handleRailPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    delete event.currentTarget.dataset.dragging;
    finishRailGesture(event);
  };

  const handleRailPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    cancelRailGesture(event);
  };

  const handleRailWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey) return;
    const dominant = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(dominant) < 3) return;
    if (
      (dominant < 0 && activeIndex === 0) ||
      (dominant > 0 && activeIndex === cards.length - 1)
    ) return;
    event.preventDefault();
    const lowerBound = activeIndex < cards.length - 1 ? -railStep * 1.08 : 0;
    const upperBound = activeIndex > 0 ? railStep * 1.08 : 0;
    const impulse = Math.max(-120, Math.min(120, dominant)) * 0.82;
    const nextOffset = Math.max(
      lowerBound,
      Math.min(upperBound, dragOffsetRef.current - impulse),
    );
    event.currentTarget.dataset.scrolling = "true";
    queueRailDragOffset(nextOffset);

    if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    const viewport = event.currentTarget;
    wheelTimerRef.current = setTimeout(() => {
      delete viewport.dataset.scrolling;
      wheelTimerRef.current = null;
      const threshold = Math.min(44, railStep * 0.18);
      const direction = dragOffsetRef.current < -threshold
        ? 1
        : dragOffsetRef.current > threshold
          ? -1
          : 0;
      if (direction !== 0) changeIndex(activeIndex + direction);
      else setRailDragOffset(0);
    }, 95);
  };

  const handleRailKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      changeIndex(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      changeIndex(event.key === "Home" ? 0 : cards.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openInspect(activeCard);
    }
  };

  const handleInspectorKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      inspectorRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => element.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <main
      className={styles.page}
      data-inspecting={inspectCard ? "true" : "false"}
      data-closing={isClosing ? "true" : "false"}
    >
      <div
        className={styles.archiveContent}
        aria-hidden={inspectCard ? true : undefined}
        inert={inspectCard ? true : undefined}
      >
        <header className={styles.header}>
          <Link href="/" className={styles.backLink} aria-label="Back to profile index">
            <ArrowLeft aria-hidden="true" />
            INDEX
          </Link>

          <div className={styles.sportSwitcher} role="group" aria-label="Sport collection">
            {sports.map((item) => (
              <button
                key={item}
                type="button"
                className={sport === item ? styles.sportActive : undefined}
                aria-pressed={sport === item}
                onClick={() => changeSport(item)}
              >
                {sportLabels[item]}
              </button>
            ))}
          </div>
        </header>

        <section className={styles.collection} aria-label={`${sport} card collection`}>
        <nav className={styles.seriesBar} aria-label={`${sport} card series`}>
          <div className={styles.seriesTabs} role="group" aria-label="Filter cards by series">
            <button
              type="button"
              className={activeSeriesId === "all" ? styles.seriesActive : undefined}
              aria-pressed={activeSeriesId === "all"}
              onClick={() => changeSeries("all")}
            >
              <span>ALL</span>
            </button>
            {seriesOptions.map((series) => {
              return (
                <button
                  key={series.id}
                  type="button"
                  className={activeSeriesId === series.id ? styles.seriesActive : undefined}
                  aria-pressed={activeSeriesId === series.id}
                  onClick={() => changeSeries(series.id)}
                >
                  <span>{series.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div
          className={styles.railViewport}
          tabIndex={0}
          role="listbox"
          aria-label={`${sportLabels[sport]} ${activeSeries?.label ?? "all series"} player cards`}
          aria-activedescendant={`rail-card-${activeCard.id}`}
          onPointerDown={handleRailPointerDown}
          onPointerMove={handleRailPointerMove}
          onPointerUp={handleRailPointerEnd}
          onPointerCancel={handleRailPointerCancel}
          onLostPointerCapture={() => {
            if (gestureRef.current.pointerId !== null) cancelRailGesture();
          }}
          onWheel={handleRailWheel}
          onKeyDown={handleRailKeyDown}
        >
          <div ref={railRef} key={scopeKey} className={styles.rail}>
            {visibleCards.map(({ card, index }) => {
              const offset = index - activeIndex;
              const railStyle = getRailCardStyle(offset, railStep);
              const isActive = index === activeIndex;

              return (
                <button
                  id={`rail-card-${card.id}`}
                  key={card.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  aria-label={`${card.player}, ${card.year} ${card.maker} ${card.series}, ${card.parallel}, card ${card.cardNumber}`}
                  className={`${styles.railCard} ${isActive ? styles.railCardActive : ""}`}
                  style={railStyle}
                  data-card-index={index}
                  tabIndex={-1}
                >
                  <SportsCardArtwork
                    card={card}
                    priority={isActive}
                    sizes="(max-width: 640px) 58vw, (max-width: 1024px) 30vw, 235px"
                    effects={Math.abs(index - activeIndex) <= 1}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <p className={styles.selectionStatus} role="status" aria-live="polite">
          {activeCard.player}, {activeIndex + 1} of {cards.length}, {activeSeries?.label ?? "all series"}
        </p>

        <div className={styles.activeCaption}>
          <button type="button" onClick={(event) => openInspect(activeCard, event.currentTarget)}>
            <strong>{activeCard.player}</strong>
            <span>{activeCard.parallel}</span>
          </button>
        </div>
        </section>
      </div>

      {inspectCard ? (
        <section
          ref={inspectorRef}
          className={styles.inspector}
          data-closing={isClosing ? "true" : "false"}
          aria-labelledby="card-inspector-title"
          aria-describedby="card-inspector-instructions"
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          onKeyDown={handleInspectorKeyDown}
        >
          <header className={styles.inspectorHeader}>
            <button type="button" className={styles.backButton} onClick={closeInspect}>
              <ArrowLeft aria-hidden="true" /> COLLECTION
            </button>
            <button
              type="button"
              className={styles.closeButton}
              aria-label="Close card inspector"
              onClick={closeInspect}
            >
              <X aria-hidden="true" />
            </button>
          </header>

          <div className={styles.inspectorLayout}>
            <InteractiveCard
              card={inspectCard}
              flipSignal={flipSignal}
              reducedMotion={reducedMotion}
              onFaceChange={setFace}
            />

            <aside className={`${styles.cardDetails} ${showInfo ? styles.cardDetailsOpen : ""}`}>
              <div className={styles.detailIndex}>
                <span>{sportLabels[inspectCard.sport]}</span>
                <strong>#{inspectCard.cardNumber}</strong>
              </div>
              <p className={styles.detailEyebrow}>{inspectCard.year} · {inspectCard.maker} · {face.toUpperCase()}</p>
              <h2
                id="card-inspector-title"
                className={inspectCard.familyName.length > 10 ? styles.longPlayerName : undefined}
              >
                <span>{inspectCard.givenName}</span>
                {inspectCard.familyName}
              </h2>
              <p className={styles.detailParallel}>{inspectCard.parallel}</p>
              <p className={styles.detailMeta}>
                {inspectCard.series} · {inspectCard.serial}
              </p>
              {inspectCard.sourcePage ? (
                <a className={styles.detailSource} href={inspectCard.sourcePage} target="_blank" rel="noreferrer">
                  SOURCE RECORD <ArrowLeft aria-hidden="true" />
                </a>
              ) : null}

              <div className={styles.inspectActions}>
                <button
                  type="button"
                  className={styles.flipButton}
                  onClick={() => setFlipSignal((current) => current + 1)}
                >
                  <FlipHorizontal2 aria-hidden="true" /> FLIP CARD <span>F</span>
                </button>
                <button type="button" onClick={closeInspect}>RETURN</button>
              </div>
              <p id="card-inspector-instructions" className={styles.inspectHint}><Rotate3D aria-hidden="true" /> DRAG TO INSPECT · RELEASE TO SETTLE · DOUBLE CLICK TO FLIP</p>
            </aside>
          </div>

          <button
            type="button"
            className={`${styles.mobileInfoButton} ${showInfo ? styles.mobileInfoButtonOpen : ""}`}
            aria-expanded={showInfo}
            onClick={() => setShowInfo((current) => !current)}
          >
            <Info aria-hidden="true" /> {showInfo ? "CLOSE INFO" : "CARD INFO"}
          </button>
        </section>
      ) : null}
    </main>
  );
}
