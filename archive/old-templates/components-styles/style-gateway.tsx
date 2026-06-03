"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowRight, CircleDot, LockKeyhole, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { availableStyle, siteStyles, type SiteStyle } from "@/data/styles";

export function StyleGateway() {
  const router = useRouter();
  const [activeSlug, setActiveSlug] = useState<string>(availableStyle.slug);
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const glowX = useSpring(useTransform(pointerX, [0, 1], ["15%", "85%"]), {
    stiffness: 90,
    damping: 24,
  });
  const glowY = useSpring(useTransform(pointerY, [0, 1], ["15%", "85%"]), {
    stiffness: 90,
    damping: 24,
  });
  const activeStyle = useMemo(
    () => siteStyles.find((style) => style.slug === activeSlug) ?? availableStyle,
    [activeSlug]
  );
  const gatewayBackground = useTransform(
    [glowX, glowY],
    ([x, y]) =>
      `radial-gradient(circle at ${x} ${y}, ${activeStyle.accent}2e, transparent 28%), radial-gradient(circle at 18% 78%, rgba(102, 227, 255, 0.11), transparent 24%), var(--background)`
  );

  function enterStyle(style: SiteStyle) {
    setActiveSlug(style.slug);

    if (style.status === "available") {
      router.push(`/styles/${style.slug}`);
    }
  }

  return (
    <main
      className="relative min-h-svh overflow-hidden bg-background text-foreground"
      onPointerMove={(event) => {
        pointerX.set(event.clientX / window.innerWidth);
        pointerY.set(event.clientY / window.innerHeight);
      }}
    >
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background: gatewayBackground,
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <section className="relative mx-auto grid min-h-svh w-full max-w-7xl gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-10">
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between gap-6">
            <Link href="/" className="text-sm font-semibold text-foreground">
              Profile<span className="text-primary">.</span>Lab
            </Link>
            <Badge variant="outline">Style Gateway</Badge>
          </div>

          <div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-none text-foreground sm:text-6xl xl:text-7xl">
              Choose the way this profile behaves.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Each style keeps the same core content, but rebuilds the rhythm, interface, motion, and interaction language from the ground up.
            </p>
          </div>

          <div className="hidden min-h-[28rem] items-center justify-center lg:flex">
            <StyleWheel activeSlug={activeSlug} onActivate={setActiveSlug} onEnter={enterStyle} />
          </div>

          <div className="grid gap-3 lg:hidden">
            {siteStyles.map((style) => (
              <StyleListItem
                key={style.slug}
                style={style}
                isActive={style.slug === activeSlug}
                onActivate={setActiveSlug}
                onEnter={enterStyle}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:pt-14">
          <StylePreview style={activeStyle} />
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/88 p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Selected style</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{activeStyle.name}</p>
            </div>
            {activeStyle.status === "available" ? (
              <Link
                href={`/styles/${activeStyle.slug}`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Enter this style
                <ArrowRight aria-hidden data-icon="inline-end" />
              </Link>
            ) : (
              <span className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold text-muted-foreground">
                <LockKeyhole aria-hidden data-icon="inline-start" />
                Reserved
              </span>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function StyleWheel({
  activeSlug,
  onActivate,
  onEnter,
}: {
  activeSlug: string;
  onActivate: (slug: string) => void;
  onEnter: (style: SiteStyle) => void;
}) {
  const radius = 176;
  const center = 224;

  return (
    <div className="relative size-[28rem]">
      <div className="absolute inset-0 rounded-full border border-border" />
      <div className="absolute inset-16 rounded-full border border-primary/20" />
      <div className="absolute inset-32 rounded-full border border-accent/20" />
      <div className="absolute left-1/2 top-1/2 flex size-36 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-border bg-background/86 text-center backdrop-blur-xl">
        <Sparkles aria-hidden className="text-primary" />
        <p className="mt-3 text-sm font-semibold text-foreground">Style Wheel</p>
        <p className="mt-1 text-xs text-muted-foreground">Hover to preview</p>
      </div>

      {siteStyles.map((style, index) => {
        const angle = -90 + (index * 360) / siteStyles.length;
        const x = center + radius * Math.cos((angle * Math.PI) / 180);
        const y = center + radius * Math.sin((angle * Math.PI) / 180);
        const isActive = activeSlug === style.slug;

        return (
          <motion.button
            key={style.slug}
            type="button"
            aria-disabled={style.status === "reserved"}
            onMouseEnter={() => onActivate(style.slug)}
            onFocus={() => onActivate(style.slug)}
            onClick={() => onEnter(style)}
            className="absolute flex w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-start gap-2 rounded-lg border border-border bg-card/92 p-3 text-left shadow-2xl shadow-black/20 backdrop-blur-xl transition-colors hover:border-primary focus-visible:border-primary"
            style={{ left: x, top: y }}
            animate={{
              scale: isActive ? 1.08 : 1,
              borderColor: isActive ? style.accent : "rgba(245,245,240,0.14)",
            }}
          >
            <span className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
              {style.status === "available" ? "Available" : "Reserved"}
              <CircleDot aria-hidden data-icon="inline-end" />
            </span>
            <span className="text-base font-semibold text-foreground">{style.name}</span>
            <span className="text-xs leading-4 text-muted-foreground">{style.tagline}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function StyleListItem({
  style,
  isActive,
  onActivate,
  onEnter,
}: {
  style: SiteStyle;
  isActive: boolean;
  onActivate: (slug: string) => void;
  onEnter: (style: SiteStyle) => void;
}) {
  return (
    <motion.button
      type="button"
      aria-disabled={style.status === "reserved"}
      onPointerEnter={() => onActivate(style.slug)}
      onFocus={() => onActivate(style.slug)}
      onClick={() => onEnter(style)}
      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card/92 p-4 text-left transition-colors hover:border-primary focus-visible:border-primary"
      animate={{
        borderColor: isActive ? style.accent : "rgba(245,245,240,0.14)",
      }}
    >
      <span>
        <span className="block text-base font-semibold text-foreground">{style.name}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{style.tagline}</span>
      </span>
      <span className="text-xs font-medium text-muted-foreground">
        {style.status === "available" ? "Enter" : "Reserved"}
      </span>
    </motion.button>
  );
}

function StylePreview({ style }: { style: SiteStyle }) {
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card/88 backdrop-blur-xl">
      <AnimatePresence mode="wait">
        <motion.div
          key={style.slug}
          initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -18, filter: "blur(10px)" }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-6 p-5 sm:p-6"
        >
          <div
            className="relative min-h-80 overflow-hidden rounded-md border"
            style={{
              borderColor: `${style.accent}66`,
              background: `radial-gradient(circle at 70% 28%, ${style.accent}36, transparent 24%), linear-gradient(135deg, var(--surface), var(--background))`,
            }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(rgba(245,245,240,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(245,245,240,0.08)_1px,transparent_1px)] bg-[size:34px_34px]" />
            <div className="relative flex min-h-80 flex-col justify-between p-5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">{style.preview.mode}</span>
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium text-background"
                  style={{ backgroundColor: style.accent }}
                >
                  {style.status}
                </span>
              </div>
              <MiniPreview style={style} />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-semibold leading-none text-foreground sm:text-5xl">
              {style.name}
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">{style.description}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {style.preview.notes.map((note) => (
                <Badge key={note} variant="outline">
                  {note}
                </Badge>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </article>
  );
}

function MiniPreview({ style }: { style: SiteStyle }) {
  if (style.slug === "minimal-index") {
    return (
      <div className="grid gap-3">
        {style.preview.notes.map((note, index) => (
          <div key={note} className="flex items-center gap-4 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">0{index + 1}</span>
            <span className="text-sm text-foreground">{note}</span>
          </div>
        ))}
      </div>
    );
  }

  if (style.slug === "agent-os") {
    return (
      <div className="grid gap-3 sm:grid-cols-[0.72fr_1fr]">
        <div className="rounded-md border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Task queue</p>
          <p className="mt-10 text-3xl font-semibold text-foreground">07</p>
        </div>
        <div className="grid gap-2">
          {style.preview.notes.map((note) => (
            <div key={note} className="rounded-md border border-border bg-background/60 p-3 text-sm text-foreground">
              {note}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="relative mx-auto size-44 rounded-full border" style={{ borderColor: style.accent }}>
        <div
          className="absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rotate-45 border bg-background/50"
          style={{ borderColor: style.accent }}
        />
      </div>
      <p className="max-w-sm text-sm leading-6 text-muted-foreground">{style.preview.surface}</p>
    </div>
  );
}
