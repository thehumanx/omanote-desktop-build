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
      { text: "Read Atomic Habits ch.5", tag: "#books", done: false, due: "this weekend" },
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
      { title: "Book notes: Atomic Habits", preview: "The aggregation of marginal gains..." },
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
  { domain: "insights.omanote", title: "Workspace insights", category: "Metrics", categoryIcon: "📈" },
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

export const FAQ_ITEMS = [
  {
    question: "Can I organize todos into folders?",
    answer:
      "Yes. Todos now have folders, can be shared, and can keep a selected folder when you capture from the canvas so you don't have to sort everything twice.",
  },
  {
    question: "Can scheduled todos show up in the calendar?",
    answer:
      "Yes. Date-only todos stack at the top of the day, timed todos land in the right slot, and completed ones still keep their scheduled context.",
  },
  {
    question: "How does Explore work?",
    answer:
      "Hashtags act like a thread running through related things. Add #work or #health to a note, a todo, and an event, and Explore pulls them all together. It's a surprisingly satisfying way to revisit how your days connect.",
  },
  {
    question: "Can I share my bookmarks or notes with someone?",
    answer:
      "Yes. Bookmark folders and note folders can each be turned into a public link — just toggle it on in the folder settings. Visitors get a clean, read-only page. Your encrypted workspace stays private.",
  },
  {
    question: "Can I share todo folders too?",
    answer:
      "Yes. Todo folders can be shared just like note folders and bookmark categories, so the same organized workspace can be shown publicly when you want it to.",
  },
  {
    question: "Does omanote have a dark mode?",
    answer:
      "Yes. Light, dark, or system — pick in settings, and it syncs across all your devices. Public pages (landing, shared folders) stay light so links look right when you share them.",
  },
  {
    question: "Does omanote work offline?",
    answer:
      "Yes. Lose the wifi, keep capturing. Changes save locally and sync when your connection comes back. No dramatic data loss, just a quiet queue.",
  },
  {
    question: "What if I forget my passphrase?",
    answer:
      "During setup, omanote gives you a recovery key to download. Keep it somewhere you'll actually find it — because if you forget your passphrase, that key is the way back in.",
  },
  {
    question: "Can I move my data to another account?",
    answer:
      "Yes. Settings has export and import tools. Your exported data is plain text once decrypted, so treat it like the private journal it basically is.",
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
