import { useEffect, useState } from "react";
import { QUICK_PICK_EMOJIS } from "./bookmark-category-icon";

/**
 * Keyword search over emojilib (~180 KB). Loaded on first use rather than
 * imported statically: it used to live in bookmark-category-icon.tsx, which
 * every FolderLabel imports, so every screen with a folder on it paid for the
 * whole emoji keyword table before anyone opened a picker.
 *
 * `searchEmoji` stays synchronous and returns [] until the index has loaded;
 * pickers call `useEmojiIndex(open)` so they re-render once it arrives.
 */

type EmojiEntry = { emoji: string; name: string; keywords: string[] };
let emojiIndex: EmojiEntry[] | null = null;
let loading: Promise<void> | null = null;

function loadEmojiIndex(): Promise<void> {
  loading ??= import("emojilib").then(({ default: emojilib }) => {
    emojiIndex = Object.entries(emojilib as Record<string, string[]>).map(([emoji, keywords]) => ({
      emoji,
      name: (keywords[0] ?? "").replace(/_/g, " "),
      keywords,
    }));
  });
  return loading;
}

/** Starts loading the index when `enabled`; returns true once it's ready. */
export function useEmojiIndex(enabled: boolean): boolean {
  const [ready, setReady] = useState(emojiIndex !== null);
  useEffect(() => {
    if (!enabled || emojiIndex) return;
    let alive = true;
    loadEmojiIndex()
      .then(() => {
        if (alive) setReady(true);
      })
      .catch(() => {
        // Offline before the chunk was ever fetched: allow a retry next time.
        loading = null;
      });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return ready || emojiIndex !== null;
}

export function searchEmoji(query: string): Array<{ emoji: string; name: string }> {
  const q = query.toLowerCase().trim();
  if (!q || !emojiIndex) return [];
  const exact: EmojiEntry[] = [];
  const starts: EmojiEntry[] = [];
  const contains: EmojiEntry[] = [];
  for (const entry of emojiIndex) {
    const hit = entry.keywords.some((k) => k === q || k.replace(/_/g, " ") === q);
    const startHit = !hit && entry.keywords.some((k) => k.startsWith(q) || k.replace(/_/g, " ").startsWith(q));
    const containsHit = !hit && !startHit && entry.keywords.some((k) => k.includes(q) || k.replace(/_/g, " ").includes(q));
    if (hit) exact.push(entry);
    else if (startHit) starts.push(entry);
    else if (containsHit) contains.push(entry);
  }
  return [...exact, ...starts, ...contains].slice(0, 8).map(({ emoji, name }) => ({ emoji, name }));
}

/** Quick-pick emoji suggestions with their resolved names, for showing before the user types a search query. */
export function quickPickEmojiSuggestions(): Array<{ emoji: string; name: string }> {
  const nameByEmoji = new Map((emojiIndex ?? []).map(({ emoji, name }) => [emoji, name]));
  return QUICK_PICK_EMOJIS.map((emoji) => ({ emoji, name: nameByEmoji.get(emoji) ?? "" }));
}
