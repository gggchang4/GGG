/**
 * Parse the cached SportsCardsPro collection table without making a network
 * request. The title cell is the authoritative source for the exact parallel
 * name and published print run.
 */

export function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseTitle(title) {
  const parallelMatch = title.match(/\[([^\]]+)\]\s*#[^#]*$/);
  return {
    sourceRecord: title.trim(),
    parallel: parallelMatch?.[1].trim().toUpperCase() ?? "BASE PRIZM",
  };
}

export function extractCollectionProducts(markdown, sourceSlug) {
  const records = [];
  const gamePath = `/game/${sourceSlug}/`;

  for (const line of markdown.split(/\r?\n/)) {
    if (!line.includes(gamePath)) continue;

    const imageMatch = line.match(
      /!\[Image \d+\]\((https:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[^/]+\/60\.jpg)\)/,
    );
    const sourceLinkMatch = line.match(
      new RegExp(
        `https?://(?:www\\.)?sportscardspro\\.com${gamePath.replaceAll("/", "\\/")}([^ )\"]+)`,
      ),
    );
    if (!imageMatch || !sourceLinkMatch) continue;

    const slug = sourceLinkMatch[1];
    const titleHref = `http://www.sportscardspro.com${gamePath}${slug}`;
    const titleAnchorEnd = `](${titleHref})`;
    const titleLinkIndex = line.indexOf(titleAnchorEnd);
    const titleStart = line.lastIndexOf("| [", titleLinkIndex);

    let sourceRecord = "";
    let parallel = "BASE PRIZM";
    let serial = null;

    if (titleLinkIndex >= 0 && titleStart >= 0) {
      const title = line.slice(titleStart + 3, titleLinkIndex);
      ({ sourceRecord, parallel } = parseTitle(title));
      const tail = line.slice(titleLinkIndex + titleAnchorEnd.length);
      serial = tail.match(/^\/(\d+)/)?.[1] ?? null;
    }

    records.push({
      image: imageMatch[1],
      slug,
      sourceRecord,
      parallel,
      serial,
    });
  }

  return records;
}

