import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { projects } from "@/data/projects";

export function WorksSection() {
  const featuredProjects = projects.slice(0, 3);

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-24 sm:px-8 lg:px-10">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <FadeIn>
          <p className="text-sm font-medium text-primary">Works</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
            Case studies that connect interface taste with engineering decisions.
          </h2>
        </FadeIn>
        <FadeIn delay={0.1}>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground lg:ml-auto">
            Each work entry is planned as a future case study: background, role, visual system, interaction highlight, engineering implementation, and final result.
          </p>
        </FadeIn>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {featuredProjects.map((project, index) => (
          <FadeIn key={project.slug} delay={index * 0.08}>
            <Link
              href={project.href}
              className="group flex min-h-[30rem] flex-col justify-between rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/60"
            >
              <div>
                <div className="flex min-h-44 items-end rounded-md border border-border bg-[linear-gradient(135deg,var(--surface),var(--surface-strong))] p-4">
                  <span className="text-5xl font-semibold text-foreground/10">0{index + 1}</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-foreground">{project.title}</h3>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {project.description}
                </p>
              </div>
              <div className="mt-8">
                <Separator />
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">
                  View case
                  <ArrowUpRight aria-hidden data-icon="inline-end" />
                </span>
              </div>
            </Link>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
