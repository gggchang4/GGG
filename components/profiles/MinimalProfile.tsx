"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  MoveHorizontal,
  Pause,
  Play,
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

const wrapIndex = (index: number, length: number) =>
  ((index % length) + length) % length;

const toGsapNumber = (value: string | number) =>
  typeof value === "number" ? value : Number.parseFloat(value);

type HorizontalLoopTimeline = gsap.core.Timeline & {
  current: () => number;
  next: (vars?: gsap.TweenVars) => gsap.core.Tween;
  previous: (vars?: gsap.TweenVars) => gsap.core.Tween;
  times: number[];
  toIndex: (index: number, vars?: gsap.TweenVars) => gsap.core.Tween;
};

type HorizontalLoopConfig = {
  onChange?: (item: HTMLElement, index: number) => void;
  paddingRight?: number;
  paused?: boolean;
  repeat?: number;
  speed?: number;
};

/**
 * A typed adaptation of GSAP's responsive horizontalLoop helper.
 * Each original element wraps independently, so the gallery stays seamless
 * without duplicate slides or a visible beginning/end.
 */
function horizontalLoop(
  sourceItems: HTMLElement[],
  config: HorizontalLoopConfig = {},
) {
  const items = gsap.utils.toArray<HTMLElement>(sourceItems);
  const length = items.length;
  const times: number[] = [];
  const widths: number[] = [];
  const xPercents: number[] = [];
  const pixelsPerSecond = (config.speed ?? 1) * 100;
  const snap = gsap.utils.snap(1);
  let currentIndex = 0;
  let totalWidth = 0;

  const timeline = gsap.timeline({
    repeat: config.repeat,
    paused: config.paused,
    defaults: { ease: "none" },
    onReverseComplete: () =>
      timeline.totalTime(timeline.rawTime() + timeline.duration() * 100),
    onUpdate: () => {
      if (!times.length || !timeline.duration()) {
        return;
      }

      const currentTime = timeline.time();
      const duration = timeline.duration();
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      times.forEach((time, index) => {
        const directDistance = Math.abs(time - currentTime);
        const wrappedDistance = Math.min(
          directDistance,
          duration - directDistance,
        );

        if (wrappedDistance < closestDistance) {
          closestDistance = wrappedDistance;
          closestIndex = index;
        }
      });

      if (closestIndex !== currentIndex) {
        currentIndex = closestIndex;
        config.onChange?.(items[currentIndex], currentIndex);
      }
    },
  }) as HorizontalLoopTimeline;

  if (!length) {
    return timeline;
  }

  const startX = items[0].offsetLeft;

  gsap.set(items, {
    xPercent: (index, element: HTMLElement) => {
      const width = (widths[index] = toGsapNumber(
        gsap.getProperty(element, "width", "px"),
      ));
      const x = toGsapNumber(gsap.getProperty(element, "x", "px"));
      const xPercent = toGsapNumber(
        gsap.getProperty(element, "xPercent"),
      );

      xPercents[index] = snap((x / width) * 100 + xPercent);
      return xPercents[index];
    },
  });
  gsap.set(items, { x: 0 });

  totalWidth =
    items[length - 1].offsetLeft +
    (xPercents[length - 1] / 100) * widths[length - 1] -
    startX +
    items[length - 1].offsetWidth *
      toGsapNumber(gsap.getProperty(items[length - 1], "scaleX")) +
    (config.paddingRight ?? 0);

  items.forEach((item, index) => {
    const currentX = (xPercents[index] / 100) * widths[index];
    const distanceToStart = item.offsetLeft + currentX - startX;
    const distanceToLoop =
      distanceToStart +
      widths[index] * toGsapNumber(gsap.getProperty(item, "scaleX"));

    timeline
      .to(
        item,
        {
          xPercent: snap(
            ((currentX - distanceToLoop) / widths[index]) * 100,
          ),
          duration: distanceToLoop / pixelsPerSecond,
        },
        0,
      )
      .fromTo(
        item,
        {
          xPercent: snap(
            ((currentX - distanceToLoop + totalWidth) / widths[index]) * 100,
          ),
        },
        {
          xPercent: xPercents[index],
          duration: (totalWidth - distanceToLoop) / pixelsPerSecond,
          immediateRender: false,
        },
        distanceToLoop / pixelsPerSecond,
      )
      .add(`work-${index}`, distanceToStart / pixelsPerSecond);

    times[index] = distanceToStart / pixelsPerSecond;
  });

  const toIndex = (requestedIndex: number, vars: gsap.TweenVars = {}) => {
    let index = requestedIndex;

    if (Math.abs(index - currentIndex) > length / 2) {
      index += index > currentIndex ? -length : length;
    }

    const nextIndex = wrapIndex(index, length);
    let time = times[nextIndex];

    if ((time > timeline.time()) !== (index > currentIndex)) {
      vars.modifiers = { time: gsap.utils.wrap(0, timeline.duration()) };
      time += timeline.duration() * (index > currentIndex ? 1 : -1);
    }

    currentIndex = nextIndex;
    vars.overwrite = true;
    return timeline.tweenTo(time, vars);
  };

  timeline.next = (vars) => toIndex(currentIndex + 1, vars);
  timeline.previous = (vars) => toIndex(currentIndex - 1, vars);
  timeline.current = () => currentIndex;
  timeline.toIndex = toIndex;
  timeline.times = times;
  timeline.progress(1, true).progress(0, true);
  currentIndex = 0;
  config.onChange?.(items[0], 0);

  return timeline;
}

