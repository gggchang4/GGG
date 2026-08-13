/**
 * Deterministic Panini Prizm optical recipes.
 *
 * Exact parallel labels receive their own profile id. A physical pattern
 * family supplies the print geometry, while the series, parallel label and
 * card id deterministically vary frequency, phase, angle, colour and travel.
 * This keeps all cards reproducible without hand-authored per-card values.
 */

import { slugify } from "./archive-records.mjs";

const PATTERN_RECIPES = {
  base: {
    scaleX: [176, 242], scaleY: [214, 304], micro: [38, 64], angle: 96,
    intensity: [0.42, 0.55], spectral: [0.56, 0.72], contrast: [1.04, 1.13],
    gloss: [0.5, 0.62], blend: "screen", etchBlend: "screen", trajectory: "linear",
  },
  silver: {
    scaleX: [168, 228], scaleY: [190, 264], micro: [32, 52], angle: 112,
    intensity: [0.58, 0.72], spectral: [0.42, 0.62], contrast: [1.1, 1.22],
    gloss: [0.68, 0.82], blend: "screen", etchBlend: "screen", trajectory: "counter",
  },
  pandora: {
    scaleX: [28, 42], scaleY: [28, 44], micro: [12, 20], angle: 45,
    intensity: [0.62, 0.78], spectral: [0.7, 0.9], contrast: [1.12, 1.26],
    gloss: [0.66, 0.8], blend: "color-dodge", etchBlend: "screen", trajectory: "diagonal",
  },
  color: {
    scaleX: [172, 238], scaleY: [198, 286], micro: [34, 58], angle: 105,
    intensity: [0.52, 0.68], spectral: [0.34, 0.56], contrast: [1.08, 1.2],
    gloss: [0.6, 0.76], blend: "screen", etchBlend: "soft-light", trajectory: "linear",
  },
  ice: {
    scaleX: [34, 58], scaleY: [42, 70], micro: [16, 28], angle: 24,
    intensity: [0.6, 0.79], spectral: [0.58, 0.82], contrast: [1.1, 1.24],
    gloss: [0.65, 0.82], blend: "color-dodge", etchBlend: "screen", trajectory: "counter",
  },
  mojo: {
    scaleX: [38, 62], scaleY: [38, 66], micro: [14, 23], angle: 0,
    intensity: [0.6, 0.78], spectral: [0.64, 0.88], contrast: [1.08, 1.22],
    gloss: [0.62, 0.78], blend: "color-dodge", etchBlend: "screen", trajectory: "orbit",
  },
  disco: {
    scaleX: [27, 44], scaleY: [29, 47], micro: [11, 18], angle: 0,
    intensity: [0.56, 0.73], spectral: [0.48, 0.7], contrast: [1.08, 1.2],
    gloss: [0.58, 0.74], blend: "screen", etchBlend: "color-dodge", trajectory: "diagonal",
  },
  "fast-break": {
    scaleX: [20, 34], scaleY: [24, 38], micro: [9, 15], angle: 18,
    intensity: [0.5, 0.68], spectral: [0.42, 0.62], contrast: [1.06, 1.18],
    gloss: [0.56, 0.7], blend: "screen", etchBlend: "screen", trajectory: "horizontal",
  },
  sparkle: {
    scaleX: [42, 72], scaleY: [52, 86], micro: [13, 23], angle: 32,
    intensity: [0.62, 0.82], spectral: [0.7, 0.94], contrast: [1.08, 1.22],
    gloss: [0.68, 0.86], blend: "color-dodge", etchBlend: "screen", trajectory: "counter",
  },
  glitter: {
    scaleX: [18, 31], scaleY: [20, 35], micro: [7, 13], angle: 63,
    intensity: [0.66, 0.84], spectral: [0.78, 0.98], contrast: [1.12, 1.28],
    gloss: [0.7, 0.88], blend: "color-dodge", etchBlend: "screen", trajectory: "orbit",
  },
  tricolor: {
    scaleX: [188, 256], scaleY: [224, 318], micro: [48, 72], angle: 118,
    intensity: [0.5, 0.66], spectral: [0.22, 0.38], contrast: [1.06, 1.16],
    gloss: [0.58, 0.72], blend: "screen", etchBlend: "soft-light", trajectory: "horizontal",
  },
  wave: {
    scaleX: [88, 142], scaleY: [28, 52], micro: [20, 34], angle: 104,
    intensity: [0.56, 0.74], spectral: [0.48, 0.72], contrast: [1.08, 1.2],
    gloss: [0.6, 0.76], blend: "screen", etchBlend: "color-dodge", trajectory: "vertical",
  },
  "multi-wave": {
    scaleX: [74, 126], scaleY: [24, 46], micro: [18, 30], angle: 76,
    intensity: [0.62, 0.8], spectral: [0.76, 0.96], contrast: [1.1, 1.24],
    gloss: [0.64, 0.8], blend: "color-dodge", etchBlend: "screen", trajectory: "counter",
  },
  snakeskin: {
    scaleX: [32, 48], scaleY: [42, 64], micro: [13, 20], angle: 18,
    intensity: [0.5, 0.66], spectral: [0.28, 0.46], contrast: [1.12, 1.28],
    gloss: [0.52, 0.68], blend: "soft-light", etchBlend: "screen", trajectory: "diagonal",
  },
  zebra: {
    scaleX: [54, 84], scaleY: [36, 58], micro: [17, 28], angle: 68,
    intensity: [0.44, 0.6], spectral: [0.16, 0.3], contrast: [1.18, 1.34],
    gloss: [0.48, 0.64], blend: "screen", etchBlend: "overlay", trajectory: "horizontal",
  },
  elephant: {
    scaleX: [58, 92], scaleY: [64, 106], micro: [20, 34], angle: 12,
    intensity: [0.42, 0.58], spectral: [0.2, 0.36], contrast: [1.14, 1.3],
    gloss: [0.46, 0.62], blend: "soft-light", etchBlend: "screen", trajectory: "counter",
  },
  tiger: {
    scaleX: [62, 96], scaleY: [38, 62], micro: [18, 30], angle: 74,
    intensity: [0.48, 0.64], spectral: [0.22, 0.4], contrast: [1.16, 1.32],
    gloss: [0.5, 0.66], blend: "screen", etchBlend: "overlay", trajectory: "horizontal",
  },
  checker: {
    scaleX: [26, 40], scaleY: [26, 42], micro: [12, 19], angle: 45,
    intensity: [0.52, 0.68], spectral: [0.28, 0.46], contrast: [1.16, 1.32],
    gloss: [0.56, 0.72], blend: "screen", etchBlend: "difference", trajectory: "diagonal",
  },
  shimmer: {
    scaleX: [12, 22], scaleY: [138, 218], micro: [7, 12], angle: 118,
    intensity: [0.56, 0.74], spectral: [0.48, 0.72], contrast: [1.08, 1.2],
    gloss: [0.62, 0.78], blend: "color-dodge", etchBlend: "screen", trajectory: "vertical",
  },
  pulsar: {
    scaleX: [48, 76], scaleY: [48, 80], micro: [17, 28], angle: 0,
    intensity: [0.58, 0.76], spectral: [0.56, 0.8], contrast: [1.1, 1.24],
    gloss: [0.62, 0.8], blend: "color-dodge", etchBlend: "screen", trajectory: "orbit",
  },
  hyper: {
    scaleX: [22, 36], scaleY: [26, 42], micro: [10, 16], angle: 42,
    intensity: [0.56, 0.74], spectral: [0.6, 0.84], contrast: [1.1, 1.24],
    gloss: [0.6, 0.78], blend: "color-dodge", etchBlend: "screen", trajectory: "diagonal",
  },
  seismic: {
    scaleX: [72, 118], scaleY: [72, 122], micro: [21, 34], angle: 0,
    intensity: [0.58, 0.76], spectral: [0.52, 0.76], contrast: [1.1, 1.24],
    gloss: [0.6, 0.78], blend: "screen", etchBlend: "color-dodge", trajectory: "orbit",
  },
  camo: {
    scaleX: [76, 122], scaleY: [88, 142], micro: [25, 42], angle: 28,
    intensity: [0.38, 0.54], spectral: [0.12, 0.26], contrast: [1.12, 1.28],
    gloss: [0.44, 0.6], blend: "soft-light", etchBlend: "overlay", trajectory: "counter",
  },
  scope: {
    scaleX: [38, 62], scaleY: [38, 64], micro: [13, 22], angle: 0,
    intensity: [0.54, 0.7], spectral: [0.4, 0.62], contrast: [1.1, 1.22],
    gloss: [0.58, 0.74], blend: "screen", etchBlend: "color-dodge", trajectory: "orbit",
  },
  lazer: {
    scaleX: [18, 30], scaleY: [96, 158], micro: [8, 14], angle: 128,
    intensity: [0.58, 0.76], spectral: [0.58, 0.82], contrast: [1.1, 1.24],
    gloss: [0.62, 0.8], blend: "color-dodge", etchBlend: "screen", trajectory: "diagonal",
  },
  power: {
    scaleX: [36, 58], scaleY: [44, 72], micro: [13, 22], angle: 58,
    intensity: [0.58, 0.76], spectral: [0.52, 0.76], contrast: [1.12, 1.26],
    gloss: [0.6, 0.78], blend: "color-dodge", etchBlend: "overlay", trajectory: "counter",
  },
  gold: {
    scaleX: [182, 252], scaleY: [212, 304], micro: [38, 62], angle: 108,
    intensity: [0.54, 0.7], spectral: [0.16, 0.3], contrast: [1.08, 1.18],
    gloss: [0.68, 0.84], blend: "screen", etchBlend: "soft-light", trajectory: "linear",
  },
  "gold-vinyl": {
    scaleX: [118, 186], scaleY: [118, 192], micro: [17, 28], angle: 0,
    intensity: [0.68, 0.84], spectral: [0.18, 0.34], contrast: [1.12, 1.24],
    gloss: [0.78, 0.92], blend: "color-dodge", etchBlend: "screen", trajectory: "orbit",
  },
  black: {
    scaleX: [154, 224], scaleY: [188, 276], micro: [28, 48], angle: 116,
    intensity: [0.34, 0.5], spectral: [0.14, 0.28], contrast: [1.18, 1.34],
    gloss: [0.7, 0.86], blend: "screen", etchBlend: "soft-light", trajectory: "counter",
  },
  "black-gold": {
    scaleX: [104, 168], scaleY: [138, 218], micro: [24, 40], angle: 122,
    intensity: [0.5, 0.66], spectral: [0.12, 0.26], contrast: [1.16, 1.32],
    gloss: [0.72, 0.88], blend: "screen", etchBlend: "overlay", trajectory: "diagonal",
  },
  "black-finite": {
    scaleX: [18, 29], scaleY: [18, 31], micro: [7, 12], angle: 45,
    intensity: [0.42, 0.58], spectral: [0.08, 0.2], contrast: [1.22, 1.4],
    gloss: [0.78, 0.94], blend: "screen", etchBlend: "difference", trajectory: "counter",
  },
  sakura: {
    scaleX: [46, 72], scaleY: [50, 80], micro: [16, 26], angle: 22,
    intensity: [0.5, 0.68], spectral: [0.32, 0.52], contrast: [1.06, 1.18],
    gloss: [0.56, 0.72], blend: "screen", etchBlend: "color-dodge", trajectory: "diagonal",
  },
  breakaway: {
    scaleX: [58, 92], scaleY: [24, 42], micro: [15, 25], angle: 132,
    intensity: [0.48, 0.66], spectral: [0.4, 0.62], contrast: [1.08, 1.2],
    gloss: [0.56, 0.72], blend: "screen", etchBlend: "color-dodge", trajectory: "horizontal",
  },
  exclusive: {
    scaleX: [94, 156], scaleY: [118, 186], micro: [24, 40], angle: 102,
    intensity: [0.48, 0.64], spectral: [0.46, 0.68], contrast: [1.08, 1.2],
    gloss: [0.58, 0.74], blend: "screen", etchBlend: "soft-light", trajectory: "counter",
  },
};

