import { folderColorStyle } from "./folder-color";
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

interface CategoryIconDef {
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

const EMOJI_SHORTCODES: Record<string, string> = {
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

function resolveShortcode(raw: string): string {
  const colonMatch = raw.match(/^:([a-z0-9_-]+):$/);
  const name = colonMatch ? colonMatch[1] : raw.toLowerCase().trim();
  return EMOJI_SHORTCODES[name] ?? raw;
}

export function parseIconInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const resolved = resolveShortcode(trimmed);
  return resolved;
}

interface CategoryIconViewProps {
  icon?: string;
  size?: "sm" | "md";
  className?: string;
  /**
   * The folder's colour key. Tints a drawn glyph with that colour's darker
   * "ink" shade. **Emoji deliberately ignore it** — they carry their own
   * colours, and forcing a `color` onto one does nothing on most platforms
   * while breaking the few that render monochrome.
   */
  color?: string;
}

export function CategoryIconView({ icon, size = "sm", className, color }: CategoryIconViewProps) {
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const textSize = size === "sm" ? "text-base leading-none" : "text-lg leading-none";
  const palette = folderColorStyle(color);
  const inkStyle = palette ? { color: palette.ink } : undefined;

  if (!icon) {
    return <Folder className={[iconSize, className].filter(Boolean).join(" ")} style={inkStyle} />;
  }

  const LucideComponent = lucideIconByName.get(icon);
  if (LucideComponent) {
    return <LucideComponent className={[iconSize, className].filter(Boolean).join(" ")} style={inkStyle} />;
  }

  if (isEmojiString(icon)) {
    return <span className={[textSize, className].filter(Boolean).join(" ")}>{icon}</span>;
  }

  return <Folder className={[iconSize, className].filter(Boolean).join(" ")} style={inkStyle} />;
}
