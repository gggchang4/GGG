import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { socialLinks } from "@/data/social";

export function ContactSection({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={
        compact
          ? "flex flex-col gap-10"
          : "mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-24 sm:px-8 lg:px-10"
      }
    >
      <FadeIn>
        <p className="text-sm font-medium text-primary">Contact</p>
        <h2 className="mt-3 max-w-4xl text-4xl font-semibold leading-none text-foreground sm:text-6xl">
          Build, explore, ship.
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground">
          Open to frontend engineering, creative interaction, AI Agent UI, and product prototype conversations.
        </p>
      </FadeIn>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {socialLinks.map((item, index) => (
          <FadeIn key={item.label} delay={index * 0.06}>
            <Link
              href={item.href}
              className="group flex min-h-32 flex-col justify-between rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/60"
            >
              <span className="text-sm text-muted-foreground">{item.type}</span>
              <span className="flex items-center justify-between gap-4 text-xl font-semibold text-foreground">
                {item.label}
                <ArrowUpRight aria-hidden data-icon="inline-end" />
              </span>
            </Link>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
