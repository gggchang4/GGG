import type { Metadata } from "next";
import { ExperimentalProfile } from "@/components/profiles/ExperimentalProfile";

export const metadata: Metadata = {
  title: "Experimental Profile",
  description: "An experimental profile page powered by shared profile data.",
};

export default function ExperimentalProfilePage() {
  return <ExperimentalProfile />;
}
