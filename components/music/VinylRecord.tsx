"use client";

import Image from "next/image";
import gsap from "gsap";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type RefObject,
} from "react";
import type { VinylAlbum } from "@/data/records";
import styles from "@/components/music/vinyl-record.module.css";

export type VinylRecordVariant = "floating" | "platter";

export type VinylRecordProps = {
  album: VinylAlbum;
  playing?: boolean;
  /** Override the material's native RPM when the deck speed is changed. */
  spinDuration?: number;
  /** Share one physical motor angle across the platter, record and strobe. */
  controlledRotation?: boolean;
  rotorRef?: RefObject<HTMLSpanElement | null>;
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
  "--label-background": string;
  "--label-foreground": string;
  "--label-accent": string;
};

export const VinylRecord = memo(function VinylRecord({
  album,
  playing = false,
  spinDuration,
  controlledRotation = false,
  rotorRef,
  className,
  artworkSizes = "(max-width: 768px) 78vw, 560px",
  labelSizes = "180px",
  variant = "floating",
}: VinylRecordProps) {
  const { vinyl } = album;
  const { label } = vinyl;
  const rpm = vinyl.rpm ?? 33.333;
  const internalRotorRef = useRef<HTMLSpanElement>(null);
  const spinTweenRef = useRef<gsap.core.Tween | null>(null);
  const rateTweenRef = useRef<gsap.core.Tween | null>(null);
  const resolvedSpinDuration = spinDuration ?? 60 / rpm;
  const recordStyle: VinylRecordStyle = {
    "--vinyl-primary": vinyl.primary,
    "--vinyl-secondary": vinyl.secondary ?? album.spine,
    "--vinyl-accent": vinyl.accent ?? album.edge,
    "--vinyl-spin-duration": `${resolvedSpinDuration}s`,
    "--label-background": label.background,
    "--label-foreground": label.foreground,
    "--label-accent": label.accent ?? vinyl.accent ?? album.edge,
  };
  const rootClassName = [styles.record, className].filter(Boolean).join(" ");
  const hasDiscArtwork =
    vinyl.artwork === "picture-disc" || vinyl.artwork === "half-picture";
  const hasLabelArtwork = label.style === "artwork" || label.style === "heart";
  const bindRotor = useCallback(
    (node: HTMLSpanElement | null) => {
      internalRotorRef.current = node;
      if (rotorRef) {
        rotorRef.current = node;
      }
    },
    [rotorRef],
  );

  useLayoutEffect(() => {
    if (controlledRotation) {
      return;
    }

    const rotor = internalRotorRef.current;

    if (!rotor) {
      return;
    }

    const spinTween = gsap.to(rotor, {
      rotation: "+=360",
      duration: 1.8,
      repeat: -1,
      ease: "none",
      paused: false,
    });
    spinTween.timeScale(0);
    spinTweenRef.current = spinTween;

    return () => {
      rateTweenRef.current?.kill();
      spinTween.kill();
      spinTweenRef.current = null;
    };
  }, [controlledRotation]);

  useEffect(() => {
    if (controlledRotation) {
      return;
    }

    const spinTween = spinTweenRef.current;

    if (!spinTween) {
      return;
    }

    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const syncSpinRate = () => {
      const targetRate =
        playing && !motionPreference.matches ? 1.8 / resolvedSpinDuration : 0;
      const currentRate = spinTween.timeScale();

      rateTweenRef.current?.kill();
      rateTweenRef.current = gsap.to(spinTween, {
        timeScale: targetRate,
        duration:
          targetRate === 0 ? 0.9 : targetRate > currentRate ? 0.7 : 0.48,
        ease: targetRate === 0 ? "power3.out" : "power2.out",
        overwrite: true,
      });
    };

    syncSpinRate();
    motionPreference.addEventListener("change", syncSpinRate);

    return () => {
      motionPreference.removeEventListener("change", syncSpinRate);
      rateTweenRef.current?.kill();
    };
  }, [controlledRotation, playing, resolvedSpinDuration]);

  return (
    <span
      className={rootClassName}
      data-kind={vinyl.kind}
      data-artwork={vinyl.artwork}
      data-label-style={label.style}
      data-release-status={vinyl.releaseStatus}
      data-playing={playing ? "true" : "false"}
      data-state={playing ? "playing" : "stopped"}
      data-variant={variant}
      data-vinyl-root
      style={recordStyle}
      aria-hidden="true"
    >
      <span className={styles.castShadow} />

      <span ref={bindRotor} className={styles.rotor} data-rotor>
        <span className={styles.edgeDepth}>
          <span className={styles.edgeReflection} />
          <span className={styles.edgeNotches} />
        </span>

        <span className={styles.discSurface}>
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
                src={label.artwork ?? album.cover}
                alt=""
                fill
                sizes={labelSizes}
                loading="eager"
                draggable={false}
              />
            ) : (
              <span className={styles.blankLabel} />
            )}
            <span className={styles.labelCopy}>
              <small>{label.kicker ?? "SIDE A"}</small>
              <strong>{label.title ?? album.title}</strong>
              <small>{label.subtitle ?? album.artist}</small>
              <em>SIDE A · {rpm === 45 ? "45" : "33⅓"} RPM</em>
            </span>
            <span className={styles.labelVarnish} />
            <span className={styles.labelRing} />
          </span>

          <span className={styles.spindleHole}>
            <span />
          </span>
        </span>
      </span>

      <span className={styles.stationaryShade} />
      <span className={styles.stationaryLight} data-stationary-light>
        <span className={styles.lightFan} />
        <span className={styles.lightStreak} />
        <span className={styles.edgeGlint} />
      </span>
    </span>
  );
});
