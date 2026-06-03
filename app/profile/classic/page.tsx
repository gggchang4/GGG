import type { Metadata } from "next";
import { ClassicProfile } from "@/components/profiles/ClassicProfile";

export const metadata: Metadata = {
  title: "Classic Profile",
  description: "A classic profile page powered by shared profile data.",
};

export default function ClassicProfilePage() {
  return <ClassicProfile />;
}
