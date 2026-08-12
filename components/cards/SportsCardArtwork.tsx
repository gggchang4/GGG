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
  "--portrait-position": string;
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
    "--portrait-position": card.objectPosition,
  };
  const makerLogo =
    card.maker === "Topps"
      ? "/media/cards/brands/topps.png"
      : card.series === "PRIZM" || card.series === "PRIZM WORLD CUP"
        ? "/media/cards/brands/panini-prizm.png"
        : "/media/cards/brands/panini.png";

  if (face === "back") {
    return (
      <div
        className={`${styles.cardArtwork} ${styles.cardBackArtwork}`}
        style={theme}
      >
        <div className={styles.backSunburst} aria-hidden="true" />

        <header className={styles.backHeader}>
          <span>{card.year}</span>
          <span className={styles.backBrandLogo}>
            <Image src={makerLogo} alt={card.maker} fill sizes="72px" />
          </span>
          <span>#{card.cardNumber}</span>
        </header>

        <div className={styles.backIdentity}>
          <p>{card.givenName}</p>
          <h3>{card.familyName}</h3>
          <span>
            {card.team} · {card.position}
          </span>
        </div>

        <div className={styles.backPortrait}>
          <Image
            src={card.image}
            alt=""
            fill
            sizes={sizes}
            className={styles.cardImage}
          />
        </div>

        <dl className={styles.backStats}>
          {card.stats.map((stat, index) => (
            <div key={stat}>
              <dt>{String(index + 1).padStart(2, "0")}</dt>
              <dd>{stat}</dd>
            </div>
          ))}
        </dl>

        <div className={styles.backCopy}>
          <p>
            DIGITAL COLLECTOR SERIES · AUTHENTIC PLAYER IMAGE · ARCHIVE EDITION
          </p>
          <span>{card.serial}</span>
        </div>

        <div className={styles.backLegal}>
          <span>GGG CARD ARCHIVE</span>
          <span>PLAYER CARD · NOT FOR RESALE</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.cardArtwork} ${styles.cardFrontArtwork}`}
      style={theme}
      data-foil={card.foil}
      data-maker={card.maker.toLowerCase()}
      data-sport={card.sport}
    >
      <Image
        src={card.image}
        alt={card.player}
        fill
        priority={priority}
        sizes={sizes}
        className={styles.cardImage}
      />

      <div className={styles.portraitGrade} aria-hidden="true" />
      <div className={styles.cardFrameGraphic} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <header className={styles.cardTopline}>
        <span className={styles.cardMaker}>
          <Image src={makerLogo} alt={card.maker} fill sizes="64px" />
        </span>
        <span>{card.year}</span>
        <strong>{card.rarity}</strong>
      </header>

      <span className={styles.leagueMark} aria-hidden="true">
        <Image
          src={
            card.sport === "nba"
              ? "/media/cards/brands/nba.png"
              : "/media/cards/brands/champions-league.png"
          }
          alt=""
          fill
          sizes="42px"
        />
      </span>

      <div className={styles.cardNumberMark} aria-hidden="true">
        {card.number}
      </div>

      <div className={styles.cardSeries}>
        <span>{card.series}</span>
        <strong>{card.parallel}</strong>
      </div>

      <footer className={styles.cardNameplate}>
        <div>
          <span>{card.givenName}</span>
          <strong>{card.familyName}</strong>
        </div>
        <p>
          <span>{card.position}</span>
          <strong>{card.team}</strong>
        </p>
      </footer>

      <div className={styles.cardSerial}>
        <span>#{card.cardNumber}</span>
        <strong>{card.serial}</strong>
      </div>

      <div className={styles.foilField} aria-hidden="true" />
      <div className={styles.foilGlare} aria-hidden="true" />
      <div className={styles.clearCoat} aria-hidden="true" />
    </div>
  );
}
