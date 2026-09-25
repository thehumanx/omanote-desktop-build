import { readLocalStorageOptional, stringCodec, writeLocalStorage } from "./local-storage";
import type { VersionInfo } from "./changelog-parse";

const LAST_SEEN_VERSION_KEY = "omanote:last-seen-version";

export function getUnseenVersions(versions: VersionInfo[], lastSeen: string | null): VersionInfo[] {
  if (!versions.length) return [];
  if (!lastSeen) return versions;

  const lastSeenIdx = versions.findIndex((versionInfo) => versionInfo.version === lastSeen);
  if (lastSeenIdx === -1) return versions;
  return versions.slice(0, lastSeenIdx);
}

export function getLastSeenVersion(): string | null {
  return readLocalStorageOptional(LAST_SEEN_VERSION_KEY, stringCodec) ?? null;
}

export function markVersionSeen(version: string): void {
  writeLocalStorage(LAST_SEEN_VERSION_KEY, stringCodec, version);
}
