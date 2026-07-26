import { StyleCard } from "@/components/home/StyleCard";
import { stylesConfig } from "@/data/stylesConfig";

export function StyleSelector() {
  const availableCount = stylesConfig.filter((style) => style.status === "available").length;

  return (
    <section className="grid gap-5" aria-labelledby="style-selector-title">
      <div className="flex flex-col justify-between gap-3 border-t border-border pt-8 sm:flex-row sm:items-end">
        <div>
          <h2 id="style-selector-title" className="text-2xl font-semibold text-foreground">
            Select a profile style
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {availableCount} styles are available now. More directions can be added by updating the shared style configuration.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {stylesConfig.map((style) => (
          <StyleCard key={style.id} style={style} />
        ))}
      </div>
    </section>
  );
}
