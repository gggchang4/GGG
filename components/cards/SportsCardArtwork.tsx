import Image from "next/image";
import type { CSSProperties } from "react";
import type { SportsCard } from "@/data/sportsCards";
import styles from "@/components/cards/sports-cards.module.css";

type SportsCardArtworkProps = {
  card: SportsCard;
  face?: "front" | "back";
  priority?: boolean;
  sizes?: string;
  effects?: boolean;
};

type CardTheme = CSSProperties & {
  "--card-primary": string;
  "--card-secondary": string;
  "--card-accent": string;
};

function createAlphaMaskStyle(src?: string): CSSProperties | undefined {
  if (!src) return undefined;

  return {
    WebkitMaskImage: `url("${src}")`,
    maskImage: `url("${src}")`,
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
  };
}

export function SportsCardArtwork({
  card,
  face = "front",
  priority = false,
  sizes = "(max-width: 640px) 62vw, 240px",
  effects = true,
}: SportsCardArtworkProps) {
  const theme: CardTheme = {
    "--card-primary": card.primary,
    "--card-secondary": card.secondary,
    "--card-accent": card.accent,
  };
  const src = face === "front" ? card.frontImage : card.backImage;
  const foilMaskStyle = face === "front" ? createAlphaMaskStyle(card.foilMaskImage) : undefined;
  const autographMaskStyle = face === "front" ? createAlphaMaskStyle(card.autographMaskImage) : undefined;

  return (
    <div
      className={`${styles.cardArtwork} ${face === "back" ? styles.cardBackArtwork : ""}`}
      style={theme}
      data-foil={face === "front" ? card.foil : "paper"}
      data-foil-mask={face === "front" ? card.foilMask : undefined}
      data-autograph={face === "front" && card.autographed ? card.autographMask : undefined}
      data-card={card.id}
      data-maker={card.maker.toLowerCase()}
      data-series={card.seriesId}
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

      {face === "front" && effects ? (
        <>
          <span className={styles.foilDiffraction} style={foilMaskStyle} aria-hidden="true" />
          <span className={styles.foilEtching} style={foilMaskStyle} aria-hidden="true" />
          <span className={styles.foilGlare} aria-hidden="true" />
          <span className={styles.clearCoat} aria-hidden="true" />
          {card.autographed && autographMaskStyle ? (
            <span className={styles.autographProtection} style={autographMaskStyle} aria-hidden="true">
              <Image src={src} alt="" fill sizes={sizes} draggable={false} />
            </span>
          ) : null}
        </>
      ) : face === "back" && effects ? (
        <>
          <span className={styles.backSatin} aria-hidden="true" />
          <span className={styles.clearCoat} aria-hidden="true" />
        </>
      ) : null}
    </div>
  );
}
