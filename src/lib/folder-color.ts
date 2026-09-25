/**
 * The eight colours a folder (or page) can be tinted with from the icon
 * picker.
 *
 * Records store the **key**, never a hex value. Two reasons: the same folder
 * has to look right in light and dark mode, which one stored colour can't do;
 * and a palette baked into user rows could never be restyled without a
 * migration. The actual values live as CSS custom properties in index.css —
 * keep the two lists in step.
 */
export const FOLDER_COLORS = [
  "rose",
  "amber",
  "emerald",
  "teal",
  "sky",
  "indigo",
  "violet",
  "pink",
] as const;

type FolderColor = (typeof FOLDER_COLORS)[number];

/**
 * Guards a value read back from the server. An unknown key (a colour removed
 * from the palette, a row written by a newer client) reads as "no colour"
 * rather than resolving to a `var()` that doesn't exist and painting
 * `transparent`.
 */
export function isFolderColor(value: string | undefined | null): value is FolderColor {
  return typeof value === "string" && (FOLDER_COLORS as readonly string[]).includes(value);
}

type FolderColorStyle = {
  /** Container/tab background. */
  surface: string;
  /** Darker shade of the same hue, for a Lucide icon. */
  ink: string;
};

/**
 * CSS `var()` references for a colour key, or `null` when the folder has no
 * colour (or an unrecognised one) and should use the default surfaces.
 *
 * Returns `var()` strings for inline `style={}` rather than Tailwind classes:
 * the key is only known at runtime, and `bg-folder-${key}` would need all
 * sixteen utilities enumerated in the Tailwind config to survive purging.
 */
export function folderColorStyle(value: string | undefined | null): FolderColorStyle | null {
  if (!isFolderColor(value)) return null;
  return {
    surface: `var(--folder-${value}-surface)`,
    ink: `var(--folder-${value}-ink)`,
  };
}
