import type { Metadata } from "next";
import { ProfileRouteStub } from "@/components/profiles/ProfileRouteStub";

export const metadata: Metadata = {
  title: "Minimal Profile",
  description: "The minimal glass profile route.",
};

export default function MinimalProfilePage() {
  return (
    <ProfileRouteStub
      index="01"
      title="Minimal"
      route="/profile/minimal"
    />
  );
}