export function MinimalProfile() {
  const rootRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<HTMLElement>(null);
  const timelineYearNavRef = useRef<HTMLDivElement>(null);
  const worksViewportRef = useRef<HTMLDivElement>(null);
  const worksTrackRef = useRef<HTMLDivElement>(null);
  const worksLoopRef = useRef<HorizontalLoopTimeline | null>(null);
  const workTweenRef = useRef<gsap.core.Tween | null>(null);
  const activeWorkRef = useRef(0);
  const workPausedRef = useRef(false);
  const workInteractionRef = useRef({
    focused: false,
    hovered: false,
  });
  const workDragRef = useRef({
    active: false,
    pointerId: -1,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
  });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeSection, setActiveSection] = useState("top");
  const [activeTimeline, setActiveTimeline] = useState(0);
  const [activeWork, setActiveWork] = useState(0);
  const [isWorkDragging, setIsWorkDragging] = useState(false);
  const [isWorkPaused, setIsWorkPaused] = useState(false);

  const setCurrentWork = useCallback((nextIndex: number) => {
    const index = wrapIndex(nextIndex, workSlots.length);

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
    const yearNav = timelineYearNavRef.current;
    const activeButton = yearNav?.children.item(
      activeTimeline,
    ) as HTMLElement | null;

    if (!yearNav || !activeButton) {
      return;
    }

    yearNav.scrollTo({
      left:
        activeButton.offsetLeft -
        yearNav.clientWidth / 2 +
        activeButton.offsetWidth / 2,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [activeTimeline, reducedMotion]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

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
          gsap.utils
            .toArray<HTMLElement>(
              "[data-timeline-watermark]",
              timelineRef.current,
            )
            .forEach((watermark) => {
              gsap.fromTo(
                watermark,
                { xPercent: -5 },
                {
                  xPercent: 5,
                  ease: "none",
                  scrollTrigger: {
                    trigger: watermark.parentElement,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: 0.65,
                  },
                },
              );
            });
        }
      }
    }, root);

    return () => {
      context.revert();
    };
  }, [reducedMotion]);

  useEffect(() => {
    workPausedRef.current = isWorkPaused;

    const loop = worksLoopRef.current;

    if (!loop || reducedMotion || workDragRef.current.active) {
      return;
    }

    if (isWorkPaused) {
      loop.pause();
    } else if (
      !workTweenRef.current &&
      !workInteractionRef.current.focused &&
      !workInteractionRef.current.hovered
    ) {
      loop.play();
    }
  }, [isWorkPaused, reducedMotion]);

  useEffect(() => {
    const viewport = worksViewportRef.current;
    const track = worksTrackRef.current;

    if (!viewport || !track) {
      return;
    }

    const frames = Array.from(
      track.querySelectorAll<HTMLElement>("[data-work-frame]"),
    );

    if (!frames.length || reducedMotion) {
      gsap.set(frames, { clearProps: "transform" });
      worksLoopRef.current = null;
      return;
    }

    let resizeFrame = 0;
    let disposed = false;
    let isVisible = false;
    let loop: HorizontalLoopTimeline | null = null;

    const buildLoop = () => {
      if (disposed) {
        return;
      }

      const currentIndex = activeWorkRef.current;
      const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;

      workTweenRef.current?.kill();
      workTweenRef.current = null;
      loop?.kill();
      gsap.set(frames, { clearProps: "transform" });

      loop = horizontalLoop(frames, {
        paused: true,
        repeat: -1,
        speed: 0.28,
        paddingRight: gap,
        onChange: (_item, index) => setCurrentWork(index),
      });
      worksLoopRef.current = loop;
      loop.time(loop.times[currentIndex] ?? 0, false);

      if (
        isVisible &&
        !workPausedRef.current &&
        !workInteractionRef.current.focused &&
        !workInteractionRef.current.hovered
      ) {
        loop.play();
      }
    };

    const requestBuild = () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(buildLoop);
    };

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;

        if (!loop || workDragRef.current.active || workTweenRef.current) {
          return;
        }

        if (
          isVisible &&
          !workPausedRef.current &&
          !workInteractionRef.current.focused &&
          !workInteractionRef.current.hovered
        ) {
          loop.play();
        } else {
          loop.pause();
        }
      },
      { rootMargin: "18% 0px", threshold: 0 },
    );
    const resizeObserver = new ResizeObserver(requestBuild);

    visibilityObserver.observe(viewport);
    resizeObserver.observe(viewport);
    resizeObserver.observe(frames[0]);
    requestBuild();
    void document.fonts?.ready.then(requestBuild);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(resizeFrame);
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      workTweenRef.current?.kill();
      workTweenRef.current = null;
      loop?.kill();
      worksLoopRef.current = null;
      gsap.set(frames, { clearProps: "transform" });
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

  const handleReducedWorksScroll = () => {
    const viewport = worksViewportRef.current;

    if (!viewport || !reducedMotion) {
      return;
    }

    const frames = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-work-frame]"),
    );
    const viewportCenter =
      viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    frames.forEach((frame, index) => {
      const bounds = frame.getBoundingClientRect();
      const frameCenter = bounds.left + bounds.width / 2;
      const distance = Math.abs(frameCenter - viewportCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setCurrentWork(closestIndex);
  };

  const goToWork = (direction: -1 | 1) => {
    const nextIndex = wrapIndex(
      activeWorkRef.current + direction,
      workSlots.length,
    );
    const loop = worksLoopRef.current;

    if (!loop || reducedMotion) {
      const viewport = worksViewportRef.current;
      const frame = viewport?.querySelectorAll<HTMLElement>(
        "[data-work-frame]",
      )[nextIndex];

      setCurrentWork(nextIndex);

      if (viewport && frame) {
        const viewportLeft = viewport.getBoundingClientRect().left;
        const frameLeft = frame.getBoundingClientRect().left;

        viewport.scrollTo({
          left: viewport.scrollLeft + frameLeft - viewportLeft,
          behavior: "auto",
        });
      }
      return;
    }

    loop.pause();
    workTweenRef.current?.kill();
    workTweenRef.current =
      direction > 0
        ? loop.next({
            duration: 0.82,
            ease: "power3.inOut",
            onComplete: () => {
              workTweenRef.current = null;
              if (
                !workPausedRef.current &&
                !workInteractionRef.current.focused &&
                !workInteractionRef.current.hovered
              ) {
                loop.play();
              }
            },
          })
        : loop.previous({
            duration: 0.82,
            ease: "power3.inOut",
            onComplete: () => {
              workTweenRef.current = null;
              if (
                !workPausedRef.current &&
                !workInteractionRef.current.focused &&
                !workInteractionRef.current.hovered
              ) {
                loop.play();
              }
            },
          });
  };

  const handleWorkPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const loop = worksLoopRef.current;

    if (
      !loop ||
      reducedMotion ||
      !event.isPrimary ||
      event.button !== 0
    ) {
      return;
    }

    workTweenRef.current?.kill();
    workTweenRef.current = null;
    loop.pause();
    workDragRef.current = {
      active: true,
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
    };
    setIsWorkDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleWorkPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const drag = workDragRef.current;
    const loop = worksLoopRef.current;

    if (
      !drag.active ||
      drag.pointerId !== event.pointerId ||
      !loop
    ) {
      return;
    }

    event.preventDefault();
    const deltaX = event.clientX - drag.lastX;
    const deltaTime = Math.max(8, event.timeStamp - drag.lastTime);
    const instantVelocity = (deltaX / deltaTime) * 1000;

    drag.velocity = drag.velocity * 0.72 + instantVelocity * 0.28;
    drag.lastX = event.clientX;
    drag.lastTime = event.timeStamp;
    loop.time(
      gsap.utils.wrap(0, loop.duration())(
        loop.time() - deltaX / 28,
      ),
      false,
    );
  };

  const finishWorkDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const drag = workDragRef.current;
    const loop = worksLoopRef.current;

    if (!drag.active || drag.pointerId !== event.pointerId) {
      return;
    }

    workDragRef.current.active = false;
    setIsWorkDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!loop) {
      return;
    }

    const duration = loop.duration();
    const projectedTime = gsap.utils.wrap(0, duration)(
      loop.time() - clamp(drag.velocity, -1800, 1800) * 0.18 / 28,
    );
    let targetIndex = loop.current();
    let closestDistance = Number.POSITIVE_INFINITY;

    loop.times.forEach((time, index) => {
      const directDistance = Math.abs(time - projectedTime);
      const wrappedDistance = Math.min(
        directDistance,
        duration - directDistance,
      );

      if (wrappedDistance < closestDistance) {
        closestDistance = wrappedDistance;
        targetIndex = index;
      }
    });

    workTweenRef.current = loop.toIndex(targetIndex, {
      duration: 0.88,
      ease: "power3.out",
      onComplete: () => {
        workTweenRef.current = null;
        if (
          !workPausedRef.current &&
          !workInteractionRef.current.focused &&
          !workInteractionRef.current.hovered
        ) {
          loop.play();
        }
      },
    });
  };

  const handleWorkPointerEnter = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.pointerType !== "mouse") {
      return;
    }

    workInteractionRef.current.hovered = true;

    if (!reducedMotion) {
      worksLoopRef.current?.pause();
    }
  };

  const handleWorkPointerLeave = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.pointerType !== "mouse") {
      return;
    }

    workInteractionRef.current.hovered = false;

    if (
      !reducedMotion &&
      !workPausedRef.current &&
      !workDragRef.current.active &&
      !workTweenRef.current &&
      !workInteractionRef.current.focused
    ) {
      worksLoopRef.current?.play();
    }
  };

  const handleWorkFocus = () => {
    workInteractionRef.current.focused = true;

    if (!reducedMotion) {
      worksLoopRef.current?.pause();
    }
  };

  const handleWorkBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      workInteractionRef.current.focused = false;

      if (
        !reducedMotion &&
        !workPausedRef.current &&
        !workTweenRef.current &&
        !workInteractionRef.current.hovered
      ) {
        worksLoopRef.current?.play();
      }
    }
  };

  const handleWorkKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      goToWork(event.key === "ArrowRight" ? 1 : -1);
    }
  };

  const goToTimelineChapter = (index: number) => {
    document.getElementById(`timeline-chapter-${index}`)?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "center",
    });
  };

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
          <p className={styles.sectionIndex}>02 / Journey</p>
          <p className={styles.sectionNote}>Five chapters, still in motion.</p>
        </header>

        <div className={styles.timelineLead}>
          <h2 id="timeline-title" data-reveal>
            Learning,
            <br />
            building,
            <br />
            becoming.
          </h2>
          <p data-reveal>
            A personal index of the places and practices that shaped how I
            think.
          </p>
        </div>

        <nav
          className={`${styles.glassSurface} ${styles.timelineIndexBar}`}
          aria-label="Timeline chapters"
          onPointerMove={handleGlassPointer}
        >
          <span className={styles.timelineIndexLabel}>Life index</span>
          <div ref={timelineYearNavRef} className={styles.timelineYearNav}>
            {profileData.timeline.map((item, index) => (
              <button
                key={item.year}
                type="button"
                className={
                  activeTimeline === index ? styles.timelineYearActive : ""
                }
                aria-current={activeTimeline === index ? "step" : undefined}
                aria-label={`Go to ${item.date}: ${item.title}`}
                onClick={() => goToTimelineChapter(index)}
              >
                {item.year}
              </button>
            ))}
          </div>
          <span className={styles.timelineCount} aria-hidden="true">
            {String(activeTimeline + 1).padStart(2, "0")} /{" "}
            {String(profileData.timeline.length).padStart(2, "0")}
          </span>
        </nav>

        <div className={styles.timelineList}>
          {profileData.timeline.map((item, index) => (
            <article
              id={`timeline-chapter-${index}`}
              key={item.date}
              className={`${styles.timelineChapter} ${
                activeTimeline === index ? styles.timelineChapterActive : ""
              }`}
              data-timeline-index={index}
            >
              <span
                className={styles.timelineWatermark}
                data-timeline-watermark
                aria-hidden="true"
              >
                {item.year}
              </span>

              <div className={styles.timelineChapterMeta}>
                <span>Chapter {String(index + 1).padStart(2, "0")}</span>
                <time>{item.date}</time>
              </div>

              <div className={styles.timelineChapterContent}>
                <div className={styles.timelineBranch} data-reveal>
                  <p className={styles.timelineBranchLabel}>
                    {"secondaryTitle" in item ? "Study" : "Milestone"}
                  </p>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>

                {"secondaryTitle" in item ? (
                  <div className={styles.timelineBranch} data-reveal>
                    <p className={styles.timelineBranchLabel}>Practice</p>
                    <h3>{item.secondaryTitle}</h3>
                    <p>{item.secondaryDetail}</p>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        id="works"
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
          role="region"
          aria-roledescription="carousel"
          aria-label="Selected work, infinite gallery"
          tabIndex={0}
          onScroll={handleReducedWorksScroll}
          onKeyDown={handleWorkKeyDown}
          onFocus={handleWorkFocus}
          onBlur={handleWorkBlur}
          onPointerEnter={handleWorkPointerEnter}
          onPointerLeave={handleWorkPointerLeave}
          onPointerDown={handleWorkPointerDown}
          onPointerMove={handleWorkPointerMove}
          onPointerUp={finishWorkDrag}
          onPointerCancel={finishWorkDrag}
          onLostPointerCapture={finishWorkDrag}
        >
          <div ref={worksTrackRef} className={styles.worksTrack}>
            {workSlots.map((slot, index) => (
              <article
                key={slot.index}
                className={`${styles.workFrame} ${
                  activeWork === index ? styles.workFrameActive : ""
                }`}
                data-work-frame
                data-work-index={index}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${workSlots.length}`}
              >
                <div
                  className={`${styles.glassSurface} ${styles.workFrameSurface}`}
                  onPointerMove={handleGlassPointer}
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
            onClick={() => goToWork(-1)}
            aria-label="Previous work frame"
          >
            <ArrowLeft aria-hidden />
          </button>

          <div className={styles.workCounter}>
            <span>{String(activeWork + 1).padStart(2, "0")}</span>
            <span>/ {String(workSlots.length).padStart(2, "0")}</span>
          </div>

          <div className={styles.loopMarks} aria-hidden="true">
            {workSlots.map((slot, index) => (
              <span
                key={slot.index}
                className={activeWork === index ? styles.loopMarkActive : ""}
              />
            ))}
          </div>

          <p className={styles.dragHint}>
            <MoveHorizontal aria-hidden />
            Drag / swipe
          </p>

          <button
            type="button"
            onClick={() => setIsWorkPaused((paused) => !paused)}
            disabled={reducedMotion}
            aria-label={
              reducedMotion
                ? "Gallery motion reduced by system preference"
                : isWorkPaused
                  ? "Resume gallery motion"
                  : "Pause gallery motion"
            }
            aria-pressed={isWorkPaused}
          >
            {isWorkPaused || reducedMotion ? (
              <Play aria-hidden />
            ) : (
              <Pause aria-hidden />
            )}
          </button>

          <button
            type="button"
            onClick={() => goToWork(1)}
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
