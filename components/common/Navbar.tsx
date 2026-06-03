import Link from "next/link";
import { stylesConfig } from "@/data/stylesConfig";

export function Navbar() {
  return (
    <header className="border-b border-border bg-background/88 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-5 sm:px-8 lg:px-10">
        <Link href="/" className="text-sm font-semibold text-foreground">
          Profile Web
        </Link>

        <nav className="flex items-center gap-1" aria-label="Profile styles">
          {stylesConfig.map((style) => (
            <Link
              key={style.id}
              href={style.route}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {style.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
