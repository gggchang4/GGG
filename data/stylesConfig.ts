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
    id: "classic",
    index: "01",
    name: "Classic",
    shortLabel: "Quiet / Structured",
    description:
      "A calm, readable profile layout that works well as the default resume-style experience.",
    route: null,
    status: "placeholder",
    previewImage: null,
    tags: ["Readable", "Resume", "Default"],
  },
  {
    id: "editorial",
    index: "02",
    name: "Editorial",
    shortLabel: "Type / Narrative",
    description:
      "A typography-led profile style for long-form storytelling and selected project case studies.",
    route: null,
    status: "placeholder",
    previewImage: null,
    tags: ["Typography", "Case Study", "Narrative"],
  },
  {
    id: "experimental",
    index: "03",
    name: "Experimental",
    shortLabel: "Motion / WebGL",
    description:
      "An expressive profile route for motion systems, creative coding, and realtime visual experiments.",
    route: null,
    status: "placeholder",
    previewImage: null,
    tags: ["Expressive", "WebGL", "Interaction"],
  },
];

export function getStyleConfig(id: string) {
  return stylesConfig.find((style) => style.id === id);
}
