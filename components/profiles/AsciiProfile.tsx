"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Download,
  Pause,
  Play,
  Radio,
  Sparkles,
} from "lucide-react";
import { profileData } from "@/data/profileData";
import {
  AsciiField,
  asciiPalettes,
  type AsciiFieldHandle,
  type AsciiScene,
} from "@/components/profiles/AsciiField";
import { AsciiAlbumReveal } from "@/components/profiles/AsciiAlbumReveal";
import styles from "@/components/profiles/ascii-profile.module.css";

const programs: readonly {
  id: AsciiScene;
  index: string;
  label: string;
}[] = [
  { id: "self", index: "01", label: "Self" },
  { id: "field", index: "02", label: "Field" },
  { id: "orbit", index: "03", label: "Orbit" },
  { id: "noise", index: "04", label: "Noise" },
] as const;

const sections = [
  { href: "#top", label: "Portrait" },
  { href: "#about", label: "Source" },
  { href: "#timeline", label: "Log" },
  { href: "#coordinates", label: "Taste" },
  { href: "#silhouette", label: "Silhouette" },
] as const;

const densityLabels = ["COARSE", "MEDIUM", "FINE"] as const;

const staticAsciiFallback = String.raw`
                     .,:;irsXA253hMHGS#9B&@
                 ,iXG#&@@@@@@@@@@@@@@@@&9HL:
              .rH&@@@&9SHM352AXsri;:,:i5B@@@G;
             iB@@@HXi,.              .:sH@@@@9:
            r@@@Gs.      .,:;;;:,.      iB@@@M
           :@@@H.     :XH#&@@@@&9G1,     5@@@#
           i@@@5     s@@@BHi::i5#@@@X.   r@@@&
           :@@@H.    H@@@X  ..  r@@@B.   5@@@#
            r@@@Gs.  :G@@@H1ii1H@@@9:  .iB@@@M
             iB@@@HXi,.:X9&@@@@&9G1,.:sH@@@@9:
              .rH&@@@&9SHM352253MH9&@@@G;
                 ,iXG#&@@@@ GGG @@@@&9HL:
                     .,:; CHEESE ;:,.`;

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);

    return () => media.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

