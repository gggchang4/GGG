import styles from "@/components/home/home.module.css";

export function StaticGlassLens({
  isSelectMode = false,
}: {
  isSelectMode?: boolean;
}) {
  return (
    <div
      className={`${styles.staticLens} ${
        isSelectMode ? styles.staticLensSelect : ""
      }`}
      aria-hidden="true"
    >
      <span className={styles.staticLensSignature}>
        <span>GGG</span>
        <span>Cheese</span>
      </span>
      <span className={styles.staticLensRim} />
      <span className={styles.staticLensGlow} />
    </div>
  );
}
