import Image from "next/image";
import type { CSSProperties } from "react";
import type { VinylAlbum } from "@/data/records";
import styles from "@/components/music/vinyl-record.module.css";

export type VinylRecordVariant = "floating" | "platter";

export type VinylRecordProps = {
  album: VinylAlbum;
  playing?: boolean;
  /** Override the material's native RPM when the deck speed is changed. */
  spinDuration?: number;
  className?: string;
  artworkSizes?: string;
  labelSizes?: string;
  /**
   * `floating` exposes the pressed edge and a lifted shadow. `platter` keeps the
   * profile tight so the record can sit naturally on the turntable mat.
   */
  variant?: VinylRecordVariant;
};

type VinylRecordStyle = CSSProperties & {
  "--vinyl-primary": string;
  "--vinyl-secondary": string;
  "--vinyl-accent": string;
  "--vinyl-spin-duration": string;
};

export function VinylRecord({
  album,
  playing = false,
  spinDuration,
  className,
  artworkSizes = "(max-width: 768px) 78vw, 560px",
  labelSizes = "180px",
  variant = "floating",
}: VinylRecordProps) {
  const { vinyl } = album;
  const rpm = vinyl.rpm ?? 33.333;
  const recordStyle: VinylRecordStyle = {
    "--vinyl-primary": vinyl.primary,
    "--vinyl-secondary": vinyl.secondary ?? album.spine,
    "--vinyl-accent": vinyl.accent ?? album.edge,
    "--vinyl-spin-duration": `${spinDuration ?? 60 / rpm}s`,
  };
  const rootClassName = [styles.record, className].filter(Boolean).join(" ");
  const hasDiscArtwork =
    vinyl.artwork === "picture-disc" || vinyl.artwork === "half-picture";
  const hasLabelArtwork = vinyl.artwork !== "none";

  return (
    <span
      className={rootClassName}
      data-kind={vinyl.kind}
      data-artwork={vinyl.artwork}
      data-playing={playing ? "true" : "false"}
      data-state={playing ? "playing" : "stopped"}
      data-variant={variant}
      style={recordStyle}
      aria-hidden="true"
    >
      <span className={styles.castShadow} />

      <span className={styles.edgeDepth}>
        <span className={styles.edgeReflection} />
        <span className={styles.edgeNotches} />
      </span>

      <span className={styles.rotor} data-rotor>
        <span className={styles.material} />

        {hasDiscArtwork ? (
          <span className={styles.discArtwork}>
            <Image
              src={album.cover}
              alt=""
              fill
              sizes={artworkSizes}
              loading="eager"
              draggable={false}
            />
          </span>
        ) : null}

        {vinyl.artwork === "half-picture" ? (
          <span className={styles.artworkSeam} />
        ) : null}

        <span className={styles.materialTexture} />
        <span className={styles.pressRings} />
        <span className={styles.grooves} />
        <span className={styles.runoutGrooves} />
        <span className={styles.outerLip} />

        <span className={styles.label}>
          {hasLabelArtwork ? (
            <Image
              className={styles.labelArtwork}
              src={album.cover}
              alt=""
              fill
              sizes={labelSizes}
              loading="eager"
              draggable={false}
            />
          ) : (
            <span className={styles.blankLabel} />
          )}
          <span className={styles.labelVarnish} />
          <span className={styles.labelRing} />
        </span>

        <span className={styles.spindleHole}>
          <span />
        </span>
      </span>

      <span className={styles.stationaryLight} data-stationary-light>
        <span className={styles.lightFan} />
        <span className={styles.lightStreak} />
        <span className={styles.edgeGlint} />
        <span className={styles.spindleHighlight} />
      </span>
    </span>
  );
}
