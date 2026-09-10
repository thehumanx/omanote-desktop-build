import { toDateKey } from "@omanote/shared";
import changelogMarkdown from "../../../CHANGELOG.md?raw";
import { parseLatestVersion } from "../../lib/update-checker";
import type {
  BookmarkItem,
  DateKey,
  EventEntry,
  NoteFolder,
  NoteItem,
  PageItem,
  TodoItem,
} from "@omanote/shared";
import type { CanvasArtifactItem } from "../../app/reducer";
import type { WeekAtGlance } from "../../app/insights-local";

/**
 * Fixture data for the landing page's canvas preview.
 *
 * This feeds the *real* canvas components (see CanvasPreview.tsx), so the
 * shapes here have to satisfy the same domain types the app uses. That is the
 * point: the previous landing mockup was a parallel reimplementation of the
 * canvas UI and drifted every time the real one changed.
 *
 * Everything is dated relative to "now" at module load, so the preview never
 * shows a stale date to a visitor.
 */

const now = new Date();
const todayKey = toDateKey(now);

export const PREVIEW_TODAY_KEY: DateKey = todayKey;

/** A timestamp at a given wall-clock time today, so the feed reads as one day. */
function at(hour: number, minute: number): number {
  const date = new Date(now);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

function daysAgoKey(days: number): DateKey {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return toDateKey(date);
}

function daysAgoAt(days: number, hour: number): number {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
}

/** Minimal ProseMirror doc, so `pageDocStats` reports believable word counts. */
function pageDoc(paragraphs: string[]): string {
  return JSON.stringify({
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })),
  });
}

export const PREVIEW_NOTE_FOLDERS: NoteFolder[] = [
  { id: "folder-thinking", name: "Thinking out loud", icon: "💭", createdAt: daysAgoAt(90, 9), updatedAt: at(8, 40) },
  { id: "folder-product", name: "Product", icon: "🧩", createdAt: daysAgoAt(120, 9), updatedAt: at(13, 20) },
];

const BOOKMARK_CATEGORIES = [
  { id: "cat-reading", name: "Reading" },
  { id: "cat-dev", name: "Dev" },
];

export const PREVIEW_CATEGORY_NAME_BY_ID = new Map(
  BOOKMARK_CATEGORIES.map((category) => [category.id, category.name] as const),
);

const morningRun: EventEntry = {
  id: "event-run",
  label: "Gave talk on AI as a better half #kss",
  loggedAt: at(10, 12),
  createdAt: at(10, 12),
  createdDateKey: todayKey,
  sourceType: "manual",
};

const byteSizedNote: NoteItem = {
  id: "note-bytesized",
  body: "Most of what I think during a day is byte-sized. A half-thought, a thing to remember, something worth keeping. It never arrives shaped like a document. #ideas",
  tags: ["#ideas"],
  folderId: "folder-thinking",
  folderName: "Thinking out loud",
  createdAt: at(8, 40),
  updatedAt: at(8, 40),
  createdDateKey: todayKey,
};

/**
 * The #iceland thread.
 *
 * The tour's hashtag step claims that tagging a note, a todo and an event with
 * the same word ties them together — so the fixture has to actually show that,
 * with all three adjacent in the feed so they're on screen at once. Hashtags
 * live inline in the text: `RichTextPreview` picks them out of a note's body,
 * a todo's title and an event's label, so there's no separate field to set.
 */
const icelandNote: NoteItem = {
  id: "note-iceland",
  body: "Sid wants to add the Westfjords. It's beautiful, but it's another 400km and we'd lose two days to driving. #iceland",
  tags: ["#iceland"],
  folderId: "folder-thinking",
  folderName: "Thinking out loud",
  createdAt: at(12, 5),
  updatedAt: at(12, 5),
  createdDateKey: todayKey,
};

const danaTodo: TodoItem = {
  id: "todo-dana",
  title: "Sync up with Sid @sid@email.com #iceland",
  priority: "normal",
  status: "open",
  dueDateKey: todayKey,
  dueTime: "17:00",
  createdAt: at(12, 20),
  updatedAt: at(12, 20),
  createdDateKey: todayKey,
  folderId: "folder-personal",
  folderName: "Personal",
};

const glacierEvent: EventEntry = {
  id: "event-glacier",
  label: "Booked the glacier walk #iceland",
  loggedAt: at(12, 40),
  createdAt: at(12, 40),
  createdDateKey: todayKey,
  sourceType: "manual",
};

