import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { projects } from "@/data/projects";

export const metadata: Metadata = {
  title: "Works | Personal Digital Space",
  description:
    "Selected case studies across frontend engineering, AI products, and interaction design.",
};

export default function WorksPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-5 py-28 sm:px-8 lg:px-10">
      <section className="max-w-4xl">
        <h1 className="text-4xl font-semibold leading-none text-foreground sm:text-6xl">
          Selected Works
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Case-study ready projects covering visual systems, interaction details, engineering decisions, and AI / Agent product thinking.
        </p>
      </section>

      <section className="grid gap-5">
        {projects.map((project, index) => (
          <article
            key={project.slug}
            className="group grid gap-6 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/60 md:grid-cols-[0.8fr_1.2fr]"
          >
            <div className="flex min-h-64 items-end rounded-md border border-border bg-[linear-gradient(135deg,var(--surface),var(--surface-strong))] p-4">
              <span className="text-6xl font-semibold text-foreground/10">
                0{index + 1}
              </span>
            </div>
            <div className="flex flex-col justify-between gap-8">
              <div>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <h2 className="mt-5 text-3xl font-semibold text-foreground">
                  {project.title}
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {project.description}
                </p>
              </div>
              <Link
                href={project.href}
                className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary"
              >
                Open case study
                <ArrowUpRight aria-hidden data-icon="inline-end" />
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
