import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { SignInButton } from "@clerk/react";
import { CookieNotice } from "../components/CookieNotice";
import { Bookmark, CheckCheck, CheckSquare, Clock3, Compass, FileText, CalendarDays, SquarePen, Folder, Link2, List, Settings, Zap, MousePointerClick, Lock, Puzzle, LayoutDashboard, Hash, Share2, Moon, Monitor, Bell, RefreshCw, Download, Rss, BookOpen, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import changelogMarkdown from "../../CHANGELOG.md?raw";
import { SeoHead } from "../seo/SeoHead";
import { color } from "../design-system/tokens";
import { parseLatestVersion } from "../lib/update-checker";
import { useOutsideClick } from "../lib/useOutsideClick";
import { SegmentedPill, TodoCheckmark } from "../components/ui";
import {
  BOOKMARKS,
  EVENT,
  EXPLORE_TAGS,
  FAQ_ITEMS,
  getModeFromText,
  tagColor,
} from "./landing-data";

const CTA_BG = color.brandCta;
const CTA_BORDER = color.brandCtaHover;
const desktopAppReleaseUrl = "https://github.com/thehumanx/omanote-releases/releases/latest";

const NAV_TABS = [
  { key: "canvas", label: "Canvas", icon: SquarePen },
  { key: "todos", label: "Todos", icon: CheckSquare },
  { key: "notes", label: "Notes", icon: FileText },
  { key: "bookmarks", label: "Bookmarks", icon: Bookmark },
  { key: "event", label: "Events", icon: CalendarDays },
] as const;

const DUMMY_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="20" fill="${color.zinc200}"/>
      <circle cx="20" cy="15" r="6" fill="${color.zinc400}"/>
      <path d="M8 32c2.8-5.2 7-7.8 12-7.8S29.2 26.8 32 32" fill="${color.zinc400}"/>
    </svg>
  `);

// ─── Nav download dropdown ────────────────────────────────────────────────────
function DownloadNavDropdown() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useOutsideClick(menuRef, open, () => setOpen(false));

  return (
    <div ref={menuRef} className="relative hidden sm:block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((c) => !c)}
        className="inline-flex items-center gap-1.5 text-sm text-app-ink-muted hover:text-app-ink transition-colors duration-app-fast ease-app-out font-medium"
      >
        Download
        <ChevronDown
          className={[
            "h-3.5 w-3.5 transition-transform duration-app-base ease-app-out",
            open ? "rotate-180" : "rotate-0",
          ].join(" ")}
        />
      </button>
      <div
        aria-hidden={!open}
        className={[
          "absolute right-0 top-full z-30 mt-3 w-48 overflow-hidden rounded-2xl border border-app-line bg-app-surface p-2 shadow-soft",
          "origin-top-right transition-[opacity,transform] duration-app-base ease-app-out",
          open ? "pointer-events-auto opacity-100 translate-y-0 scale-100" : "pointer-events-none opacity-0 translate-y-1 scale-[0.98]",
        ].join(" ")}
      >
        <a
          href="#extension"
          onClick={() => setOpen(false)}
          className="flex w-full items-center gap-app-compact rounded-app-panel px-app-field-x py-app-field-y text-left text-sm text-app-ink-muted transition duration-app-fast ease-app-out hover:bg-app-surface-hover hover:text-app-ink"
        >
          <Puzzle className="h-4 w-4" />
          Extension
        </a>
        <a
          href={desktopAppReleaseUrl}
          onClick={() => setOpen(false)}
          className="flex w-full items-center gap-app-compact rounded-app-panel px-app-field-x py-app-field-y text-left text-sm text-app-ink-muted transition duration-app-fast ease-app-out hover:bg-app-surface-hover hover:text-app-ink"
        >
          <Monitor className="h-4 w-4" />
          Desktop app
        </a>
      </div>
    </div>
  );
}

// ─── App mockup views ─────────────────────────────────────────────────────────
const CANVAS_DAYS = [
  { key: "wed-jun-24", label: "Today · Jun 24", subtitle: "CANVAS" },
  { key: "tue-jun-23", label: "Tue · Jun 23", subtitle: "CANVAS" },
  { key: "thu-jun-25", label: "Thu · Jun 25", subtitle: "CANVAS" },
] as const;

function formatHeroTodayLabel() {
  const today = new Date();
  const month = today.toLocaleDateString("en-US", { month: "short" });
  const day = today.toLocaleDateString("en-US", { day: "numeric" });
  return `Today · ${month} ${day}`;
}

type ReaderFeedGroupPreview = {
  category: string;
  feeds: Array<{ title: string; unread: number; accent?: string }>;
};

type ReaderArticlePreview = {
  feed: string;
  age: string;
  title: string;
  summary: string;
  unread?: boolean;
  thumb: string;
};

const READER_FEED_GROUPS: ReaderFeedGroupPreview[] = [
  {
    category: "Design",
    feeds: [
      { title: "UX Collective - Medium", unread: 11 },
      { title: "DOC", unread: 35, accent: "bg-success-ink" },
    ],
  },
  {
    category: "Design Engineering",
    feeds: [{ title: "AddyOsmani.com", unread: 10 }],
  },
  {
    category: "Tech Vids",
    feeds: [{ title: "The PrimeTime", unread: 20, accent: "bg-danger-ink" }],
  },
] as const;

const READER_ARTICLES: ReaderArticlePreview[] = [
  {
    feed: "UX Collective - Medium",
    age: "1d",
    title: "The organizational cost of low taste",
    summary: "When taste is weak, organizations don't fail in strategy. They fail in decisions. This is what happens when an organization loses a shared sense of quality.",
    unread: true,
    thumb: "bg-[linear-gradient(135deg,#111827,#312e81)]",
  },
  {
    feed: "UX Collective - Medium",
    age: "1d",
    title: "Better search, worse web",
    summary: "Every number says Google AI Search is better. None of them can see the cost. Continue reading on UX Collective.",
    unread: true,
    thumb: "bg-[linear-gradient(135deg,#f5f5f4,#d6d3d1)]",
  },
  {
    feed: "UX Collective - Medium",
    age: "2d",
    title: "Access is not mastery, the polymath UX architect, A2UI under the hood",
    summary: "Weekly curated resources for designers, thinkers and makers. I've seen PMs and sales teams build working prototypes with AI tools that genuinely work.",
    thumb: "bg-[linear-gradient(135deg,#111827,#9ca3af)]",
  },
  {
    feed: "UX Collective - Medium",
    age: "2d",
    title: "What sits on the engawa",
    summary: "On designing for wishes we cannot yet wish alone. Continue reading on UX Collective.",
    thumb: "bg-[linear-gradient(135deg,#f8fafc,#bbf7d0)]",
  },
  {
    feed: "UX Collective - Medium",
    age: "2d",
    title: "The Magic 8-Ball vs. Gen AI: a surprisingly interesting comparison",
    summary: "Two products. Both fortune-tellers. Wildly different operating costs.",
    thumb: "bg-[linear-gradient(135deg,#020617,#f59e0b)]",
  },
  {
    feed: "UX Collective - Medium",
    age: "2d",
    title: "Why the best part of the flow isn't the end",
    summary: "Strip out the transaction and what's left still works, which should tell us something about the product.",
    unread: true,
    thumb: "bg-[linear-gradient(135deg,#fff7ed,#bef264)]",
  },
] as const;

type MockTab = (typeof NAV_TABS)[number]["key"];
type MockMode = "write" | "read";
type SlashArtifact = "todo" | "event" | "bookmark";
type SlashComposerPhase = "slash" | "picker" | "editor";

const SLASH_ARTIFACTS: Array<{ key: SlashArtifact; label: string }> = [
  { key: "todo", label: "todo" },
  { key: "event", label: "event" },
  { key: "bookmark", label: "bookmark" },
];

const SLASH_SEQUENCE: Array<{ phase: SlashComposerPhase; artifact: SlashArtifact; duration: number }> = [
  { phase: "slash", artifact: "todo", duration: 800 },
  { phase: "picker", artifact: "todo", duration: 1100 },
  { phase: "editor", artifact: "todo", duration: 2300 },
  { phase: "slash", artifact: "event", duration: 650 },
  { phase: "picker", artifact: "event", duration: 1000 },
  { phase: "editor", artifact: "event", duration: 2200 },
  { phase: "slash", artifact: "bookmark", duration: 650 },
  { phase: "picker", artifact: "bookmark", duration: 1050 },
  { phase: "editor", artifact: "bookmark", duration: 2500 },
];

const ARTIFACT_TYPED_TEXT: Record<SlashArtifact, string> = {
  todo: "Review launch checklist in 10 min",
  event: "Morning run 6:45 AM",
  bookmark: "https://readwise.io",
};

function useSlashCommandAnimation() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const current = SLASH_SEQUENCE[step];
    const timeout = window.setTimeout(() => {
      setStep((next) => (next + 1) % SLASH_SEQUENCE.length);
    }, current.duration);
    return () => window.clearTimeout(timeout);
  }, [step]);

  return SLASH_SEQUENCE[step];
}

function useArtifactTyping(artifact: SlashArtifact, active: boolean) {
  const [text, setText] = useState("");

  useEffect(() => {
    setText("");
  }, [artifact, active]);

  useEffect(() => {
    if (!active) return;
    const target = ARTIFACT_TYPED_TEXT[artifact];
    if (text.length >= target.length) return;

    const timeout = window.setTimeout(() => {
      setText(target.slice(0, text.length + 1));
    }, 42);
    return () => window.clearTimeout(timeout);
  }, [active, artifact, text]);

  return text;
}

function SlashCommandMenu({ active }: { active: SlashArtifact }) {
  return (
    <div className="absolute left-0 top-10 z-20 w-48 overflow-hidden rounded-lg border border-app-line bg-app-surface shadow-soft">
      {SLASH_ARTIFACTS.map((artifact) => (
        <div
          key={artifact.key}
          className={`px-4 py-2 text-base leading-6 ${
            active === artifact.key ? "bg-app-surface-muted text-app-ink" : "text-app-ink-faint"
          }`}
        >
          {artifact.label}
        </div>
      ))}
    </div>
  );
}

function ArtifactEditorPreview({ artifact, typedText }: { artifact: SlashArtifact; typedText: string }) {
  if (artifact === "todo") {
    return (
      <div className="grid w-full grid-cols-[minmax(0,1fr)_160px_auto] items-start gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-5 w-5 rounded-full border border-app-line-strong bg-app-surface shadow-sm" />
          <span className={`text-base leading-6 ${typedText ? "text-app-ink" : "text-app-line-strong"}`}>
            {typedText || "Write your checklist"}
            <span className="ml-px inline-block h-4 w-px animate-pulse bg-app-ink align-text-bottom" />
          </span>
        </div>
        <button type="button" className="justify-self-end border-b border-app-line text-sm leading-6 text-app-ink-faint">
          Others
        </button>
      </div>
    );
  }

  if (artifact === "event") {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-5 w-5 items-center justify-center rounded-md border border-app-line-strong bg-app-surface text-app-ink-faint shadow-sm">
          <Clock3 className="h-3.5 w-3.5" />
        </span>
        <span className={`text-base leading-6 ${typedText ? "text-app-ink" : "text-app-line-strong"}`}>
          {typedText || "Write your event"}
          <span className="ml-px inline-block h-4 w-px animate-pulse bg-app-ink align-text-bottom" />
        </span>
      </div>
    );
  }

  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)_200px] items-start gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-5 w-5 items-center justify-center rounded-md border border-success-ink bg-app-surface text-success-ink shadow-sm">
          <Bookmark className="h-3.5 w-3.5" />
        </span>
        <span className={`text-base leading-6 ${typedText ? "text-app-ink" : "text-app-line-strong"}`}>
          {typedText || "Paste or type a URL"}
          <span className="ml-px inline-block h-4 w-px animate-pulse bg-app-ink align-text-bottom" />
        </span>
      </div>
      <div className="relative justify-self-end">
        <button type="button" className="w-full border-b border-app-line pb-1 text-left text-sm leading-6 text-app-ink-faint">
          Uncategorized
        </button>
      </div>
    </div>
  );
}

function SlashCommandComposer({
  phase,
  artifact,
}: {
  phase: SlashComposerPhase;
  artifact: SlashArtifact;
}) {
  const typedText = useArtifactTyping(artifact, phase === "editor");

  if (phase === "editor") {
    return (
      <div className="relative -ml-3 -mr-2 -my-1 rounded-xl px-3 py-1">
        <ArtifactEditorPreview artifact={artifact} typedText={typedText} />
      </div>
    );
  }

  return (
    <div className="relative z-20 -ml-3 -mr-2 -my-1 min-h-8 rounded-xl px-3 py-1">
      <p className="min-h-7 text-lg leading-7 text-app-ink">
        /
        <span className="ml-px inline-block h-5 w-px animate-pulse bg-app-ink align-text-bottom" />
      </p>
      {phase === "picker" ? <SlashCommandMenu active={artifact} /> : null}
    </div>
  );
}

function CanvasView({
  activeDayIndex,
  onPrevDay,
  onNextDay,
  onToggleTodo,
  completedTodos,
  composerPhase,
  composerArtifact,
}: {
  activeDayIndex: number;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToggleTodo: (id: string) => void;
  completedTodos: Set<string>;
  composerPhase: SlashComposerPhase;
  composerArtifact: SlashArtifact;
}) {
  const activeDay = CANVAS_DAYS[activeDayIndex] ?? CANVAS_DAYS[0];

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-9 px-5 py-5 pb-24" aria-label={`${activeDay.subtitle} ${activeDay.label}`}>
      <SlashCommandComposer phase={composerPhase} artifact={composerArtifact} />

      <div className="space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_180px] items-start gap-4">
          <div className="group relative -ml-3 -mr-2 -my-1 w-full rounded-xl px-2 py-1 pl-3 transition hover:bg-app-surface-hover">
            <div className="flex items-start gap-2">
              <TodoCheckmark as="span" aria-hidden="true" checked size="md" align="text" />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <p className="text-base leading-6 text-app-ink-faint line-through">Update landing page copy</p>
                <span className="rounded-md bg-app-surface-muted px-2 py-0.5 text-[11px] text-app-ink-faint">10AM, Today</span>
              </div>
            </div>
          </div>
          <p className="hidden pt-1 text-xs text-app-ink-faint md:block">✓ 11:08AM, Wed, Jun 24</p>
        </div>

        <button
          type="button"
          className="ml-0 flex w-full max-w-[720px] items-start gap-3 rounded-xl border border-app-line bg-app-surface px-3 py-3 text-left transition hover:bg-app-surface-hover md:ml-1"
        >
          <div className="h-[58px] w-[92px] shrink-0 overflow-hidden rounded-md border border-app-line bg-app-surface-muted">
            <div className="h-full w-full bg-[linear-gradient(135deg,#111827_0%,#111827_38%,#f97316_39%,#f97316_74%,#d6d3d1_75%)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Bookmark className="h-3.5 w-3.5 text-app-ink-faint" />
              <p className="truncate text-xs font-medium text-app-ink-muted">aresluna.org</p>
            </div>
            <p className="mt-1 line-clamp-2 text-base font-bold leading-6 text-app-ink">
              Show your hands honor for the strange power they bring you
            </p>
            <p className="mt-1 line-clamp-1 text-sm leading-5 text-app-ink-muted">On designing finger-friendly interactions</p>
            <span className="mt-2 inline-flex rounded-md bg-app-surface-muted px-2 py-0.5 text-[11px] text-app-ink-muted">Design Eng.</span>
          </div>
        </button>

        <div className="group relative -ml-3 -mr-2 -my-1 w-full rounded-xl px-2 py-1 pl-3 transition hover:bg-app-surface-hover">
          <button type="button" className="flex w-full items-start gap-2 text-left">
            <span className="h-6 rounded-md border border-app-line bg-app-surface-muted px-2 py-0.5 text-xs font-medium text-app-ink-faint shadow-none">
              11:08AM
            </span>
            <span className="min-w-0 flex-1 text-base leading-6 text-app-ink">Updated landing page copy</span>
          </button>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_180px] items-start gap-4">
          <div className="group relative -ml-3 -mr-2 -my-1 w-full rounded-xl px-2 py-1 pl-3 transition hover:bg-app-surface-hover">
            <div className="flex items-start gap-2">
              <TodoCheckmark
                type="button"
                aria-label="toggle completed preview todo"
                checked={completedTodos.has("todo-2")}
                onClick={() => onToggleTodo("todo-2")}
                align="text"
              />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <p className={`text-base leading-6 ${completedTodos.has("todo-2") ? "text-app-ink-faint line-through" : "text-app-ink"}`}>
                Published feature roadmap
                </p>
                <span className="rounded-md bg-app-surface-muted px-2 py-0.5 text-[11px] text-app-ink-faint">12:15PM, Today</span>
              </div>
            </div>
          </div>
          <p className="hidden pt-1 text-xs text-app-ink-faint md:block">✓ 12:32PM, Wed, Jun 24</p>
        </div>

        <div className="group relative -ml-3 -mr-2 -my-1 w-full rounded-xl px-2 py-1 pl-3 transition hover:bg-app-surface-hover">
          <button type="button" className="flex w-full items-start gap-2 text-left">
            <span className="h-6 rounded-md border border-app-line bg-app-surface-muted px-2 py-0.5 text-xs font-medium text-app-ink-faint shadow-none">
              12:32PM
            </span>
            <span className="min-w-0 flex-1 text-base leading-6 text-app-ink">Publish feature roadmap</span>
          </button>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_180px] items-start gap-4">
          <div className="group relative -ml-3 -mr-2 -my-1 w-full rounded-xl px-2 py-1 pl-3 transition hover:bg-app-surface-hover">
            <div className="flex items-start gap-2">
              <TodoCheckmark as="span" aria-hidden="true" checked size="md" align="text" />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <p className="text-base leading-6 text-app-ink-faint line-through">Folder organization for todo</p>
                <span className="rounded-md bg-app-surface-muted px-2 py-0.5 text-[11px] text-app-ink-faint">Mon, Jun 22</span>
              </div>
            </div>
          </div>
          <p className="hidden pt-1 text-xs text-app-ink-faint md:block">✓ 1:28PM, Wed, Jun 24</p>
        </div>

        <div className="group relative -ml-3 -mr-2 -my-1 w-full rounded-xl px-2 py-1 pl-3 transition hover:bg-app-surface-hover">
          <button type="button" className="flex w-full items-start gap-2 text-left">
            <span className="h-6 rounded-md border border-app-line bg-app-surface-muted px-2 py-0.5 text-xs font-medium text-app-ink-faint shadow-none">
              1:28PM
            </span>
            <span className="min-w-0 flex-1 text-base leading-6 text-app-ink">Folder organization for todo</span>
          </button>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_180px] items-start gap-4">
          <div className="group relative -ml-3 -mr-2 -my-1 w-full rounded-xl px-2 py-1 pl-3 transition hover:bg-app-surface-hover">
            <div className="flex items-start gap-2">
              <TodoCheckmark as="span" aria-hidden="true" checked size="md" align="text" />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <p className="text-base leading-6 text-app-ink-faint line-through">RSS reader</p>
                <span className="rounded-md bg-app-surface-muted px-2 py-0.5 text-[11px] text-app-ink-faint">Wed, Jun 17</span>
              </div>
            </div>
          </div>
          <p className="hidden pt-1 text-xs text-app-ink-faint md:block">✓ 1:29PM, Wed, Jun 24</p>
        </div>

        <div className="group relative -ml-3 -mr-2 -my-1 w-full rounded-xl px-2 py-1 pl-3 transition hover:bg-app-surface-hover">
          <button type="button" className="flex w-full items-start gap-2 text-left">
            <span className="h-6 rounded-md border border-app-line bg-app-surface-muted px-2 py-0.5 text-xs font-medium text-app-ink-faint shadow-none">
              1:29PM
            </span>
            <span className="min-w-0 flex-1 text-base leading-6 text-app-ink">RSS reader</span>
          </button>
        </div>

        {[
          ["Todo for Wed, Jul 1", "Recurring todos"],
        ].map(([date, text]) => (
          <div key={date} className="group relative -ml-3 -mr-2 -my-1 w-full rounded-xl px-2 py-1 pl-3 transition hover:bg-app-surface-hover">
            <button type="button" className="flex w-full items-start gap-2 text-left">
              <span className="rounded-md bg-info-surface px-2 py-0.5 text-[15px] font-medium leading-6 text-info-ink">
                {date}
              </span>
              <span className="min-w-0 flex-1 text-base leading-6 text-app-ink-faint">{text}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const TODO_MOCKUP_FOLDER_COUNTS = [
  {
    name: "omanote Feature Ro...",
    icon: "🚀",
    count: 12,
    selected: true,
  },
  {
    name: "Others",
    icon: "📁",
    count: 193,
    selected: false,
  },
] as const;

const TODO_MOCKUP_TABS = [
  { key: "today", label: "Today", count: 2 },
  { key: "overdue", label: "Overdue", count: 1 },
  { key: "later", label: "Later", count: 10 },
  { key: "completed", label: "Completed", count: 2 },
] as const;

const TODO_MOCKUP_SECTIONS = [
  { title: "Launch mobile apps", due: "10AM, Today" },
  { title: "Add recurring todos", due: "Tue, Jun 30" },
  { title: "Read Atomic Habits ch.5", tag: "#books", due: "Fri, Jul 3" },
  { title: "Launch RSS reader", completedLabel: "✓ 12:32PM, Wed, Jun 24" },
  { title: "Add todo folders", completedLabel: "✓ 1:29PM, Wed, Jun 24" },
] as const;

function MockTodoRow({
  title,
  tag,
  due,
  completedLabel,
  done = false,
}: {
  title: string;
  tag: string;
  due?: string;
  completedLabel?: string;
  done?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_110px] items-center gap-4">
      <div className="group flex min-w-0 items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-app-surface-hover/70">
        <TodoCheckmark as="span" checked={done} size="sm" align="text" className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className={`min-w-0 text-[15px] leading-6 ${done ? "line-through text-app-ink-faint" : "text-app-ink"}`}>
              {title}
            </p>
            {due ? (
              <span className="rounded-md bg-app-surface-muted px-2 py-0.5 text-[11px] leading-5 text-app-ink-faint">
                {due}
              </span>
            ) : null}
          </div>
          {tag ? <p className="mt-1 text-[13px] leading-5 text-success-ink">{tag}</p> : null}
        </div>
      </div>
      <div className="flex items-center justify-end">
        {completedLabel ? (
          <span className="text-[12px] leading-5 text-app-ink-faint">{completedLabel}</span>
        ) : null}
      </div>
    </div>
  );
}

function MockFolderRail({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <aside className="w-[292px] shrink-0 overflow-y-auto border-r border-app-line bg-app-surface px-6 py-4">
      {children}
    </aside>
  );
}

function MockFolderRailToolbar({
  addLabel,
  sortLabel = "Last updated",
  showSortIcon = false,
}: {
  addLabel: string;
  sortLabel?: string;
  showSortIcon?: boolean;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <button
        type="button"
        aria-label={addLabel}
        className="flex h-10 w-10 items-center justify-center rounded-md border border-app-line bg-app-surface text-xl leading-none text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
      >
        +
      </button>
      <button
        type="button"
        className="inline-flex h-10 items-center gap-1.5 rounded-app-field border border-app-line bg-app-surface px-3 text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
      >
        {showSortIcon ? <span aria-hidden="true">↕</span> : null}
        {sortLabel}
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}

function MockFolderRow({
  name,
  icon,
  count,
  selected,
  onClick,
}: {
  name: string;
  icon: React.ReactNode;
  count: number;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
        selected ? "bg-app-surface-hover text-app-ink shadow-[0_1px_0_rgba(15,23,42,0.02)]" : "hover:bg-app-surface-hover/70"
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-app-surface-muted text-base text-app-ink-faint">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold leading-6 text-app-ink">
        {name}
      </span>
      <span className="rounded-full bg-app-surface-muted px-2 py-0.5 text-[11px] font-medium text-app-ink-muted">
        {count}
      </span>
    </button>
  );
}

function TodosView() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-app-surface">
      <div className="mx-auto flex h-full w-full max-w-[1180px] min-h-0 overflow-hidden">
        <MockFolderRail>
          <MockFolderRailToolbar addLabel="Add folder" />
          <div className="space-y-2">
            {TODO_MOCKUP_FOLDER_COUNTS.map((folder) => (
              <MockFolderRow
                key={folder.name}
                name={folder.name}
                icon={folder.icon}
                count={folder.count}
                selected={folder.selected}
              />
            ))}
          </div>
        </MockFolderRail>

        <section className="flex min-h-0 flex-1 flex-col px-6 py-4">
          <div className="mb-5 flex items-center justify-between gap-3">
            <button
              type="button"
              aria-label="Add todo"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-app-line bg-app-surface text-2xl leading-none text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
            >
              +
            </button>
            <div className="flex flex-1 justify-center">
              <SegmentedPill
                ariaLabel="Todo view filters"
                activeKey="later"
                onChange={() => {}}
                items={TODO_MOCKUP_TABS.map((tab) => ({
                  key: tab.key,
                  label: tab.label,
                  count: tab.count,
                }))}
                className="bg-app-surface-muted/60 shadow-none border-none"
              />
            </div>
            <div className="w-10" aria-hidden="true" />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-4">
            <div className="space-y-2">
              {TODO_MOCKUP_SECTIONS.map((item) => (
                <MockTodoRow
                  key={item.title}
                  title={item.title}
                  tag={item.tag}
                  due={item.due}
                  completedLabel={item.completedLabel}
                  done={Boolean(item.completedLabel)}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const NOTES_MOCKUP_FOLDERS = [
  { name: "random", icon: "📁", count: 8 },
  { name: "Blog", icon: "📁", count: 1 },
  { name: "Happy Customer", icon: "✨", count: 4 },
  { name: "Omanote", icon: "💘", count: 14 },
  { name: "Articles", icon: "📖", count: 7, selected: true },
  { name: "AI", icon: "⚙️", count: 1 },
  { name: "Uncategorized", icon: "📁", count: 4 },
  { name: "Thoughts", icon: "🧠", count: 6 },
  { name: "Work", icon: "🗂️", count: 4 },
  { name: "Design", icon: "✨", count: 5 },
  { name: "THG", icon: "📁", count: 2 },
] as const;

const NOTES_MOCKUP_ARTICLES = [
  {
    meta: "Created May 8, 2026 · Updated Jun 4, 2026 · 0 hashtags · 6 links",
    title: "When life gives you a Mac Mini, make Lemon",
    sourceLabel: "Source",
    sourceDomain: "sarahandkate.substack.com",
    sourceTitle: "A Non-Engineer Built Our Institutional AI Agent",
    sourceSummary: "Meet Lemon, built without a dev team. What it does, and the first of the Lemon Lessons.",
    body: "Week 9: Growth Mechanics — Viral and Referral Flows",
    bodySummary:
      "Compare growth strategies in Dropbox, Cash App, and Wordle. Calculate customer acquisition cost and viral coefficient for each approach.",
  },
  {
    meta: "Created Apr 18, 2026 · Updated May 2, 2026 · 2 hashtags · 3 links",
    title: "Inside the Decision to Rebrand",
    sourceLabel: "Source",
    sourceDomain: "thebrandingjournal.com",
    sourceTitle: "Inside the Decision to Rebrand Grammarly as Superhuman",
    sourceSummary: "Marion Andrivet",
    body: "For about a week, I couldn’t sleep past 4am. Because I couldn’t stop thinking about what I can do with Claude Cowork for work and personal projects.",
  },
] as const;

function NotesSourceCard({
  domain,
  title,
  summary,
}: {
  domain: string;
  title: string;
  summary: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-app-line bg-app-surface px-3 py-2.5 shadow-sm">
      <div className="h-16 w-16 shrink-0 rounded-lg bg-app-surface-muted bg-[linear-gradient(135deg,#d7d7d7_0%,#f7f7f7_38%,#bdbdbd_38%,#bdbdbd_50%,#f2f2f2_50%,#f2f2f2_100%)]" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-[13px] leading-5 text-app-ink-muted">
          <span className="h-4 w-4 rounded-full bg-app-ink text-[9px] leading-4 text-app-surface text-center">◌</span>
          <span className="truncate">{domain}</span>
        </div>
        <p className="text-[13px] font-semibold leading-5 text-app-ink">{title}</p>
        <p className="mt-1 text-[13px] leading-5 text-app-ink-muted">{summary}</p>
      </div>
    </div>
  );
}

function NotesView() {
  const [openFolder, setOpenFolder] = useState("Articles");
  return (
    <div className="flex h-full min-h-0 bg-app-surface">
      <MockFolderRail>
        <MockFolderRailToolbar addLabel="Add note" />
        <div className="space-y-2">
          {NOTES_MOCKUP_FOLDERS.map((folder) => (
            <MockFolderRow
              key={folder.name}
              name={folder.name}
              icon={folder.icon}
              count={folder.count}
              selected={folder.selected || openFolder === folder.name}
              onClick={() => setOpenFolder(folder.name)}
            />
          ))}
        </div>
      </MockFolderRail>

      <div className="min-w-0 flex-1 overflow-hidden px-6 py-4">
        <div className="min-h-0 h-full overflow-y-auto pr-2">
          <div className="space-y-6">
            {NOTES_MOCKUP_ARTICLES.map((article) => (
              <article key={article.title} className="space-y-3">
                <p className="text-[13px] leading-5 text-app-ink-muted">{article.meta}</p>
                <h3 className="text-[13px] font-semibold leading-5 text-app-ink">{article.title}</h3>
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold leading-5 text-app-ink">{article.sourceLabel}</p>
                  <NotesSourceCard
                    domain={article.sourceDomain}
                    title={article.sourceTitle}
                    summary={article.sourceSummary}
                  />
                </div>
                {article.body ? <h4 className="text-[13px] font-medium leading-5 text-app-ink">{article.body}</h4> : null}
                {article.bodySummary ? (
                  <p className="max-w-[760px] text-[13px] leading-6 text-app-ink-muted">{article.bodySummary}</p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const BOOKMARK_MOCKUP_FOLDERS = [
  { name: "Design Eng.", icon: <Folder className="h-4 w-4" />, count: 4, selected: true },
  { name: "Saved", icon: <Folder className="h-4 w-4" />, count: 34 },
  { name: "UX", icon: <Folder className="h-4 w-4" />, count: 7 },
  { name: "AI", icon: <Folder className="h-4 w-4" />, count: 9 },
  { name: "Craft", icon: <Folder className="h-4 w-4" />, count: 5 },
  { name: "Design", icon: "🎨", count: 18 },
  { name: "Articles", icon: "🧾", count: 14 },
  { name: "Uncategorized", icon: <Folder className="h-4 w-4" />, count: 5 },
  { name: "Eng. + Tech", icon: <Folder className="h-4 w-4" />, count: 5 },
  { name: "Useful Tools", icon: <Folder className="h-4 w-4" />, count: 4 },
  { name: "Product Mgmt", icon: <Folder className="h-4 w-4" />, count: 5 },
  { name: "UI", icon: <Folder className="h-4 w-4" />, count: 1 },
] as const;

const BOOKMARK_MOCKUP_CARDS = [
  {
    title: "Show your hands honor for the strange power they bring you",
    summary: "On designing finger-friendly interactions",
    domain: "aresluna.org",
    favicon: <Bookmark className="h-4 w-4" />,
    imageClass: "bg-[linear-gradient(135deg,#d8d8d8_0%,#949494_48%,#ff6b12_48%,#ff6b12_70%,#1f2937_70%)]",
  },
  {
    title: "Addy Osmani",
    summary: "I co-wrote a Google whitepaper...",
    domain: "addyosmani.com",
    favicon: "👨",
    imageClass: "bg-[radial-gradient(circle_at_50%_28%,#6b3f2c_0_15%,transparent_16%),linear-gradient(135deg,#b8e7df,#a6dcd3)]",
  },
  {
    title: "The Rosetta Stone of Design Engineering",
    summary: "A deeper look at how design an...",
    domain: "yannglt.com",
    favicon: "╬",
    imageClass: "bg-[linear-gradient(135deg,#0d1117_0%,#0d1117_54%,#444_55%,#151515_72%,#020617_72%)]",
  },
  {
    title: "Why UI designers should understand Flexbox and CSS...",
    summary: "CSS for UI Designer Why UI...",
    domain: "Medium",
    favicon: "M",
    imageClass: "bg-[linear-gradient(90deg,#262626,#262626),linear-gradient(135deg,#ff8a65,#ff8a65)]",
  },
] as const;

function BookmarksView() {
  return (
    <div className="flex h-full min-h-0 bg-app-surface">
      <MockFolderRail>
        <MockFolderRailToolbar addLabel="Add bookmark folder" showSortIcon />
        <div className="space-y-2">
          {BOOKMARK_MOCKUP_FOLDERS.map((folder) => (
            <MockFolderRow
              key={folder.name}
              name={folder.name}
              icon={folder.icon}
              count={folder.count}
              selected={folder.selected}
            />
          ))}
        </div>
      </MockFolderRail>

      <div className="min-w-0 flex-1 overflow-hidden px-6 py-4">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            aria-label="Add bookmark"
            className="flex h-10 w-10 items-center justify-center rounded-md border border-app-line bg-app-surface text-xl leading-none text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
          >
            +
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-app-field border border-app-line bg-app-surface px-3 py-2 text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
          >
            Latest
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        <div className="grid max-w-[880px] grid-cols-3 gap-4">
          {BOOKMARK_MOCKUP_CARDS.map((card) => (
            <article
              key={card.title}
              className="min-w-0 rounded-2xl border border-app-line bg-app-surface p-3 shadow-sm transition hover:bg-app-surface-hover/40"
            >
              <div className={`mb-3 h-24 rounded-lg ${card.imageClass}`} />
              <h3 className="line-clamp-2 text-[14px] font-semibold leading-5 text-app-ink">{card.title}</h3>
              <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-app-ink-muted">{card.summary}</p>
              <div className="mt-4 flex min-w-0 items-center gap-2 text-[12px] leading-5 text-app-ink-faint">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-app-surface-muted text-[12px] text-app-ink-muted">
                  {card.favicon}
                </span>
                <span className="truncate">{card.domain}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventView() {
  return (
    <div className="h-full min-h-0 overflow-hidden bg-app-surface px-6 py-4">
      <div className="flex h-full min-h-0">
        <div className="w-full max-w-[980px] min-w-0 overflow-y-auto pr-4">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-app-ink-muted">Timeline</p>
              <p className="mt-1 text-sm text-app-ink-muted">{EVENT.length} total events</p>
            </div>
            <div className="inline-flex items-center rounded-full border border-app-line bg-app-surface-muted/70 p-1 shadow-sm">
              <button
                type="button"
                aria-label="Calendar view"
                className="flex h-7 w-7 items-center justify-center rounded-full text-app-ink-faint transition hover:bg-app-surface hover:text-app-ink"
              >
                <CalendarDays className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Timeline view"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-app-ink text-app-surface shadow-app-nav-active"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute bottom-0 left-[11px] top-[22px] w-px bg-app-line" />
            <div className="relative flex items-center gap-1.5 py-2.5">
              <div className="relative z-10 flex h-[14px] w-[22px] shrink-0 items-center justify-center">
                <div className="h-[10px] w-[10px] rounded-full border-2 border-app-ink-faint bg-app-surface" />
              </div>
              <span className="text-sm font-bold text-app-ink">Today</span>
              <span className="rounded-full bg-app-surface-muted px-2 py-0.5 text-[11px] font-bold text-app-ink-muted">
                {EVENT.length}
              </span>
            </div>

            <div className="relative ml-6 pb-3">
              {EVENT.map((entry, eventIndex) => {
                const isFirstEvent = eventIndex === 0;
                const isLastEvent = eventIndex === EVENT.length - 1;

                return (
                  <div key={entry.time + entry.text} className="relative flex items-start gap-3 rounded-lg py-1.5">
                    {!isFirstEvent ? <div className="absolute left-[10px] top-0 h-[6px] w-px bg-app-line" /> : null}
                    {!isLastEvent ? <div className="absolute bottom-0 left-[10px] top-[26px] w-px bg-app-line" /> : null}
                    <div className="relative z-10 flex w-[21px] shrink-0 items-center justify-center">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-app-surface-muted">
                        {entry.auto ? (
                          <CheckCheck className="h-3 w-3 text-app-ink-faint" />
                        ) : (
                          <Clock3 className="h-3 w-3 text-app-ink-faint" />
                        )}
                      </div>
                    </div>

                    <div className="group/event relative min-w-0 flex-1 rounded-lg px-2 -mx-2 transition hover:bg-app-surface-hover">
                      <div className="flex items-start gap-1.5 pr-6">
                        <span className="w-[68px] shrink-0 tabular-nums text-xs text-app-ink-faint">
                          {entry.time}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-5 text-app-ink-muted">{entry.text}</p>
                          <p className="mt-0.5 text-xs leading-4 text-success-ink">{entry.tag}</p>
                        </div>
                        {entry.auto ? (
                          <span className="shrink-0 rounded-full bg-info-surface px-1.5 py-0.5 text-[10px] font-medium text-info-ink">
                            auto
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExploreView() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-4">
      <div className="mb-4 rounded-xl border border-app-line bg-app-surface px-3 py-2.5 w-full max-w-xs">
        <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">Explore</p>
        <p className="text-sm font-bold text-app-ink">Hashtag threads across notes, todos, and events</p>
      </div>
      <div className="relative w-full max-w-xs" style={{ height: 200 }}>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 200" fill="none">
          <line x1="150" y1="84" x2="66" y2="130" stroke={color.zinc200} strokeWidth="1" />
          <line x1="150" y1="84" x2="222" y2="44" stroke={color.zinc200} strokeWidth="1" />
          <line x1="150" y1="84" x2="84" y2="44" stroke={color.zinc200} strokeWidth="1" />
          <line x1="150" y1="84" x2="210" y2="140" stroke={color.zinc200} strokeWidth="1" />
          <line x1="150" y1="84" x2="30" y2="80" stroke={color.zinc200} strokeWidth="1" />
          <line x1="150" y1="84" x2="252" y2="100" stroke={color.zinc200} strokeWidth="1" />
          <line x1="150" y1="84" x2="150" y2="160" stroke={color.zinc200} strokeWidth="1" />
        </svg>
        {EXPLORE_TAGS.map((tag) => (
          <div
            key={tag.tag}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full border px-2.5 py-1 text-xs font-bold cursor-pointer transition-opacity hover:opacity-80 shadow-sm select-none ${tagColor(tag.tag)}`}
            style={{ left: `${tag.x}%`, top: `${tag.y}%` }}
          >
            {tag.tag}
          </div>
        ))}
      </div>
      <p className="text-xs text-app-ink-faint mt-2 text-center">
        Tap any hashtag to see everything connected to it
      </p>
    </div>
  );
}

