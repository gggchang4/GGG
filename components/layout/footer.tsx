import Link from "next/link";
import { profile } from "@/data/profile";
import { socialLinks } from "@/data/social";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-10 sm:px-8 lg:px-10">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm text-muted-foreground">Personal Digital Space</p>
            <p className="mt-2 max-w-xl text-2xl font-semibold leading-tight text-foreground">
              {profile.footerLine}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {socialLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          © 2026 {profile.name}. Built with Next.js, React, TypeScript, Tailwind CSS, Motion, GSAP, and Three.js.
        </p>
      </div>
    </footer>
  );
}
