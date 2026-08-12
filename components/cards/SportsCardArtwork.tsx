import Image from "next/image";
import type { CSSProperties } from "react";
import type { SportsCard } from "@/data/sportsCards";
import styles from "@/components/cards/sports-cards.module.css";

type SportsCardArtworkProps = {
  card: SportsCard;
  face?: "front" | "back";
  priority?: boolean;
  sizes?: string;
};

type CardTheme = CSSProperties & {
  "--card-primary": string;
  "--card-secondary": string;
  "--card-accent": string;
};

export function SportsCardArtwork({
  card,
  face = "front",
  priority = false,
  sizes = "(max-width: 640px) 62vw, 240px",
}: SportsCardArtworkProps) {
  const theme: CardTheme = {
    "--card-primary": card.primary,
    "--card-secondary": card.secondary,
    "--card-accent": card.accent,
  };
  const src = face === "front" ? card.frontImage : card.backImage;

  return (
    <div
      className={`${styles.cardArtwork} ${face === "back" ? styles.cardBackArtwork : ""}`}
      style={theme}
      data-foil={face === "front" ? card.foil : "paper"}
      data-autograph={face === "front" && card.autographed ? card.autographMask : undefined}
      data-maker={card.maker.toLowerCase()}
    >
      <Image
        src={src}
        alt={face === "front" ? `${card.player} ${card.year} ${card.series} ${card.parallel}` : `${card.player} card back`}
        fill
        priority={priority}
        sizes={sizes}
        className={styles.scanImage}
        draggable={false}
      />

      {face === "front" ? (
        <>
          <span className={styles.foilDiffraction} aria-hidden="true" />
          <span className={styles.foilEtching} aria-hidden="true" />
          <span className={styles.foilGlare} aria-hidden="true" />
          <span className={styles.clearCoat} aria-hidden="true" />
          {card.autographed ? (
            <span className={styles.autographProtection} aria-hidden="true">
              <Image src={src} alt="" fill sizes={sizes} draggable={false} />
            </span>
          ) : null}
        </>
      ) : (
        <>
          <span className={styles.backSatin} aria-hidden="true" />
          <span className={styles.clearCoat} aria-hidden="true" />
        </>
      )}
    </div>
  );
}
