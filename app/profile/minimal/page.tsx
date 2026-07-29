import type { Metadata } from "next";
import { MinimalProfile } from "@/components/profiles/MinimalProfile";

export const metadata: Metadata = {
  title: "GGG Cheese — Computer Science & Full-stack",
  description:
    "GGG Cheese is a computer science student at Wuhan University and a full-stack developer exploring computing as an artistic medium.",
};

export default function MinimalProfilePage() {
  return <MinimalProfile />;
}
