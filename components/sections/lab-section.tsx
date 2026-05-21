import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { InteractiveField } from "@/components/sections/interactive-field";
import { Badge } from "@/components/ui/badge";
import { labExperiments } from "@/data/lab";

export function LabSection() {
  const previewItems = labExperiments.slice(0, 3);

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:px-10">
      <FadeIn>
        <InteractiveField />
      </FadeIn>

      <div className="flex flex-col justify-between gap-8">
        <FadeIn>
          <p className="text-sm font-medium text-primary">Lab</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
            Interaction experiments for motion, WebGL, and AI Agent UI.
          </h2>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            The lab is where the site proves interaction skill directly through small, focused demos instead of describing it.
          </p>
        </FadeIn>

        <div className="grid gap-3">
          {previewItems.map((item, index) => (
            <FadeIn key={item.title} delay={index * 0.06}>
              <Link
                href="/lab"
                className="group flex items-center justify-between gap-5 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/60"
              >
                <div>
                  <Badge variant="outline">{item.type}</Badge>
                  <p className="mt-3 font-medium text-foreground">{item.title}</p>
                </div>
                <ArrowUpRight aria-hidden data-icon="inline-end" />
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
