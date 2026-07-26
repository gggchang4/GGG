import styles from "@/components/home/home.module.css";

export function StaticMetalDisc() {
  return (
    <div className={styles.staticDisc} aria-hidden="true">
      <span className={styles.staticDiscRing} />
      <span className={styles.staticDiscCore} />
    </div>
  );
}
