import Link from "next/link";
import type { CSSProperties, PointerEvent } from "react";
import type { ProfileStyleConfig } from "@/data/stylesConfig";
import styles from "@/components/home/home.module.css";

type DiscNavigationProps = {
  profiles: readonly ProfileStyleConfig[];
  isActive: boolean;
  isInteractive: boolean;
};

type SectorStyle = CSSProperties & {
  "--section-label-x": string;
  "--section-label-y": string;
  "--section-shift-x": string;
  "--section-shift-y": string;
};

const FULL_CIRCLE = 360;
const FIRST_SECTOR_CENTER = -90;
const MAX_ARC_STEP = 15;
const LABEL_RADIUS = 28;

function getSectorAngles(index: number, count: number) {
  const sweep = FULL_CIRCLE / count;
  const center = FIRST_SECTOR_CENTER + index * sweep;

  return {
    center,
    start: center - sweep / 2,
    sweep,
  };
}

function getCirclePoint(angle: number) {
  const radians = (angle * Math.PI) / 180;
  const x = 50 + Math.cos(radians) * 50;
  const y = 50 + Math.sin(radians) * 50;

  return `${x.toFixed(3)}% ${y.toFixed(3)}%`;
}

function getSectorStyle(index: number, count: number): SectorStyle {
  const { center, start, sweep } = getSectorAngles(index, count);
  const arcSteps = Math.max(2, Math.ceil(sweep / MAX_ARC_STEP));
  const arcPoints = Array.from({ length: arcSteps + 1 }, (_, pointIndex) => {
    const angle = start + (sweep * pointIndex) / arcSteps;
    return getCirclePoint(angle);
  });
  const centerRadians = (center * Math.PI) / 180;

  return {
    clipPath: `polygon(50% 50%, ${arcPoints.join(", ")})`,
    "--section-label-x": `${(
      50 +
      Math.cos(centerRadians) * LABEL_RADIUS
    ).toFixed(3)}%`,
    "--section-label-y": `${(
      50 +
      Math.sin(centerRadians) * LABEL_RADIUS
    ).toFixed(3)}%`,
    "--section-shift-x": `${(Math.cos(centerRadians) * 0.55).toFixed(3)}rem`,
    "--section-shift-y": `${(Math.sin(centerRadians) * 0.55).toFixed(3)}rem`,
  };
}

export function DiscNavigation({
  profiles,
  isActive,
  isInteractive,
}: DiscNavigationProps) {
  const sectionCount = profiles.length;

  return (
    <nav
      id="lens-style-selector"
      className={`${styles.lensSections} ${
        isActive ? styles.lensSectionsActive : ""
      } ${
        isInteractive ? styles.lensSectionsInteractive : ""
      }`}
      aria-label="Profile style sections"
      aria-hidden={!isInteractive}
    >
      <ol className={styles.lensSectionList}>
        {profiles.map((profile, index) => {
          const sectorStyle = getSectorStyle(index, sectionCount);
          const interactionProps = {
            className: styles.lensSection,
            style: sectorStyle,
            tabIndex: isInteractive ? 0 : -1,
            onPointerDown: (event: PointerEvent) => event.stopPropagation(),
          };
          const label = (
            <span className={styles.lensSectionLabel} aria-hidden="true">
              <span>{profile.index}</span>
              <strong>{profile.name}</strong>
            </span>
          );

          return (
            <li key={profile.id}>
              {profile.status === "available" ? (
                <Link
                  {...interactionProps}
                  href={profile.route}
                  aria-label={`Open ${profile.name} profile`}
                  onClick={(event) => event.stopPropagation()}
                >
                  {label}
                </Link>
              ) : (
                <button
                  {...interactionProps}
                  type="button"
                  aria-label={`${profile.name} profile, not available yet`}
                  aria-disabled="true"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  {label}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {sectionCount > 1
        ? profiles.map((profile, index) => {
            const { start } = getSectorAngles(index, sectionCount);

            return (
              <span
                key={`${profile.id}-divider`}
                className={styles.lensDivider}
                style={{ transform: `rotate(${start}deg)` }}
                aria-hidden="true"
              />
            );
          })
        : null}
    </nav>
  );
}
