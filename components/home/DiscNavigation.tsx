import type { ProfileStyleConfig } from "@/data/stylesConfig";
import styles from "@/components/home/home.module.css";

type DiscNavigationProps = {
  profiles: ProfileStyleConfig[];
  isActive: boolean;
};

export function DiscNavigation({
  profiles,
  isActive,
}: DiscNavigationProps) {
  return (
    <nav
      id="lens-style-selector"
      className={`${styles.lensSections} ${
        isActive ? styles.lensSectionsActive : ""
      }`}
      aria-label="Profile style sections"
      aria-hidden={!isActive}
    >
      <ol className={styles.lensSectionList}>
        {profiles.slice(0, 3).map((profile, index) => (
          <li key={profile.id}>
            <button
              type="button"
              className={`${styles.lensSection} ${
                styles[`lensSection${index + 1}`]
              }`}
              aria-label={`${profile.name} profile section, link not assigned`}
              aria-disabled="true"
              tabIndex={isActive ? 0 : -1}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onPointerDown={(event) => event.stopPropagation()}
            />
          </li>
        ))}
      </ol>

      <span
        className={`${styles.lensDivider} ${styles.lensDivider1}`}
        aria-hidden="true"
      />
      <span
        className={`${styles.lensDivider} ${styles.lensDivider2}`}
        aria-hidden="true"
      />
      <span
        className={`${styles.lensDivider} ${styles.lensDivider3}`}
        aria-hidden="true"
      />
    </nav>
  );
}
