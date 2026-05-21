import type { Metadata } from "next";
import { ContactSection } from "@/components/sections/contact-section";

export const metadata: Metadata = {
  title: "Contact | Personal Digital Space",
  description: "Contact links and collaboration entry points.",
};

export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-28 sm:px-8 lg:px-10">
      <ContactSection compact />
    </main>
  );
}
