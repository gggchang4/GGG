import type { Metadata } from "next";
import { StackSection } from "@/components/sections/stack-section";
import { ReservedStylePage } from "@/components/styles/reserved-style-page";

export const metadata: Metadata = {
  title: "Stack | Personal Digital Space",
  description: "Frontend, backend, AI, design, tooling, and deployment stack.",
};

type StackPageProps = {
  params: Promise<{
    style: string;
  }>;
};

export default async function StackPage({ params }: StackPageProps) {
  const { style } = await params;

  if (style !== "playground") {
    return <ReservedStylePage styleSlug={style} section="Stack" />;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-28 sm:px-8 lg:px-10">
      <StackSection compact />
    </main>
  );
}
