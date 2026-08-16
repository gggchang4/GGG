/** Remove only the legacy BASE PRIZM files identified by the tracked manifest. */
import { execFileSync } from "node:child_process";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const ARCHIVE_ROOT = path.resolve(ROOT, "public", "media", "cards", "archive");
const MASK_ROOT = path.resolve(ROOT, "public", "media", "cards", "archive-masks");
const LOG_PATH = path.join(ROOT, "data", "sportsCardArchive.prune.generated.json");

function trackedLegacyManifest() {
  const raw = execFileSync("git", ["show", "HEAD:data/sportsCardArchive.generated.json"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

function resolvePublicPath(publicPath, allowedRoot) {
  const target = path.resolve(ROOT, "public", publicPath.replace(/^\//, ""));
  const relative = path.relative(allowedRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing out-of-scope deletion: ${target}`);
  }
  return target;
}

function resolveLoggedPath(relativePath) {
  const target = path.resolve(ROOT, relativePath);
  const insideArchive = !path.relative(ARCHIVE_ROOT, target).startsWith("..") &&
    !path.isAbsolute(path.relative(ARCHIVE_ROOT, target));
  const insideMasks = !path.relative(MASK_ROOT, target).startsWith("..") &&
    !path.isAbsolute(path.relative(MASK_ROOT, target));
  if (!insideArchive && !insideMasks) {
    throw new Error(`Refusing out-of-scope logged deletion: ${target}`);
  }
  return target;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

try {
  const priorLog = JSON.parse(await readFile(LOG_PATH, "utf8"));
  if (priorLog.baseRecords > 0 && Array.isArray(priorLog.removed)) {
    let restoredFiles = 0;
    for (const record of priorLog.removed) {
      for (const relativePath of record.deleted ?? []) {
        const target = resolveLoggedPath(relativePath);
        if (await exists(target)) {
          await rm(target, { force: true });
          restoredFiles += 1;
        }
      }
    }
    console.log(
      `Base archive already pruned (${priorLog.baseRecords} records); ` +
        `${restoredFiles} restored files removed.`,
    );
    process.exit(0);
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const baseCards = trackedLegacyManifest().filter((card) => card.parallel === "BASE PRIZM");
const removed = [];

for (const card of baseCards) {
  const frontPath = resolvePublicPath(card.frontImage, ARCHIVE_ROOT);
  const maskPath = resolvePublicPath(card.foilMaskImage, MASK_ROOT);
  const targets = [frontPath, maskPath];
  const deleted = [];
  for (const target of targets) {
    if (await exists(target)) {
      await rm(target, { force: true });
      deleted.push(path.relative(ROOT, target).replaceAll("\\", "/"));
    }
  }
  removed.push({ id: card.id, sport: card.sport, deleted });
}

const log = {
  generatedAt: new Date().toISOString(),
  policy: "Deleted only files whose tracked metadata classified them as BASE PRIZM.",
  baseRecords: baseCards.length,
  deletedFiles: removed.reduce((total, record) => total + record.deleted.length, 0),
  removed,
};
await writeFile(LOG_PATH, `${JSON.stringify(log, null, 2)}\n`, "utf8");
console.log(`Removed ${log.baseRecords} base records / ${log.deletedFiles} local files.`);
