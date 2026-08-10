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

export type VinylLabelStyle =
  | "classic"
  | "artwork"
  | "heart"
  | "minimal"
  | "printed";

export type VinylReleaseStatus = "official" | "concept";

export type VinylLabel = {
  style: VinylLabelStyle;
  background: string;
  foreground: string;
  accent?: string;
  kicker?: string;
  title?: string;
  subtitle?: string;
  artwork?: string;
};

export type VinylMaterial = {
  kind: VinylMaterialKind;
  artwork: VinylArtworkTreatment;
  primary: string;
  secondary?: string;
  accent?: string;
  label: VinylLabel;
  releaseStatus: VinylReleaseStatus;
  edition: string;
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
      artwork: "none",
      primary: "#050505",
      secondary: "#17110e",
      accent: "#b98039",
      label: {
        style: "classic",
        background: "#24140f",
        foreground: "#eadcc5",
        accent: "#b98039",
        kicker: "ROC-A-FELLA RECORDS",
        title: "THE COLLEGE DROPOUT",
        subtitle: "KANYE WEST",
      },
      releaseStatus: "official",
      edition: "2LP standard black vinyl",
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
      kind: "black",
      artwork: "none",
      primary: "#050505",
      secondary: "#17130f",
      accent: "#c19a42",
      label: {
        style: "classic",
        background: "#21150f",
        foreground: "#e9dcc2",
        accent: "#b79136",
        kicker: "ROC-A-FELLA · DEF JAM",
        title: "LATE REGISTRATION",
        subtitle: "KANYE WEST",
      },
      releaseStatus: "official",
      edition: "2LP standard black vinyl",
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
      kind: "solid",
      artwork: "none",
      primary: "#a52a9d",
      secondary: "#5d2f72",
      accent: "#75e8ff",
      label: {
        style: "artwork",
        background: "#b92aa8",
        foreground: "#fff5fc",
        accent: "#75e8ff",
        kicker: "ARCHIVE CONCEPT",
        subtitle: "NO OFFICIAL LP PRESSING",
      },
      releaseStatus: "concept",
      edition: "Archive concept — no official LP pressing",
      rpm: 33.333,
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
      kind: "black",
      artwork: "none",
      primary: "#050505",
      secondary: "#191919",
      accent: "#d9d9d4",
      label: {
        style: "heart",
        background: "#d9dad5",
        foreground: "#242424",
        accent: "#de4b49",
        kicker: "ROC-A-FELLA · DEF JAM",
        title: "808S & HEARTBREAK",
        subtitle: "KANYE WEST",
      },
      releaseStatus: "official",
      edition: "2LP standard black vinyl",
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
      kind: "black",
      artwork: "none",
      primary: "#050505",
      secondary: "#17110f",
      accent: "#b51419",
      label: {
        style: "artwork",
        background: "#b51419",
        foreground: "#e7c469",
        accent: "#e7c469",
        kicker: "ROC-A-FELLA RECORDS",
        subtitle: "MY BEAUTIFUL DARK TWISTED FANTASY",
      },
      releaseStatus: "official",
      edition: "3LP black vinyl with George Condo labels",
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
      primary: "#d9dcd9",
      secondary: "#737777",
      accent: "#dc413a",
      label: {
        style: "minimal",
        background: "#d9dcd9",
        foreground: "#242626",
        accent: "#d53e38",
        kicker: "ARCHIVE CONCEPT",
        title: "YEEZUS",
        subtitle: "NO OFFICIAL LP PRESSING",
      },
      releaseStatus: "concept",
      edition: "Archive concept — no official LP pressing",
      rpm: 33.333,
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
      kind: "translucent",
      artwork: "none",
      primary: "#d7d9d5",
      secondary: "#868b88",
      accent: "#ec7a3a",
      label: {
        style: "minimal",
        background: "#ec7a3a",
        foreground: "#17120f",
        accent: "#f1d0a6",
        kicker: "ARCHIVE CONCEPT",
        title: "THE LIFE OF PABLO",
        subtitle: "NO OFFICIAL LP PRESSING",
      },
      releaseStatus: "concept",
      edition: "Archive concept — no official LP pressing",
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
      kind: "black",
      artwork: "none",
      primary: "#050505",
      secondary: "#18201a",
      accent: "#c7ef20",
      label: {
        style: "minimal",
        background: "#c7ef20",
        foreground: "#10140f",
        accent: "#2d5c42",
        kicker: "GOOD MUSIC · DEF JAM",
        title: "YE",
        subtitle: "KANYE WEST",
      },
      releaseStatus: "official",
      edition: "1LP standard black vinyl",
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
      kind: "translucent",
      artwork: "none",
      primary: "#ed7099",
      secondary: "#aa3e68",
      accent: "#f1e8d4",
      label: {
        style: "minimal",
        background: "#f1e8d4",
        foreground: "#211a1d",
        accent: "#df5c89",
        kicker: "GETTING OUT OUR DREAMS",
        title: "KIDS SEE GHOSTS",
        subtitle: "KANYE WEST · KID CUDI",
      },
      releaseStatus: "official",
      edition: "RSD 2020 translucent pink vinyl",
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
      kind: "translucent",
      artwork: "none",
      primary: "#123cc5",
      secondary: "#071e83",
      accent: "#efd465",
      label: {
        style: "printed",
        background: "#1236b8",
        foreground: "#efd465",
        accent: "#efd465",
        kicker: "NEW SONGS · AR 1331 A",
        title: "JESUS IS KING",
        subtitle: "KANYE WEST",
      },
      releaseStatus: "official",
      edition: "1LP translucent cobalt blue vinyl",
      rpm: 33.333,
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
      artwork: "none",
      primary: "#030303",
      secondary: "#121212",
      accent: "#4d493d",
      label: {
        style: "printed",
        background: "#080808",
        foreground: "#716b59",
        accent: "#38352e",
        kicker: "YZY · DEF JAM",
        title: "DONDA",
        subtitle: "SIDE A",
      },
      releaseStatus: "official",
      edition: "4LP standard black vinyl",
      rpm: 33.333,
    },
  },
];
