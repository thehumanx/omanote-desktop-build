export type CanvasItem =
  | { id: number; kind: "note"; text: string; tag: string }
  | { id: number; kind: "todo"; text: string; tag: string; done: boolean }
  | { id: number; kind: "event"; time: string; text: string; tag: string }
  | { id: number; kind: "bookmark"; domain: string; title: string; tag: string };

export const CANVAS: CanvasItem[] = [
  { id: 1, kind: "note", text: "Launch notes: keep the homepage current", tag: "#work" },
  { id: 2, kind: "todo", text: "Review todo folders before launch", tag: "#work", done: false },
  { id: 3, kind: "todo", text: "Buy coffee beans", tag: "#errands", done: true },
  { id: 4, kind: "event", time: "7:00 AM", text: "Morning run", tag: "#health" },
  { id: 5, kind: "bookmark", domain: "rss.app", title: "Design feed roundup", tag: "#tools" },
  { id: 6, kind: "note", text: "Ideas: landing mockup should match real app chrome", tag: "#ideas" },
];

export const TODOS = [
  {
    group: "Today",
    color: "text-app-ink",
    items: [
      { text: "Review todo folders before launch", tag: "#work", done: false, due: "by 5pm today" },
      { text: "Call mom tonight", tag: "#family", done: false, due: "at 8pm" },
    ],
  },
  {
    group: "Overdue",
    color: "text-danger-ink",
    items: [{ text: "Buy coffee beans", tag: "#errands", done: false, due: "yesterday" }],
  },
  {
    group: "Upcoming",
    color: "text-app-ink-muted",
    items: [
      { text: "Todo folder sharing review", tag: "#work", done: false, due: "tomorrow" },
      { text: "Read On Emotional Intelligence ch.5", tag: "#books", done: false, due: "this weekend" },
    ],
  },
  {
    group: "Completed",
    color: "text-app-ink-faint",
    items: [
      { text: "Submit expense report", tag: "#work", done: true, due: "" },
      { text: "Team sync call", tag: "#work", done: true, due: "" },
    ],
  },
];

export const NOTES_FOLDERS = [
  {
    folder: "Work",
    icon: "💼",
    items: [
      { title: "Launch notes", preview: "Shipping RSS, insights, todo folders..." },
      { title: "Shared folder copy", preview: "Public links should still feel personal and calm..." },
    ],
  },
  {
    folder: "Personal",
    icon: "🏠",
    items: [
      { title: "Book notes: On Emotional Intelligence", preview: "Goleman's five components: self-awareness, self-regulation..." },
      { title: "Morning run thoughts", preview: "Woke up at 6am, matcha was perfect..." },
    ],
  },
  {
    folder: "Ideas",
    icon: "💡",
    items: [{ title: "App feature ideas", preview: "Show the real app chrome in the hero mockup..." }],
  },
];

export const BOOKMARKS = [
  { domain: "readwise.io", title: "Readwise Reader", category: "Reading", categoryIcon: "📚" },
  { domain: "rss.app", title: "Morning feed digest", category: "News", categoryIcon: "🗞️" },
  { domain: "linear.app", title: "Linear – Issue Tracking", category: "Tools", categoryIcon: "⚙️" },
  { domain: "insights.omanote", title: "Canvas insights", category: "Metrics", categoryIcon: "📈" },
  { domain: "vercel.com", title: "Vercel – Deploy Instantly", category: "Dev", categoryIcon: "💻" },
];

export const EVENT = [
  { time: "6:45 AM", text: "Morning run", tag: "#health", auto: false },
  { time: "8:00 AM", text: "Made matcha ☕", tag: "#morning", auto: false },
  { time: "9:30 AM", text: "Team standup", tag: "#work", auto: false },
  { time: "12:30 PM", text: "Lunch walk", tag: "#health", auto: false },
  { time: "3:00 PM", text: "Review scheduled todo", tag: "#work", auto: false },
];

