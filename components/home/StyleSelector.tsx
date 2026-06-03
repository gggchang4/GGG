import { StyleCard } from "@/components/home/StyleCard";
import { stylesConfig } from "@/data/stylesConfig";

export function StyleSelector() {
  return (
    <section className="grid gap-5 md:grid-cols-2" aria-label="Available profile styles">
      {stylesConfig.map((style) => (
        <StyleCard key={style.id} style={style} />
      ))}
    </section>
  );
}
