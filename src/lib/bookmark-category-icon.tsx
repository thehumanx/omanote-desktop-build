import emojilib from "emojilib";
import {
  Bookmark,
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  Code2,
  Cpu,
  Film,
  Folder,
  Gamepad2,
  Globe,
  Heart,
  Home,
  Music,
  Newspaper,
  Palette,
  Rocket,
  ShoppingBag,
  Star,
  Tag,
  type LucideIcon,
} from "lucide-react";

export interface CategoryIconDef {
  name: string;
  label: string;
  component: LucideIcon;
}

export const LUCIDE_CATEGORY_ICONS: CategoryIconDef[] = [
  { name: "Folder", label: "Folder", component: Folder },
  { name: "Star", label: "Star", component: Star },
  { name: "Heart", label: "Heart", component: Heart },
  { name: "Bookmark", label: "Bookmark", component: Bookmark },
  { name: "Tag", label: "Tag", component: Tag },
  { name: "Globe", label: "Globe", component: Globe },
  { name: "ShoppingBag", label: "Shopping", component: ShoppingBag },
  { name: "Briefcase", label: "Work", component: Briefcase },
  { name: "Code2", label: "Code", component: Code2 },
  { name: "BookOpen", label: "Books", component: BookOpen },
  { name: "Music", label: "Music", component: Music },
  { name: "Camera", label: "Camera", component: Camera },
  { name: "Film", label: "Film", component: Film },
  { name: "Gamepad2", label: "Gaming", component: Gamepad2 },
  { name: "Palette", label: "Art", component: Palette },
  { name: "Cpu", label: "Tech", component: Cpu },
  { name: "Newspaper", label: "News", component: Newspaper },
  { name: "Rocket", label: "Rocket", component: Rocket },
  { name: "Building2", label: "Business", component: Building2 },
  { name: "Home", label: "Home", component: Home },
];

const lucideIconByName = new Map<string, LucideIcon>(
  LUCIDE_CATEGORY_ICONS.map(({ name, component }) => [name, component]),
);

export const EMOJI_SHORTCODES: Record<string, string> = {
  folder: "📁",
  star: "⭐",
  heart: "❤️",
  bookmark: "🔖",
  fire: "🔥",
  rocket: "🚀",
  bulb: "💡",
  book: "📚",
  code: "💻",
  art: "🎨",
  music: "🎵",
  movie: "🎬",
  game: "🎮",
  money: "💰",
  work: "💼",
  home: "🏠",
  globe: "🌍",
  camera: "📷",
  tools: "🛠️",
  chart: "📊",
  brain: "🧠",
  lock: "🔒",
  trophy: "🏆",
  link: "🔗",
  pin: "📌",
  tag: "🏷️",
  gear: "⚙️",
  magic: "✨",
  flag: "🚩",
};

export const QUICK_PICK_EMOJIS = [
  "📁", "⭐", "🔥", "🚀", "💡", "📚", "💻", "🎨",
  "🎵", "🎮", "💰", "🌍", "🧠", "🏆", "✨", "⚙️",
];

function isEmojiString(value: string): boolean {
  return /\p{Emoji}/u.test(value) && !LUCIDE_CATEGORY_ICONS.some((i) => i.name === value);
}

export function resolveShortcode(raw: string): string {
  const colonMatch = raw.match(/^:([a-z0-9_-]+):$/);
  const name = colonMatch ? colonMatch[1] : raw.toLowerCase().trim();
  return EMOJI_SHORTCODES[name] ?? raw;
}

type EmojiEntry = { emoji: string; name: string; keywords: string[] };
let _emojiIndex: EmojiEntry[] | null = null;

function getEmojiIndex(): EmojiEntry[] {
  if (_emojiIndex) return _emojiIndex;
  _emojiIndex = Object.entries(emojilib as Record<string, string[]>).map(([emoji, keywords]) => ({
    emoji,
    name: (keywords[0] ?? "").replace(/_/g, " "),
    keywords: keywords as string[],
  }));
  return _emojiIndex;
}

export function searchEmoji(query: string): Array<{ emoji: string; name: string }> {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const index = getEmojiIndex();
  const exact: EmojiEntry[] = [];
  const starts: EmojiEntry[] = [];
  const contains: EmojiEntry[] = [];
  for (const entry of index) {
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
  const index = getEmojiIndex();
  const nameByEmoji = new Map(index.map(({ emoji, name }) => [emoji, name]));
  return QUICK_PICK_EMOJIS.map((emoji) => ({ emoji, name: nameByEmoji.get(emoji) ?? "" }));
}

export function parseIconInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const resolved = resolveShortcode(trimmed);
  return resolved;
}

export interface CategoryIconViewProps {
  icon?: string;
  size?: "sm" | "md";
  className?: string;
}

export function CategoryIconView({ icon, size = "sm", className }: CategoryIconViewProps) {
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const textSize = size === "sm" ? "text-base leading-none" : "text-lg leading-none";

  if (!icon) {
    return <Folder className={[iconSize, className].filter(Boolean).join(" ")} />;
  }

  const LucideComponent = lucideIconByName.get(icon);
  if (LucideComponent) {
    return <LucideComponent className={[iconSize, className].filter(Boolean).join(" ")} />;
  }

  if (isEmojiString(icon)) {
    return <span className={[textSize, className].filter(Boolean).join(" ")}>{icon}</span>;
  }

  return <Folder className={[iconSize, className].filter(Boolean).join(" ")} />;
}
