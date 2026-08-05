export type VinylMaterialKind =
  | "black"
  | "solid"
  | "translucent"
  | "marble"
  | "splatter"
  | "picture"
  | "split";

export type VinylArtworkTreatment =
  | "label"
  | "picture-disc"
  | "half-picture"
  | "none";

export type VinylMaterial = {
  kind: VinylMaterialKind;
  artwork: VinylArtworkTreatment;
  primary: string;
  secondary?: string;
  accent?: string;
  /** Physical playback speed used by the visual rotor. */
  rpm?: 33.333 | 45;
};

export type VinylAlbum = {
  id: string;
  title: string;
  artist: string;
  year: number;
  cover: string;
  spine: string;
  edge: string;
  vinyl: VinylMaterial;
};

export const vinylAlbums: VinylAlbum[] = [
  {
    id: "college-dropout",
    title: "The College Dropout",
    artist: "Kanye West",
    year: 2004,
    cover: "/media/records/college-dropout.jpg",
    spine: "#6d3d23",
    edge: "#d5ad70",
    vinyl: {
      kind: "black",
      artwork: "label",
      primary: "#090807",
      secondary: "#2e211a",
      accent: "#c9a565",
      rpm: 33.333,
    },
  },
  {
    id: "late-registration",
    title: "Late Registration",
    artist: "Kanye West",
    year: 2005,
    cover: "/media/records/late-registration.jpg",
    spine: "#4b271c",
    edge: "#c59664",
    vinyl: {
      kind: "solid",
      artwork: "label",
      primary: "#54251d",
      secondary: "#190f0d",
      accent: "#d49b69",
      rpm: 33.333,
    },
  },
  {
    id: "graduation",
    title: "Graduation",
    artist: "Kanye West",
    year: 2007,
    cover: "/media/records/graduation.jpg",
    spine: "#b320a2",
    edge: "#ff78cf",
    vinyl: {
      kind: "translucent",
      artwork: "label",
      primary: "#ff48ca",
      secondary: "#6d2cff",
      accent: "#75e8ff",
      rpm: 45,
    },
  },
  {
    id: "808s-heartbreak",
    title: "808s & Heartbreak",
    artist: "Kanye West",
    year: 2008,
    cover: "/media/records/808s-heartbreak.jpg",
    spine: "#eceae4",
    edge: "#ef736b",
    vinyl: {
      kind: "split",
      artwork: "half-picture",
      primary: "#eee9df",
      secondary: "#df5251",
      accent: "#5e5d58",
      rpm: 33.333,
    },
  },
  {
    id: "mbdtf",
    title: "My Beautiful Dark Twisted Fantasy",
    artist: "Kanye West",
    year: 2010,
    cover: "/media/records/mbdtf.jpg",
    spine: "#b41318",
    edge: "#e6b25e",
    vinyl: {
      kind: "picture",
      artwork: "picture-disc",
      primary: "#85161b",
      secondary: "#d9ad58",
      accent: "#17100f",
      rpm: 33.333,
    },
  },
  {
    id: "yeezus",
    title: "Yeezus",
    artist: "Kanye West",
    year: 2013,
    cover: "/media/records/yeezus.jpg",
    spine: "#a7aaa8",
    edge: "#d53831",
    vinyl: {
      kind: "translucent",
      artwork: "none",
      primary: "#dadbd8",
      secondary: "#8a8d8d",
      accent: "#dc413a",
      rpm: 45,
    },
  },
  {
    id: "life-of-pablo",
    title: "The Life of Pablo",
    artist: "Kanye West",
    year: 2016,
    cover: "/media/records/life-of-pablo.jpg",
    spine: "#e86d32",
    edge: "#101010",
    vinyl: {
      kind: "splatter",
      artwork: "label",
      primary: "#ed7a35",
      secondary: "#16130f",
      accent: "#f0d0a2",
      rpm: 33.333,
    },
  },
  {
    id: "ye",
    title: "ye",
    artist: "Kanye West",
    year: 2018,
    cover: "/media/records/ye.jpg",
    spine: "#28556d",
    edge: "#d2cf9e",
    vinyl: {
      kind: "marble",
      artwork: "label",
      primary: "#648da2",
      secondary: "#d0cf9d",
      accent: "#244b61",
      rpm: 33.333,
    },
  },
  {
    id: "kids-see-ghosts",
    title: "KIDS SEE GHOSTS",
    artist: "KIDS SEE GHOSTS",
    year: 2018,
    cover: "/media/records/kids-see-ghosts.jpg",
    spine: "#bc4f22",
    edge: "#f0c35d",
    vinyl: {
      kind: "marble",
      artwork: "half-picture",
      primary: "#c85f2b",
      secondary: "#4d2033",
      accent: "#e7bd58",
      rpm: 33.333,
    },
  },
  {
    id: "jesus-is-king",
    title: "JESUS IS KING",
    artist: "Kanye West",
    year: 2019,
    cover: "/media/records/jesus-is-king.jpg",
    spine: "#173f9f",
    edge: "#b9c8f5",
    vinyl: {
      kind: "split",
      artwork: "half-picture",
      primary: "#16449f",
      secondary: "#d6e1ff",
      accent: "#faf6df",
      rpm: 45,
    },
  },
  {
    id: "donda",
    title: "Donda",
    artist: "Kanye West",
    year: 2021,
    cover: "/media/records/donda.jpg",
    spine: "#111111",
    edge: "#484848",
    vinyl: {
      kind: "black",
      artwork: "picture-disc",
      primary: "#050505",
      secondary: "#242424",
      accent: "#8c8c8c",
      rpm: 33.333,
    },
  },
];
