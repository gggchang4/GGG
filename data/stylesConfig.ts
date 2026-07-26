export type ProfileStyleConfig = {
  id: string;
  name: string;
  description: string;
  route: string;
  status: "available" | "coming-soon";
  previewImage: string | null;
  tags: string[];
};

export const stylesConfig: ProfileStyleConfig[] = [
  {
    id: "classic",
    name: "Classic",
    description:
      "A calm, readable profile layout that works well as the default resume-style experience.",
    route: "/profile/classic",
    status: "available",
    previewImage: null,
    tags: ["Readable", "Resume", "Default"],
  },
  {
    id: "experimental",
    name: "Experimental",
    description:
      "A separate profile route reserved for a more expressive visual system in later iterations.",
    route: "/profile/experimental",
    status: "available",
    previewImage: null,
    tags: ["Expressive", "Future UI", "Flexible"],
  },
  {
    id: "editorial",
    name: "Editorial",
    description:
      "A future typography-led profile style for long-form storytelling and project case studies.",
    route: "/profile/editorial",
    status: "coming-soon",
    previewImage: null,
    tags: ["Typography", "Case Study", "Planned"],
  },
];

export function getStyleConfig(id: string) {
  return stylesConfig.find((style) => style.id === id);
}
