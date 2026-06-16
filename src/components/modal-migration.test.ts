import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migratedFiles = [
  "src/components/ImportDataModal.tsx",
  "src/components/ExportDataModal.tsx",
  "src/components/UpdateModal.tsx",
  "src/components/ExtensionModal.tsx",
  "src/screens/ExploreScreen.tsx",
  "src/components/ExploreOverlay.tsx",
];

const mixedPortalFiles = [
  "src/screens/BookmarksScreen.tsx",
  "src/screens/NotesScreen.tsx",
  "src/screens/SettingsScreen.tsx",
];

describe("modal shell migration", () => {
  it.each(migratedFiles)("%s uses BaseModal instead of a custom modal portal", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");

    expect(source).toContain("BaseModal");
    expect(source).not.toContain('from "./ModalPortal"');
    expect(source).not.toContain('from "../components/ModalPortal"');
  });

  it.each(mixedPortalFiles)("%s uses BaseModal for confirmation modals while keeping non-modal portals", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");

    expect(source).toContain("BaseModal");
  });
});
