/**
 * Compatibility entry point.
 *
 * The former 300-card builder generated archive backs and admitted base
 * cards. Both behaviours violate the physical-scan archive policy, so every
 * build path now resolves to the curated paired-scan pipeline.
 */
await import("./build-special-archive.mjs");
