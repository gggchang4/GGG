import type { Metadata } from "next";
import { AboutSection } from "@/components/sections/about-section";
import { StackSection } from "@/components/sections/stack-section";
import { ReservedStylePage } from "@/components/styles/reserved-style-page";
import { profile } from "@/data/profile";

export const metadata: Metadata = {
  title: "About | Personal Digital Space",
  description:
    "About the direction, taste, stack, and future path behind this personal profile site.",
};

type AboutPageProps = {
  params: Promise<{
    style: string;
  }>;
};

export default async function AboutPage({ params }: AboutPageProps) {
  const { style } = await params;

  if (style !== "playground") {
    return <ReservedStylePage styleSlug={style} section="About" />;
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-5 py-28 sm:px-8 lg:px-10">
      <section className="max-w-4xl">
        <h1 className="text-4xl font-semibold leading-none text-foreground sm:text-6xl">
          {profile.name}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          {profile.intro}
        </p>
      </section>
      <AboutSection compact />
      <StackSection compact />
    </main>
  );
}
