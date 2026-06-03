import type { Metadata } from "next";
import { ContactSection } from "@/components/sections/contact-section";
import { ReservedStylePage } from "@/components/styles/reserved-style-page";

export const metadata: Metadata = {
  title: "Contact | Personal Digital Space",
  description: "Contact links and collaboration entry points.",
};

type ContactPageProps = {
  params: Promise<{
    style: string;
  }>;
};

export default async function ContactPage({ params }: ContactPageProps) {
  const { style } = await params;

  if (style !== "playground") {
    return <ReservedStylePage styleSlug={style} section="Contact" />;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-28 sm:px-8 lg:px-10">
      <ContactSection compact />
    </main>
  );
}
