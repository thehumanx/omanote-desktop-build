export type TypingPhrase = {
  text: string;
};

export const TYPING_PHRASES: TypingPhrase[] = [
  { text: "had the best matcha this morning #morning" },
  { text: "/todo call mom tonight #family" },
  { text: "/event morning run 6:45 AM #health" },
  { text: "/bookmark https://readwise.io" },
  { text: "idea: keep launch notes in one place #work" },
  { text: "/todo ship the landing redesign by friday #work" },
];

export const BENTO_PHRASES: TypingPhrase[] = [
  { text: "made the best matcha today #morning" },
  { text: "/todo call dentist next week #health" },
  { text: "/bookmark https://readwise.io" },
  { text: "/event evening walk 8pm #health" },
];

export type CanvasItem =
  | { id: number; kind: "note"; text: string; tag: string }
  | { id: number; kind: "todo"; text: string; tag: string; done: boolean }
  | { id: number; kind: "event"; time: string; text: string; tag: string }
  | { id: number; kind: "bookmark"; domain: string; title: string; tag: string };

export const CANVAS: CanvasItem[] = [
  { id: 1, kind: "note", text: "Had the best matcha this morning", tag: "#morning" },
  { id: 2, kind: "todo", text: "Call mom tonight", tag: "#family", done: false },
  { id: 3, kind: "todo", text: "Buy coffee beans", tag: "#errands", done: true },
  { id: 4, kind: "event", time: "7:00 AM", text: "Morning run", tag: "#health" },
  { id: 5, kind: "bookmark", domain: "readwise.io", title: "Readwise Reader", tag: "#tools" },
  { id: 6, kind: "note", text: "Idea: keep launch notes in one place", tag: "#work" },
];

export const TODOS = [
  {
    group: "Today",
    color: "text-app-ink",
    items: [
      { text: "Ship landing page redesign", tag: "#work", done: false, due: "by 5pm today" },
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
      { text: "Read Atomic Habits ch.5", tag: "#books", done: false, due: "this weekend" },
      { text: "Renew gym membership", tag: "#health", done: false, due: "Apr 30" },
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
      { title: "Q2 goals", preview: "Ship v1 landing page, improve onboarding..." },
      { title: "Meeting notes – Apr 22", preview: "Discussed roadmap priorities for Q2..." },
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
    items: [{ title: "App feature ideas", preview: "Landing page with interactive demo..." }],
  },
];

export const BOOKMARKS = [
  { domain: "readwise.io", title: "Readwise Reader", category: "Reading", categoryIcon: "📚" },
  { domain: "omarchy.org", title: "Omarchy by DHH", category: "Inspiration", categoryIcon: "✨" },
  { domain: "linear.app", title: "Linear – Issue Tracking", category: "Tools", categoryIcon: "⚙️" },
  { domain: "obsidian.md", title: "Obsidian – Note-taking", category: "Reference", categoryIcon: "🔗" },
  { domain: "vercel.com", title: "Vercel – Deploy Instantly", category: "Dev", categoryIcon: "💻" },
];

export const EVENT = [
  { time: "6:45 AM", text: "Morning run", tag: "#health", auto: false },
  { time: "8:00 AM", text: "Made matcha ☕", tag: "#morning", auto: false },
  { time: "9:30 AM", text: "Team standup", tag: "#work", auto: true },
  { time: "12:30 PM", text: "Lunch walk", tag: "#health", auto: false },
  { time: "3:00 PM", text: "Submit expense report", tag: "#work", auto: true },
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
    question: "What is omanote?",
    answer:
      "omanote (always smallcase, yes on purpose) is an opinionated daily workspace for capturing notes, todos, bookmarks, events, and all the small stuff that makes up a day — in one place.",
  },
  {
    question: "Is omanote an AI note-taking app?",
    answer:
      "Nope. No AI, no 'smart suggestions,' no chatbot waiting to summarize your thoughts at you. Just a clean, opinionated workspace built around fast capture, hashtags, and keeping your stuff private.",
  },
  {
    question: "What is the canvas?",
    answer:
      "The canvas is your daily dumping ground — in the best possible way. Anything you capture today lands there first, then it can also live in Notes, Todos, Bookmarks, or Event. It's the starting point, not the destination.",
  },
  {
    question: "Do I need slash commands?",
    answer:
      "Not at all. Type plain text, paste a link, and omanote will figure it out. Slash commands are just a shortcut for when you already know what you're making.",
  },
  {
    question: "How are notes, todos, bookmarks, and events connected?",
    answer:
      "They're all specialist views of the same daily workspace. The canvas is where things land; the other views are where you manage them when you're actually ready to.",
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
    question: "Is my data private?",
    answer:
      "Your content is encrypted on the client before it ever leaves your device. Only you — with your passphrase — can unlock it. The app is built for personal use, and that means actually private.",
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

export const ROADMAP = [
  {
    phase: "Now",
    focus: "Core polish & reliability",
    outcomes: [
      "Improve hashtag discovery and mind map interactions.",
      "Keep day-first capture fast, stable, and trustworthy.",
      "Refine update visibility directly inside the app.",
    ],
  },
  {
    phase: "Next",
    focus: "Planned features",
    outcomes: [
      "Build mobile applications.",
      "Improve hashtag features.",
      "Expand extension capabilities and cross-surface capture.",
    ],
  },
  {
    phase: "Later",
    focus: "Connected omanote ecosystem",
    outcomes: [
      "Make cross-surface capture and recall seamless.",
      "Expand connected-memory retrieval beyond basic hashtag linking.",
      "Keep simple defaults while supporting deeper power workflows.",
    ],
  },
];

export function getModeFromText(text: string): string {
  if (text.startsWith("/todo")) return "todo";
  if (text.startsWith("/event")) return "event";
  if (text.startsWith("/bookmark")) return "bookmark";
  return "note";
}
