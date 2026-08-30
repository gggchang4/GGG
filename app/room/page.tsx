import type { Metadata, Viewport } from "next";
import { RoomExperience } from "@/components/room/RoomExperience";

export const metadata: Metadata = {
  title: "Room Model",
  description:
    "An interactive, dark American teen bedroom rendered as a real-time 3D diorama.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RoomPage() {
  return <RoomExperience />;
}
