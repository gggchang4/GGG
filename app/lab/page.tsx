import type { Metadata } from "next";
import { InteractiveField } from "@/components/sections/interactive-field";
import { Badge } from "@/components/ui/badge";
import { labExperiments } from "@/data/lab";

export const metadata: Metadata = {
  title: "Lab | Personal Digital Space",
  description:
    "Interaction experiments, WebGL demos, animation studies, and AI agent UI prototypes.",
};

export default function LabPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-5 py-28 sm:px-8 lg:px-10">
      <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <h1 className="text-4xl font-semibold leading-none text-foreground sm:text-6xl">
            Interaction Lab
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            A playground for motion, WebGL, creative coding, and AI-native interface prototypes.
          </p>
        </div>
        <InteractiveField />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {labExperiments.map((experiment) => (
          <article
            key={experiment.title}
            className="rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/60"
          >
            <Badge variant="outline">{experiment.type}</Badge>
            <h2 className="mt-5 text-2xl font-semibold text-foreground">
              {experiment.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {experiment.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {experiment.stack.map((item) => (
                <Badge key={item} variant="secondary">
                  {item}
                </Badge>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