const systemsBookmark: BookmarkItem = {
  id: "bookmark-systems",
  categoryId: "cat-reading",
  url: "https://www.are.na/blog/notes-on-collecting",
  title: "Notes on collecting",
  siteName: "are.na",
  // The article itself is invented, so there's no og:image of its own to use.
  // This is are.na's site-wide one, hotlinked: a real bookmark on a real canvas
  // shows a real thumbnail, and the empty-icon placeholder made the card look
  // like the preview had failed. It's an external asset we don't control: if
  // are.na ever moves it, the card renders a broken image rather than falling
  // back to the icon, so this is the first thing to check if the bookmark
  // starts looking wrong.
  thumbnailUrl: "https://www.are.na/og-image.png",
  description:
    "On keeping things without needing to know yet why you kept them — collection as a slow form of thinking.",
  previewState: "ready",
  createdAt: at(10, 2),
  createdDateKey: todayKey,
};

const shippedEvent: EventEntry = {
  id: "event-shipped",
  label: "Launched omakey 3.0.0",
  loggedAt: at(11, 30),
  createdAt: at(11, 30),
  createdDateKey: todayKey,
  sourceType: "todo_completed",
  sourceTodoId: "todo-changelog",
};

const notionNote: NoteItem = {
  id: "note-not-replacing",
  body: "omanote isn't trying to replace anyone's wiki. Keep your Notion. This is for the stuff that never makes it that far. #product",
  tags: ["#product"],
  folderId: "folder-product",
  folderName: "Product",
  createdAt: at(13, 20),
  updatedAt: at(13, 20),
  createdDateKey: todayKey,
};

const icelandPage: PageItem = {
  // id === clientKey marks this as an optimistic (not-yet-synced) page, which
  // makes PageCard skip its `getPageShare` Convex query entirely. That keeps
  // the preview from firing an authenticated query as a signed-out visitor.
  id: "page-iceland",
  clientKey: "page-iceland",
  title: "Iceland trip, rough plan",
  icon: "🧊",
  docJson: pageDoc([
    "Ring road, counter-clockwise, nine days in early March.",
    "Reykjavík two nights either end. Vík and Höfn in the middle. Book the glacier walk before the dates go.",
    "Sid wants to add the Westfjords — probably a different trip.",
  ]),
  preview: "Ring road, counter-clockwise, nine days in early March.",
  createdAt: at(16, 40),
  updatedAt: at(16, 40),
  createdDateKey: todayKey,
};

const previewItems: CanvasArtifactItem[] = [
  { kind: "event", createdAt: morningRun.createdAt, data: morningRun },
  { kind: "note", createdAt: byteSizedNote.createdAt, data: byteSizedNote },
  { kind: "bookmark", createdAt: systemsBookmark.createdAt, data: systemsBookmark },
  { kind: "event", createdAt: shippedEvent.createdAt, data: shippedEvent },
  // The #iceland thread, kept consecutive so the hashtag step can show a note,
  // a todo and an event carrying the same tag in one screenful.
  { kind: "note", createdAt: icelandNote.createdAt, data: icelandNote },
  { kind: "todo", createdAt: danaTodo.createdAt, data: danaTodo },
  { kind: "event", createdAt: glacierEvent.createdAt, data: glacierEvent },
  { kind: "note", createdAt: notionNote.createdAt, data: notionNote },
  { kind: "page", createdAt: icelandPage.createdAt, data: icelandPage },
];

/** Today's feed, sorted by creation time the way `buildCanvasDayItems` sorts it. */
export const PREVIEW_CANVAS_ITEMS: CanvasArtifactItem[] = [...previewItems].sort(
  (left, right) => left.createdAt - right.createdAt,
);

/**
 * Overdue todos are deliberately personal, not roadmap items.
 *
 * This section renders a red "overdue Nd" badge per row. Feeding it the real
 * public roadmap would mean the landing page permanently advertising that the
 * roadmap is running late, updating daily. The overdue view is a genuinely
 * good part of the product and worth showing — just not with omanote's own
 * slipped deadlines as the example. Roadmap items render as ordinary open
 * todos in the day feed instead (see use-roadmap-preview.ts).
 */
export const PREVIEW_OVERDUE_TODOS: TodoItem[] = [
  {
    id: "todo-dentist",
    title: "Complete Gintama #anime",
    priority: "normal",
    status: "open",
    dueDateKey: daysAgoKey(5),
    createdAt: daysAgoAt(12, 10),
    updatedAt: daysAgoAt(12, 10),
    createdDateKey: daysAgoKey(12),
    folderId: "folder-personal",
    folderName: "Personal",
  },
  {
    id: "todo-photos",
    title: "Launch omanote mobile app",
    priority: "normal",
    status: "open",
    dueDateKey: daysAgoKey(2),
    createdAt: daysAgoAt(8, 19),
    updatedAt: daysAgoAt(8, 19),
    createdDateKey: daysAgoKey(8),
    folderId: "folder-personal",
    folderName: "Personal",
  },
];

