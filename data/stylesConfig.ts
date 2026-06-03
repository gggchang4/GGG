export type ProfileStyleConfig = {
  id: "classic" | "experimental";
  name: string;
  description: string;
  route: string;
  previewImage: string | null;
};

export const stylesConfig: ProfileStyleConfig[] = [
  {
    id: "classic",
    name: "Classic",
    description:
      "A calm, readable profile layout that works well as the default resume-style experience.",
    route: "/profile/classic",
    previewImage: null,
  },
  {
    id: "experimental",
    name: "Experimental",
    description:
      "A separate profile route reserved for a more expressive visual system in later iterations.",
    route: "/profile/experimental",
    previewImage: null,
  },
];

export function getStyleConfig(id: ProfileStyleConfig["id"]) {
  return stylesConfig.find((style) => style.id === id);
}
