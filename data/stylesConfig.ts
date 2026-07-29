type ProfileStyleBase = {
  id: string;
  index: string;
  name: string;
  shortLabel: string;
  description: string;
  previewImage: string | null;
  tags: string[];
};

export type ProfileStyleConfig =
  | (ProfileStyleBase & {
      status: "available";
      route: string;
    })
  | (ProfileStyleBase & {
      status: "placeholder" | "coming-soon";
      route: null;
    });

export const stylesConfig: ProfileStyleConfig[] = [
  {
    id: "minimal",
    index: "01",
    name: "Minimal",
    shortLabel: "Glass / Quiet",
    description:
      "A restrained profile system extending the homepage water, glass, and quiet spatial language.",
    route: "/profile/minimal",
    status: "available",
    previewImage: null,
    tags: ["Minimal", "Glass", "Water"],
  },
  {
    id: "avant-garde",
    index: "02",
    name: "Avant-Garde",
    shortLabel: "Future / Expressive",
    description:
      "A frontier-facing profile for visual experimentation, personal taste, and artistic direction.",
    route: "/profile/avant-garde",
    status: "available",
    previewImage: null,
    tags: ["Experimental", "Art Direction", "Motion"],
  },
  {
    id: "ascii",
    index: "03",
    name: "ASCII",
    shortLabel: "Chromatic / Generative",
    description:
      "A living profile rendered through chromatic ASCII, generative motion, and playable typographic fields.",
    route: "/profile/ascii",
    status: "available",
    previewImage: null,
    tags: ["ASCII Art", "Generative Canvas", "Interaction"],
  },
];

export function getStyleConfig(id: string) {
  return stylesConfig.find((style) => style.id === id);
}