export const EXPLORE_TAGS = [
  { tag: "#work", x: 50, y: 42 },
  { tag: "#health", x: 22, y: 65 },
  { tag: "#morning", x: 74, y: 22 },
  { tag: "#family", x: 28, y: 22 },
  { tag: "#books", x: 70, y: 70 },
  { tag: "#errands", x: 10, y: 40 },
  { tag: "#tools", x: 84, y: 50 },
  { tag: "#ideas", x: 50, y: 80 },
];

// Kept in sync by hand with the FAQPage JSON-LD in index.html — that's
// static markup outside the React build, so it can't import this array
// directly. If you change a question or answer here, change it there too.
export const FAQ_ITEMS = [
  {
    question: "What is omanote?",
    answer:
      "omanote (stylized in smallcase) is a personal daily canvas for capturing notes, todos, bookmarks, and events in one place, organized by the day you captured them.",
  },
  {
    question: "Is omanote an AI note-taking app?",
    answer:
      "No. omanote has no AI features. Nothing is AI-written, AI-summarized, or sent to a model. It is built around manual capture, folders, and hashtags.",
  },
  {
    question: "What is the canvas?",
    answer:
      "The canvas shows one day at a time. Anything you capture lands there first, and also appears in Notes, Todos, Bookmarks, or Events. For longer writing, create a canvas page: a full document that sits alongside the daily canvas.",
  },
  {
    question: "Can I write longer documents?",
    answer:
      "Yes. Canvas pages are full documents, similar to a Notion page or Google Doc. Create as many as you want, each with its own title, checklists, links, and images. Any page can be shared as a public link.",
  },
  {
    question: "Can I add images to omanote?",
    answer:
      "Yes, inside canvas pages. Drop an image in, resize it, and add a caption. Images are encrypted on your device before upload. Storage is capped at 200MB per account while accounts are free.",
  },
  {
    question: "Do I need slash commands?",
    answer:
      "No, but pressing / is the fastest way in. It opens the composer from anywhere in the app, already set to match the tab you are on. From there you can type a plain note, paste a link, or use /todo or /bookmark to pick a type directly. Inside a canvas page, / opens a block menu for headings, checklists, lists, images, quotes, and code blocks.",
  },
  {
    question: "How are notes, todos, bookmarks, and events connected?",
    answer:
      "Each one is a focused view of the same day. You capture on the canvas, then use the specific view to organize and manage that item later.",
  },
  {
    question: "Can I organize todos into folders?",
    answer:
      "Yes. Todos have folders, can be shared, and remember your last-used folder when you capture, so you do not have to sort everything twice.",
  },
  {
    question: "Can scheduled todos show up in the calendar?",
    answer:
      "Yes. Date-only todos stack at the top of the day, timed todos land in the right slot, and completed ones keep their scheduled context.",
  },
  {
    question: "How does Explore work?",
    answer:
      "Add the same hashtag to a note, a todo, and an event, and Explore shows them together as a map. It is a way to browse by topic instead of by date.",
  },
  {
    question: "Can I share my bookmarks, notes, or todos with someone?",
    answer:
      "Yes. Bookmark folders, note folders, todo folders, and canvas pages can each be turned into a public link from their settings. Visitors get a read-only page. One caveat: a public page has to be readable without your passphrase, so that folder or page is stored unencrypted while the link is on. Switch it off and that copy is deleted. Anything you have not shared stays encrypted.",
  },
  {
    question: "Does omanote have a dark mode?",
    answer:
      "Yes. Light, dark, or system. Pick it in settings and it syncs across your devices. Public pages stay light so shared links look consistent.",
  },
  {
    question: "Does omanote work offline?",
    answer:
      "Yes. Changes save locally and sync when your connection comes back, so you can keep capturing without a connection.",
  },
  {
    question: "Is my data private?",
    answer:
      "User content is encrypted on your device before it is stored. You unlock it with your passphrase, so the app is designed around private personal use.",
  },
  {
    question: "What if I forget my passphrase?",
    answer:
      "During setup, omanote gives you a recovery key to download. Store it somewhere safe. If you forget your passphrase, that key is the only way back into your account.",
  },
  {
    question: "Can I move my data to another account?",
    answer:
      "Yes. Settings has export and import tools. Exported data is decrypted plain text, so keep the file somewhere safe.",
  },
];

