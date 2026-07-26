import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ProfileStyleConfig } from "@/data/stylesConfig";

const statusLabel: Record<ProfileStyleConfig["status"], string> = {
  available: "Available",
  placeholder: "Reserved",
  "coming-soon": "Coming soon",
};

export function StyleCard({ style }: { style: ProfileStyleConfig }) {
  const isAvailable = style.status === "available";
  const cardClass =
    "group flex h-full flex-col justify-between gap-8 rounded-lg border border-border bg-card p-5 text-left transition-colors";
  const interactiveClass = isAvailable
    ? "hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    : "opacity-72";

  const content = (
    <article className={`${cardClass} ${interactiveClass}`} data-disabled={!isAvailable}>
      <div className="grid gap-5">
        <div
          className="flex aspect-[16/9] items-center justify-center rounded-md border border-dashed border-border bg-secondary text-sm text-muted-foreground"
          style={style.previewImage ? { backgroundImage: `url(${style.previewImage})` } : undefined}
        >
          {style.previewImage ? "Preview image" : "Preview placeholder"}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span
            className={
              isAvailable
                ? "rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                : "rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground"
            }
          >
            {statusLabel[style.status]}
          </span>
          <span className="text-xs text-muted-foreground">{style.route ?? "Route reserved"}</span>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-card-foreground">{style.name}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{style.description}</p>
        </div>

        <div className="flex flex-wrap gap-2" aria-label={`${style.name} tags`}>
          {style.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <span
        className={
          isAvailable
            ? "inline-flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors group-hover:bg-primary/90"
            : "inline-flex w-fit items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground"
        }
      >
        {isAvailable ? "Open style" : "Not available yet"}
        {isAvailable ? <ArrowRight aria-hidden className="size-4" /> : null}
      </span>
    </article>
  );

  if (style.status !== "available") {
    return content;
  }

  return (
    <Link
      href={style.route}
      className="block h-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label={`Open ${style.name} profile style`}
    >
      {content}
    </Link>
  );
}
