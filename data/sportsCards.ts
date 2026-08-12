export type CardSport = "nba" | "football";

export type FoilPreset = "prizm" | "chrome" | "gold" | "ice" | "wave" | "paper";

export type SportsCard = {
  id: string;
  sport: CardSport;
  player: string;
  givenName: string;
  familyName: string;
  team: string;
  position: string;
  number: string;
  nation: string;
  year: string;
  maker: "Panini" | "Topps";
  series: string;
  parallel: string;
  cardNumber: string;
  serial: string;
  rarity: string;
  image: string;
  objectPosition: string;
  primary: string;
  secondary: string;
  accent: string;
  foil: FoilPreset;
  stats: readonly [string, string, string];
};

export const sportsCards: readonly SportsCard[] = [
  {
    id: "lebron-james-prizm",
    sport: "nba",
    player: "LeBron James",
    givenName: "LEBRON",
    familyName: "JAMES",
    team: "Los Angeles Lakers",
    position: "F",
    number: "23",
    nation: "USA",
    year: "2024",
    maker: "Panini",
    series: "PRIZM",
    parallel: "PURPLE WAVE",
    cardNumber: "001",
    serial: "23 / 99",
    rarity: "SSP",
    image: "/media/cards/nba/lebron-james.webp",
    objectPosition: "50% 44%",
    primary: "#32125c",
    secondary: "#f3bd19",
    accent: "#ef4a78",
    foil: "prizm",
    stats: ["40,474 PTS", "11,185 REB", "11,009 AST"],
  },
  {
    id: "stephen-curry-chrome",
    sport: "nba",
    player: "Stephen Curry",
    givenName: "STEPHEN",
    familyName: "CURRY",
    team: "Golden State Warriors",
    position: "G",
    number: "30",
    nation: "USA",
    year: "2025",
    maker: "Topps",
    series: "CHROME BASKETBALL",
    parallel: "BLUE MOON",
    cardNumber: "030",
    serial: "41 / 75",
    rarity: "REFRACTOR",
    image: "/media/cards/nba/stephen-curry.webp",
    objectPosition: "49% 42%",
    primary: "#0755a5",
    secondary: "#ffc72c",
    accent: "#42d9ff",
    foil: "chrome",
    stats: ["4× CHAMP", "2× MVP", "10× ALL-STAR"],
  },
  {
    id: "victor-wembanyama-select",
    sport: "nba",
    player: "Victor Wembanyama",
    givenName: "VICTOR",
    familyName: "WEMBANYAMA",
    team: "San Antonio Spurs",
    position: "C-F",
    number: "1",
    nation: "FRA",
    year: "2023–24",
    maker: "Panini",
    series: "SELECT",
    parallel: "WHITE ICE",
    cardNumber: "224",
    serial: "01 / 25",
    rarity: "COURTSIDE",
    image: "/media/cards/nba/victor-wembanyama.webp",
    objectPosition: "50% 46%",
    primary: "#151515",
    secondary: "#d5d9df",
    accent: "#9ff4ff",
    foil: "ice",
    stats: ["21.4 PPG", "10.6 RPG", "3.6 BPG"],
  },
  {
    id: "lionel-messi-chrome",
    sport: "football",
    player: "Lionel Messi",
    givenName: "LIONEL",
    familyName: "MESSI",
    team: "Argentina",
    position: "RW",
    number: "10",
    nation: "ARG",
    year: "2022",
    maker: "Panini",
    series: "PRIZM WORLD CUP",
    parallel: "AQUA WAVE",
    cardNumber: "010",
    serial: "10 / 50",
    rarity: "LEGEND",
    image: "/media/cards/football/lionel-messi.webp",
    objectPosition: "50% 43%",
    primary: "#65bde8",
    secondary: "#f7f8f2",
    accent: "#f3d25b",
    foil: "wave",
    stats: ["8× BALLON D'OR", "2022 WC", "10× LALIGA"],
  },
  {
    id: "cristiano-ronaldo-gold",
    sport: "football",
    player: "Cristiano Ronaldo",
    givenName: "CRISTIANO",
    familyName: "RONALDO",
    team: "Portugal",
    position: "ST",
    number: "7",
    nation: "POR",
    year: "2018",
    maker: "Panini",
    series: "PRIZM WORLD CUP",
    parallel: "GOLD POWER",
    cardNumber: "007",
    serial: "07 / 10",
    rarity: "CASE HIT",
    image: "/media/cards/football/cristiano-ronaldo.webp",
    objectPosition: "50% 38%",
    primary: "#77162c",
    secondary: "#e0b94c",
    accent: "#50a875",
    foil: "gold",
    stats: ["5× BALLON D'OR", "5× UCL", "EURO 2016"],
  },
  {
    id: "kylian-mbappe-sapphire",
    sport: "football",
    player: "Kylian Mbappé",
    givenName: "KYLIAN",
    familyName: "MBAPPÉ",
    team: "France",
    position: "ST",
    number: "10",
    nation: "FRA",
    year: "2022",
    maker: "Panini",
    series: "PRIZM WORLD CUP",
    parallel: "BLUE CRACKLE",
    cardNumber: "205",
    serial: "18 / 49",
    rarity: "COLOR BLAST",
    image: "/media/cards/football/kylian-mbappe.webp",
    objectPosition: "50% 40%",
    primary: "#10245d",
    secondary: "#efefef",
    accent: "#ef294f",
    foil: "chrome",
    stats: ["2018 WC", "WC GOLDEN BOOT", "6× LIGUE 1"],
  },
] as const;

export const sports = ["nba", "football"] as const;

export function getCardsBySport(sport: CardSport) {
  return sportsCards.filter((card) => card.sport === sport);
}
