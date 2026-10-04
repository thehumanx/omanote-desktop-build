/**
 * CHANGELOG.md parsing. Pure — no browser APIs — because it runs in two
 * places: at build time in src/build/vite-changelog-plugin.ts (which produces
 * `virtual:changelog` and the version JSON files) and in the lazy Updates
 * screen, the one place that still renders the full markdown.
 */

export type VersionInfo = {
  version: string;
  date: string;
  summary: string;
  items: string[];
};

const VERSION_HEADING_RE = /^### (v[\d.]+)\s*\[([^\]]+)\]/i;

export function parseVersions(markdown: string, sectionTitle = "Versions"): VersionInfo[] {
  const lines = markdown.split(/\r?\n/);

  const normalizedSectionTitle = `## ${sectionTitle}`.toLowerCase();
  const sectStart = lines.findIndex((l) => l.trim().toLowerCase() === normalizedSectionTitle);
  if (sectStart === -1) return [];

  const versions: VersionInfo[] = [];
  let i = sectStart + 1;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (/^##\s+/.test(line)) break;

    const versionMatch = line.match(VERSION_HEADING_RE);
    if (!versionMatch) {
      i += 1;
      continue;
    }

    const version = versionMatch[1];
    const date = versionMatch[2];
    let summary = "";
    const items: string[] = [];

    i += 1;
    while (i < lines.length) {
      const blockLine = lines[i].trim();
      if (/^###/.test(blockLine) || /^##\s+/.test(blockLine)) break;

      if (blockLine.startsWith("> ")) {
        summary = blockLine.slice(2).trim();
      } else if (blockLine.startsWith("- ")) {
        items.push(blockLine.slice(2).trim());
      }
      i += 1;
    }

    versions.push({ version, date, summary, items });
  }

  return versions;
}

export function parseLatestVersion(markdown: string, sectionTitle = "Versions"): VersionInfo | null {
  return parseVersions(markdown, sectionTitle)[0] ?? null;
}

/** Body of a `## <sectionTitle>` section, up to the next `##`. */
export function extractSection(markdown: string, sectionTitle = "Versions"): string {
  const lines = markdown.split(/\r?\n/);
  const normalizedSectionTitle = `## ${sectionTitle}`.toLowerCase();
  const start = lines.findIndex((line) => line.trim().toLowerCase() === normalizedSectionTitle);
  if (start === -1) return "";

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }

  return lines.slice(start + 1, end).join("\n").trim();
}

export type ChangelogProduct = "application" | "extension";

export type Milestone = {
  product: ChangelogProduct;
  version: string;
  date: string;
  /** Epoch ms of `date`, for ordering and month grouping. NaN if unparseable. */
  time: number;
  title: string;
  summary: string;
};

/**
 * `<!-- milestone: Title -->` under a version heading marks that release for the
 * Updates timeline. It's an HTML comment so it stays invisible on GitHub, and
 * the detailed changelog renderer skips it.
 */
export const MILESTONE_RE = /^<!--\s*milestone:\s*(.+?)\s*-->$/i;

const PRODUCT_SECTIONS: Array<{ product: ChangelogProduct; sectionTitle: string }> = [
  { product: "application", sectionTitle: "Versions" },
  { product: "extension", sectionTitle: "Extension Versions" },
];

function parseSectionMilestones(markdown: string, product: ChangelogProduct, sectionTitle: string): Milestone[] {
  const milestones: Milestone[] = [];
  let current: Milestone | null = null;

  for (const raw of extractSection(markdown, sectionTitle).split(/\r?\n/)) {
    const line = raw.trim();
    const heading = line.match(VERSION_HEADING_RE);
    if (heading) {
      current = { product, version: heading[1], date: heading[2], time: Date.parse(heading[2]), title: "", summary: "" };
      continue;
    }
    if (!current) continue;

    const marker = line.match(MILESTONE_RE);
    if (marker && !current.title) {
      current.title = marker[1];
      milestones.push(current);
    } else if (line.startsWith("> ") && !current.summary) {
      current.summary = line.slice(2).trim();
    }
  }

  return milestones;
}

/** Marked releases from both products, newest first. */
export function parseMilestones(markdown: string): Milestone[] {
  return PRODUCT_SECTIONS.flatMap(({ product, sectionTitle }) => parseSectionMilestones(markdown, product, sectionTitle)).sort(
    (a, b) => (b.time || 0) - (a.time || 0),
  );
}
