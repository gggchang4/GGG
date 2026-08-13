/** Generate one material mask per archive scan from its own print values. */
import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, "public", "media", "cards", "archive");
const MASK_ROOT = path.join(ROOT, "public", "media", "cards", "archive-masks");

async function buildMask(sport, filename) {
  const source = path.join(SOURCE_ROOT, sport, filename);
  const destinationDirectory = path.join(MASK_ROOT, sport);
  const destination = path.join(destinationDirectory, filename.replace(/\.webp$/, ".png"));
  await mkdir(destinationDirectory, { recursive: true });

  const { data, info } = await sharp(source)
    .resize(350, 490)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = Buffer.alloc(info.width * info.height);
  const cx = info.width / 2;
  const cy = info.height * 0.45;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 3;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
      const chroma = max - min;
      const nx = Math.abs((x - cx) / cx);
      const ny = Math.abs((y - cy) / (info.height * 0.55));
      const border = Math.max(nx ** 2.4, ny ** 3.1);
      const metallic = Math.min(1, luma / 188) * (1 - Math.min(0.62, chroma / 320));
      const printRelief = Math.min(1, chroma / 105) * 0.18;
      const subjectSuppression = nx < 0.42 && y > info.height * 0.14 && y < info.height * 0.78 ? 0.34 : 1;
      const value = (0.12 + border * 0.72 + metallic * 0.46 + printRelief) * subjectSuppression;
      alpha[y * info.width + x] = Math.round(Math.min(0.9, value) * 255);
    }
  }

  const white = Buffer.alloc(info.width * info.height * 4, 255);
  for (let index = 0; index < alpha.length; index += 1) white[index * 4 + 3] = alpha[index];
  await sharp(white, { raw: { width: info.width, height: info.height, channels: 4 } })
    .blur(1.15)
    .resize(700, 980)
    .png({ compressionLevel: 9, palette: false })
    .toFile(destination);
}

for (const sport of ["nba", "nfl", "football"]) {
  const filenames = (await readdir(path.join(SOURCE_ROOT, sport))).filter((file) => file.endsWith(".webp"));
  let done = 0;
  const workers = Array.from({ length: 8 }, async (_, workerIndex) => {
    for (let index = workerIndex; index < filenames.length; index += 8) {
      await buildMask(sport, filenames[index]);
      done += 1;
      process.stdout.write(`\r${sport}: ${done}/${filenames.length}`);
    }
  });
  await Promise.all(workers);
  process.stdout.write("\n");
}
