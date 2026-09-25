/// <reference types="vite/client" />


declare module "virtual:changelog" {
  // Mirrors VersionInfo in src/lib/changelog-parse.ts (an ambient module
  // can't import through a relative path).
  type VersionInfo = { version: string; date: string; summary: string; items: string[] };
  /** The newest app versions in CHANGELOG.md, newest first (see src/build/vite-changelog-plugin.ts). */
  export const appVersions: VersionInfo[];
  export const extensionVersions: VersionInfo[];
  /** The version this bundle was built from. */
  export const currentVersion: VersionInfo | null;
}
