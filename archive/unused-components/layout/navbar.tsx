"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { navItems } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Navbar({ styleSlug = "playground" }: { styleSlug?: string }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const basePath = `/styles/${styleSlug}`;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/82 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <Link href="/" className="text-sm font-semibold text-foreground" aria-label="Back to style wheel">
          Profile<span className="text-primary">.</span>Lab
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {navItems.map((item) => {
            const href = item.path ? `${basePath}/${item.path}` : basePath;
            const isActive = item.path ? pathname === href : pathname === basePath;

            return (
              <Link
                key={item.path || "home"}
                href={href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                  isActive && "bg-secondary text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/"
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary"
          >
            Styles
          </Link>

          <Link
            href={`${basePath}/contact`}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Contact
          </Link>
        </div>

        <Button
          aria-label="Toggle navigation"
          aria-expanded={isOpen}
          variant="outline"
          size="icon"
          className="md:hidden"
          onClick={() => setIsOpen((value) => !value)}
        >
          {isOpen ? <X aria-hidden /> : <Menu aria-hidden />}
        </Button>
      </div>

      {isOpen ? (
        <nav className="border-t border-border bg-background px-5 py-4 md:hidden" aria-label="Mobile navigation">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.path || "home"}
                href={item.path ? `${basePath}/${item.path}` : basePath}
                className="rounded-lg px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/"
              className="rounded-lg px-3 py-3 text-sm text-primary transition-colors hover:bg-secondary"
              onClick={() => setIsOpen(false)}
            >
              Styles
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
