"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  MoveHorizontal,
} from "lucide-react";
import { WaterSurface } from "@/components/home/WaterSurface";
import { profileData } from "@/data/profileData";
import styles from "@/components/profiles/minimal-profile.module.css";

const navigation = [
  { id: "top", label: "Top" },
  { id: "about", label: "About" },
  { id: "timeline", label: "Timeline" },
  { id: "works", label: "Works" },
] as const;

const workSlots = [
  {
    index: "01",
    line: "A place for what comes next.",
  },
  {
    index: "02",
    line: "Ideas become systems here.",
  },
  {
    index: "03",
    line: "Code, motion, and meaning.",
  },
  {
    index: "04",
    line: "The archive is still open.",
  },
] as const;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function MinimalProfile() {
  const rootRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<HTMLElement>(null);
  const worksSectionRef = useRef<HTMLElement>(null);
  const worksViewportRef = useRef<HTMLDivElement>(null);
  const worksTrackRef = useRef<HTMLDivElement>(null);
  const worksScrollTriggerRef = useRef<ScrollTrigger | null>(null);
  const activeWorkRef = useRef(0);
  const workDragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startScroll: 0,
  });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeSection, setActiveSection] = useState("top");
  const [activeTimeline, setActiveTimeline] = useState(0);
  const [activeWork, setActiveWork] = useState(0);
  const [isWorkDragging, setIsWorkDragging] = useState(false);

  const setCurrentWork = useCallback((nextIndex: number) => {
    const index = clamp(nextIndex, 0, workSlots.length - 1);

    if (activeWorkRef.current === index) {
      return;
    }

    activeWorkRef.current = index;
    setActiveWork(index);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);

    updatePreference();
    media.addEventListener("change", updatePreference);

    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-profile-section]"),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (first, second) =>
              Math.abs(first.boundingClientRect.top) -
              Math.abs(second.boundingClientRect.top),
          );

        const id = visible[0]?.target.getAttribute("data-profile-section");

        if (id) {
          setActiveSection(id);
        }
      },
      {
        rootMargin: "-32% 0px -58% 0px",
        threshold: 0,
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const items = Array.from(
      document.querySelectorAll<HTMLElement>("[data-timeline-index]"),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (first, second) =>
              Math.abs(first.boundingClientRect.top) -
              Math.abs(second.boundingClientRect.top),
          );
        const nextIndex = Number(
          visible[0]?.target.getAttribute("data-timeline-index"),
        );

        if (Number.isFinite(nextIndex)) {
          setActiveTimeline(nextIndex);
        }
      },
      {
        rootMargin: "-38% 0px -48% 0px",
        threshold: 0,
      },
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      if (!reducedMotion) {
        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .fromTo(
            "[data-hero-line]",
            { yPercent: 112 },
            {
              yPercent: 0,
              duration: 1.05,
              stagger: 0.11,
            },
            0.08,
          )
          .fromTo(
            "[data-hero-meta]",
            { autoAlpha: 0, y: 16 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.72,
              stagger: 0.08,
            },
            0.42,
          );

        gsap.to("[data-hero-title]", {
          yPercent: 13,
          autoAlpha: 0.16,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-hero]",
            start: "top top",
            end: "bottom top",
            scrub: 0.7,
          },
        });

        gsap.utils
          .toArray<HTMLElement>("[data-reveal]", root)
          .forEach((element) => {
            gsap.fromTo(
              element,
              {
                autoAlpha: 0,
                y: 42,
              },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.88,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: element,
                  start: "top 82%",
                  once: true,
                },
              },
            );
          });

        if (timelineRef.current) {
          gsap.fromTo(
            "[data-timeline-fill]",
            { scaleY: 0 },
            {
              scaleY: 1,
              ease: "none",
              scrollTrigger: {
                trigger: timelineRef.current,
                start: "top 54%",
                end: "bottom 66%",
                scrub: 0.5,
              },
            },
          );
        }
      }

      media.add(
        "(min-width: 901px) and (prefers-reduced-motion: no-preference)",
        () => {
          const section = worksSectionRef.current;
          const viewport = worksViewportRef.current;
          const track = worksTrackRef.current;

          if (!section || !viewport || !track) {
            return;
          }

          const frames = Array.from(
            track.querySelectorAll<HTMLElement>("[data-work-frame]"),
          );
          const getDistance = () =>
            Math.max(1, track.scrollWidth - viewport.clientWidth);

          const tween = gsap.to(track, {
            x: () => -getDistance(),
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top top",
              end: () => `+=${getDistance()}`,
              pin: true,
              scrub: 0.75,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              onUpdate: (self) => {
                const nextIndex = Math.round(
                  self.progress * (workSlots.length - 1),
                );
                setCurrentWork(nextIndex);

                frames.forEach((frame, index) => {
                  const position = index / (workSlots.length - 1);
                  const distance = Math.min(
                    1,
                    Math.abs(position - self.progress) * 2.4,
                  );

                  gsap.set(frame, {
                    opacity: 1 - distance * 0.5,
                    scale: 1 - distance * 0.045,
                    rotate: (position - self.progress) * 1.35,
                  });
                });
              },
            },
          });

          worksScrollTriggerRef.current = tween.scrollTrigger ?? null;

          return () => {
            worksScrollTriggerRef.current = null;
          };
        },
      );
    }, root);

    return () => {
      media.revert();
      context.revert();
      worksScrollTriggerRef.current = null;
    };
  }, [reducedMotion, setCurrentWork]);

  const handleGlassPointer = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;

    event.currentTarget.style.setProperty("--glass-x", `${x}%`);
    event.currentTarget.style.setProperty("--glass-y", `${y}%`);
  };

  const handleMobileWorksScroll = () => {
    const viewport = worksViewportRef.current;

    if (!viewport || window.innerWidth > 900) {
      return;
    }

    const frames = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-work-frame]"),
    );
    const center = viewport.scrollLeft + viewport.clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    frames.forEach((frame, index) => {
      const frameCenter = frame.offsetLeft + frame.offsetWidth / 2;
      const distance = Math.abs(frameCenter - center);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setCurrentWork(closestIndex);
  };

  const goToWork = (nextIndex: number) => {
    const index = clamp(nextIndex, 0, workSlots.length - 1);
    const trigger = worksScrollTriggerRef.current;

    if (trigger && window.innerWidth > 900) {
      const progress = index / (workSlots.length - 1);
      const top = trigger.start + (trigger.end - trigger.start) * progress;

      window.scrollTo({
        top,
        behavior: reducedMotion ? "auto" : "smooth",
      });
      return;
    }

    const viewport = worksViewportRef.current;
    const frame = viewport?.querySelectorAll<HTMLElement>(
      "[data-work-frame]",
    )[index];

    if (viewport && frame) {
      viewport.scrollTo({
        left: frame.offsetLeft,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }
  };

  const handleWorkPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const trigger = worksScrollTriggerRef.current;

    if (
      !trigger ||
      reducedMotion ||
      window.innerWidth <= 900 ||
      event.pointerType === "touch" ||
      event.button !== 0
    ) {
      return;
    }

    workDragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScroll: window.scrollY,
    };
    setIsWorkDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleWorkPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const drag = workDragRef.current;
    const trigger = worksScrollTriggerRef.current;

    if (
      !drag.active ||
      drag.pointerId !== event.pointerId ||
      !trigger
    ) {
      return;
    }

    event.preventDefault();
    const nextScroll = clamp(
      drag.startScroll + drag.startX - event.clientX,
      trigger.start,
      trigger.end,
    );

    window.scrollTo({ top: nextScroll, behavior: "auto" });
  };

  const finishWorkDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const drag = workDragRef.current;
    const trigger = worksScrollTriggerRef.current;

    if (!drag.active || drag.pointerId !== event.pointerId) {
      return;
    }

    workDragRef.current.active = false;
    setIsWorkDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (trigger) {
      const progress = clamp(
        (window.scrollY - trigger.start) / (trigger.end - trigger.start),
        0,
        1,
      );
      goToWork(Math.round(progress * (workSlots.length - 1)));
    }
  };

  const workProgress = ((activeWork + 1) / workSlots.length) * 100;
  const currentTimeline = profileData.timeline[activeTimeline];

  return (
    <main
      ref={rootRef}
      className={styles.page}
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      <WaterSurface
        reducedMotion={reducedMotion}
        className={styles.profileWaterSurface}
      />

      <header className={styles.header}>
        <Link
          href="/"
          className={styles.wordmark}
          aria-label="GGG Profile index"
        >
          <strong>GGG</strong>
          <span>Profile / 01</span>
        </Link>

        <nav
          className={`${styles.glassSurface} ${styles.navigation}`}
          aria-label="Profile sections"
          onPointerMove={handleGlassPointer}
        >
          {navigation.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`${styles.navigationLink} ${
                activeSection === item.id
                  ? styles.navigationLinkActive
                  : ""
              }`}
              aria-current={
                activeSection === item.id ? "location" : undefined
              }
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      <section
        id="top"
        className={styles.hero}
        data-profile-section="top"
        data-hero
        aria-labelledby="profile-title"
      >
        <div className={styles.heroKicker} data-hero-meta>
          <span>Profile / 01</span>
          <span>Wuhan, China</span>
        </div>

        <h1
          id="profile-title"
          className={styles.heroTitle}
          data-hero-title
          aria-label={profileData.name}
        >
          <span className={styles.titleMask}>
            <span data-hero-line>GGG</span>
          </span>
          <span className={`${styles.titleMask} ${styles.titleMaskEnd}`}>
            <span data-hero-line>Cheese</span>
          </span>
        </h1>

        <div className={styles.heroFooter}>
          <p className={styles.heroRole} data-hero-meta>
            Computer Science Student
            <br />
            Full-stack Developer
          </p>
          <p className={styles.heroThesis} data-hero-meta>
            <strong>Computing</strong> is my medium.
            <span>An artist of it, in the making.</span>
          </p>
        </div>

        <a href="#about" className={styles.scrollCue} data-hero-meta>
          <span aria-hidden="true" />
          Scroll to enter
        </a>
      </section>

      <section
        id="about"
        className={styles.about}
        data-profile-section="about"
        aria-labelledby="about-title"
      >
        <header className={styles.sectionHeader} data-reveal>
          <p className={styles.sectionIndex}>01 / About</p>
          <p className={styles.sectionNote}>Student, developer, human.</p>
        </header>

        <div className={styles.manifesto}>
          <h2 id="about-title" className={styles.manifestoTitle} data-reveal>
            Computing
            <br />
            is a medium.
          </h2>

          <div className={styles.manifestoCopy} data-reveal>
            <p>{profileData.summary}</p>
            <p>{profileData.manifesto}</p>
            <div className={styles.practiceLine}>
              <span>Learning</span>
              <span>Building</span>
              <span>Becoming</span>
            </div>
          </div>
        </div>

        <div className={styles.coordinates} aria-labelledby="taste-title">
          <div className={styles.coordinatesHeading} data-reveal>
            <p className={styles.sectionIndex}>Cultural coordinates</p>
            <h3 id="taste-title">Life beyond the screen.</h3>
          </div>

          <div className={styles.coordinatesList}>
            {profileData.favorites.map((favorite) => (
              <article
                key={favorite.index}
                className={styles.coordinateRow}
                data-reveal
              >
                <span className={styles.coordinateIndex}>
                  {favorite.index}
                </span>
                <p>{favorite.label}</p>
                <h4>{favorite.value}</h4>
                <span className={styles.coordinateCategory}>
                  {favorite.category}
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="timeline"
        ref={timelineRef}
        className={styles.timeline}
        data-profile-section="timeline"
        aria-labelledby="timeline-title"
      >
        <header className={styles.sectionHeader} data-reveal>
          <p className={styles.sectionIndex}>02 / Timeline</p>
          <p className={styles.sectionNote}>A life, still compiling.</p>
        </header>

        <div className={styles.timelineLayout}>
          <aside className={styles.timelineAside} aria-hidden="true">
            <div
              className={`${styles.glassSurface} ${styles.yearGlass}`}
              onPointerMove={handleGlassPointer}
            >
              <span>Current chapter</span>
              <strong key={currentTimeline.year}>
                {currentTimeline.year}
              </strong>
              <span>
                {String(activeTimeline + 1).padStart(2, "0")} /{" "}
                {String(profileData.timeline.length).padStart(2, "0")}
              </span>
            </div>
            <div className={styles.timelineTrack}>
              <span data-timeline-fill />
            </div>
          </aside>

          <div className={styles.timelineList}>
            <h2 id="timeline-title" className="sr-only">
              Personal timeline
            </h2>

            {profileData.timeline.map((item, index) => (
              <article
                key={item.date}
                className={`${styles.timelineItem} ${
                  activeTimeline === index ? styles.timelineItemActive : ""
                }`}
                data-timeline-index={index}
                data-reveal
              >
                <p className={styles.timelineDate}>{item.date}</p>
                <div className={styles.timelineEvent}>
                  <span className={styles.timelineDot} aria-hidden="true" />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.detail}</p>
                  </div>
                </div>

                {"secondaryTitle" in item ? (
                  <div className={styles.timelineFork}>
                    <span className={styles.forkLine} aria-hidden="true" />
                    <div>
                      <p className={styles.forkLabel}>Practice</p>
                      <h3>{item.secondaryTitle}</h3>
                      <p>{item.secondaryDetail}</p>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="works"
        ref={worksSectionRef}
        className={styles.works}
        data-profile-section="works"
        aria-labelledby="works-title"
      >
        <header className={styles.worksHeader}>
          <div>
            <p className={styles.sectionIndex}>03 / Selected work</p>
            <h2 id="works-title">The gallery is in motion.</h2>
          </div>
          <p>
            Projects will live here soon.
            <br />
            For now, explore the empty frames.
          </p>
        </header>

        <div
          ref={worksViewportRef}
          className={`${styles.worksViewport} ${
            isWorkDragging ? styles.worksViewportDragging : ""
          }`}
          onScroll={handleMobileWorksScroll}
          onPointerDown={handleWorkPointerDown}
          onPointerMove={handleWorkPointerMove}
          onPointerUp={finishWorkDrag}
          onPointerCancel={finishWorkDrag}
          onLostPointerCapture={() => {
            workDragRef.current.active = false;
            setIsWorkDragging(false);
          }}
        >
          <div ref={worksTrackRef} className={styles.worksTrack}>
            {workSlots.map((slot) => (
              <article
                key={slot.index}
                className={styles.workFrame}
                data-work-frame
              >
                <div className={styles.frameMeta}>
                  <span>Open frame</span>
                  <span>{slot.index} / 04</span>
                </div>

                <div className={styles.frameCross} aria-hidden="true">
                  <span />
                  <span />
                </div>

                <div className={styles.frameCopy}>
                  <p>Reserved</p>
                  <h3>{slot.line}</h3>
                </div>

                <div className={styles.frameFooter}>
                  <span>GGG Cheese / Selected work</span>
                  <span>Awaiting project</span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div
          className={`${styles.glassSurface} ${styles.worksControls}`}
          onPointerMove={handleGlassPointer}
        >
          <button
            type="button"
            onClick={() => goToWork(activeWork - 1)}
            disabled={activeWork === 0}
            aria-label="Previous work frame"
          >
            <ArrowLeft aria-hidden />
          </button>

          <div className={styles.workCounter} aria-live="polite">
            <span>{String(activeWork + 1).padStart(2, "0")}</span>
            <span>/ {String(workSlots.length).padStart(2, "0")}</span>
          </div>

          <div
            className={styles.workProgress}
            style={{ "--work-progress": `${workProgress}%` } as CSSProperties}
            aria-hidden="true"
          >
            <span />
          </div>

          <p className={styles.dragHint}>
            <MoveHorizontal aria-hidden />
            Scroll / drag
          </p>

          <button
            type="button"
            onClick={() => goToWork(activeWork + 1)}
            disabled={activeWork === workSlots.length - 1}
            aria-label="Next work frame"
          >
            <ArrowRight aria-hidden />
          </button>
        </div>
      </section>

      <footer className={styles.outro}>
        <p className={styles.sectionIndex} data-reveal>
          End / Beginning
        </p>
        <h2 data-reveal>
          Still learning.
          <br />
          Still making.
        </h2>
        <div className={styles.outroFooter} data-reveal>
          <p>
            GGG Cheese
            <span>Wuhan, China</span>
          </p>

          <Link
            href="/"
            className={`${styles.glassSurface} ${styles.backHome}`}
            onPointerMove={handleGlassPointer}
          >
            Back to profile index
            <ArrowUpRight aria-hidden />
          </Link>
        </div>
      </footer>
    </main>
  );
}