// ─── Interactive app mockup ───────────────────────────────────────────────────
function AppMockup() {
  const [mode, setMode] = useState<MockMode>("write");
  const [writeTab, setWriteTab] = useState<MockTab>("canvas");
  const [readTab, setReadTab] = useState<"reader" | "saved">("reader");
  const [completedTodos, setCompletedTodos] = useState<Set<string>>(() => new Set(["todo-2"]));
  const [isMobile, setIsMobile] = useState(false);
  const slashComposer = useSlashCommandAnimation();
  const todayLabel = formatHeroTodayLabel();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggleTodo = (id: string) => {
    setCompletedTodos((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const showCanvas = mode === "write" && writeTab === "canvas";
  const mockupHeaderStat =
    mode === "read"
      ? "76 unread"
      : writeTab === "todos"
        ? "✅ 5 completed  →"
        : writeTab === "notes"
          ? "📝 8 notes  →"
          : writeTab === "bookmarks"
            ? "🔖 7 added  →"
          : writeTab === "event"
            ? "🗓️ 6 events  →"
          : "";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-app-line bg-app-surface text-left shadow-app-dialog">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),transparent_62%)]" />
      <div className="relative">
        <div className="border-b border-app-line bg-app-surface">
          <div className="flex items-center justify-between px-5 py-2.5">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-app-line" />
              <div className="h-2.5 w-2.5 rounded-full bg-app-line" />
              <div className="h-2.5 w-2.5 rounded-full bg-app-line" />
            </div>
            <SegmentedPill
              activeKey={mode}
              ariaLabel="Write or read mode"
              onChange={(next) => {
                const nextMode = next as MockMode;
                setMode(nextMode);
                if (nextMode === "write") {
                  setReadTab("reader");
                }
              }}
              className="bg-app-surface-muted/60 shadow-none"
              items={[
                { key: "write", label: "Write", icon: <SquarePen className="h-3.5 w-3.5" /> },
                { key: "read", label: "Read", icon: <BookOpen className="h-3.5 w-3.5" /> },
              ]}
            />
            <img src={DUMMY_AVATAR} className="h-7 w-7 rounded-full opacity-60" alt="" />
          </div>
          <div className="flex h-12 items-center justify-between border-t border-app-line px-5">
            {showCanvas ? (
              <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3">
                <p className="min-w-0 truncate text-sm text-app-ink-muted">Candlelight productivity, BBK</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                    aria-label="Previous day preview"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-full px-2 py-1 text-sm font-bold text-app-ink transition hover:bg-app-surface-hover"
                  >
                    {todayLabel}
                  </button>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                    aria-label="Next day preview"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  className="justify-self-end rounded-full px-2 py-1 text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                >
                  🔥 5 days →
                </button>
              </div>
            ) : (
              <div className="flex w-full items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm text-app-ink-muted">Candlelight productivity, BBK</p>
                {mockupHeaderStat ? (
                  <p className="shrink-0 text-sm text-app-ink-faint">{mockupHeaderStat}</p>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className={`relative h-[440px] overflow-hidden ${showCanvas ? "omanote-canvas-grid bg-app-canvas" : "bg-app-canvas/35"}`}>
          {mode === "write" && writeTab === "canvas" ? (
            <div className="h-full overflow-y-auto">
              <CanvasView
                activeDayIndex={0}
                onPrevDay={() => {}}
                onNextDay={() => {}}
                onToggleTodo={toggleTodo}
                completedTodos={completedTodos}
                composerPhase={slashComposer.phase}
                composerArtifact={slashComposer.artifact}
              />
            </div>
          ) : null}
          {mode === "write" && writeTab === "todos" ? <TodosView /> : null}
          {mode === "write" && writeTab === "notes" ? <NotesView /> : null}
          {mode === "write" && writeTab === "bookmarks" ? <BookmarksView /> : null}
          {mode === "write" && writeTab === "event" ? <EventView /> : null}
          {mode === "read" ? (
            <div className="mx-auto grid h-[440px] w-full max-w-[1050px] grid-cols-1 md:grid-cols-[250px_minmax(0,1fr)] gap-4 overflow-hidden px-4 pt-4">
              <aside className="hidden md:block min-h-0 overflow-hidden">
                <div className="mb-3 flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Add feed"
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-app-line bg-app-surface text-lg leading-none text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                  >
                    +
                  </button>
                </div>
                <div className="min-h-0 space-y-2 overflow-y-auto pb-16">
                  <button
                    type="button"
                    onClick={() => setReadTab("reader")}
                    className="flex w-full min-w-0 items-center gap-2 rounded-lg bg-app-surface-muted px-3 py-2 text-left text-sm font-medium text-app-ink"
                  >
                    <Rss className="h-4 w-4 shrink-0 text-app-ink-faint" />
                    <span className="min-w-0 flex-1 truncate">All feeds</span>
                  </button>

                  {READER_FEED_GROUPS.map((group) => (
                    <div key={group.category} className="space-y-1">
                      <div className="group flex w-full items-center gap-1 rounded-lg">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-app-surface-muted text-app-ink-faint">
                            <Folder className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{group.category}</span>
                          <span className="text-app-ink-faint">...</span>
                        </button>
                      </div>
                      <div className="ml-8 space-y-1">
                        {group.feeds.map((feed) => (
                          <button
                            type="button"
                            key={feed.title}
                            className="flex w-full min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                          >
                            <span className={`h-2 w-2 shrink-0 rounded-full ${feed.accent ?? "bg-app-line-strong"}`} />
                            <span className="min-w-0 flex-1 truncate">{feed.title}</span>
                            <span className="shrink-0 rounded-full bg-app-surface-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-app-ink-faint">
                              {feed.unread}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </aside>

              <section className="min-h-0 border-l border-app-line pl-4">
                <div className="h-full min-h-0 overflow-y-auto pb-24">
                  <div className="divide-y divide-app-line">
                    {READER_ARTICLES.map((article) => (
                      <button
                        type="button"
                        key={article.title}
                        className="flex w-full items-start gap-4 px-4 py-3.5 text-left transition-colors hover:bg-app-surface-hover"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-xs text-app-ink-faint">
                            {article.unread ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-ink" aria-label="Unread" /> : null}
                            <span className="truncate">{article.feed}</span>
                            <span className="shrink-0">· {article.age}</span>
                          </p>
                          <p className={`mt-1 text-[15px] leading-snug ${article.unread ? "font-medium text-app-ink" : "text-app-ink-muted"}`}>
                            {article.title}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-app-ink-faint">{article.summary}</p>
                        </div>
                        <div className={`mt-1 h-16 w-24 shrink-0 rounded-lg border border-app-line ${article.thumb}`} />
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />
        </div>

        <div className="flex h-16 items-center gap-3 border-t border-app-line px-4">
          <button
            type="button"
            aria-label="Preview explore"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-app-line bg-app-surface text-app-ink-muted shadow-app-nav transition hover:bg-app-canvas"
          >
            <Compass size={15} />
          </button>

          <div className="flex-1 min-w-0 flex justify-center">
            <SegmentedPill
              activeKey={mode === "read" ? readTab : writeTab}
              ariaLabel="Preview app tabs"
              className="gap-2 bg-app-surface-muted/40 px-2 shadow-soft"
              onChange={(key) => {
                if (mode === "read") {
                  setReadTab(key === "saved" ? "saved" : "reader");
                } else if (mode === "write") {
                  if (isMobile && (key as MockTab) !== "canvas") return;
                  setWriteTab(key as MockTab);
                  if ((key as MockTab) === "canvas") {
                    setMode("write");
                  }
                }
              }}
              items={
                mode === "read"
                  ? [
                      { key: "reader", label: readTab === "reader" ? "Feeds" : undefined, icon: <Rss className="h-3.5 w-3.5" />, ariaLabel: "Feeds" },
                      { key: "saved", label: readTab === "saved" ? "Saved" : undefined, icon: <Bookmark className="h-3.5 w-3.5" />, ariaLabel: "Saved" },
                    ]
                  : NAV_TABS.map((tab) => ({
                      key: tab.key,
                      label: writeTab === tab.key ? tab.label : undefined,
                      icon: <tab.icon className="h-3.5 w-3.5" />,
                      ariaLabel: tab.label,
                    }))
              }
            />
          </div>

          <button
            type="button"
            aria-label="Profile"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-app-line bg-app-surface shadow-app-nav"
          >
            <img src={DUMMY_AVATAR} className="h-10 w-10 rounded-full opacity-60" alt="" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Extension popup mockup ───────────────────────────────────────────────────
function ExtensionPopupMockup() {
  return (
    <div className="w-[300px] rounded-2xl border border-app-line bg-app-surface shadow-app-dialog overflow-hidden text-left">
      {/* Header */}
      <div className="border-b border-app-line px-3.5 py-2.5 flex items-center justify-between bg-app-surface shrink-0">
        <img src="/logo.svg" alt="omanote" className="h-5 w-auto" />
        <Settings size={13} className="text-app-ink-faint" />
      </div>

      {/* Type selector */}
      <div className="px-3.5 pt-3">
        <div className="flex gap-1 rounded-lg bg-app-surface-muted p-1">
          {["Bookmark", "Note", "Todo"].map((t, i) => (
            <div
              key={t}
              className={`flex-1 text-center text-[11px] py-1 rounded-md font-bold transition-colors ${
                i === 0 ? "bg-app-surface text-app-ink shadow-sm" : "text-app-ink-faint"
              }`}
            >
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* URL field */}
      <div className="px-3.5 pt-2">
        <div className="rounded-lg border border-app-line bg-app-canvas px-3 py-2 text-[11px] text-app-ink-faint truncate">
          https://linear.app/changelog
        </div>
      </div>

      {/* Tag field */}
      <div className="px-3.5 pt-2">
        <div className="rounded-lg border border-app-line bg-app-surface px-3 py-2 text-[11px] text-success-ink font-medium">
          #tools
        </div>
      </div>

      {/* Save button */}
      <div className="px-3.5 pt-2 pb-3.5">
        <div
          className="w-full rounded-lg py-2 text-center text-[13px] font-bold text-white"
          style={{ backgroundColor: CTA_BG }}
        >
          Save to canvas
        </div>
      </div>

      {/* Recent saves */}
      <div className="border-t border-app-line px-3.5 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-app-ink-faint mb-2">Recent</p>
        <div className="space-y-1.5">
          {[
            { title: "Readwise Reader", domain: "readwise.io", tag: "#tools" },
            { title: "Vercel – Deploy Instantly", domain: "vercel.com", tag: "#dev" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-app-surface-muted flex items-center justify-center shrink-0">
                <Link2 className="h-3 w-3 text-app-ink-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-app-ink truncate">{item.title}</p>
                <p className="text-[10px] text-app-ink-faint">{item.domain}</p>
              </div>
              <span className="text-[9px] text-success-ink shrink-0">{item.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── RSS announcement banner ──────────────────────────────────────────────────
const RSS_BANNER_KEY = "omanote_rss_banner_dismissed";

function RssBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(RSS_BANNER_KEY)) setVisible(true);
    } catch {
      // localStorage unavailable — don't show the banner
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(RSS_BANNER_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="relative px-4 py-2" style={{ backgroundColor: CTA_BG }}>
      <p className="text-center text-sm font-medium text-white">
        Feature announcement: omanote reader is here. Read your favorite authors right from the app.{" "}
        <a href="#reader" className="font-bold underline underline-offset-2 hover:no-underline">
          Learn more →
        </a>
      </p>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={dismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-white/70 transition-colors duration-app-fast ease-app-out hover:text-white cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── RSS reader section ───────────────────────────────────────────────────────
function RssReaderMockup() {
  const categories = [
    { name: "Tech", icon: "💻", count: 3 },
    { name: "Design", icon: "🎨", count: 1 },
    { name: "News", icon: "📰", count: 8 },
  ];
  const articles = [
    { title: "The future of AI-native interfaces", feed: "The Verge", time: "2h ago", read: false },
    { title: "Why local-first software matters more than ever", feed: "Hacker News", time: "4h ago", read: false },
    { title: "Figma's new auto-layout engine", feed: "Design Notes", time: "Yesterday", read: true },
    { title: "OpenAI announces new developer tools", feed: "The Verge", time: "Yesterday", read: true },
  ];
  return (
    <div className="rounded-2xl border border-app-line bg-app-surface shadow-app-dialog overflow-hidden text-left w-full max-w-[520px]">
      {/* Top chrome */}
      <div className="border-b border-app-line h-9 bg-app-surface flex items-center justify-between px-4 shrink-0">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-app-line" />
          <div className="w-2 h-2 rounded-full bg-app-line" />
          <div className="w-2 h-2 rounded-full bg-app-line" />
        </div>
        <div className="flex items-center gap-2 rounded-full border border-app-line bg-app-canvas px-3 py-1">
          <span className="text-[11px] font-medium text-app-ink-muted">Write</span>
          <span className="text-[11px] font-bold text-app-ink bg-app-surface rounded-full px-2 py-0.5 -my-0.5">Read</span>
        </div>
        <div className="w-6 h-6 rounded-full bg-app-line opacity-40" />
      </div>

      {/* 3-pane layout */}
      <div className="flex" style={{ height: 280 }}>
        {/* Sidebar */}
        <div className="w-[130px] shrink-0 border-r border-app-line bg-app-canvas/50 py-2 flex flex-col gap-0.5">
          <div className="px-2 mb-1">
            <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5 bg-app-surface-muted">
              <Rss className="h-3 w-3 text-app-ink-muted shrink-0" />
              <span className="text-[11px] font-medium text-app-ink-muted">All feeds</span>
            </div>
          </div>
          {categories.map((c) => (
            <div key={c.name} className="flex items-center gap-1.5 px-3 py-1.5 mx-1 rounded-md">
              <span className="text-xs leading-none shrink-0">{c.icon}</span>
              <span className="text-[11px] font-bold text-app-ink flex-1 truncate">{c.name}</span>
              <span className="shrink-0 rounded-full bg-app-surface-muted text-app-ink-faint px-1.5 text-[9px] font-bold leading-4">{c.count}</span>
            </div>
          ))}
        </div>

        {/* Article list */}
        <div className="w-[180px] shrink-0 border-r border-app-line py-2 flex flex-col gap-0.5 overflow-hidden">
          {articles.map((a, i) => (
            <div
              key={i}
              className={`px-3 py-2 mx-1 rounded-md flex items-start gap-1.5 ${i === 1 ? "bg-app-surface" : ""}`}
            >
              {!a.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-info-ink" />}
              <div className={`min-w-0 ${a.read ? "pl-3" : ""}`}>
                <p className={`text-[10px] leading-snug ${a.read ? "text-app-ink-faint" : "font-semibold text-app-ink"} line-clamp-2`}>{a.title}</p>
                <p className="text-[9px] text-app-ink-faint mt-0.5">{a.feed} · {a.time}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Reader pane */}
        <div className="flex-1 px-4 py-3 overflow-hidden">
          <p className="text-[9px] font-bold uppercase tracking-widest text-app-ink-faint mb-1">Hacker News · 4h ago</p>
          <p className="text-[12px] font-black leading-snug text-app-ink mb-2">Why local-first software matters more than ever</p>
          <p className="text-[10px] leading-relaxed text-app-ink-muted line-clamp-5">
            Local-first software keeps your data on your device and syncs in the background. It's faster, works offline, and gives you ownership — without sacrificing collaboration. Here's why it's the right model for the next generation of apps...
          </p>
          <div className="mt-3 flex items-center gap-1.5">
            <div className="rounded-md bg-app-surface-muted px-2 py-1 text-[9px] font-bold text-app-ink-muted flex items-center gap-1">
              <BookOpen className="h-2.5 w-2.5" /> Save
            </div>
            <div className="rounded-md bg-app-surface-muted px-2 py-1 text-[9px] font-bold text-app-ink-muted flex items-center gap-1">
              <Bookmark className="h-2.5 w-2.5" /> Bookmark
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Extension section ────────────────────────────────────────────────────────
function ExtensionSection() {
  return (
    <section id="extension" className="border-t border-app-line">
      <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: popup mockup */}
          <div className="flex justify-center lg:justify-start order-2 lg:order-1">
            <div className="relative">
              {/* Subtle glow behind the popup */}
              <div
                className="absolute inset-0 rounded-3xl blur-3xl opacity-20 -z-10"
                style={{ background: `radial-gradient(ellipse at center, ${CTA_BG} 0%, transparent 70%)` }}
              />
              <ExtensionPopupMockup />
            </div>
          </div>

          {/* Right: copy + download buttons */}
          <div className="order-1 lg:order-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">
              Browser extension
            </p>
            <h2 className="font-serif-heading font-serif-heading-smooth mt-4 text-3xl sm:text-4xl font-black tracking-[-0.025em] leading-tight">
              Capture from anywhere,<br className="hidden sm:block" /> without switching tabs.
            </h2>
            <p className="mt-5 text-app-ink-muted leading-relaxed text-[15px]">
              The omanote extension puts quick capture one click away. Save a bookmark, drop a note,
              or log a todo — one click from any page, straight into your encrypted workspace.
            </p>

            <ul className="mt-7 space-y-4">
              {[
                {
                  icon: Zap,
                  title: "Instant popup",
                  body: "Hit Alt+Shift+O or click the toolbar icon from any tab to open quick capture.",
                },
                {
                  icon: MousePointerClick,
                  title: "Right-click to save",
                  body: "Select text on any page and save it as a note or bookmark via the context menu.",
                },
                {
                  icon: Lock,
                  title: "Same encryption",
                  body: "Uses your omanote passphrase. Nothing leaves your device unencrypted.",
                },
              ].map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <f.icon className="h-5 w-5 shrink-0 mt-0.5 text-app-ink-muted" />
                  <p className="text-[15px] leading-snug text-app-ink-muted">
                    <strong className="text-app-ink font-bold">{f.title}</strong>
                    {" — "}
                    {f.body}
                  </p>
                </li>
              ))}
            </ul>

            {/* Download buttons */}
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="https://chromewebstore.google.com/detail/omanote/foafmfgfdbdiiggmmfdoalgpfhkejbjn"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-app-line bg-app-surface px-4 py-2.5 text-sm font-bold text-app-ink hover:border-app-line-strong hover:bg-app-canvas transition-colors duration-app-fast ease-app-out shadow-sm"
              >
                <span className="text-base leading-none">🌐</span>
                Add to Chrome / Chromium
              </a>
              <a
                href="https://addons.mozilla.org/en-US/firefox/addon/omanote/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-app-line bg-app-surface px-4 py-2.5 text-sm font-bold text-app-ink hover:border-app-line-strong hover:bg-app-canvas transition-colors duration-app-fast ease-app-out shadow-sm"
              >
                <span className="text-base leading-none">🦊</span>
                Add to Firefox
              </a>
            </div>
            <p className="mt-3 text-xs text-app-ink-faint">
              Free. No account needed to install — sign in to sync with your workspace.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA button ───────────────────────────────────────────────────────────────
function JournalCta({ label = "Start your daily workspace", inverted }: { label?: string; inverted?: boolean }) {
  return (
    <SignInButton mode="modal" fallbackRedirectUrl="/canvas">
      <button
        className="relative inline-flex items-center overflow-hidden rounded-xl px-5 py-2.5 text-sm font-bold cursor-pointer transition-[transform,filter] duration-app-fast ease-app-out hover:brightness-110 active:translate-y-px active:scale-[0.98]"
        style={inverted ? {
          backgroundColor: "#fff",
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0px 1px 4px 0px rgba(0,0,0,0.35)",
          color: CTA_BG,
        } : {
          backgroundColor: CTA_BG,
          border: `1px solid ${CTA_BORDER}`,
          boxShadow: "0px 1px 4px 0px rgba(0,0,0,0.35)",
          color: "#fff",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={inverted ? { boxShadow: "inset 0px 2px 2px 0px rgba(0,0,0,0.04)" } : { boxShadow: "inset 0px 3px 4px 0px rgba(255,255,255,0.22)" }}
        />
        <span className="relative z-10">{label}</span>
      </button>
    </SignInButton>
  );
}

// ─── Main landing page ────────────────────────────────────────────────────────
export function LandingScreen() {
  const year = new Date().getFullYear();
  const currentVersion = parseLatestVersion(changelogMarkdown)?.version ?? "v0.9";

  return (
    <>
      <SeoHead
        title="omanote | Opinionated daily workspace"
        description="omanote is a personal daily workspace for capturing notes, todos, bookmarks, events, and small moments before the day disappears."
      />
      <div className="public-page min-h-screen flex flex-col bg-app-surface text-app-ink">
      {/* Nav */}
      <nav className="border-b border-app-line sticky top-0 bg-app-surface/95 backdrop-blur-sm z-20">
        <div className="max-w-[1136px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <img src="/logo.svg" alt="omanote home" className="h-6 sm:h-7 w-auto" />
          <div className="flex items-center gap-4 sm:gap-6">
            <DownloadNavDropdown />
            <SignInButton mode="modal" fallbackRedirectUrl="/canvas">
              <button className="text-sm text-app-ink-muted hover:text-app-ink transition-colors duration-app-fast ease-app-out cursor-pointer font-medium">
                Sign in
              </button>
            </SignInButton>
          </div>
        </div>
      </nav>

      {/* RSS announcement banner */}
      <RssBanner />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative z-0 mx-auto max-w-[1136px] overflow-hidden px-4 pb-14 pt-16 text-center sm:px-6 sm:pt-20 lg:pt-28">
          <p className="inline-flex items-center rounded-full border border-app-line bg-app-canvas px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-app-ink-muted">
            Opinionated daily workspace
          </p>
          <h1 className="font-serif-heading font-serif-heading-smooth mt-6 text-[44px] sm:text-[58px] lg:text-[72px] font-black leading-[1.02] tracking-[-0.035em] max-w-[860px] mx-auto">
            Capture the day
            <br className="hidden sm:block" /> before it disappears.
          </h1>
          <p className="mt-5 text-md text-app-ink-muted max-w-[560px] mx-auto leading-relaxed">
            Notes, todos, bookmarks, events, RSS.
            <br />
            One workspace for everything that fits in a day.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <JournalCta label="Start your daily workspace" />
            <a
              href="https://omanote.com/s/FeUM44Rd"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-app-line bg-app-surface px-4 py-2.5 text-sm font-medium text-app-ink-muted hover:border-app-line-strong hover:text-app-ink transition-colors duration-app-fast ease-app-out"
            >
              <CheckSquare className="h-4 w-4" />
              View roadmap
            </a>
          </div>

          {/* App mockup — half-peeking below the fold */}
          <div className="relative z-0 mx-auto mt-3 max-w-4xl translate-y-14 sm:mt-4">
            <AppMockup />
            {/* Page-level bottom fade hints the page continues */}
            <div className="pointer-events-none absolute -bottom-1 inset-x-0 h-20 bg-gradient-to-t from-white to-transparent" />
          </div>
        </section>

        {/* Why omanote */}
        <section id="why" className="border-t border-app-line">
          <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-start">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">
                  The name
                </p>
                <h2 className="font-serif-heading font-serif-heading-smooth mt-4 text-3xl sm:text-4xl font-black tracking-[-0.025em] leading-tight">
                  An opinionated daily workspace, already arranged.
                </h2>
                <p className="mt-5 text-app-ink-muted leading-relaxed text-[15px]">
                  <strong className="text-app-ink">Omakase</strong> (お任せ) is Japanese for "I'll
                  leave it to you" — the total trust you place in a chef who just handles it. No
                  menu. No decisions. Just show up, eat well, and wonder how they knew exactly what
                  you needed.
                </p>
                <p className="mt-4 text-app-ink-muted leading-relaxed text-[15px]">
                  omanote does the same thing for your day. The structure is already there waiting —
                  canvas to start, then notes, todos, bookmarks, events, RSS, Insights, and Explore
                  when you want to pull the thread.
                </p>
                <p className="mt-4 text-app-ink-muted leading-relaxed text-[15px]">
                  It's for people who want to just open a thing and start typing — not spend a
                  weekend building a second brain.
                </p>
                <p className="mt-4 text-app-ink-muted leading-relaxed text-[15px]">
                  Inspired by{" "}
                  <a
                    href="https://omarchy.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-app-ink underline underline-offset-2 hover:no-underline"
                  >
                    Omarchy by DHH
                  </a>{" "}
                  and its beautifully stubborn, ready-to-use spirit.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    icon: LayoutDashboard,
                    title: "Already structured",
                    body: "Everything's already in place. Open it, start typing. No setup, no decisions, no tutorial to skip.",
                  },
                  {
                    icon: Zap,
                    title: "Low ceremony",
                    body: "Dump it in. Sort it out later. The workspace won't judge you for figuring things out as you go.",
                  },
                  {
                    icon: Hash,
                    title: "Hashtags connect everything",
                    body: "Tag a note, a todo, and an event with #health. Now they're connected. Explore and Insights make the pattern easier to revisit.",
                  },
                  {
                    icon: CalendarDays,
                    title: "Day-first capture",
                    body: "Every capture is rooted in today, with calendar jumps and scheduled todos so things stay anchored to the right day.",
                  },
                  {
                    icon: Moon,
                    title: "Light, dark, or system",
                    body: "Full dark mode support, synced across devices. Switch in settings — or just let it follow your OS.",
                  },
                  {
                    icon: Rss,
                    title: "Built-in RSS reader",
                    body: "Subscribe to any feed, read in-app, and save articles to your bookmarks. Opt in from Settings when you're ready.",
                  },
                ].map((card) => (
                  <div key={card.title} className="rounded-2xl border border-app-line bg-app-surface p-5">
                    <card.icon className="h-6 w-6 text-app-ink-muted" />
                    <p className="mt-3 text-sm font-bold text-app-ink">{card.title}</p>
                    <p className="mt-1.5 text-sm text-app-ink-muted leading-snug">{card.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Write & Read mode */}
        <section id="how-it-works" className="border-t border-app-line">
          <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">
                  Write & Read
                </p>
                <h2 className="font-serif-heading font-serif-heading-smooth mt-4 text-3xl sm:text-4xl font-black tracking-[-0.025em] leading-tight">
                  Write. Read.
                  <br className="hidden sm:block" /> Same workspace.
                </h2>
                <p className="mt-5 text-app-ink-muted leading-relaxed text-[15px]">
                  <strong className="text-app-ink">Write mode</strong> — the canvas is where
                  everything starts. Notes, todos, bookmarks, events, all in one stream tied to
                  today. Type, paste, or use /slash commands. Sort it out later in the focused
                  views.
                </p>
                <ul className="mt-5 space-y-3">
                  {[
                    { icon: SquarePen, text: "Canvas is your daily dumping ground" },
                    { icon: FileText, text: "Notes is your organized thoughts" },
                    { icon: CheckSquare, text: "Todos parses natural language for date and time" },
                    { icon: Bookmark, text: "Bookmarks organizes your links" },
                    { icon: Clock3, text: "Events shows your upcoming todos, events and timelines" },
                  ].map((item) => (
                    <li key={item.text} className="flex items-center gap-3 text-sm text-app-ink-muted">
                      <item.icon className="h-4 w-4 shrink-0 text-app-ink-faint" />
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-app-ink-muted leading-relaxed text-[15px]">
                  <strong className="text-app-ink">Read mode</strong> — subscribe to feeds, read
                  articles, and save what matters. Full reader sits alongside your workspace — no
                  context switch needed.
                </p>
              </div>

              <div className="flex justify-center lg:justify-end">
                <div className="relative w-full max-w-[520px]">
                  <div
                    className="absolute inset-0 rounded-3xl blur-3xl opacity-15 -z-10"
                    style={{ background: `radial-gradient(ellipse at center, ${CTA_BG} 0%, transparent 70%)` }}
                  />
                  <RssReaderMockup />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Extension */}
        <ExtensionSection />

        {/* Privacy */}
        <section className="border-t border-app-line">
          <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">Privacy</p>
            <h2 className="font-serif-heading font-serif-heading-smooth mt-4 text-2xl sm:text-3xl font-black tracking-[-0.025em] leading-tight">
              Your stuff. Yours.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-app-ink-muted max-w-[560px] mx-auto">
              Client-side encryption, passphrase unlock, offline capture, and recovery keys.
              Your data stays yours — always.
            </p>
            <Link
              to="/privacy"
              className="mt-5 inline-flex text-sm text-app-ink underline underline-offset-2 hover:no-underline transition-colors duration-app-fast ease-app-out"
            >
              Read the privacy policy →
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-app-line">
          <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">FAQ</p>
            <h2 className="font-serif-heading font-serif-heading-smooth mt-4 text-2xl sm:text-3xl font-black tracking-[-0.025em] leading-tight">
              Good questions.
            </h2>
            <div className="mt-8 border-t border-app-line">
              {FAQ_ITEMS.map((item) => (
                <div
                  key={item.question}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-12 py-6 border-b border-app-line"
                >
                  <p className="text-sm font-bold text-app-ink leading-snug">{item.question}</p>
                  <p className="text-sm text-app-ink-muted leading-relaxed">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-app-line">
          <div
            className="max-w-[1136px] mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-20 text-center rounded-3xl my-8 sm:my-12" style={{ backgroundColor: "#F7FCF1" }}
          >
            <h2 className="font-serif-heading font-serif-heading-smooth text-3xl sm:text-4xl font-black tracking-[-0.025em] max-w-[480px] mx-auto leading-tight text-app-ink">
              Ready to start dumping?
            </h2>
            <p className="mt-4 max-w-[380px] mx-auto leading-relaxed text-[15px] text-app-ink-muted">
              Your canvas is already waiting. No setup. No onboarding. No tour.
            </p>
            <div className="mt-8 flex justify-center">
              <JournalCta label="Start your daily workspace" />
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-app-line">
        <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <img src="/logo.svg" alt="omanote home" className="h-5 w-auto" />
                <Link
                  to="/updates"
                  className="rounded-full border border-app-line bg-app-canvas px-2 py-0.5 text-[10px] font-bold text-app-ink-muted hover:border-app-line-strong hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out cursor-pointer"
                >
                  {currentVersion}
                </Link>
              </div>
              <p className="mt-2.5 text-xs text-app-ink-faint leading-relaxed max-w-[280px]">
                Personal notetaking app of{" "}
                <a
                  href="https://iambishistha.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  iambishistha.com
                </a>
                .
                <span className="block">Built for personal use, shared publicly.</span>
              </p>
              <div className="mt-3 flex gap-4 text-xs text-app-ink-faint">
                <a
                  href="https://omanote.com/s/FeUM44Rd"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  Roadmap
                </a>
                <Link
                  to="/updates"
                  className="underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  Changelog
                </Link>
                <a
                  href={desktopAppReleaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  Desktop app
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 text-xs text-app-ink-faint sm:text-right">
              <span>© {year} omanote. All rights reserved.</span>
              <span className="max-w-[300px] sm:max-w-none leading-snug">
                Your data is encrypted client-side and stored securely.
                <br className="hidden sm:block" /> We don't sell, share, or read your data. Ever.
              </span>
              <div className="flex gap-4 w-fit sm:ml-auto">
                <Link
                  to="/privacy"
                  className="underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  Privacy
                </Link>
                <Link
                  to="/terms"
                  className="underline underline-offset-2 hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out"
                >
                  Terms
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Cookie notice */}
      <CookieNotice />
    </div>
    </>
  );
}
