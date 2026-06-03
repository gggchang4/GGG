import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ProfileStyleConfig } from "@/data/stylesConfig";

export function StyleCard({ style }: { style: ProfileStyleConfig }) {
  return (
    <article className="flex h-full flex-col justify-between gap-8 rounded-lg border border-border bg-card p-5">
      <div>
        <div className="flex aspect-[16/9] items-center justify-center rounded-md border border-dashed border-border bg-secondary text-sm text-muted-foreground">
          {style.previewImage ? "Preview image" : "Preview pending"}
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-card-foreground">{style.name}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{style.description}</p>
      </div>

      <Link
        href={style.route}
        className="inline-flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Open style
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </article>
  );
}
