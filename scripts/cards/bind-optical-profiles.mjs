/** Bind exact source labels and deterministic optical recipes to all 300 cards. */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { extractCollectionProducts } from "./archive-records.mjs";
import { buildOpticalProfile } from "./prizm-optics.mjs";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "data", "sportsCardArchive.generated.json");

const SETS = {
  nba: {
    sourceSlug: "basketball-cards-2023-panini-prizm",
    cache: path.join(ROOT, ".cache", "card-archive", "nba-collection.md"),
  },
  nfl: {
    sourceSlug: "football-cards-2023-panini-prizm",
    cache: path.join(ROOT, ".cache", "card-archive", "nfl-collection.md"),
  },
  football: {
    sourceSlug: "soccer-cards-2022-panini-prizm-world-cup",
    cache: path.join(ROOT, ".cache", "card-archive", "football-collection.md"),
  },
};

async function loadSourceRecords() {
  const records = new Map();
  for (const [sport, set] of Object.entries(SETS)) {
    try {
      const markdown = await readFile(set.cache, "utf8");
      for (const record of extractCollectionProducts(markdown, set.sourceSlug)) {
        records.set(`${sport}:${record.slug}`, record);
      }
    } catch {
      // The local manifest already retains the last parsed labels. A missing
      // cache must never force another remote download just to bind optics.
    }
  }
  return records;
}

const cards = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
const sourceRecords = await loadSourceRecords();
const rebound = cards.map((card) => {
  const sourceSlug = card.sourcePage.split("/").at(-1);
  const sourceRecord = sourceRecords.get(`${card.sport}:${sourceSlug}`);
  const parallel = (sourceRecord?.parallel ?? card.parallel).toUpperCase();
  const optics = buildOpticalProfile({ ...card, parallel });
  const serial = sourceRecord?.serial
    ? `/${sourceRecord.serial}`
    : parallel === "BASE PRIZM"
      ? "BASE"
      : "PARALLEL";

  return {
    ...card,
    parallel,
    serial,
    rarity: parallel,
    foil: optics.profile,
    finishSeed: card.finishSeed,
    optics,
    backMode: "digital-archive",
    sourceRecord: sourceRecord?.sourceRecord || card.sourceRecord || `${card.player} #${card.cardNumber}`,
    stats: [card.stats[0], parallel, `PANINI #${card.cardNumber}`],
  };
});

await writeFile(MANIFEST_PATH, `${JSON.stringify(rebound, null, 2)}\n`, "utf8");
console.log(`Bound ${rebound.length} deterministic optical profiles.`);

