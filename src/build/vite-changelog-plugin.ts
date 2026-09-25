import { readFileSync, writeFileSync } from "node:fs";
import type { Plugin } from "vite";
import { parseVersions } from "../lib/changelog-parse";

/**
 * Build-time only (imported by vite.config.ts and vitest.config.ts, never by
 * the app). It lives under src/ rather than scripts/ because the public
 * desktop build repo syncs src/ and vite.config.ts but not scripts/.
 *
 * CHANGELOG.md is the source of truth for the app's version. This plugin
 * parses it once, at build time, into three outputs:
 *
 * - `virtual:changelog` — the running build's version plus its recent release
 *   notes, for the update banner/modal, error reports and the landing page.
 *   Importing the raw markdown instead put ~70 KB in the main chunk.
 * - `public/version-latest.json` — `{ version }`, ~30 bytes. What
 *   UpdateContext polls every few minutes.
 * - `public/version.json` — `{ version, versions }`, fetched only when the
 *   polled version differs from the running one. Desktop builds up to v0.33.7
 *   poll this file directly and read `versions`, so it must keep that shape.
 *   It used to carry the whole raw changelog too (135 KB per poll).
 */

// Enough to cover anyone who skipped a few releases; the full history lives on
// the Updates screen.
const RECENT_APP_VERSIONS = 20;
const RECENT_EXTENSION_VERSIONS = 5;

const VIRTUAL_ID = "virtual:changelog";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

function readManifest() {
  const markdown = readFileSync(new URL("../../CHANGELOG.md", import.meta.url), "utf-8");
  const appVersions = parseVersions(markdown).slice(0, RECENT_APP_VERSIONS);
  const extensionVersions = parseVersions(markdown, "Extension Versions").slice(0, RECENT_EXTENSION_VERSIONS);
  return { appVersions, extensionVersions };
}

export function changelogPlugin({ writeFiles = true } = {}): Plugin {
  const writeVersionFiles = () => {
    try {
      const { appVersions } = readManifest();
      if (!appVersions.length) return;
      const version = appVersions[0].version;
      const publicDir = new URL("../../public/", import.meta.url);
      writeFileSync(new URL("version-latest.json", publicDir), JSON.stringify({ version }));
      writeFileSync(new URL("version.json", publicDir), JSON.stringify({ version, versions: appVersions }));
    } catch (e) {
      console.warn("[changelog] Failed to write public/version*.json:", e);
    }
  };

  return {
    name: "changelog",
    buildStart: writeFiles ? writeVersionFiles : undefined,
    configureServer: writeFiles ? writeVersionFiles : undefined,
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_VIRTUAL_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return undefined;
      this.addWatchFile(new URL("../../CHANGELOG.md", import.meta.url).pathname);
      const { appVersions, extensionVersions } = readManifest();
      return [
        `export const appVersions = ${JSON.stringify(appVersions)};`,
        `export const extensionVersions = ${JSON.stringify(extensionVersions)};`,
        `export const currentVersion = appVersions[0] ?? null;`,
      ].join("\n");
    },
  };
}
