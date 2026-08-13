/**
 * Validate the complete local archive and emit deterministic audit artifacts.
 * No network access is used.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { OPTICAL_PATTERN_NAMES } from "./prizm-optics.mjs";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "data", "sportsCardArchive.generated.json");
const AUDIT_PATH = path.join(ROOT, "data", "sportsCardArchive.audit.generated.json");
const ARCHIVE_NOTES_PATH = path.join(ROOT, "public", "media", "cards", "ARCHIVE.md");
const MATERIAL_CSS_PATH = path.join(ROOT, "components", "cards", "sports-cards.module.css");
const EXPECTED_SPORTS = ["nba", "nfl", "football"];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function localPath(publicPath) {
  return path.join(ROOT, "public", publicPath.replace(/^\//, ""));
}

function duplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1);
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

async function inspectAssets(card) {
  const frontBuffer = await readFile(localPath(card.frontImage));
  const maskBuffer = await readFile(localPath(card.foilMaskImage));
  const [frontMetadata, maskMetadata] = await Promise.all([
    sharp(frontBuffer).metadata(),
    sharp(maskBuffer).metadata(),
  ]);

  return {
    id: card.id,
    imageHash: sha256(frontBuffer),
    maskHash: sha256(maskBuffer),
    imageWidth: frontMetadata.width,
    imageHeight: frontMetadata.height,
    imageFormat: frontMetadata.format,
    maskWidth: maskMetadata.width,
    maskHeight: maskMetadata.height,
    maskFormat: maskMetadata.format,
    maskHasAlpha: Boolean(maskMetadata.hasAlpha),
  };
}

async function concurrentMap(values, concurrency, mapper) {
  const results = new Array(values.length);
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

const cards = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
const materialCss = await readFile(MATERIAL_CSS_PATH, "utf8");
const errors = [];

if (cards.length !== 300) errors.push(`Expected 300 archive cards, found ${cards.length}.`);

for (const sport of EXPECTED_SPORTS) {
  const count = cards.filter((card) => card.sport === sport).length;
  if (count !== 100) errors.push(`Expected 100 ${sport} cards, found ${count}.`);
}

for (const field of ["id", "frontImage", "foilMaskImage", "sourcePage", "sourceImage", "finishSeed"]) {
  const repeated = duplicates(cards.map((card) => card[field]));
  if (repeated.length > 0) errors.push(`${field} contains ${repeated.length} duplicate value(s).`);
}

for (const card of cards) {
  const requiredStrings = [
    "id", "player", "team", "year", "series", "parallel", "cardNumber",
    "frontImage", "backImage", "foilMaskImage", "sourcePage", "sourceImage",
    "sourceCollection", "sourceRecord",
  ];
  for (const field of requiredStrings) {
    if (typeof card[field] !== "string" || card[field].trim() === "") {
      errors.push(`${card.id}: missing ${field}.`);
    }
  }

  if (card.backMode !== "digital-archive") errors.push(`${card.id}: archive back mode is not explicit.`);
  if (card.backImage !== card.frontImage) errors.push(`${card.id}: archive back source should remain the recorded front path.`);
  if (!card.optics) errors.push(`${card.id}: missing optical profile.`);
  if (card.optics && !OPTICAL_PATTERN_NAMES.includes(card.optics.pattern)) {
    errors.push(`${card.id}: unknown optical pattern ${card.optics.pattern}.`);
  }
  if (card.optics && card.foil !== card.optics.profile) errors.push(`${card.id}: foil/profile mismatch.`);
  if (card.parallel !== card.parallel.toUpperCase()) errors.push(`${card.id}: parallel label is not normalized.`);
  if (card.team === "NBA" || card.team === "NFL" || card.team === "FIFA WORLD CUP") {
    errors.push(`${card.id}: team metadata fell back to a generic league label.`);
  }
}

const fingerprints = cards.map((card) => card.optics?.fingerprint);
if (duplicates(fingerprints).length > 0) errors.push("Optical fingerprints are not unique.");

const opticalParameterSignatures = cards.map((card) => {
  const parameters = Object.fromEntries(
    Object.entries(card.optics ?? {}).filter(([key]) => key !== "fingerprint"),
  );
  return JSON.stringify(parameters);
});
if (duplicates(opticalParameterSignatures).length > 0) {
  errors.push("Two or more cards share the same complete optical parameter set.");
}

const assetRecords = await concurrentMap(cards, 10, inspectAssets);
for (const asset of assetRecords) {
  if (asset.imageWidth !== 700 || asset.imageHeight !== 980 || asset.imageFormat !== "webp") {
    errors.push(`${asset.id}: front asset is not a 700x980 WebP.`);
  }
  if (asset.maskWidth !== 700 || asset.maskHeight !== 980 || asset.maskFormat !== "png" || !asset.maskHasAlpha) {
    errors.push(`${asset.id}: mask is not a 700x980 alpha PNG.`);
  }
}

if (duplicates(assetRecords.map((asset) => asset.imageHash)).length > 0) {
  errors.push("Archive image content hashes are not unique.");
}
if (duplicates(assetRecords.map((asset) => asset.maskHash)).length > 0) {
  errors.push("Archive mask content hashes are not unique.");
}

const profiles = countBy(cards.map((card) => card.optics.profile));
const patterns = countBy(cards.map((card) => card.optics.pattern));
if (Object.keys(profiles).length < 20) errors.push("Fewer than 20 exact parallel profiles are represented.");
if (Object.keys(patterns).length < 20) errors.push("Fewer than 20 physical pattern families are represented.");
for (const pattern of OPTICAL_PATTERN_NAMES) {
  if (!materialCss.includes(`data-pattern="${pattern}"`)) {
    errors.push(`Optical pattern ${pattern} has no material CSS recipe.`);
  }
}

const sportsSummary = Object.fromEntries(EXPECTED_SPORTS.map((sport) => {
  const sportCards = cards.filter((card) => card.sport === sport);
  return [sport, {
    cards: sportCards.length,
    players: new Set(sportCards.map((card) => card.player)).size,
    teams: new Set(sportCards.map((card) => card.team)).size,
    parallels: new Set(sportCards.map((card) => card.parallel)).size,
    opticalProfiles: new Set(sportCards.map((card) => card.optics.profile)).size,
    patternFamilies: new Set(sportCards.map((card) => card.optics.pattern)).size,
  }];
}));

const assetById = new Map(assetRecords.map((asset) => [asset.id, asset]));
const auditCards = cards.map((card) => ({
  id: card.id,
  sport: card.sport,
  player: card.player,
  team: card.team,
  cardNumber: card.cardNumber,
  parallel: card.parallel,
  serial: card.serial,
  image: card.frontImage,
  imageSha256: assetById.get(card.id).imageHash,
  mask: card.foilMaskImage,
  maskSha256: assetById.get(card.id).maskHash,
  opticalProfile: card.optics.profile,
  opticalPattern: card.optics.pattern,
  opticalFingerprint: card.optics.fingerprint,
  backMode: card.backMode,
  sourceRecord: card.sourceRecord,
  sourcePage: card.sourcePage,
  sourceImage: card.sourceImage,
  sourceCollection: card.sourceCollection,
}));

const archiveDigest = sha256(Buffer.from(JSON.stringify(auditCards)));
const audit = {
  schemaVersion: 1,
  archiveDigest,
  valid: errors.length === 0,
  totals: {
    cards: cards.length,
    uniqueImages: new Set(assetRecords.map((asset) => asset.imageHash)).size,
    uniqueMasks: new Set(assetRecords.map((asset) => asset.maskHash)).size,
    uniqueOpticalFingerprints: new Set(fingerprints).size,
    exactParallelProfiles: Object.keys(profiles).length,
    physicalPatternFamilies: Object.keys(patterns).length,
  },
  sports: sportsSummary,
  patterns,
  profiles,
  sourceCollections: [...new Set(cards.map((card) => card.sourceCollection))].sort(),
  errors,
  cards: auditCards,
};

await writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

const sportRows = EXPECTED_SPORTS.map((sport) => {
  const summary = sportsSummary[sport];
  return `| ${sport.toUpperCase()} | ${summary.cards} | ${summary.players} | ${summary.teams} | ${summary.parallels} | ${summary.opticalProfiles} | ${summary.patternFamilies} |`;
}).join("\n");
const patternRows = Object.entries(patterns)
  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  .map(([pattern, count]) => `| ${pattern} | ${count} |`)
  .join("\n");
const sourceRows = audit.sourceCollections.map((source) => `- ${source}`).join("\n");

const markdown = `# Prizm digital archive\n\nThis file is generated by \`scripts/cards/validate-prizm-archive.mjs\`. The detailed per-card SHA-256 and source ledger is stored in \`data/sportsCardArchive.audit.generated.json\`.\n\n- Archive digest: \`${archiveDigest}\`\n- Validation: **${errors.length === 0 ? "PASS" : "FAIL"}**\n- Cards / unique scans / unique masks / unique optical fingerprints: **${cards.length} / ${audit.totals.uniqueImages} / ${audit.totals.uniqueMasks} / ${audit.totals.uniqueOpticalFingerprints}**\n- Exact parallel profiles / physical pattern families: **${audit.totals.exactParallelProfiles} / ${audit.totals.physicalPatternFamilies}**\n- All generated entries use an explicit digital archive back; the front scan is never rendered as a card back.\n\n## Coverage\n\n| Sport | Cards | Players | Teams / nations | Parallels | Optical profiles | Pattern families |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${sportRows}\n\n## Physical pattern families\n\n| Pattern | Cards |\n| --- | ---: |\n${patternRows}\n\n## Source collections\n\n${sourceRows}\n`;
await writeFile(ARCHIVE_NOTES_PATH, markdown, "utf8");

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`PASS ${cards.length} cards · ${audit.totals.exactParallelProfiles} profiles · ${audit.totals.physicalPatternFamilies} patterns`);
  console.log(`Archive digest ${archiveDigest}`);
}