export const modeChip: Record<string, string> = {
  note: "bg-app-surface-muted text-app-ink-muted",
  todo: "bg-info-surface text-info-ink",
  bookmark: "bg-success-surface text-success-ink",
  event: "bg-danger-surface text-danger-ink",
};

const TAG_COLORS: Record<string, string> = {
  "#work": "bg-info-surface text-info-ink border-info-line",
  "#health": "bg-success-surface text-success-ink border-success-line",
  "#morning": "bg-orange-100 text-orange-700 border-orange-200",
  "#family": "bg-danger-surface text-danger-ink border-danger-line",
  "#books": "bg-warning-surface text-warning-ink border-warning-line",
  "#errands": "bg-app-surface-muted text-app-ink-muted border-app-line",
  "#tools": "bg-purple-100 text-purple-700 border-purple-200",
  "#ideas": "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
};

export function tagColor(tag: string) {
  return TAG_COLORS[tag] ?? "bg-app-surface-muted text-app-ink-muted border-app-line";
}

export function getModeFromText(text: string): string {
  if (text.startsWith("/todo")) return "todo";
  if (text.startsWith("/event")) return "event";
  if (text.startsWith("/bookmark")) return "bookmark";
  return "note";
}

// ─── Mockup artwork ───────────────────────────────────────────────────────────

/**
 * Real photography used inside the landing-page mockups, where a gradient
 * placeholder would undersell the feature being shown (the canvas-page image
 * block, specifically).
 *
 * Source: https://www.pexels.com/photo/31291321/ (aurora borealis over Iceland).
 * Pexels licence: free for commercial use, no attribution required.
 *
 * Served pre-cropped to 880x293 (3:1) WebP, ~17KB, which is 2x the widest spot
 * it renders at. Both call sites set explicit width/height so the layout does
 * not shift while it loads. If you swap the file, keep the same aspect ratio or
 * update those attributes too.
 */
export const MOCKUP_PHOTO = {
  aurora: "/mockup-aurora.webp",
} as const;

/**
 * Decorative gradients for the landing-page mockups: fake article thumbnails,
 * bookmark card images, and app-icon art.
 *
 * These are illustration, not UI colour — nothing else in the app references
 * them and they have no light/dark variants — so they are named constants here
 * rather than design tokens. `landing-data.ts` is on the design-token audit's
 * approved list for exactly this reason; keeping the raw hex inline in
 * `LandingScreen.tsx` made the audit noisy enough that people stopped reading
 * it. Add new mockup art here, not in the screen.
 */
export const MOCKUP_GRADIENT = {
  articleIndigo: "bg-[linear-gradient(135deg,#111827,#312e81)]",
  articleStone: "bg-[linear-gradient(135deg,#f5f5f4,#d6d3d1)]",
  articleSlate: "bg-[linear-gradient(135deg,#111827,#9ca3af)]",
  articleMint: "bg-[linear-gradient(135deg,#f8fafc,#bbf7d0)]",
  articleAmber: "bg-[linear-gradient(135deg,#020617,#f59e0b)]",
  articleLime: "bg-[linear-gradient(135deg,#fff7ed,#bef264)]",
  /** Extension mockup's app-icon tile. */
  appIconStripe:
    "bg-[linear-gradient(135deg,#111827_0%,#111827_38%,#f97316_39%,#f97316_74%,#d6d3d1_75%)]",
  /** Note source-card thumbnail. */
  noteThumbnail:
    "bg-[linear-gradient(135deg,#d7d7d7_0%,#f7f7f7_38%,#bdbdbd_38%,#bdbdbd_50%,#f2f2f2_50%,#f2f2f2_100%)]",
  bookmarkOrange:
    "bg-[linear-gradient(135deg,#d8d8d8_0%,#949494_48%,#ff6b12_48%,#ff6b12_70%,#1f2937_70%)]",
  bookmarkDark:
    "bg-[linear-gradient(135deg,#0d1117_0%,#0d1117_54%,#444_55%,#151515_72%,#020617_72%)]",
  bookmarkCoral: "bg-[linear-gradient(90deg,#262626,#262626),linear-gradient(135deg,#ff8a65,#ff8a65)]",
} as const;
