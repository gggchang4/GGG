/** Validate the paired physical special-card archive without network access. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { curatedSpecialCards } from "./curated-special-cards.mjs";
import { OPTICAL_PATTERN_NAMES } from "./prizm-optics.mjs";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "data", "sportsCardArchive.generated.json");
const AUDIT_PATH = path.join(ROOT, "data", "sportsCardArchive.audit.generated.json");
const ARCHIVE_NOTES_PATH = path.join(ROOT, "public", "media", "cards", "ARCHIVE.md");
const MATERIAL_CSS_PATH = path.join(ROOT, "components", "cards", "sports-cards.module.css");
const EXPECTED_SPORTS = ["nba", "nfl", "football"];
const LEGACY_AUTHENTIC_COUNTS = { nba: 7, nfl: 0, football: 7 };
const EXPECTED_GENERATED_CARDS = curatedSpecialCards.length;

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
  const [frontBuffer, backBuffer, maskBuffer] = await Promise.all([
    readFile(localPath(card.frontImage)),
    readFile(localPath(card.backImage)),
    readFile(localPath(card.foilMaskImage)),
  ]);
  const [frontMetadata, backMetadata, maskMetadata] = await Promise.all([
    sharp(frontBuffer).metadata(),
    sharp(backBuffer).metadata(),
    sharp(maskBuffer).metadata(),
  ]);
  return {
    id: card.id,
    frontHash: sha256(frontBuffer),
    backHash: sha256(backBuffer),
    maskHash: sha256(maskBuffer),
    front: frontMetadata,
    back: backMetadata,
    mask: maskMetadata,
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

if (cards.length !== EXPECTED_GENERATED_CARDS) {
  errors.push(`Expected ${EXPECTED_GENERATED_CARDS} paired generated cards, found ${cards.length}.`);
}

for (const sport of EXPECTED_SPORTS) {
  const generated = cards.filter((card) => card.sport === sport).length;
  const finalCount = generated + LEGACY_AUTHENTIC_COUNTS[sport];
  if (finalCount < 21) errors.push(`${sport} final archive has only ${finalCount} cards.`);
}

for (const field of ["id", "frontImage", "backImage", "foilMaskImage", "sourcePage", "sourceImage", "backSourceImage", "specimenId"]) {
  const repeated = duplicates(cards.map((card) => card[field]));
  if (repeated.length > 0) errors.push(`${field} contains ${repeated.length} duplicate value(s).`);
}

for (const card of cards) {
  const requiredStrings = [
    "id", "player", "team", "year", "series", "parallel", "cardNumber",
    "frontImage", "backImage", "foilMaskImage", "sourcePage", "sourceImage",
    "backSourceImage", "backSourcePage", "sourceCollection", "sourceRecord",
    "sourceTitle", "specimenId", "scanProvenance",
  ];
  for (const field of requiredStrings) {
    if (typeof card[field] !== "string" || card[field].trim() === "") errors.push(`${card.id}: missing ${field}.`);
  }
  if (/BASE|COMMON/i.test(card.parallel) || card.serial === "BASE") errors.push(`${card.id}: base/common card is forbidden.`);
  if (card.backMode !== "scan") errors.push(`${card.id}: backMode must be scan.`);
  if (card.scanProvenance !== "paired-physical-specimen") errors.push(`${card.id}: scan pair provenance is invalid.`);
  if (card.frontImage === card.backImage) errors.push(`${card.id}: front and back paths are identical.`);
  if (card.sourcePage !== card.backSourcePage) errors.push(`${card.id}: front and back are not tied to one specimen page.`);
  if (!card.optics) errors.push(`${card.id}: missing optical profile.`);
  if (card.optics && !OPTICAL_PATTERN_NAMES.includes(card.optics.pattern)) errors.push(`${card.id}: unknown pattern ${card.optics.pattern}.`);
  if (card.optics?.pattern === "base") errors.push(`${card.id}: special card resolved to the base optical pattern.`);
  if (card.optics && card.foil !== card.optics.profile) errors.push(`${card.id}: foil/profile mismatch.`);
  if (card.parallel !== card.parallel.toUpperCase()) errors.push(`${card.id}: parallel label is not normalized.`);
  if (card.team === "NBA" || card.team === "NFL" || card.team === "FIFA WORLD CUP") errors.push(`${card.id}: generic team metadata.`);
  for (const parameter of ["roughness", "relief", "fresnel", "sparkle", "dispersion", "anisotropy"]) {
    if (typeof card.optics?.[parameter] !== "number") errors.push(`${card.id}: missing physical optical parameter ${parameter}.`);
  }
}

const fingerprints = cards.map((card) => card.optics?.fingerprint);
if (duplicates(fingerprints).length > 0) errors.push("Optical fingerprints are not unique.");
const opticalSignatures = cards.map((card) => JSON.stringify(Object.fromEntries(
  Object.entries(card.optics ?? {}).filter(([key]) => key !== "fingerprint"),
)));
if (duplicates(opticalSignatures).length > 0) errors.push("Two cards share a complete optical parameter set.");

const assetRecords = await concurrentMap(cards, 8, inspectAssets);
for (const asset of assetRecords) {
  for (const [side, metadata] of [["front", asset.front], ["back", asset.back]]) {
    if (metadata.width !== 700 || metadata.height !== 980 || metadata.format !== "webp") errors.push(`${asset.id}: ${side} is not a 700x980 WebP.`);
  }
  if (asset.mask.width !== 700 || asset.mask.height !== 980 || asset.mask.format !== "png" || !asset.mask.hasAlpha) {
    errors.push(`${asset.id}: mask is not a 700x980 alpha PNG.`);
  }
  if (asset.frontHash === asset.backHash) errors.push(`${asset.id}: front/back content hashes are identical.`);
}

for (const [label, hashes] of [
  ["front", assetRecords.map((asset) => asset.frontHash)],
  ["back", assetRecords.map((asset) => asset.backHash)],
  ["mask", assetRecords.map((asset) => asset.maskHash)],
]) {
  if (duplicates(hashes).length > 0) errors.push(`${label} content hashes are not unique.`);
}

const profiles = countBy(cards.map((card) => card.optics.profile));
const patterns = countBy(cards.map((card) => card.optics.pattern));
if (Object.keys(profiles).length < 20) errors.push("Fewer than 20 exact special-card optical profiles are represented.");
if (Object.keys(patterns).length < 12) errors.push("Fewer than 12 physical pattern families are represented.");
for (const pattern of OPTICAL_PATTERN_NAMES) {
  if (!materialCss.includes(`data-pattern="${pattern}"`)) errors.push(`Pattern ${pattern} has no material CSS recipe.`);
}

const sportsSummary = Object.fromEntries(EXPECTED_SPORTS.map((sport) => {
  const sportCards = cards.filter((card) => card.sport === sport);
  return [sport, {
    generatedCards: sportCards.length,
    legacyAuthenticCards: LEGACY_AUTHENTIC_COUNTS[sport],
    finalCards: sportCards.length + LEGACY_AUTHENTIC_COUNTS[sport],
    players: new Set(sportCards.map((card) => card.player)).size,
    teams: new Set(sportCards.map((card) => card.team)).size,
    parallels: new Set(sportCards.map((card) => card.parallel)).size,
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
  specimenId: card.specimenId,
  front: card.frontImage,
  frontSha256: assetById.get(card.id).frontHash,
  back: card.backImage,
  backSha256: assetById.get(card.id).backHash,
  mask: card.foilMaskImage,
  maskSha256: assetById.get(card.id).maskHash,
  opticalProfile: card.optics.profile,
  opticalPattern: card.optics.pattern,
  opticalFingerprint: card.optics.fingerprint,
  sourcePage: card.sourcePage,
  sourceTitle: card.sourceTitle,
  frontSource: card.sourceImage,
  backSource: card.backSourceImage,
  scanProvenance: card.scanProvenance,
}));
const archiveDigest = sha256(Buffer.from(JSON.stringify(auditCards)));
const audit = {
  schemaVersion: 2,
  archiveDigest,
  generatedAt: new Date().toISOString(),
  valid: errors.length === 0,
  policy: "special cards only; real front/back from one physical specimen; no digital back fallbacks",
  totals: {
    generatedPairedCards: cards.length,
    legacyAuthenticCards: 14,
    finalCards: cards.length + 14,
    uniqueFronts: new Set(assetRecords.map((asset) => asset.frontHash)).size,
    uniqueBacks: new Set(assetRecords.map((asset) => asset.backHash)).size,
    uniqueMasks: new Set(assetRecords.map((asset) => asset.maskHash)).size,
    uniqueOpticalFingerprints: new Set(fingerprints).size,
    exactParallelProfiles: Object.keys(profiles).length,
    physicalPatternFamilies: Object.keys(patterns).length,
    autographed: cards.filter((card) => card.autographed).length,
    serialized: cards.filter((card) => card.serial !== "PARALLEL").length,
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
  return `| ${sport.toUpperCase()} | ${summary.generatedCards} | ${summary.legacyAuthenticCards} | ${summary.finalCards} | ${summary.players} | ${summary.parallels} |`;
}).join("\n");
const patternRows = Object.entries(patterns)
  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  .map(([pattern, count]) => `| ${pattern} | ${count} |`)
  .join("\n");

const finalSportSummary = EXPECTED_SPORTS
  .map((sport) => `${sportsSummary[sport].finalCards} ${sport.toUpperCase()}`)
  .join(" / ");

const markdown = `# Special-card physical archive\n\nThis ledger is generated by \`scripts/cards/validate-prizm-archive.mjs\`. Per-card sources and SHA-256 values are in \`data/sportsCardArchive.audit.generated.json\`.\n\n- Archive digest: \`${archiveDigest}\`\n- Validation: **${errors.length === 0 ? "PASS" : "FAIL"}**\n- Final cards: **${audit.totals.finalCards}** (${finalSportSummary})\n- Generated paired specimens: **${cards.length}**\n- Unique fronts / backs / masks / optical fingerprints: **${audit.totals.uniqueFronts} / ${audit.totals.uniqueBacks} / ${audit.totals.uniqueMasks} / ${audit.totals.uniqueOpticalFingerprints}**\n- Exact parallel profiles / represented physical families: **${audit.totals.exactParallelProfiles} / ${audit.totals.physicalPatternFamilies}**\n- Every generated entry uses the real front and back from one public physical specimen. Digital backs and front-as-back fallbacks are rejected.\n\n## Coverage\n\n| Sport | Paired scans | Legacy scans | Final | Players | Parallels |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${sportRows}\n\n## Represented physical pattern families\n\n| Pattern | Cards |\n| --- | ---: |\n${patternRows}\n\n## Source policy\n\n- Paired specimen pages: https://www.fanaticscollect.com/\n- Checklist / parallel reference: Topps and Panini product checklists and PSA catalog records.\n- Assets are stored locally only for this non-commercial visual archive; every record retains its source page and both source image URLs.\n`;
await writeFile(ARCHIVE_NOTES_PATH, markdown, "utf8");

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`PASS ${audit.totals.finalCards} final cards · ${audit.totals.exactParallelProfiles} profiles · ${audit.totals.physicalPatternFamilies} patterns`);
  console.log(`Archive digest ${archiveDigest}`);
}
