import type { Metadata, Viewport } from "next";
import { AsciiProfile } from "@/components/profiles/AsciiProfile";

export const metadata: Metadata = {
  title: "ASCII Signal",
  description:
    "GGG Cheese rendered as a living, chromatic ASCII signal—an interactive profile made with text, light, and code.",
};

export const viewport: Viewport = {
  themeColor: "#050608",
};

export default function AsciiProfilePage() {
  return <AsciiProfile />;
}
