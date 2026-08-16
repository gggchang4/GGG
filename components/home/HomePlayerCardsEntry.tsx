import Link from "next/link";
import styles from "@/components/home/home-player-cards-entry.module.css";

export function HomePlayerCardsEntry() {
  return (
    <Link
      href="/cards"
      className={styles.entry}
      aria-label="Open the player card collection for NBA and football cards"
    >
      <span className={styles.cardFrame} aria-hidden="true">
        <span className={styles.card}>
          <span className={styles.cardNumber}>01</span>
          <span className={styles.cardEdition}>CHROME</span>
          <span className={styles.playerPortrait}>
            <span className={styles.playerHead} />
            <span className={styles.playerBody} />
            <span className={styles.ball} />
          </span>
          <span className={styles.cardName}>ALL STAR</span>
          <span className={styles.cardFoil} />
        </span>
      </span>

      <span className={styles.copy} aria-hidden="true">
        <small>New collection</small>
        <strong>Player cards</strong>
        <span>NBA · Football · View archive</span>
      </span>

      <span className={styles.arrow} aria-hidden="true">
        ↗
      </span>
    </Link>
  );
}