export function AsciiProfile() {
  const fieldRef = useRef<AsciiFieldHandle>(null);
  const rootRef = useRef<HTMLElement>(null);
  const [scene, setScene] = useState<AsciiScene>("self");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [density, setDensity] = useState(1);
  const [paused, setPaused] = useState(false);
  const [activeSection, setActiveSection] = useState("top");
  const reducedMotion = useReducedMotion();
  const palette = asciiPalettes[paletteIndex];

  const setProgram = useCallback((nextScene: AsciiScene) => {
    setScene(nextScene);
    fieldRef.current?.injectPulse();
  }, []);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    root.dataset.revealEnhanced = "true";
    const sceneSections = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ascii-scene]"),
    );
    const revealItems = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reveal]"),
    );

    const sceneObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) {
          return;
        }

        const element = visible.target as HTMLElement;
        const nextScene = element.dataset.asciiScene as
          | AsciiScene
          | undefined;
        const nextSection = element.id;

        if (nextScene) {
          setScene(nextScene);
        }

        if (nextSection) {
          setActiveSection(nextSection);
        }
      },
      {
        rootMargin: "-28% 0px -34% 0px",
        threshold: [0.05, 0.25, 0.5, 0.8],
      },
    );

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          (entry.target as HTMLElement).dataset.visible = "true";
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.12,
      },
    );

    sceneSections.forEach((section) => sceneObserver.observe(section));
    revealItems.forEach((item) => revealObserver.observe(item));

    return () => {
      sceneObserver.disconnect();
      revealObserver.disconnect();
      delete root.dataset.revealEnhanced;
    };
  }, []);

  const rootStyle = useMemo(
    () =>
      ({
        "--ascii-accent": palette.colors[3],
        "--ascii-cyan": palette.colors[4],
        "--ascii-hot": palette.colors[0],
        "--ascii-violet": palette.colors[6],
      }) as CSSProperties,
    [palette],
  );

  const cyclePalette = () => {
    setPaletteIndex((current) => (current + 1) % asciiPalettes.length);
    fieldRef.current?.injectPulse(0.78, 0.22);
  };

  const cycleDensity = () => {
    setDensity((current) => (current + 1) % densityLabels.length);
    fieldRef.current?.injectPulse(0.22, 0.78);
  };

  return (
    <main
      ref={rootRef}
      className={styles.page}
      style={rootStyle}
      data-paused={paused || reducedMotion ? "true" : "false"}
    >
      <div className={styles.canvasLayer}>
        <pre className={styles.canvasFallback} aria-hidden="true">
          {staticAsciiFallback}
        </pre>
        <AsciiField
          ref={fieldRef}
          density={density}
          palette={palette}
          paused={paused}
          reducedMotion={reducedMotion}
          scene={scene}
        />
      </div>
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />

      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} aria-label="Back to profile index">
          <span className={styles.liveDot} aria-hidden="true" />
          <strong>GGG</strong>
          <span>PROFILE / 03</span>
        </Link>

        <nav className={styles.navigation} aria-label="ASCII profile sections">
          {sections.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={
                activeSection === item.href.slice(1)
                  ? styles.navigationActive
                  : undefined
              }
              aria-current={
                activeSection === item.href.slice(1) ? "location" : undefined
              }
            >
              {item.label}
            </a>
          ))}
        </nav>

        <p className={styles.headerStatus}>
          <Radio aria-hidden="true" />
          LIVE SIGNAL
        </p>
      </header>

      <section
        id="top"
        className={styles.hero}
        data-ascii-scene="self"
        aria-labelledby="ascii-profile-title"
      >
        <div className={styles.heroMeta}>
          <p>
            <span>SUBJECT</span>
            {profileData.name}
          </p>
          <p>
            <span>COORDINATES</span>
            Wuhan / CN
          </p>
        </div>

        <div className={styles.heroSignal} aria-hidden="true">
          <span>INPUT / POINTER</span>
          <span>MOVE TO BEND THE FIELD</span>
        </div>

        <h1 id="ascii-profile-title" className={styles.heroTitle}>
          <span>GGG</span>
          <strong>CHEESE</strong>
        </h1>

        <p className={styles.heroRole}>
          <span>{profileData.role}</span>
          <strong>{profileData.headline}</strong>
        </p>

        <a href="#about" className={styles.scrollCue}>
          <ArrowDown aria-hidden="true" />
          <span>Enter source</span>
        </a>

        <p className={styles.mobileDockHint}>Swipe controls ↔</p>

        <div className={styles.controlDock} aria-label="ASCII field controls">
          <div className={styles.programs} role="group" aria-label="Field program">
            {programs.map((program) => (
              <button
                key={program.id}
                type="button"
                className={scene === program.id ? styles.programActive : undefined}
                aria-pressed={scene === program.id}
                onClick={() => setProgram(program.id)}
              >
                <span>{program.index}</span>
                {program.label}
              </button>
            ))}
          </div>

          <div className={styles.utilityControls}>
            <button
              type="button"
              aria-label={`Cycle color palette. Current: ${palette.name}`}
              onClick={cyclePalette}
            >
              <Sparkles aria-hidden="true" />
              <span>COLOR</span>
              <strong>{palette.name}</strong>
            </button>
            <button
              type="button"
              aria-label={`Cycle character density. Current: ${densityLabels[density]}`}
              onClick={cycleDensity}
            >
              <span>DENSITY</span>
              <strong>{densityLabels[density]}</strong>
            </button>
            <button
              type="button"
              aria-label={
                reducedMotion
                  ? "Animation disabled by reduced motion preference"
                  : paused
                    ? "Resume ASCII animation"
                    : "Pause ASCII animation"
              }
              aria-pressed={paused}
              onClick={() => setPaused((current) => !current)}
              disabled={reducedMotion}
            >
              {paused || reducedMotion ? (
                <Play aria-hidden="true" />
              ) : (
                <Pause aria-hidden="true" />
              )}
              <span>{reducedMotion ? "REDUCED" : paused ? "PLAY" : "PAUSE"}</span>
            </button>
            <button
              type="button"
              aria-label="Export current ASCII frame as PNG"
              onClick={() => fieldRef.current?.exportFrame()}
            >
              <Download aria-hidden="true" />
              <span>FRAME</span>
            </button>
          </div>
        </div>
      </section>

      <section
        id="about"
        className={styles.about}
        data-ascii-scene="field"
        aria-labelledby="source-title"
      >
        <div className={styles.sectionMarker} data-reveal>
          <span>01</span>
          <p>SOURCE / IDENTITY</p>
        </div>

        <div className={styles.manifesto}>
          <p className={styles.eyebrow} data-reveal>
            Not a terminal theme.
            <br />
            A portrait made of signals.
          </p>
          <h2 id="source-title" data-reveal>
            COMPUTING
            <span>IS MY</span>
            MEDIUM.
          </h2>
          <div className={styles.manifestoCopy} data-reveal>
            <p>{profileData.summary}</p>
            <p>{profileData.manifesto}</p>
          </div>
        </div>

        <div className={styles.sourcePanel} data-reveal>
          <div className={styles.sourcePanelHeader}>
            <span>identity.ts</span>
            <span>READ / WRITE</span>
          </div>
          <pre aria-label="Profile information expressed as source code">
            <code>
              <span className={styles.codeMuted}>01</span>{" "}
              <span className={styles.codeHot}>const</span> maker = {"{"}
              {"\n"}
              <span className={styles.codeMuted}>02</span>{"   "}name:{" "}
              <span className={styles.codeGreen}>&quot;{profileData.name}&quot;</span>,
              {"\n"}
              <span className={styles.codeMuted}>03</span>{"   "}base:{" "}
              <span className={styles.codeGreen}>&quot;{profileData.location}&quot;</span>,
              {"\n"}
              <span className={styles.codeMuted}>04</span>{"   "}study:{" "}
              <span className={styles.codeGreen}>
                &quot;{profileData.university}&quot;
              </span>,
              {"\n"}
              <span className={styles.codeMuted}>05</span>{"   "}practice: [
              {"\n"}
              {profileData.skills.map((skill, index) => (
                <span key={skill}>
                  <span className={styles.codeMuted}>
                    {String(index + 6).padStart(2, "0")}
                  </span>
                  {"     "}
                  <span className={styles.codeCyan}>&quot;{skill}&quot;</span>,
                  {"\n"}
                </span>
              ))}
              <span className={styles.codeMuted}>09</span>{"   "}],
              {"\n"}
              <span className={styles.codeMuted}>10</span>{"   "}status:{" "}
              <span className={styles.codeViolet}>BECOMING</span>,
              {"\n"}
              <span className={styles.codeMuted}>11</span>
              {" }"} as <span className={styles.codeHot}>const</span>;
            </code>
          </pre>
          <button
            type="button"
            className={styles.pulseButton}
            onClick={() => fieldRef.current?.injectPulse()}
          >
            Inject curiosity
            <span aria-hidden="true">↳</span>
          </button>
        </div>
      </section>

      <section
        id="timeline"
        className={styles.timeline}
        data-ascii-scene="orbit"
        aria-labelledby="timeline-title"
      >
        <header className={styles.timelineHeader}>
          <div className={styles.sectionMarker} data-reveal>
            <span>02</span>
            <p>TRANSMISSION / LOG</p>
          </div>
          <h2 id="timeline-title" data-reveal>
            FIVE CHAPTERS,
            <br />
            STILL TRANSMITTING.
          </h2>
          <p data-reveal>
            A life index rendered as an open signal—each point changes what
            comes after it.
          </p>
        </header>

        <div className={styles.timelineList}>
          {profileData.timeline.map((item, index) => (
            <article
              key={`${item.year}-${item.title}`}
              className={styles.timelineRow}
              data-reveal
              onPointerEnter={() =>
                fieldRef.current?.injectPulse(
                  0.2 + index * 0.15,
                  0.35 + (index % 2) * 0.28,
                )
              }
            >
              <span className={styles.timelineIndex}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <time>{item.year}</time>
              <div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
              <span className={styles.timelineGlyph} aria-hidden="true">
                {index === profileData.timeline.length - 1 ? "●" : "○"}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section
        id="coordinates"
        className={styles.coordinates}
        data-ascii-scene="noise"
        aria-labelledby="coordinates-title"
      >
        <div className={styles.coordinatesIntro}>
          <div className={styles.sectionMarker} data-reveal>
            <span>03</span>
            <p>CULTURAL / COORDINATES</p>
          </div>
          <h2 id="coordinates-title" data-reveal>
            WHAT KEEPS
            <br />
            THE SIGNAL HUMAN.
          </h2>
        </div>

        <div className={styles.coordinateList}>
          {profileData.favorites.map((favorite, index) => (
            <article
              key={favorite.index}
              className={styles.coordinateRow}
              data-reveal
              onPointerEnter={() =>
                fieldRef.current?.injectPulse(0.28 + index * 0.22, 0.52)
              }
            >
              <span>{favorite.index}</span>
              <p>{favorite.label}</p>
              <h3>{favorite.value}</h3>
              <strong>{favorite.category}</strong>
            </article>
          ))}
        </div>
      </section>

      <section
        id="silhouette"
        className={styles.silhouette}
        data-ascii-scene="self"
        aria-labelledby="silhouette-title"
      >
        <header className={styles.silhouetteIntro}>
          <div className={styles.sectionMarker} data-reveal>
            <span>04</span>
            <p>SELF / SILHOUETTE</p>
          </div>

          <div className={styles.silhouetteHeading}>
            <p className={styles.eyebrow} data-reveal>
              Favorite signal / Asen
            </p>
            <h2 id="silhouette-title" data-reveal>
              PART OF MY
              <span>SILHOUETTE.</span>
            </h2>
          </div>

          <p className={styles.silhouetteCopy} data-reveal>
            Some images become coordinates. This one—Asen above the
            city—stays with me somewhere between music, memory, and code.
          </p>
        </header>

        <div data-reveal>
          <AsciiAlbumReveal />
        </div>

        <div className={styles.albumMeta} data-reveal>
          <p>
            <span>01 / Artist</span>
            <strong>Asen</strong>
          </p>
          <p>
            <span>02 / Medium</span>
            <strong>Album artwork</strong>
          </p>
          <p>
            <span>03 / Translation</span>
            <strong>RGB → ASCII</strong>
          </p>
        </div>
      </section>

      <footer className={styles.outro} data-ascii-scene="self">
        <p className={styles.outroPrompt} data-reveal>
          <span>ggg@wuhan</span>:<strong>~/profile/ascii</strong>$
        </p>
        <h2 data-reveal>
          THE NEXT
          <br />
          FRAME IS YOURS.
        </h2>
        <div className={styles.outroActions} data-reveal>
          <Link href="/">
            cd /profile-index
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <button type="button" onClick={() => fieldRef.current?.exportFrame()}>
            save current signal
            <Download aria-hidden="true" />
          </button>
        </div>
        <div className={styles.outroMeta}>
          <span>GGG CHEESE / 2026</span>
          <span>MADE WITH TEXT, LIGHT + CODE</span>
        </div>
      </footer>
    </main>
  );
}
