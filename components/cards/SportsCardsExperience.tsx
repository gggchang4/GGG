"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
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
  ChevronLeft,
  ChevronRight,
  FlipHorizontal2,
  Info,
  Rotate3D,
  Sparkles,
  X,
} from "lucide-react";
import {
  getCardsBySport,
  sports,
  type CardSport,
  type SportsCard,
} from "@/data/sportsCards";
import { InteractiveCard } from "@/components/cards/InteractiveCard";
import { SportsCardArtwork } from "@/components/cards/SportsCardArtwork";
import styles from "@/components/cards/sports-cards.module.css";

type GalleryTheme = CSSProperties & {
  "--active-color": string;
  "--active-accent": string;
  "--active-secondary": string;
};

type RailCardStyle = CSSProperties & {
  "--card-x": string;
  "--card-distance": number;
  "--card-scale": number;
  "--card-opacity": number;
  "--card-z": number;
  "--card-rotate": string;
};

const DRAG_THRESHOLD = 7;

function clampIndex(index: number, count: number) {
  return Math.max(0, Math.min(count - 1, index));
}

export function SportsCardsExperience() {
  const rootRef = useRef<HTMLElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const gestureRef = useRef({
    pointerId: null as number | null,
    startX: 0,
    lastX: 0,
    startedAt: 0,
    moved: false,
    targetIndex: 0,
  });
  const wheelLockRef = useRef(0);
  const [sport, setSport] = useState<CardSport>("nba");
  const [selectedBySport, setSelectedBySport] = useState<Record<CardSport, number>>({
    nba: 0,
    football: 0,
  });
  const [dragOffset, setDragOffset] = useState(0);
  const [inspectCard, setInspectCard] = useState<SportsCard | null>(null);
  const [face, setFace] = useState<"front" | "back">("front");
  const [flipSignal, setFlipSignal] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [railStep, setRailStep] = useState(220);
  const cards = useMemo(() => getCardsBySport(sport), [sport]);
  const activeIndex = selectedBySport[sport];
  const activeCard = cards[activeIndex] ?? cards[0];

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
      if (width <= 640) {
        setRailStep(Math.min(270, Math.max(190, width * 0.56)));
      } else if (width <= 1024) {
        setRailStep(Math.min(280, Math.max(220, width * 0.28)));
      } else {
        setRailStep(Math.min(270, Math.max(205, width * 0.17)));
      }
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
      inspectorRef.current?.querySelector<HTMLElement>("button")?.focus();
    });
    return () => {
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [inspectCard]);

  const closeInspect = useCallback(() => {
    setInspectCard(null);
    setFace("front");
    setShowInfo(false);
  }, []);

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
      setSelectedBySport((current) => ({ ...current, [sport]: clamped }));
      setDragOffset(0);
    },
    [cards.length, sport],
  );

  const changeSport = (nextSport: CardSport) => {
    if (nextSport === sport) return;
    setSport(nextSport);
    setDragOffset(0);
  };

  const openInspect = useCallback((card: SportsCard, trigger?: HTMLElement | null) => {
    returnFocusRef.current = trigger ?? (document.activeElement as HTMLElement | null);
    setInspectCard(card);
    setFace("front");
    setShowInfo(false);
  }, []);

  const finishRailGesture = (event?: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (event && gesture.pointerId !== event.pointerId) return;

    const elapsed = Math.max(16, performance.now() - gesture.startedAt);
    const velocity = (gesture.lastX - gesture.startX) / elapsed;
    let step = Math.round(-dragOffset / railStep);
    if (Math.abs(velocity) > 0.45) step += velocity < 0 ? 1 : -1;
    step = Math.max(-2, Math.min(2, step));

    if (gesture.moved && step !== 0) changeIndex(activeIndex + step);
    else if (!gesture.moved) {
      if (gesture.targetIndex !== activeIndex) changeIndex(gesture.targetIndex);
      else openInspect(cards[gesture.targetIndex], event?.currentTarget);
    } else setDragOffset(0);

    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    gestureRef.current = {
      pointerId: null,
      startX: 0,
      lastX: 0,
      startedAt: 0,
      moved: false,
      targetIndex: 0,
    };
  };

  const handleRailPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || gestureRef.current.pointerId !== null) return;
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      startedAt: performance.now(),
      moved: false,
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
    const delta = event.clientX - gesture.startX;
    if (Math.abs(delta) > DRAG_THRESHOLD) gesture.moved = true;
    gesture.lastX = event.clientX;
    setDragOffset(delta);
  };

  const handleRailPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    delete event.currentTarget.dataset.dragging;
    finishRailGesture(event);
  };

  const handleRailWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey) return;
    const dominant = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(dominant) < 3) return;
    if (
      (dominant < 0 && activeIndex === 0) ||
      (dominant > 0 && activeIndex === cards.length - 1)
    ) {
      return;
    }
    event.preventDefault();
    const now = performance.now();
    if (now < wheelLockRef.current) return;
    wheelLockRef.current = now + 260;
    changeIndex(activeIndex + (dominant > 0 ? 1 : -1));
  };

  const handleRailKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      changeIndex(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      changeIndex(event.key === "Home" ? 0 : cards.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openInspect(activeCard);
    }
  };

  const galleryTheme: GalleryTheme = {
    "--active-color": activeCard.primary,
    "--active-accent": activeCard.accent,
    "--active-secondary": activeCard.secondary,
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
      ref={rootRef}
      className={styles.page}
      style={galleryTheme}
      data-inspecting={inspectCard ? "true" : "false"}
    >
      <div className={styles.ambientGlow} aria-hidden="true" />
      <div className={styles.roomGrain} aria-hidden="true" />

      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Back to profile index">
          <span className={styles.brandMark}>GGG</span>
          <span>
            CARD ARCHIVE
            <small>DIGITAL COLLECTION</small>
          </span>
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
              <span>{item === "nba" ? "01" : "02"}</span>
              {item === "nba" ? "NBA" : "FOOTBALL"}
            </button>
          ))}
        </div>

        <div className={styles.headerMeta}>
          <p>
            <span>{String(cards.length).padStart(2, "0")} CARDS</span>
            <strong>CURATED SET</strong>
          </p>
          <span className={styles.liveDot} aria-hidden="true" />
        </div>
      </header>

      <section className={styles.collection} aria-labelledby="collection-title">
        <div className={styles.collectionIntro}>
          <p>PLAYER CARD ARCHIVE / VOL. 01</p>
          <h1 id="collection-title">
            HOLD THE
            <span>HIGHLIGHT.</span>
          </h1>
        </div>

        <div
          className={styles.railViewport}
          tabIndex={0}
          role="listbox"
          aria-label={`${sport === "nba" ? "NBA" : "Football"} player cards`}
          aria-activedescendant={`rail-card-${activeCard.id}`}
          onPointerDown={handleRailPointerDown}
          onPointerMove={handleRailPointerMove}
          onPointerUp={handleRailPointerEnd}
          onPointerCancel={handleRailPointerEnd}
          onLostPointerCapture={() => {
            if (gestureRef.current.pointerId !== null) finishRailGesture();
          }}
          onWheel={handleRailWheel}
          onKeyDown={handleRailKeyDown}
        >
          <div className={styles.rail}>
            {cards.map((card, index) => {
              const offset = index - activeIndex;
              const visualOffset = offset + dragOffset / railStep;
              const distance = Math.min(3, Math.abs(visualOffset));
              const railStyle: RailCardStyle = {
                "--card-x": `${visualOffset * railStep}px`,
                "--card-distance": distance,
                "--card-scale": Math.max(0.72, 1 - distance * 0.12),
                "--card-opacity": Math.max(0.28, 1 - distance * 0.25),
                "--card-z": 20 - Math.round(distance * 3),
                "--card-rotate": `${Math.max(-13, Math.min(13, visualOffset * -5.5))}deg`,
              };
              const isActive = index === activeIndex;

              return (
                <button
                  id={`rail-card-${card.id}`}
                  key={card.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  aria-label={`${card.player}, ${card.year} ${card.maker} ${card.series}`}
                  className={`${styles.railCard} ${isActive ? styles.railCardActive : ""}`}
                  style={railStyle}
                  data-card-index={index}
                  tabIndex={-1}
                >
                  <SportsCardArtwork
                    card={card}
                    priority={index === 0}
                    sizes="(max-width: 640px) 62vw, (max-width: 1024px) 30vw, 250px"
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.activeCaption} aria-live="polite">
          <span>
            {String(activeIndex + 1).padStart(2, "0")} / {String(cards.length).padStart(2, "0")}
          </span>
          <div>
            <strong>{activeCard.player}</strong>
            <p>
              {activeCard.year} · {activeCard.maker} {activeCard.series} · {activeCard.parallel}
            </p>
          </div>
          <button type="button" onClick={(event) => openInspect(activeCard, event.currentTarget)}>
            INSPECT CARD
            <ArrowLeft aria-hidden="true" />
          </button>
        </div>

        <div className={styles.railControls}>
          <button
            type="button"
            aria-label="Previous card"
            disabled={activeIndex === 0}
            onClick={() => changeIndex(activeIndex - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <span>
            {cards.map((card, index) => (
              <button
                key={card.id}
                type="button"
                className={index === activeIndex ? styles.railDotActive : undefined}
                aria-label={`Select ${card.player}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => changeIndex(index)}
              />
            ))}
          </span>
          <button
            type="button"
            aria-label="Next card"
            disabled={activeIndex === cards.length - 1}
            onClick={() => changeIndex(activeIndex + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>
          <Rotate3D aria-hidden="true" />
          DRAG TO BROWSE · CLICK TO INSPECT
        </p>
          <p>
            TOPPS / PANINI · DIGITAL EDITIONS ·{" "}
            <a href="/media/cards/ATTRIBUTION.md" target="_blank" rel="noreferrer">
              MEDIA CREDITS
            </a>
          </p>
      </footer>

      {inspectCard ? (
        <section
          ref={inspectorRef}
          className={styles.inspector}
          aria-label={`Inspecting ${inspectCard.player} card`}
          role="dialog"
          aria-modal="true"
          onKeyDown={handleInspectorKeyDown}
        >
          <div className={styles.inspectorBackdrop} aria-hidden="true" />
          <header className={styles.inspectorHeader}>
            <button type="button" className={styles.backButton} onClick={closeInspect}>
              <ArrowLeft aria-hidden="true" />
              BACK TO COLLECTION
            </button>
            <p>
              <Sparkles aria-hidden="true" />
              {face.toUpperCase()} FACE · LIVE FOIL
            </p>
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

            <aside
              className={`${styles.cardDetails} ${showInfo ? styles.cardDetailsOpen : ""}`}
            >
              <div className={styles.detailIndex}>
                <span>{inspectCard.sport === "nba" ? "NBA" : "FIFA"}</span>
                <strong>#{inspectCard.cardNumber}</strong>
              </div>

              <p className={styles.detailEyebrow}>
                {inspectCard.year} {inspectCard.maker} · {inspectCard.rarity}
              </p>
              <h2>
                <span>{inspectCard.givenName}</span>
                {inspectCard.familyName}
              </h2>
              <p className={styles.detailTeam}>
                {inspectCard.team} · {inspectCard.position} · #{inspectCard.number}
              </p>

              <dl className={styles.detailList}>
                <div>
                  <dt>SPORT</dt>
                  <dd>{inspectCard.sport === "nba" ? "BASKETBALL" : "FOOTBALL"}</dd>
                </div>
                <div>
                  <dt>SERIES</dt>
                  <dd>{inspectCard.series}</dd>
                </div>
                <div>
                  <dt>PARALLEL</dt>
                  <dd>{inspectCard.parallel}</dd>
                </div>
                <div>
                  <dt>SERIAL</dt>
                  <dd>{inspectCard.serial}</dd>
                </div>
                <div>
                  <dt>NATION</dt>
                  <dd>{inspectCard.nation}</dd>
                </div>
              </dl>

              <div className={styles.inspectActions}>
                <button
                  type="button"
                  className={styles.flipButton}
                  onClick={() => setFlipSignal((current) => current + 1)}
                >
                  <FlipHorizontal2 aria-hidden="true" />
                  FLIP CARD
                  <span>F</span>
                </button>
                <button type="button" onClick={closeInspect}>
                  RETURN
                </button>
              </div>

              <p className={styles.inspectHint}>
                <Rotate3D aria-hidden="true" />
                DRAG ANYWHERE ON THE CARD · DOUBLE CLICK TO FLIP
              </p>
            </aside>
          </div>

          <button
            type="button"
            className={styles.mobileInfoButton}
            aria-expanded={showInfo}
            onClick={() => setShowInfo((current) => !current)}
          >
            <Info aria-hidden="true" />
            {showInfo ? "CLOSE INFO" : "CARD INFO"}
          </button>
        </section>
      ) : null}
    </main>
  );
}
