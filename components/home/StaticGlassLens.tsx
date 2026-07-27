import styles from "@/components/home/home.module.css";

export function StaticGlassLens() {
  return (
    <div className={styles.staticLens} aria-hidden="true">
      <span className={styles.staticLensRim} />
      <span className={styles.staticLensGlow} />
    </div>
  );
}
