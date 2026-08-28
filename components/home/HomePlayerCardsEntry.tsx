import Image from "next/image";
import Link from "next/link";
import styles from "@/components/home/home-player-cards-entry.module.css";

export function HomePlayerCardsEntry() {
  return (
    <Link
      href="/cards"
      className={styles.entry}
      aria-label="Open the player card collection for NBA and football cards"
    >
      <span className={styles.cornerCue} aria-hidden="true">
        <span className={styles.cueCard}>
          <span>01</span>
        </span>
        <span className={styles.cueLine} />
        <span className={styles.cueLabel}>Cards</span>
      </span>

      <span className={styles.reveal} aria-hidden="true">
        <span className={styles.cardPreview}>
          <Image
            src="/media/cards/authentic/final/messi-prizm-front.webp"
            alt=""
            fill
            sizes="56px"
            priority
            unoptimized
          />
          <span className={styles.cardGlint} />
        </span>

        <span className={styles.copy}>
          <small>Player archive / 001</small>
          <strong>Cards</strong>
          <span>NBA + Football</span>
        </span>

        <span className={styles.arrow}>↗</span>
      </span>
    </Link>
  );
}
