import type { ReactNode } from "react";
import { Navbar } from "@/components/common/Navbar";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
