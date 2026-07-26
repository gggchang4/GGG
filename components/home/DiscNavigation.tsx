import Link from "next/link";
import type { ProfileStyleConfig } from "@/data/stylesConfig";
import styles from "@/components/home/home.module.css";

type DiscNavigationProps = {
  profiles: ProfileStyleConfig[];
  isDragging: boolean;
};

export function DiscNavigation({ profiles, isDragging }: DiscNavigationProps) {
  return (
    <nav
      className={`${styles.discNavigation} ${isDragging ? styles.discNavigationHidden : ""}`}
      aria-label="Profile perspectives"
    >
      <div className={styles.discCenterMark} aria-hidden="true">
        <span>Select a</span>
        <strong>Perspective</strong>
        <i />
        <span>Profile index · 2026</span>
      </div>

      <ol className={styles.discEntries}>
        {profiles.slice(0, 3).map((profile, index) => {
          const content = (
            <>
              <span className={styles.entryIndex}>{profile.index}</span>
              <span className={styles.entryName}>{profile.name}</span>
              <span className={styles.entryState}>
                {profile.status === "available" ? "Enter" : "Reserved"}
              </span>
            </>
          );

          return (
            <li
              key={profile.id}
              className={`${styles.discEntry} ${styles[`discEntry${index + 1}`]}`}
            >
              {profile.status === "available" ? (
                <Link href={profile.route} className={styles.entryAction}>
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  className={styles.entryAction}
                  aria-disabled="true"
                  aria-label={`${profile.name} profile, reserved for a future release`}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