const SPORT_TUNING = {
  nba: { frequency: 0.96, angle: -4, hue: 0 },
  nfl: { frequency: 1.08, angle: 14, hue: 5 },
  football: { frequency: 0.9, angle: -12, hue: -5 },
};

export const OPTICAL_PATTERN_NAMES = Object.freeze(Object.keys(PATTERN_RECIPES));

export function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function between(random, [minimum, maximum]) {
  return minimum + (maximum - minimum) * random();
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value, precision = 3) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function resolvePattern(parallel) {
  const label = parallel.toUpperCase();
  if (/CHERRY BLOSSOM|SAKURA/.test(label)) return "sakura";
  if (/GOLD VINYL/.test(label)) return "gold-vinyl";
  if (/BLACK FINITE/.test(label)) return "black-finite";
  if (/BLACK WHITE CHECKER|CHECKER/.test(label)) return "checker";
  if (/BLACK GOLD/.test(label)) return "black-gold";
  if (/SILVER PANDORA|PANDORA/.test(label)) return "pandora";
  if (/TIGER/.test(label)) return "tiger";
  if (/ZEBRA/.test(label)) return "zebra";
  if (/ELEPHANT/.test(label)) return "elephant";
  if (/KING SNAKE|SNAKESKIN|SNAKE/.test(label)) return "snakeskin";
  if (/RED WHITE BLUE/.test(label)) return "tricolor";
  if (/MULTI WAVE/.test(label)) return "multi-wave";
  if (/WAVE/.test(label)) return "wave";
  if (/ICE/.test(label)) return "ice";
  if (/MOJO/.test(label)) return "mojo";
  if (/FAST BREAK/.test(label)) return "fast-break";
  if (/DISCO/.test(label)) return "disco";
  if (/GLITTER/.test(label)) return "glitter";
  if (/SPARKLE/.test(label)) return "sparkle";
  if (/SHIMMER/.test(label)) return "shimmer";
  if (/PULSAR/.test(label)) return "pulsar";
  if (/HYPER/.test(label)) return "hyper";
  if (/SEISMIC/.test(label)) return "seismic";
  if (/CAMO/.test(label)) return "camo";
  if (/SCOPE/.test(label)) return "scope";
  if (/LAZER|LASER/.test(label)) return "lazer";
  if (/POWER/.test(label)) return "power";
  if (/BREAKAWAY/.test(label)) return "breakaway";
  if (/GOODRIDGE|EXCLUSIVE/.test(label)) return "exclusive";
  if (/^BLACK$/.test(label)) return "black";
  if (/GOLD/.test(label)) return "gold";
  if (/SILVER/.test(label)) return "silver";
  if (/BASE|VARIATION/.test(label)) return "base";
  return "color";
}

