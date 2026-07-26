import type { Metadata } from "next";
import { Layout } from "@/components/common/Layout";
import { StyleSelector } from "@/components/home/StyleSelector";

export const metadata: Metadata = {
  title: "Choose Your Profile Experience",
  description: "Select a visual style for this personal profile website.",
};

export default function Home() {
  return (
    <Layout>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-16 sm:px-8 lg:px-10">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase text-primary">Profile Web</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-foreground sm:text-6xl">
              Choose Your Profile Experience
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              This personal profile web is designed as a multi-style entry point. Choose a visual direction, then enter the same profile content through that experience.
            </p>
          </div>

          <p className="max-w-md text-sm leading-6 text-muted-foreground lg:ml-auto">
            The first version keeps the interaction simple: clear cards, shared configuration, and stable routes that can scale as more styles are added.
          </p>
        </section>

        <StyleSelector />

        <footer className="border-t border-border pt-6">
          <p className="text-sm leading-6 text-muted-foreground">
            More profile styles will be added over time. Each new style should be registered in the shared configuration before receiving its own page.
          </p>
        </footer>
      </div>
    </Layout>
  );
}
