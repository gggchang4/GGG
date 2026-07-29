import Link from "next/link";
import styles from "@/components/profiles/profile-route-stub.module.css";

type ProfileRouteStubProps = {
  index: string;
  title: string;
  route: string;
};

export function ProfileRouteStub({
  index,
  title,
  route,
}: ProfileRouteStubProps) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} aria-label="Back to profile index">
          <span>GGG</span>
          <span>Profile</span>
        </Link>
        <p className={styles.status}>
          <span aria-hidden="true" />
          Route connected
        </p>
      </header>

      <section className={styles.canvas} aria-labelledby="profile-style-title">
        <p className={styles.eyebrow}>{index} / Profile study</p>
        <h1 id="profile-style-title" className={styles.title}>
          {title}
        </h1>
        <p className={styles.note}>Empty canvas. Visual system follows next.</p>
        <code className={styles.route}>{route}</code>
      </section>

      <footer className={styles.footer}>
        <Link href="/" className={styles.backLink}>
          <span aria-hidden="true">↙</span>
          Back to lens
        </Link>
        <p>Scaffold / 01</p>
      </footer>
    </main>
  );
}
