import type { Metadata } from "next";
import { ProfileRouteStub } from "@/components/profiles/ProfileRouteStub";

export const metadata: Metadata = {
  title: "Avant-Garde Profile",
  description: "The avant-garde profile route.",
};

export default function AvantGardeProfilePage() {
  return (
    <ProfileRouteStub
      index="02"
      title="Avant-Garde"
      route="/profile/avant-garde"
    />
  );
}
