import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { stackGroups } from "@/data/stack";

export function StackSection({ compact = false }: { compact?: boolean }) {
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
          <p className="text-sm font-medium text-primary">Stack</p>
          <h2 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
            A React-first system with room for motion, WebGL, MDX, and deployment discipline.
          </h2>
        </FadeIn>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stackGroups.map((group, index) => (
          <FadeIn key={group.title} delay={index * 0.05}>
            <article className="min-h-56 rounded-lg border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">{group.label}</p>
              <h3 className="mt-4 text-2xl font-semibold text-foreground">{group.title}</h3>
              <div className="mt-6 flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <Badge key={item} variant="secondary">
                    {item}
                  </Badge>
                ))}
              </div>
            </article>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
