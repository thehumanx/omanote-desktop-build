const LAST_SEEN_VERSION_KEY = "omanote:last-seen-version";

export function maskEmail(email: string): string {
  const atIdx = email.indexOf("@");
  if (atIdx === -1) return email;
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***${domain}`;
}

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

export function getUnseenVersions(versions: VersionInfo[], lastSeen: string | null): VersionInfo[] {
  if (!versions.length) return [];
  if (!lastSeen) return versions;

  const lastSeenIdx = versions.findIndex((versionInfo) => versionInfo.version === lastSeen);
  if (lastSeenIdx === -1) return versions;
  return versions.slice(0, lastSeenIdx);
}

export function getLastSeenVersion(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_VERSION_KEY);
  } catch {
    return null;
  }
}

export function markVersionSeen(version: string): void {
  try {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, version);
  } catch {
    // ignore storage errors
  }
}
