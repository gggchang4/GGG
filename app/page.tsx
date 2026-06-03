import type { Metadata } from "next";
import { Layout } from "@/components/common/Layout";
import { StyleSelector } from "@/components/home/StyleSelector";

export const metadata: Metadata = {
  title: "Choose a Profile Style",
  description: "Select a visual style for this personal profile website.",
};

export default function Home() {
  return (
    <Layout>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase text-primary">Profile Web</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-foreground sm:text-6xl">
            Choose a style to view the same profile through a different lens.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Each profile style reads from the same data source, so future visual experiments can stay focused on layout, typography, and interaction.
          </p>
        </div>

        <StyleSelector />
      </section>
    </Layout>
  );
}
