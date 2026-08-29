"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import styles from "@/components/home/home-player-archive-entry.module.css";

const PLAYER_CARDS = [
  {
    id: "kyrie",
    name: "Kyrie Irving",
    image:
      "/media/cards/special/nba/nba-kyrie-irving-cosmic-propulsion-refractor-11-front.webp",
  },
  {
    id: "neymar",
    name: "Neymar Jr.",
    image:
      "/media/cards/special/football/football-neymar-prizm-gold-lazer-25-front.webp",
  },
] as const;

const EXIT_DURATION_MS = 620;

export function HomePlayerCardsEntry() {
  const router = useRouter();
  const navigationTimerRef = useRef<number | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(
    () => () => {
      if (navigationTimerRef.current !== null) {
        window.clearTimeout(navigationTimerRef.current);
      }
    },
    [],
  );

  const handlePointerMove = (event: PointerEvent<HTMLAnchorElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;

    event.currentTarget.style.setProperty("--cards-shift-x", `${x * 5}px`);
    event.currentTarget.style.setProperty("--cards-shift-y", `${y * 3}px`);
    event.currentTarget.style.setProperty("--sheen-x", `${50 + x * 34}%`);
  };

  const resetPointerPosition = (event: PointerEvent<HTMLAnchorElement>) => {
    event.currentTarget.style.setProperty("--cards-shift-x", "0px");
    event.currentTarget.style.setProperty("--cards-shift-y", "0px");
    event.currentTarget.style.setProperty("--sheen-x", "50%");
  };

  const handleNavigate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    event.preventDefault();

    if (isLeaving) {
      return;
    }

    setIsLeaving(true);
    navigationTimerRef.current = window.setTimeout(() => {
      router.push("/cards");
    }, EXIT_DURATION_MS);
  };

  return (
    <Link
      href="/cards"
      className={styles.entry}
      data-leaving={isLeaving}
      aria-label="Open the player card archive featuring Kyrie Irving and Neymar Jr."
      onClick={handleNavigate}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointerPosition}
    >
      <span className={styles.cornerCue} aria-hidden="true">
        <span className={styles.cueCards}>
          <span />
          <span />
        </span>
        <span className={styles.cueLine} />
        <span className={styles.cueLabel}>Player archive</span>
        <span className={styles.cueCount}>02</span>
      </span>

      <span className={styles.reveal} aria-hidden="true">
        <span className={styles.cardDeck}>
          {PLAYER_CARDS.map((card) => (
            <span
              key={card.id}
              className={`${styles.playerCard} ${styles[card.id]}`}
            >
              <Image
                src={card.image}
                alt={card.name}
                fill
                sizes="80px"
                priority
                unoptimized
              />
              <span className={styles.cardSheen} />
            </span>
          ))}
        </span>

        <span className={styles.archiveMeta}>
          <small>Selected players / 02</small>
          <strong>Kyrie × Neymar</strong>
          <span>Open card archive</span>
        </span>

        <span className={styles.arrow}>↗</span>
      </span>

      <span className={styles.transitionCurtain} aria-hidden="true" />
    </Link>
  );
}
