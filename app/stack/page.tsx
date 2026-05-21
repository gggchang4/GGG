import type { Metadata } from "next";
import { StackSection } from "@/components/sections/stack-section";

export const metadata: Metadata = {
  title: "Stack | Personal Digital Space",
  description: "Frontend, backend, AI, design, tooling, and deployment stack.",
};

export default function StackPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-28 sm:px-8 lg:px-10">
      <StackSection compact />
    </main>
  );
}
