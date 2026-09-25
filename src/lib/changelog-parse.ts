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
