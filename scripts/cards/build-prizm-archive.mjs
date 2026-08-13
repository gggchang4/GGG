/**
 * Builds the local 300-card Prizm archive used by /cards.
 *
 * Product/checklist metadata comes from SportsCardsPro collection pages and
 * the card images are downloaded from its public PriceCharting image CDN.
 * The generated manifest keeps the source URL for every card so the archive
 * remains auditable. Run with: node scripts/cards/build-prizm-archive.mjs
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { extractCollectionProducts, slugify } from "./archive-records.mjs";
import { buildOpticalProfile, hashString } from "./prizm-optics.mjs";

const ROOT = process.cwd();
const ASSET_ROOT = path.join(ROOT, "public", "media", "cards", "archive");
const MANIFEST_PATH = path.join(ROOT, "data", "sportsCardArchive.generated.json");

const SETS = [
  {
    sport: "nba",
    seriesId: "nba-panini-prizm-2023-24",
    sourceSlug: "basketball-cards-2023-panini-prizm",
    label: "2023–24 PANINI PRIZM",
    year: "2023–24",
    league: "NBA",
    checklist: { sid: "400618", slug: "2023-24-Panini-Prizm", pages: 4 },
  },
  {
    sport: "nfl",
    seriesId: "nfl-panini-prizm-2023",
    sourceSlug: "football-cards-2023-panini-prizm",
    label: "2023 PANINI PRIZM NFL",
    year: "2023",
    league: "NFL",
    checklist: { sid: "394629", slug: "2023-Panini-Prizm", pages: 5 },
  },
  {
    sport: "football",
    seriesId: "football-panini-prizm-world-cup-2022",
    sourceSlug: "soccer-cards-2022-panini-prizm-world-cup",
    label: "2022 PANINI PRIZM WORLD CUP",
    year: "2022",
    league: "FIFA WORLD CUP",
    checklist: { sid: "327724", slug: "2022-Panini-Prizm-World-Cup", pages: 4 },
  },
];

const cardNoise = new Set(["box", "pack", "case", "complete-set", "factory-set", "lot"]);

function titleCase(value) {
  return value
    .split("-")
    .filter(Boolean)
    .map((word) => {
      if (word === "cj") return "CJ";
      if (word.length === 1) return word.toUpperCase();
      return word[0].toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function parseProduct(product) {
  const { slug } = product;
  const numberMatch = slug.match(/-(\d+[a-z]?)$/i);
  if (!numberMatch) return null;
  const cardNumber = numberMatch[1].toUpperCase();
  let nameAndFinish = slug.slice(0, -numberMatch[0].length);
  if ([...cardNoise].some((noise) => nameAndFinish.includes(noise))) return null;

  const parallel = product.parallel || "BASE PRIZM";
  if (parallel !== "BASE PRIZM") {
    const marker = `-${slugify(parallel)}`;
    const markerIndex = nameAndFinish.lastIndexOf(marker);
    if (markerIndex > 0) nameAndFinish = nameAndFinish.slice(0, markerIndex);
  }

  nameAndFinish = nameAndFinish.replace(/-variation$/, "");
  nameAndFinish = nameAndFinish.replace(/-autograph$/, "");
  if (!nameAndFinish) return null;
  return { player: titleCase(nameAndFinish), cardNumber, parallel };
}

function splitPlayer(player) {
  const parts = player.split(" ");
  return {
    givenName: parts.slice(0, -1).join(" ") || parts[0],
    familyName: parts.at(-1) || player,
  };
}

function colorsFromSeed(seed) {
  const hue = seed % 360;
  return {
    primary: `hsl(${hue} 44% 24%)`,
    secondary: `hsl(${(hue + 32) % 360} 10% 80%)`,
    accent: `hsl(${(hue + 176) % 360} 78% 68%)`,
  };
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "ProfileWeb card archive builder" },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function downloadCard(product, outputPath) {
  try {
    await access(outputPath);
    return product.image.replace(/\/60\.jpg$/, "/1600.jpg");
  } catch {
    // Download and normalize new files below.
  }
  const imageUrl = product.image.replace(/\/60\.jpg$/, "/1600.jpg");
  const response = await fetch(imageUrl, { headers: { "user-agent": "ProfileWeb card archive builder" } });
  if (!response.ok) throw new Error(`${response.status} ${imageUrl}`);
  const input = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(input).metadata();
  const width = metadata.width ?? 1;
  const height = metadata.height ?? 1;
  const ratio = width / height;
  const targetRatio = 5 / 7;
  const extract = ratio > targetRatio
    ? { left: Math.round((width - height * targetRatio) / 2), top: 0, width: Math.round(height * targetRatio), height }
    : { left: 0, top: Math.round((height - width / targetRatio) / 2), width, height: Math.round(width / targetRatio) };
  await sharp(input)
    .rotate()
    .extract(extract)
    .resize(700, 980, { fit: "fill", withoutEnlargement: false })
    .webp({ quality: 86, smartSubsample: true })
    .toFile(outputPath);
  return imageUrl;
}

async function loadChecklist(set) {
  const records = new Map();
  const pattern = /\[(?<number>\d+[a-z]?)\]\(http:\/\/www\.tcdb\.com\/ViewCard\.cfm\/sid\/\d+\/cid\/\d+\/[^)]*\)\[(?<player>[^\]]+)\]\(http:\/\/www\.tcdb\.com\/Person[^)]*\)[^\[]*\[(?<team>[^\]]+)\]\(http:\/\/www\.tcdb\.com\/Team/g;
  for (let page = 1; page <= set.checklist.pages; page += 1) {
    const url = `https://r.jina.ai/http://www.tcdb.com/Checklist.cfm/sid/${set.checklist.sid}/${set.checklist.slug}?PageIndex=${page}`;
    const cacheDirectory = path.join(ROOT, ".cache", "card-archive");
    const cachePath = path.join(cacheDirectory, `${set.sport}-checklist-${page}.md`);
    let markdown;
    try {
      markdown = await readFile(cachePath, "utf8");
    } catch {
      try {
        markdown = await fetchText(url);
        await writeFile(cachePath, markdown, "utf8");
      } catch {
        continue;
      }
    }
    for (const match of markdown.matchAll(pattern)) {
      records.set(match.groups.number.toUpperCase(), {
        player: match.groups.player.replace(/\s+(?:RC|VAR).*$/, "").trim(),
        team: match.groups.team.trim(),
      });
    }
  }
  return records;
}

async function buildSet(set) {
  const pageUrl = `https://www.sportscardspro.com/console/${set.sourceSlug}`;
  const cacheDirectory = path.join(ROOT, ".cache", "card-archive");
  const collectionCache = path.join(cacheDirectory, `${set.sport}-collection.md`);
  await mkdir(cacheDirectory, { recursive: true });
  let markdown;
  try {
    markdown = await readFile(collectionCache, "utf8");
  } catch {
    markdown = await fetchText(`https://r.jina.ai/http://www.sportscardspro.com/console/${set.sourceSlug}`);
    await writeFile(collectionCache, markdown, "utf8");
  }
  const products = extractCollectionProducts(markdown, set.sourceSlug)
    .map((product) => ({ ...product, parsed: parseProduct(product) }))
    .filter((product) => product.parsed)
    .slice(0, 100);

  if (products.length < 100) {
    throw new Error(`${set.seriesId} only exposed ${products.length} card records`);
  }

  const checklist = await loadChecklist(set);

  const outputDirectory = path.join(ASSET_ROOT, set.sport);
  await mkdir(outputDirectory, { recursive: true });
  const cards = [];

  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    const parsed = product.parsed;
    const id = `${set.sport}-${product.slug}`;
    const filename = `${String(index + 1).padStart(3, "0")}-${product.slug}.webp`;
    const outputPath = path.join(outputDirectory, filename);
    const sourceImage = await downloadCard(product, outputPath);
    const seed = hashString(id);
    const checklistRecord = checklist.get(parsed.cardNumber);
    const player = checklistRecord?.player ?? parsed.player;
    const names = splitPlayer(player);
    const theme = colorsFromSeed(seed);
    const optics = buildOpticalProfile({
      id,
      parallel: parsed.parallel,
      sport: set.sport,
      seriesId: set.seriesId,
      finishSeed: seed,
    });

    cards.push({
      id,
      sport: set.sport,
      seriesId: set.seriesId,
      player,
      ...names,
      team: checklistRecord?.team ?? set.league,
      position: set.sport === "nfl" ? "NFL" : set.sport === "nba" ? "NBA" : "INTL",
      number: parsed.cardNumber,
      nation: checklistRecord?.team ?? set.league,
      year: set.year,
      maker: "Panini",
      series: set.label,
      parallel: parsed.parallel,
      cardNumber: parsed.cardNumber,
      serial: product.serial ? `/${product.serial}` : parsed.parallel === "BASE PRIZM" ? "BASE" : "PARALLEL",
      rarity: parsed.parallel,
      frontImage: `/media/cards/archive/${set.sport}/${filename}`,
      backImage: `/media/cards/archive/${set.sport}/${filename}`,
      foilMaskImage: `/media/cards/archive-masks/${set.sport}/${filename.replace(/\.webp$/, ".png")}`,
      primary: theme.primary,
      secondary: theme.secondary,
      accent: theme.accent,
      foil: optics.profile,
      foilMask: "archive-prizm",
      finishSeed: seed,
      optics,
      autographed: product.slug.includes("autograph"),
      backMode: "digital-archive",
      stats: [set.league, parsed.parallel, `PANINI #${parsed.cardNumber}`],
      sourcePage: `https://www.sportscardspro.com/game/${set.sourceSlug}/${product.slug}`,
      sourceImage,
      sourceCollection: pageUrl,
      sourceRecord: product.sourceRecord,
    });
    process.stdout.write(`\r${set.sport}: ${index + 1}/100`);
  }
  process.stdout.write("\n");
  return cards;
}

await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
const cards = (await Promise.all(SETS.map(buildSet))).flat();
await writeFile(MANIFEST_PATH, `${JSON.stringify(cards, null, 2)}\n`, "utf8");
console.log(`Wrote ${cards.length} cards to ${path.relative(ROOT, MANIFEST_PATH)}`);
