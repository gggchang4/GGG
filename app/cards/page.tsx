import type { Metadata, Viewport } from "next";
import { SportsCardsExperience } from "@/components/cards/SportsCardsExperience";

export const metadata: Metadata = {
  title: "Player Card Archive",
  description:
    "An interactive digital collection of premium NBA and football player cards.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function CardsPage() {
  return <SportsCardsExperience />;
}
