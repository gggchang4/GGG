import { FadeIn } from "@/components/motion/fade-in";
import { profile } from "@/data/profile";

export function AboutSection({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={
        compact
          ? "flex flex-col gap-10"
          : "mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-24 sm:px-8 lg:px-10"
      }
    >
      {!compact ? (
        <FadeIn>
          <p className="text-sm font-medium text-primary">About</p>
          <h2 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
            {profile.aboutTitle}
          </h2>
        </FadeIn>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        {profile.aboutBlocks.map((block, index) => (
          <FadeIn key={block.title} delay={index * 0.08}>
            <article className="h-full rounded-lg border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">0{index + 1}</p>
              <h3 className="mt-8 text-2xl font-semibold text-foreground">{block.title}</h3>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {block.description}
              </p>
            </article>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
