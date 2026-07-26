import type { Metadata } from "next";
import { HomeExperience } from "@/components/home/HomeExperience";

export const metadata: Metadata = {
  title: "Profile Index",
  description:
    "An interactive profile index exploring personal identity through multiple visual systems.",
};

export default function Home() {
  return <HomeExperience />;
}
