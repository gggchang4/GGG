import { ArrowUpRight } from "lucide-react";
import { MagneticButton } from "@/components/motion/magnetic-button";
import { RevealText } from "@/components/motion/reveal-text";
import { HeroScene } from "@/components/three/hero-scene";
import { Badge } from "@/components/ui/badge";
import { profile } from "@/data/profile";

export function HeroSection() {
  return (
    <section className="mx-auto grid min-h-[72svh] w-full max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.06fr_0.94fr] lg:items-center lg:px-10">
      <div className="flex flex-col gap-8">
        <h1 className="max-w-5xl text-5xl font-semibold leading-none text-foreground sm:text-7xl lg:text-8xl">
          <RevealText text={profile.headline} />
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          {profile.intro}
        </p>
        <div className="flex flex-wrap gap-2">
          {profile.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <MagneticButton href="/works">
            View works
            <ArrowUpRight aria-hidden data-icon="inline-end" />
          </MagneticButton>
          <MagneticButton href="/lab" variant="outline">
            Enter lab
          </MagneticButton>
        </div>
      </div>

      <div className="min-h-96 rounded-lg border border-border bg-card p-3">
        <HeroScene />
      </div>
    </section>
  );
}
