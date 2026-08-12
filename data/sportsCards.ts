export type CardSport = "nba" | "football";

export type FoilPreset =
  | "topps-refractor"
  | "topps-gold"
  | "prizm-silver"
  | "mercury-blue"
  | "prizm-auto";

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
  frontImage: string;
  backImage: string;
  primary: string;
  secondary: string;
  accent: string;
  foil: FoilPreset;
  autographed: boolean;
  autographMask?: string;
  stats: readonly [string, string, string];
};

export const sportsCards: readonly SportsCard[] = [
  {
    id: "lebron-james-topps-chrome",
    sport: "nba",
    player: "LeBron James",
    givenName: "LEBRON",
    familyName: "JAMES",
    team: "Cleveland Cavaliers",
    position: "F",
    number: "23",
    nation: "USA",
    year: "2003–04",
    maker: "Topps",
    series: "CHROME",
    parallel: "REFRACTOR",
    cardNumber: "111",
    serial: "ROOKIE CARD",
    rarity: "REFRACTOR RC",
    frontImage: "/media/cards/authentic/final/lebron-topps-chrome-front.webp",
    backImage: "/media/cards/authentic/final/lebron-topps-chrome-back.webp",
    primary: "#7b1735",
    secondary: "#c6c8cb",
    accent: "#7cd8ff",
    foil: "topps-refractor",
    autographed: false,
    stats: ["2003 ROOKIE", "#1 DRAFT PICK", "TOPPS #111"],
  },
  {
    id: "stephen-curry-prizm-silver",
    sport: "nba",
    player: "Stephen Curry",
    givenName: "STEPHEN",
    familyName: "CURRY",
    team: "Golden State Warriors",
    position: "G",
    number: "30",
    nation: "USA",
    year: "2020–21",
    maker: "Panini",
    series: "PRIZM",
    parallel: "SILVER PRIZM",
    cardNumber: "159",
    serial: "SILVER",
    rarity: "PRIZM",
    frontImage: "/media/cards/authentic/final/curry-prizm-front.webp",
    backImage: "/media/cards/authentic/final/curry-prizm-back.webp",
    primary: "#095bb3",
    secondary: "#d9dde1",
    accent: "#ffca36",
    foil: "prizm-silver",
    autographed: false,
    stats: ["2× MVP", "4× CHAMPION", "ALL-TIME 3PT"],
  },
  {
    id: "victor-wembanyama-mercury-auto",
    sport: "nba",
    player: "Victor Wembanyama",
    givenName: "VICTOR",
    familyName: "WEMBANYAMA",
    team: "San Antonio Spurs",
    position: "C-F",
    number: "1",
    nation: "FRA",
    year: "2023–24",
    maker: "Topps",
    series: "MERCURY",
    parallel: "GOLD REFRACTOR AUTO",
    cardNumber: "WA-10",
    serial: "45 / 50",
    rarity: "ROOKIE AUTO",
    frontImage: "/media/cards/authentic/final/wemby-mercury-front.webp",
    backImage: "/media/cards/authentic/final/wemby-mercury-back.webp",
    primary: "#987020",
    secondary: "#f3df9d",
    accent: "#fff1a7",
    foil: "topps-gold",
    autographed: true,
    autographMask: "mercury",
    stats: ["ROOKIE AUTO", "GOLD /50", "TOPPS CERTIFIED"],
  },
  {
    id: "lionel-messi-prizm-auto",
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
    parallel: "SIGNATURES SILVER",
    cardNumber: "S-LEO",
    serial: "AUTHENTIC AUTO",
    rarity: "SIGNATURES",
    frontImage: "/media/cards/authentic/final/messi-prizm-front.webp",
    backImage: "/media/cards/authentic/final/messi-prizm-back.webp",
    primary: "#5ebde8",
    secondary: "#d9dee2",
    accent: "#4fe7ff",
    foil: "prizm-auto",
    autographed: true,
    autographMask: "prizm-bottom",
    stats: ["WORLD CHAMPION", "8× BALLON D'OR", "PANINI AUTO"],
  },
  {
    id: "cristiano-ronaldo-prizm-auto",
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
    parallel: "SIGNATURES PRIZM /25",
    cardNumber: "S-CR7",
    serial: "18 / 25",
    rarity: "SIGNATURES",
    frontImage: "/media/cards/authentic/final/ronaldo-prizm-front.webp",
    backImage: "/media/cards/authentic/final/ronaldo-prizm-back.webp",
    primary: "#8f1325",
    secondary: "#d9dadd",
    accent: "#ffcc58",
    foil: "prizm-auto",
    autographed: true,
    autographMask: "prizm-bottom",
    stats: ["5× BALLON D'OR", "EURO CHAMPION", "PANINI AUTO"],
  },
  {
    id: "kylian-mbappe-topps-chrome-auto",
    sport: "football",
    player: "Kylian Mbappé",
    givenName: "KYLIAN",
    familyName: "MBAPPÉ",
    team: "Paris Saint-Germain",
    position: "F",
    number: "7",
    nation: "FRA",
    year: "2022–23",
    maker: "Topps",
    series: "CHROME PSG",
    parallel: "REFRACTOR AUTO",
    cardNumber: "AU-KM",
    serial: "64 / 99",
    rarity: "ON-CARD AUTO",
    frontImage: "/media/cards/authentic/final/mbappe-topps-chrome-front.webp",
    backImage: "/media/cards/authentic/final/mbappe-topps-chrome-back.webp",
    primary: "#0c2f75",
    secondary: "#d1d5db",
    accent: "#70d9ff",
    foil: "topps-refractor",
    autographed: true,
    autographMask: "chrome-bottom",
    stats: ["ON-CARD AUTO", "REFRACTOR /99", "TOPPS CHROME"],
  },
] as const;

export const sports = ["nba", "football"] as const;

export function getCardsBySport(sport: CardSport) {
  return sportsCards.filter((card) => card.sport === sport);
}