/** Times the roadmap todos slot into the day feed at, once fetched. */
export const ROADMAP_SLOT_TIMES = [at(14, 10), at(14, 25), at(14, 40)];

/** Shown until the real roadmap arrives, and if the fetch fails entirely. */
export const PREVIEW_ROADMAP_FALLBACK: TodoItem[] = [
  "Recurring todos on mobile",
  "Markdown export for canvas pages",
].map((title, index) => ({
  id: `roadmap-fallback-${index}`,
  title,
  priority: "normal" as const,
  status: "done" as const,
  createdAt: ROADMAP_SLOT_TIMES[index]!,
  updatedAt: ROADMAP_SLOT_TIMES[index]!,
  createdDateKey: todayKey,
  folderId: "folder-roadmap",
  folderName: "Roadmap",
}));

/**
 * "Continue writing" shelf. The founder's note is starred so it always holds
 * a slot — phase 2 points it at the real published public page.
 */
export const PREVIEW_PAGES: PageItem[] = [
  {
    // Placeholder for a real published page — the plan is to point this at an
    // actual public share (like /s/roadmap is for the todo folder) once that
    // page exists. Card faces only render icon/title/date/word count, so
    // swapping in the real thing later is a data change, not a UI one.
    id: "page-how-it-works",
    clientKey: "page-how-it-works",
    title: "How omanote works",
    icon: "📖",
    starred: true,
    docJson: pageDoc([
      "Everything you capture lands on today's canvas first: notes, todos, bookmarks, events. Sort it later, or don't.",
      "Press / anywhere to open the composer. It opens already set to whatever view you're on.",
      "When a thought needs more room than a canvas entry, make it a page. This is one.",
    ]),
    preview: "Everything you capture lands on today's canvas first.",
    createdAt: daysAgoAt(210, 22),
    updatedAt: daysAgoAt(4, 21),
    createdDateKey: daysAgoKey(210),
  },
  {
    id: "page-reading-notes",
    clientKey: "page-reading-notes",
    title: "Reading notes — Thinking in Systems",
    icon: "📗",
    docJson: pageDoc([
      "Stocks and flows. The bathtub metaphor keeps working harder than it should.",
      "Delays in feedback loops are where most bad intuition lives — you correct for a signal that already stopped being true.",
    ]),
    preview: "Stocks and flows. The bathtub metaphor keeps working harder than it should.",
    createdAt: daysAgoAt(18, 20),
    updatedAt: daysAgoAt(2, 20),
    createdDateKey: daysAgoKey(18),
  },
  {
    id: "page-q4",
    clientKey: "page-q4",
    title: "Q4 braindump",
    icon: "🗒️",
    docJson: pageDoc([
      "Offline-first is mostly done. The remaining gap is conflict resolution on todos edited from two devices.",
      "Extension needs a proper options page before anyone else can use it.",
    ]),
    preview: "Offline-first is mostly done.",
    createdAt: daysAgoAt(31, 11),
    updatedAt: daysAgoAt(6, 16),
    createdDateKey: daysAgoKey(31),
  },
];

/**
 * The "omanote updates" row, read from the real CHANGELOG.md rather than
 * invented. The landing page already parses it for the footer version, so this
 * costs nothing and keeps the preview honest — it advertises whatever actually
 * shipped last, automatically, instead of a made-up version that goes stale.
 */
const latestVersion = parseLatestVersion(changelogMarkdown);

export const PREVIEW_UPDATE = {
  version: latestVersion?.version ?? "v0.9",
  summary:
    latestVersion?.summary ||
    "A new version of omanote is ready — take a look at what's new.",
};

/**
 * The preview's greeting.
 *
 * The app picks from a long list per time bucket, including lines that aren't
 * greetings at all ("Making progress", "Slow and steady, that's fine"). Those
 * read fine to someone who already uses omanote, but they're a strange first
 * sentence for a stranger — and appending a name to them gives you two commas.
 * So the preview keeps the app's hour boundaries and uses one plain greeting
 * per part of the day, with "early" folded into morning.
 */
export function previewGreeting(date = new Date()): { emoji: string; text: string } {
  const hour = date.getHours();
  if (hour >= 4 && hour < 12) return { emoji: "☀️", text: "Good morning, friend!" };
  if (hour >= 12 && hour < 17) return { emoji: "⛅", text: "Good afternoon, friend!" };
  if (hour >= 17 && hour < 21) return { emoji: "🌆", text: "Good evening, friend!" };
  return { emoji: "🌙", text: "Good night, friend!" };
}

export const PREVIEW_WEEK_AT_GLANCE: WeekAtGlance = {
  streakDays: 34,
  todosCount: 11,
  notesCount: 14,
  bookmarksCount: 6,
  eventsCount: 9,
};
