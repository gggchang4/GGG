import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSiteStyle } from "@/data/styles";

type ReservedStylePageProps = {
  styleSlug: string;
  section?: string;
};

export function ReservedStylePage({ styleSlug, section }: ReservedStylePageProps) {
  const style = getSiteStyle(styleSlug);
  const title = style ? style.name : "Unregistered Style";
  const label = section ? `${section} / ${title}` : title;

  return (
    <main className="mx-auto flex min-h-[calc(100svh-8rem)] w-full max-w-7xl items-center px-5 py-28 sm:px-8 lg:px-10">
      <section className="grid w-full gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
        <div className="rounded-lg border border-border bg-card p-6">
          <Construction aria-hidden className="text-primary" />
          <Badge className="mt-8" variant="outline">
            Reserved
          </Badge>
          <h1 className="mt-5 text-4xl font-semibold leading-none text-foreground sm:text-6xl">
            {label}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
            {style
              ? style.description
              : "This style slug is not registered yet. The style gateway already supports future expansion without changing the content model."}
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary"
          >
            <ArrowLeft aria-hidden data-icon="inline-start" />
            Back to style wheel
          </Link>
        </div>
        <div className="min-h-80 rounded-lg border border-border bg-[linear-gradient(135deg,var(--surface),var(--surface-strong))] p-6">
          <div
            className="h-full min-h-72 rounded-md border"
            style={{
              borderColor: style?.accent ?? "var(--border)",
              background: `radial-gradient(circle at 70% 35%, ${style?.accent ?? "#f5f5f0"}30, transparent 26%), var(--background)`,
            }}
          />
        </div>
      </section>
    </main>
  );
}
