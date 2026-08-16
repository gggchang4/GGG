/** Rebind deterministic optical recipes without altering physical scan data. */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { buildOpticalProfile } from "./prizm-optics.mjs";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "data", "sportsCardArchive.generated.json");
const cards = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
const rebound = cards.map((card) => {
  const optics = buildOpticalProfile({ ...card, finishSeed: card.finishSeed });
  return { ...card, foil: optics.profile, optics };
});
await writeFile(MANIFEST_PATH, `${JSON.stringify(rebound, null, 2)}\n`, "utf8");
console.log(`Bound ${rebound.length} paired-scan optical profiles without changing scan provenance.`);