function resolveHues(parallel, profileSeed) {
  const label = parallel.toUpperCase();
  if (/RED WHITE BLUE/.test(label)) return [355, 218];
  if (/MULTI/.test(label)) return [194, 318];
  if (/BLACK GOLD|GOLD VINYL|GOLD/.test(label)) return [43, 24];
  if (/CHERRY BLOSSOM|SAKURA/.test(label)) return [337, 305];
  if (/TIGER/.test(label)) return [27, 8];
  if (/CAMO/.test(label)) return [92, 48];
  if (/ORANGE/.test(label)) return [25, 5];
  if (/MAROON/.test(label)) return [344, 18];
  if (/PINK/.test(label)) return [326, 286];
  if (/PURPLE/.test(label)) return [279, 224];
  if (/BLUE/.test(label)) return [215, 184];
  if (/GREEN/.test(label)) return [137, 88];
  if (/RED/.test(label)) return [355, 28];
  if (/BLACK/.test(label)) return [218, 42];
  if (/WHITE|SILVER/.test(label)) return [205, 286];
  if (/GLITTER|SPARKLE|HYPER/.test(label)) return [profileSeed % 360, (profileSeed + 148) % 360];
  return [203, 315];
}

export function opticalProfileId(parallel) {
  const normalized = parallel.toUpperCase() === "BASE PRIZM" ? "base" : slugify(parallel);
  return `prizm-${normalized}`;
}

