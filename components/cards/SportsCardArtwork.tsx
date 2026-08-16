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

type CardTheme = CSSProperties & Record<`--${string}`, string | number>;

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
  const finishSeed = card.finishSeed ?? 17;
  const optics = card.optics;
  const theme: CardTheme = {
    "--card-primary": card.primary,
    "--card-secondary": card.secondary,
    "--card-accent": card.accent,
    "--finish-seed": finishSeed,
    "--finish-hue": `${optics?.hue ?? finishSeed % 360}deg`,
    "--finish-secondary-hue": `${optics?.secondaryHue ?? (finishSeed + 148) % 360}deg`,
    "--finish-phase": `${optics?.phase ?? finishSeed % 360}deg`,
    "--finish-angle": `${optics?.angle ?? (finishSeed >>> 4) % 180}deg`,
    "--finish-scale-x": `${optics?.scaleX ?? 82 + (finishSeed % 47)}px`,
    "--finish-scale-y": `${optics?.scaleY ?? 96 + ((finishSeed >>> 3) % 53)}px`,
    "--finish-micro-scale": `${optics?.microScale ?? 18 + ((finishSeed >>> 7) % 19)}px`,
    "--finish-offset-x": `${optics?.offsetX ?? (finishSeed >>> 9) % 100}%`,
    "--finish-offset-y": `${optics?.offsetY ?? (finishSeed >>> 15) % 100}%`,
    "--finish-intensity": optics?.intensity ?? 0.62,
    "--finish-spectral": optics?.spectral ?? 0.62,
    "--finish-contrast": optics?.contrast ?? 1.16,
    "--finish-gloss": optics?.gloss ?? 0.68,
    "--finish-roughness": optics?.roughness ?? 0.34,
    "--finish-relief": optics?.relief ?? 0.56,
    "--finish-fresnel": optics?.fresnel ?? 0.72,
    "--finish-sparkle": optics?.sparkle ?? 0.42,
    "--finish-dispersion": optics?.dispersion ?? 0.5,
    "--finish-anisotropy": optics?.anisotropy ?? 0.4,
    "--finish-drift": optics?.drift ?? 1,
    "--finish-blend": optics?.blend ?? "color-dodge",
    "--finish-etch-blend": optics?.etchBlend ?? "screen",
  };
  const src = face === "front" ? card.frontImage : card.backImage;
  const foilMaskStyle = face === "front" ? createAlphaMaskStyle(card.foilMaskImage) : undefined;
  const autographMaskStyle = face === "front" ? createAlphaMaskStyle(card.autographMaskImage) : undefined;

  return (
    <div
      className={`${styles.cardArtwork} ${face === "back" ? styles.cardBackArtwork : ""}`}
      style={theme}
      data-foil={face === "front" ? card.foil : "paper"}
      data-optical-profile={face === "front" ? optics?.profile : undefined}
      data-pattern={face === "front" ? optics?.pattern : undefined}
      data-trajectory={face === "front" ? optics?.trajectory : undefined}
      data-foil-mask={face === "front" ? card.foilMask : undefined}
      data-autograph={face === "front" && card.autographed ? card.autographMask : undefined}
      data-card={card.id}
      data-maker={card.maker.toLowerCase()}
      data-series={card.seriesId}
      data-sport={card.sport}
      data-scan={card.scanProvenance ?? "archive-scan"}
    >
      <Image
        src={src}
        alt={face === "front" ? `${card.player} ${card.year} ${card.series} ${card.parallel}` : `${card.player} physical card back`}
        fill
        priority={priority}
        loading="eager"
        fetchPriority={priority ? "high" : undefined}
        sizes={sizes}
        className={styles.scanImage}
        draggable={false}
      />

      {face === "front" && effects ? (
        <>
          <span className={styles.foilDiffraction} style={foilMaskStyle} aria-hidden="true" />
          <span className={styles.foilEtching} style={foilMaskStyle} aria-hidden="true" />
          <span className={styles.foilRelief} style={foilMaskStyle} aria-hidden="true" />
          <span className={styles.foilMicrotexture} style={foilMaskStyle} aria-hidden="true" />
          <span className={styles.foilSparkle} style={foilMaskStyle} aria-hidden="true" />
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
