import type { Metadata, Viewport } from "next";
import { MusicPlayerExperience } from "@/components/music/MusicPlayerExperience";

export const metadata: Metadata = {
  title: "Vinyl Player",
  description:
    "An interactive vinyl collection with a tactile record player experience.",
};

export const viewport: Viewport = {
  themeColor: "#070706",
};

export default function MusicPage() {
  return <MusicPlayerExperience />;
}