export function buildOpticalProfile({ id, parallel, sport, seriesId, finishSeed }) {
  const normalizedParallel = parallel.trim().toUpperCase();
  const profile = opticalProfileId(normalizedParallel);
  const pattern = resolvePattern(normalizedParallel);
  const recipe = PATTERN_RECIPES[pattern];
  const cardSeed = finishSeed ?? hashString(id);
  const profileSeed = hashString(`${seriesId}:${normalizedParallel}`);
  const random = createRandom(cardSeed ^ profileSeed);
  const sportTuning = SPORT_TUNING[sport] ?? SPORT_TUNING.nba;
  const [baseHue, baseSecondaryHue] = resolveHues(normalizedParallel, profileSeed);
  const profileAngleBias = ((profileSeed >>> 9) % 23) - 11;
  const profileFrequencyBias = 0.94 + ((profileSeed >>> 14) % 13) / 100;
  const scaleX = between(random, recipe.scaleX) * sportTuning.frequency * profileFrequencyBias;
  const scaleY = between(random, recipe.scaleY) * sportTuning.frequency / profileFrequencyBias;
  const microScale = between(random, recipe.micro) * (0.94 + random() * 0.12);
  const hue = (baseHue + sportTuning.hue + (random() - 0.5) * 8 + 360) % 360;
  const secondaryHue = (baseSecondaryHue + sportTuning.hue + (random() - 0.5) * 10 + 360) % 360;
  const phase = (profileSeed % 360 + random() * 97) % 360;
  const angle = (recipe.angle + sportTuning.angle + profileAngleBias + (random() - 0.5) * 18 + 360) % 360;
  const offsetX = 4 + random() * 92;
  const offsetY = 4 + random() * 92;
  const intensity = between(random, recipe.intensity);
  const spectral = between(random, recipe.spectral);
  const contrast = between(random, recipe.contrast);
  const gloss = between(random, recipe.gloss);
  const drift = 0.72 + random() * 0.66;
  const fingerprint = [
    profile,
    cardSeed.toString(36),
    Math.round(scaleX * 10).toString(36),
    Math.round(scaleY * 10).toString(36),
    Math.round(phase * 10).toString(36),
    Math.round(offsetX * 10).toString(36),
    Math.round(offsetY * 10).toString(36),
  ].join("-");

  return {
    profile,
    pattern,
    trajectory: recipe.trajectory,
    blend: recipe.blend,
    etchBlend: recipe.etchBlend,
    fingerprint,
    hue: round(hue, 2),
    secondaryHue: round(secondaryHue, 2),
    phase: round(phase, 2),
    angle: round(angle, 2),
    scaleX: round(scaleX, 2),
    scaleY: round(scaleY, 2),
    microScale: round(microScale, 2),
    offsetX: round(offsetX, 2),
    offsetY: round(offsetY, 2),
    intensity: round(clamp(intensity, 0.25, 0.95)),
    spectral: round(clamp(spectral, 0.05, 1)),
    contrast: round(clamp(contrast, 1, 1.5)),
    gloss: round(clamp(gloss, 0.3, 1)),
    drift: round(drift),
  };
}

