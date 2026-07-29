import type { Metadata } from "next";
import { ProfileRouteStub } from "@/components/profiles/ProfileRouteStub";

export const metadata: Metadata = {
  title: "ASCII Profile",
  description: "The ASCII art profile route.",
};

export default function AsciiProfilePage() {
  return (
    <ProfileRouteStub
      index="03"
      title="ASCII"
      route="/profile/ascii"
    />
  );
}
