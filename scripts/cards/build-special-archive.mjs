/**
 * Build the museum archive from paired scans of real special cards.
 *
 * Each registry record resolves to one Fanatics Collect product page. The
 * page must expose both sides of the same physical specimen. The normalized
 * local images, per-card foil mask, source URLs, and SHA-256 hashes are all
 * generated in one repeatable pass.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { curatedSpecialCards } from "./curated-special-cards.mjs";
import { buildOpticalProfile, hashString } from "./prizm-optics.mjs";

const ROOT = process.cwd();
const CARD_ROOT = path.join(ROOT, "public", "media", "cards", "special");
const MASK_ROOT = path.join(ROOT, "public", "media", "cards", "special-masks");
const CACHE_ROOT = path.join(ROOT, ".cache", "paired-card-scans");
const MANIFEST_PATH = path.join(ROOT, "data", "sportsCardArchive.generated.json");
const AUDIT_PATH = path.join(ROOT, "data", "sportsCardArchive.audit.generated.json");
const TARGET_RATIO = 5 / 7;
const LEGACY_AUTHENTIC_COUNTS = { nba: 7, nfl: 0, football: 7 };

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function normalizedText(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function splitPlayer(player) {
  const parts = player.replace(/\.$/, "").split(" ");
  return {
    givenName: parts.slice(0, -1).join(" ") || parts[0],
    familyName: parts.at(-1) || player,
  };
}

function colorsFromSeed(seed) {
  const hue = seed % 360;
  return {
    primary: `hsl(${hue} 38% 20%)`,
    secondary: `hsl(${(hue + 38) % 360} 9% 78%)`,
    accent: `hsl(${(hue + 174) % 360} 72% 66%)`,
  };
}

async function fetchBuffer(url) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "user-agent": "ProfileWeb paired physical card archive builder",
        },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function fetchText(url) {
  return (await fetchBuffer(url)).toString("utf8");
}

async function loadProductPage(card) {
  const cachePath = path.join(CACHE_ROOT, `${card.id}.html`);
  try {
    return await readFile(cachePath, "utf8");
  } catch {
    const html = await fetchText(card.sourcePage);
    await writeFile(cachePath, html, "utf8");
    return html;
  }
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/is);
  return match?.[1]
    ?.replace(/<[^>]+>/g, "")
    .replace(/\s+(?:on Fanatics Collect)?\s*$/i, "")
    .trim() || "Fanatics Collect paired card scan";
}

function unique(values) {
  return [...new Set(values)];
}

function extractScanPair(html, sourcePage) {
  const decoded = html
    .replaceAll("\\u0026", "&")
    .replaceAll("\\/", "/")
    .replaceAll("&amp;", "&");

  const beckett = unique(
    [...decoded.matchAll(/https:\/\/img\.beckett\.com\/[^"'\\\s<>]+\/(?:front|back)\.jpg/gi)]
      .map((match) => match[0]),
  );
  const beckettFront = beckett.find((url) => /\/front\.jpg(?:$|\?)/i.test(url));
  const beckettBack = beckett.find((url) => /\/back\.jpg(?:$|\?)/i.test(url));
  if (beckettFront && beckettBack) {
    return { front: beckettFront, back: beckettBack, capture: "raw-paired-scan" };
  }

  const vault = unique(
    [...decoded.matchAll(/https:\/\/cdn-vault\.fanaticscollect\.com\/[^"'\\\s<>]+\.(?:jpg|jpeg|webp)/gi)]
      .map((match) => match[0])
      .filter((url) => /\/large\//i.test(url)),
  );
  const vaultFront = vault.find((url) => /(?:_|-)1\.(?:jpg|jpeg|webp)$/i.test(url)) || vault[0];
  const vaultBack = vault.find((url) => /(?:_|-)2\.(?:jpg|jpeg|webp)$/i.test(url)) || vault[1];
  if (vaultFront && vaultBack && vaultFront !== vaultBack) {
    return { front: vaultFront, back: vaultBack, capture: "graded-paired-scan" };
  }

  throw new Error(`No paired front/back scan found on ${sourcePage}`);
}

function validateSource(card, html, title) {
  const searchable = normalizedText(`${title} ${html.slice(0, 180_000)}`);
  const familyName = normalizedText(card.player).split(" ").at(-1);
  const number = normalizedText(card.cardNumber);
  if (familyName && !searchable.includes(familyName)) {
    throw new Error(`${card.id}: source title does not contain ${card.player}`);
  }
  if (/^\d+$/.test(number) && !searchable.includes(number)) {
    throw new Error(`${card.id}: source title does not contain card #${card.cardNumber}`);
  }
  if (/BASE|COMMON/i.test(card.parallel)) {
    throw new Error(`${card.id}: common/base cards are forbidden`);
  }
}

function slabProfile(title) {
  if (/\bBGS\b/i.test(title)) return { left: 0.105, top: 0.255, width: 0.79 };
  if (/\bSGC\b/i.test(title)) return { left: 0.135, top: 0.235, width: 0.73 };
  if (/\bCGC\b/i.test(title)) return { left: 0.12, top: 0.245, width: 0.76 };
  return { left: 0.1, top: 0.245, width: 0.8 };
}

async function normalizeScan(input, outputPath, capture, title) {
  const rotated = sharp(input).rotate();
  const metadata = await rotated.metadata();
  const width = metadata.width ?? 1;
  const height = metadata.height ?? 1;
  let pipeline = rotated;

  if (capture === "graded-paired-scan") {
    const profile = slabProfile(title);
    let cropWidth = Math.round(width * profile.width);
    let cropHeight = Math.round(cropWidth / TARGET_RATIO);
    const left = Math.max(0, Math.round(width * profile.left));
    let top = Math.max(0, Math.round(height * profile.top));
    if (left + cropWidth > width) cropWidth = width - left;
    if (top + cropHeight > height) top = Math.max(0, height - cropHeight);
    if (cropHeight > height) {
      cropHeight = height;
      cropWidth = Math.round(height * TARGET_RATIO);
    }
    pipeline = pipeline.extract({ left, top, width: cropWidth, height: cropHeight });
  }

  await pipeline
    .resize(700, 980, { fit: "cover", position: "centre", withoutEnlargement: false })
    .sharpen({ sigma: 0.45, m1: 0.25, m2: 0.6 })
    .webp({ quality: 91, smartSubsample: true })
    .toFile(outputPath);
}

async function downloadAndNormalize(card, side, url, capture, title) {
  const cachePath = path.join(CACHE_ROOT, `${card.id}-${side}.source`);
  let input;
  try {
    input = await readFile(cachePath);
  } catch {
    input = await fetchBuffer(url);
    await writeFile(cachePath, input);
  }
  const directory = path.join(CARD_ROOT, card.sport);
  const outputPath = path.join(directory, `${card.id}-${side}.webp`);
  await normalizeScan(input, outputPath, capture, title);
  return outputPath;
}

async function buildMask(frontPath, destination) {
  const { data, info } = await sharp(frontPath)
    .resize(350, 490)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = Buffer.alloc(info.width * info.height);
  const luma = new Float32Array(info.width * info.height);
  const cx = info.width / 2;
  const cy = info.height * 0.47;

  for (let index = 0; index < luma.length; index += 1) {
    const offset = index * 3;
    luma[index] = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
  }

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = y * info.width + x;
      const offset = index * 3;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const chroma = max - min;
      const light = luma[index];
      const right = luma[y * info.width + Math.min(info.width - 1, x + 1)];
      const below = luma[Math.min(info.height - 1, y + 1) * info.width + x];
      const edge = Math.min(1, (Math.abs(light - right) + Math.abs(light - below)) / 78);
      const nx = Math.abs((x - cx) / cx);
      const ny = Math.abs((y - cy) / (info.height * 0.53));
      const frame = Math.max(nx ** 2.7, ny ** 3.2);
      const metallic = Math.min(1, light / 178) * (1 - Math.min(0.56, chroma / 290));
      const centreSubject = nx < 0.43 && y > info.height * 0.13 && y < info.height * 0.8;
      const subjectSuppression = centreSubject ? 0.3 : 1;
      const value = (0.08 + frame * 0.76 + metallic * 0.43 + edge * 0.24) * subjectSuppression;
      alpha[index] = Math.round(Math.min(0.94, value) * 255);
    }
  }

  const rgba = Buffer.alloc(info.width * info.height * 4, 255);
  for (let index = 0; index < alpha.length; index += 1) rgba[index * 4 + 3] = alpha[index];
  await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .blur(1.05)
    .resize(700, 980)
    .png({ compressionLevel: 9, palette: false })
    .toFile(destination);
}

function relativePublicPath(filePath) {
  return `/${path.relative(path.join(ROOT, "public"), filePath).replaceAll("\\", "/")}`;
}

function sourceRecordId(sourcePage) {
  return sourcePage.match(/\/(?:buy-now|weekly)\/([^/]+)/)?.[1] || sha256(Buffer.from(sourcePage)).slice(0, 16);
}

async function buildCard(card, index) {
  const html = await loadProductPage(card);
  const title = extractTitle(html);
  validateSource(card, html, title);
  const sourcePair = extractScanPair(html, card.sourcePage);
  const sportDirectory = path.join(CARD_ROOT, card.sport);
  const maskDirectory = path.join(MASK_ROOT, card.sport);
  await Promise.all([mkdir(sportDirectory, { recursive: true }), mkdir(maskDirectory, { recursive: true })]);

  const [frontPath, backPath] = await Promise.all([
    downloadAndNormalize(card, "front", sourcePair.front, sourcePair.capture, title),
    downloadAndNormalize(card, "back", sourcePair.back, sourcePair.capture, title),
  ]);
  const maskPath = path.join(maskDirectory, `${card.id}.png`);
  await buildMask(frontPath, maskPath);

  const [frontBuffer, backBuffer, maskBuffer] = await Promise.all([
    readFile(frontPath),
    readFile(backPath),
    readFile(maskPath),
  ]);
  const frontHash = sha256(frontBuffer);
  const backHash = sha256(backBuffer);
  if (frontHash === backHash) throw new Error(`${card.id}: front and back are identical`);

  const seed = hashString(`${card.id}:${frontHash}:${backHash}`);
  const optics = buildOpticalProfile({
    id: card.id,
    parallel: card.parallel,
    sport: card.sport,
    seriesId: card.seriesId,
    finishSeed: seed,
  });
  const names = splitPlayer(card.player);
  const theme = colorsFromSeed(seed);
  const specimenId = sourceRecordId(card.sourcePage);
  process.stdout.write(`\rpaired scans: ${index + 1}/${curatedSpecialCards.length}`);

  return {
    ...card,
    ...names,
    number: card.cardNumber,
    maker: card.maker,
    rarity: card.parallel,
    frontImage: relativePublicPath(frontPath),
    backImage: relativePublicPath(backPath),
    foilMaskImage: relativePublicPath(maskPath),
    primary: theme.primary,
    secondary: theme.secondary,
    accent: theme.accent,
    foil: optics.profile,
    foilMask: "archive-prizm",
    finishSeed: seed,
    optics,
    backMode: "scan",
    scanProvenance: "paired-physical-specimen",
    specimenId,
    sourceTitle: title,
    sourceImage: sourcePair.front,
    backSourceImage: sourcePair.back,
    backSourcePage: card.sourcePage,
    sourceCollection: "https://www.fanaticscollect.com/",
    sourceRecord: specimenId,
    stats: [card.league, card.parallel, `${card.maker.toUpperCase()} #${card.cardNumber}`],
    contentHashes: {
      front: frontHash,
      back: backHash,
      mask: sha256(maskBuffer),
    },
  };
}

function auditManifest(cards) {
  const bySport = Object.fromEntries(
    ["nba", "nfl", "football"].map((sport) => [sport, cards.filter((card) => card.sport === sport).length]),
  );
  const parallelCounts = {};
  for (const card of cards) parallelCounts[card.parallel] = (parallelCounts[card.parallel] || 0) + 1;
  const unique = (values) => new Set(values).size === values.length;
  const checks = {
    noBaseCards: cards.every((card) => !/BASE|COMMON/i.test(card.parallel)),
    pairedPhysicalScans: cards.every((card) => card.backMode === "scan" && card.scanProvenance === "paired-physical-specimen"),
    distinctFrontBack: cards.every((card) => card.contentHashes.front !== card.contentHashes.back),
    uniqueIds: unique(cards.map((card) => card.id)),
    uniqueFronts: unique(cards.map((card) => card.contentHashes.front)),
    uniqueBacks: unique(cards.map((card) => card.contentHashes.back)),
    uniqueOptics: unique(cards.map((card) => card.optics.fingerprint)),
    minimumPerSportAfterLegacyMerge: Object.entries(bySport).every(
      ([sport, count]) => count + LEGACY_AUTHENTIC_COUNTS[sport] >= 21,
    ),
  };
  if (Object.values(checks).some((value) => !value)) {
    throw new Error(`Archive audit failed: ${JSON.stringify(checks)}`);
  }
  return {
    generatedAt: new Date().toISOString(),
    policy: "special cards only; one public listing and one paired physical specimen per record",
    generatedCards: cards.length,
    legacyAuthenticCards: Object.values(LEGACY_AUTHENTIC_COUNTS).reduce((total, count) => total + count, 0),
    finalCards: cards.length + Object.values(LEGACY_AUTHENTIC_COUNTS).reduce((total, count) => total + count, 0),
    finalBySport: Object.fromEntries(
      Object.entries(bySport).map(([sport, count]) => [sport, count + LEGACY_AUTHENTIC_COUNTS[sport]]),
    ),
    autographed: cards.filter((card) => card.autographed).length,
    serialized: cards.filter((card) => card.serial !== "PARALLEL").length,
    opticalPatterns: [...new Set(cards.map((card) => card.optics.pattern))].sort(),
    parallelCounts,
    checks,
    cards: cards.map((card) => ({
      id: card.id,
      sport: card.sport,
      player: card.player,
      parallel: card.parallel,
      cardNumber: card.cardNumber,
      serial: card.serial,
      specimenId: card.specimenId,
      sourcePage: card.sourcePage,
      sourceTitle: card.sourceTitle,
      frontSource: card.sourceImage,
      backSource: card.backSourceImage,
      hashes: card.contentHashes,
      opticalFingerprint: card.optics.fingerprint,
    })),
  };
}

await Promise.all([
  mkdir(CARD_ROOT, { recursive: true }),
  mkdir(MASK_ROOT, { recursive: true }),
  mkdir(CACHE_ROOT, { recursive: true }),
]);

const cards = [];
for (let index = 0; index < curatedSpecialCards.length; index += 1) {
  cards.push(await buildCard(curatedSpecialCards[index], index));
}
process.stdout.write("\n");

const audit = auditManifest(cards);
await Promise.all([
  writeFile(MANIFEST_PATH, `${JSON.stringify(cards, null, 2)}\n`, "utf8"),
  writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`, "utf8"),
]);
console.log(`Wrote ${cards.length} paired special cards; final archive total ${audit.finalCards}.`);
