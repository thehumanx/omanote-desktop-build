import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { SignInButton } from "@clerk/react";
import { CookieNotice } from "../components/CookieNotice";
import { Bookmark, CheckSquare, Compass, FileText, CalendarDays, SquarePen, Folder, Link2, Settings, Zap, MousePointerClick, Lock, Puzzle, LayoutDashboard, Hash, Share2, Moon, Monitor, Bell, RefreshCw, Download, Rss, BookOpen, ChevronDown, X } from "lucide-react";
import readmeMarkdown from "../../README.md?raw";
import { color } from "../design-system/tokens";
import { parseLatestVersion } from "../lib/update-checker";
import { useOutsideClick } from "../lib/useOutsideClick";
import {
  BENTO_PHRASES,
  BOOKMARKS,
  CANVAS,
  EVENT,
  EXPLORE_TAGS,
  FAQ_ITEMS,
  NOTES_FOLDERS,
  ROADMAP,
  TODOS,
  TYPING_PHRASES,
  getModeFromText,
  modeChip,
  tagColor,
  type TypingPhrase,
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
        className="inline-flex items-center gap-1.5 text-sm text-app-ink-muted hover:text-app-ink transition-colors font-medium"
      >
        Download
        <ChevronDown
          className={[
            "h-3.5 w-3.5 transition-transform duration-200 ease-out",
            open ? "rotate-180" : "rotate-0",
          ].join(" ")}
        />
      </button>
      <div
        aria-hidden={!open}
        className={[
          "absolute right-0 top-full z-30 mt-3 w-48 overflow-hidden rounded-2xl border border-app-line bg-app-surface p-2 shadow-soft",
          "origin-top-right transition-[opacity,transform] duration-200 ease-out",
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
          href="#desktop"
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function useTyping(phrases: TypingPhrase[]) {
  const [text, setText] = useState("");
  const [idx, setIdx] = useState(0);
  const [del, setDel] = useState(false);

  useEffect(() => {
    const full = phrases[idx].text;
    if (!del) {
      if (text.length < full.length) {
        const t = setTimeout(() => setText(full.slice(0, text.length + 1)), 60);
        return () => clearTimeout(t);
      } else {
        const t = setTimeout(() => setDel(true), 2000);
        return () => clearTimeout(t);
      }
    } else {
      if (text.length > 0) {
        const t = setTimeout(() => setText(full.slice(0, text.length - 1)), 28);
        return () => clearTimeout(t);
      } else {
        setDel(false);
        setIdx((i) => (i + 1) % phrases.length);
      }
    }
  }, [text, del, idx, phrases]);

  return { text, mode: getModeFromText(text) };
}

function Checkmark() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
      <path
        d="M1 4l3 3 5-6"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── App mockup views ─────────────────────────────────────────────────────────
function CanvasView({ typedText, mode }: { typedText: string; mode: string }) {
  return (
    <div className="px-4 py-3 max-w-2xl mx-auto space-y-0.5">
      {/* Animated draft input */}
      <div className="rounded-xl border border-app-line bg-app-surface px-3 py-2.5 flex items-start gap-2.5 shadow-sm mb-1">
        <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${modeChip[mode]}`}>
          {mode}
        </span>
        <span className="text-sm text-app-ink flex-1 min-h-[20px]">
          {typedText}
          <span className="inline-block w-[2px] h-[13px] bg-app-ink ml-[1px] align-text-bottom animate-pulse" />
        </span>
      </div>

      {/* Existing canvas items — matching real canvas surface rendering */}
      {CANVAS.map((item) => (
        <div
          key={item.id}
          className="group relative rounded-xl px-2 py-1 pl-3 hover:bg-app-canvas transition-colors before:pointer-events-none before:absolute before:inset-y-2 before:left-0 before:w-px before:rounded-full before:bg-transparent"
        >
          {item.kind === "note" && (
            <p className="text-[15px] leading-6 text-app-ink">
              {item.text}{" "}
              <span className="text-success-ink">{item.tag}</span>
            </p>
          )}
          {item.kind === "todo" && (
            <div className="px-1 py-0.5 flex items-start gap-3">
              <div
                className={`mt-1 flex h-4 w-4 items-center justify-center rounded-sm border shrink-0 ${
                  item.done
                    ? "border-app-ink bg-app-ink text-white"
                    : "border-app-line-strong bg-app-surface text-transparent"
                }`}
              >
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="w-2.5 h-2.5">
                  <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className={`text-base leading-6 ${item.done ? "line-through text-app-ink-faint" : "text-app-ink"}`}>
                {item.text}{!item.done && <span className="text-success-ink"> {item.tag}</span>}
              </p>
            </div>
          )}
          {item.kind === "event" && (
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center h-6 w-[72px] flex-none rounded-md border border-app-line bg-app-surface-muted px-2 py-0.5 text-xs font-medium text-app-ink-muted shrink-0">
                {item.time}
              </span>
              <p className="text-base leading-6 text-app-ink">
                {item.text}{" "}
                <span className="text-success-ink">{item.tag}</span>
              </p>
            </div>
          )}
          {item.kind === "bookmark" && (
            <div className="relative overflow-hidden rounded-2xl border border-app-line bg-app-surface p-3">
              <div className="flex items-start gap-3">
                {/* Thumbnail placeholder */}
                <div className="flex-none overflow-hidden rounded-lg border border-app-line bg-app-canvas text-app-ink-faint flex h-24 w-24 items-center justify-center shrink-0">
                  <Bookmark className="h-8 w-8" />
                </div>
                <div className="min-w-0 flex-1">
                  {/* Favicon + site name */}
                  <div className="flex items-center gap-2 pb-2">
                    <div className="relative flex h-4 w-4 flex-none items-center justify-center overflow-hidden rounded-sm bg-app-surface-muted text-app-ink-muted">
                      <Bookmark className="h-3.5 w-3.5" />
                    </div>
                    <p className="min-w-0 truncate text-xs font-medium text-app-ink-muted">{item.domain}</p>
                  </div>
                  <p className="line-clamp-2 text-base font-bold leading-6 text-app-ink">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-app-ink-muted">Your read-later library in one place</p>
                  <div className="mt-2 flex flex-wrap items-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-app-surface-muted px-2 py-0.5 text-[11px] text-app-ink-muted">
                      {item.tag.replace("#", "")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TodosView() {
  return (
    <div className="px-4 py-3 max-w-2xl mx-auto space-y-5">
      {TODOS.map((group) => (
        <div key={group.group}>
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${group.color}`}>
            {group.group}
          </p>
          <div className="space-y-1">
            {group.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-app-canvas transition-colors"
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    item.done ? "bg-app-ink border-app-ink" : "border-app-line-strong"
                  }`}
                >
                  {item.done && <Checkmark />}
                </div>
                <p className={`text-sm flex-1 ${item.done ? "line-through text-app-ink-faint" : "text-app-ink"}`}>
                  {item.text}
                </p>
                <span className="text-[11px] text-success-ink shrink-0">{item.tag}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NotesView() {
  const [openFolder, setOpenFolder] = useState("Work");
  return (
    <div className="flex h-full">
      <div className="w-36 border-r border-app-line py-2 shrink-0 bg-app-canvas/50">
        {NOTES_FOLDERS.map((f) => (
          <button
            key={f.folder}
            onClick={() => setOpenFolder(f.folder)}
            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${
              openFolder === f.folder
                ? "bg-app-surface font-bold text-app-ink border-r-2 border-app-ink"
                : "text-app-ink-muted hover:text-app-ink-muted"
            }`}
          >
            <span className="text-sm leading-none shrink-0">{f.icon}</span> {f.folder}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto py-3 px-3 space-y-2">
        {NOTES_FOLDERS.find((f) => f.folder === openFolder)?.items.map((note, i) => (
          <div
            key={i}
            className="rounded-xl border border-app-line bg-app-surface px-3 py-2.5 hover:border-app-line cursor-pointer transition-colors"
          >
            <p className="text-sm font-bold text-app-ink">{note.title}</p>
            <p className="text-xs text-app-ink-faint mt-0.5 truncate">{note.preview}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookmarksView() {
  return (
    <div className="px-4 py-3 max-w-2xl mx-auto space-y-2">
      {BOOKMARKS.map((bm, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-app-line bg-app-surface px-3 py-2.5 hover:border-app-line transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-app-surface-muted flex items-center justify-center shrink-0">
            <Link2 className="h-4 w-4 text-app-ink-muted" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-app-ink truncate">{bm.title}</p>
            <p className="text-xs text-app-ink-faint">{bm.domain}</p>
          </div>
          <span className="shrink-0 rounded-full bg-app-surface-muted px-2 py-0.5 text-[10px] font-medium text-app-ink-muted flex items-center gap-1">
            <span className="text-xs leading-none">{bm.categoryIcon}</span>
            {bm.category}
          </span>
        </div>
      ))}
    </div>
  );
}

function EventView() {
  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      <div className="relative pl-8">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-app-surface-muted" />
        <div className="space-y-4">
          {EVENT.map((entry, i) => (
            <div key={i} className="relative flex items-start gap-3">
              <div
                className={`absolute -left-8 top-1 w-[14px] h-[14px] rounded-full border-2 ${
                  entry.auto ? "bg-app-ink border-app-ink" : "bg-app-surface border-app-line-strong"
                }`}
              />
              <span className="text-xs text-app-ink-faint w-14 shrink-0 pt-0.5">{entry.time}</span>
              <div className="flex-1">
                <p className="text-sm text-app-ink">{entry.text}</p>
                <span className="text-[11px] text-success-ink font-medium">{entry.tag}</span>
              </div>
              {entry.auto && (
                <span className="text-[10px] rounded-full bg-info-surface text-info-ink px-1.5 py-0.5 shrink-0 border border-info-line">
                  auto
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExploreView() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-4">
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
  const [active, setActive] = useState<string>("canvas");
  const { text: typedText, mode } = useTyping(TYPING_PHRASES);

  return (
    <div className="relative rounded-2xl border border-app-line bg-app-surface shadow-app-dialog overflow-hidden text-left">
      {/* Top chrome / date strip */}
      <div className="border-b border-app-line h-11 bg-app-surface flex items-center justify-between px-5 shrink-0">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-app-line" />
          <div className="w-2.5 h-2.5 rounded-full bg-app-line" />
          <div className="w-2.5 h-2.5 rounded-full bg-app-line" />
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-app-ink-faint hover:text-app-ink-muted text-sm px-1 transition-colors leading-none"
            aria-label="Preview previous day"
          >
            ‹
          </button>
          <span className="text-xs font-bold text-app-ink-muted">Thursday, Apr 24</span>
          <button
            className="text-app-ink-faint hover:text-app-ink-muted text-sm px-1 transition-colors leading-none"
            aria-label="Preview next day"
          >
            ›
          </button>
        </div>
        <img src={DUMMY_AVATAR} className="w-6 h-6 rounded-full opacity-60" alt="" />
      </div>

      {/* Content area */}
      <div className="relative" style={{ height: 400 }}>
        <div className="h-full overflow-y-auto">
          {active === "canvas" && <CanvasView typedText={typedText} mode={mode} />}
          {active === "todos" && <TodosView />}
          {active === "notes" && <NotesView />}
          {active === "bookmarks" && <BookmarksView />}
          {active === "event" && <EventView />}
          {active === "explore" && <ExploreView />}
        </div>
        {/* Content fade at bottom */}
        <div className="pointer-events-none absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-white to-transparent" />
      </div>

      {/* Bottom nav — three-part: compass | tabs pill | profile (matches real app) */}
      <div className="border-t border-app-line bg-app-surface h-16 flex items-center px-4 gap-3 shrink-0">
        {/* Compass circle */}
        <button
          onClick={() => setActive("explore")}
          aria-label="Preview Explore"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-app-nav transition-all duration-200 cursor-pointer ${
            active === "explore"
              ? "border-app-ink bg-app-ink text-white"
              : "border-app-line bg-app-surface text-app-ink-muted hover:bg-app-canvas"
          }`}
        >
          <Compass size={15} />
        </button>

        {/* Tab pills — centered, labels only (matches real md+ desktop behavior) */}
        <div className="flex-1 flex justify-center min-w-0">
          <div className="relative inline-flex items-center gap-1 rounded-app-chip border border-app-line/60 bg-app-surface/80 shadow-app-nav backdrop-blur-md px-1.5 py-1.5 overflow-hidden">
            {NAV_TABS.map((tab) => {
              const isActive = active === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActive(tab.key)}
                  aria-label={`Preview ${tab.label}`}
                  className={`relative flex items-center rounded-app-chip px-3 py-1.5 text-[13px] font-medium leading-none transition-all duration-200 cursor-pointer ${
                    isActive ? "text-white" : "text-app-ink-muted hover:text-app-ink"
                  }`}
                >
                  {isActive && (
                    <span className="absolute inset-0 rounded-app-chip bg-app-ink shadow-app-nav-active" aria-hidden="true">
                      <span className="absolute inset-0 rounded-app-chip shadow-app-nav-active-inset" />
                    </span>
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Profile circle */}
        <img
          src={DUMMY_AVATAR}
          className="h-11 w-11 rounded-full shrink-0 border border-app-line shadow-app-nav opacity-60 cursor-not-allowed"
          title="Profile not available in preview"
          alt=""
        />
      </div>
    </div>
  );
}

// ─── Bento card mini-previews ─────────────────────────────────────────────────
function BentoCanvas() {
  const { text } = useTyping(BENTO_PHRASES);
  return (
    <div className="sm:col-span-2 rounded-2xl border border-app-line bg-app-surface p-5 flex flex-col gap-4 overflow-hidden">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">Canvas</p>
        <h3 className="font-serif-heading font-serif-heading-smooth mt-1.5 text-lg font-black text-app-ink tracking-tight">Your daily home base</h3>
        <p className="mt-1 text-sm text-app-ink-muted leading-snug">
          Brain dumps, link saves, todo blurts, shower thoughts — all in one stream, all tied to today.
        </p>
      </div>
      <div className="rounded-xl border border-app-line bg-app-canvas p-3 space-y-2 flex-1">
        {/* Typing draft — plain text, no mode pill (matches actual app) */}
        <div className="rounded-lg bg-app-surface border border-app-line px-3 py-2 shadow-sm">
          <span className="text-xs text-app-ink-muted min-h-[16px]">
            {text}
            <span className="animate-pulse">|</span>
          </span>
        </div>
        {/* Static canvas items below the draft */}
        <div className="space-y-1.5 opacity-70">
          {[
            { kind: "note",    text: "Morning felt calm today ✨" },
            { kind: "todo",    text: "Call dentist", done: true },
            { kind: "event", text: "7:00 AM · Morning run" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-app-ink-muted px-1">
              {item.kind === "note" && <div className="w-1 h-1 rounded-full bg-app-line-strong shrink-0" />}
              {item.kind === "todo" && (
                <div className="w-3 h-3 rounded border shrink-0 flex items-center justify-center bg-app-ink border-app-ink">
                  <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              {item.kind === "event" && (
                <div className="w-1.5 h-1.5 rounded-full border border-app-line-strong shrink-0" />
              )}
              <span className={item.kind === "todo" ? "line-through text-app-ink-faint" : ""}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BentoTodos() {
  const items = [
    { text: "Ship landing redesign", tag: "#work",    due: "by 5pm today" },
    { text: "Call mom",              tag: "#family",  due: "at 8pm" },
    { text: "Buy coffee beans",      tag: "#errands", due: "overdue" },
  ];
  return (
    <div className="rounded-2xl border border-app-line bg-app-surface p-5 flex flex-col gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">Todos</p>
        <h3 className="font-serif-heading font-serif-heading-smooth mt-1.5 text-lg font-black text-app-ink tracking-tight">A task list, not a PM tool</h3>
        <p className="mt-1 text-sm text-app-ink-muted leading-snug">Today, overdue, upcoming, done. No sprints. No velocity. That's genuinely it.</p>
      </div>
      <div className="rounded-xl border border-app-line bg-app-canvas p-3 space-y-2 flex-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg bg-app-surface border border-app-line px-2.5 py-2">
            <div className="w-3.5 h-3.5 rounded border border-app-line-strong shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-app-ink">{item.text} <span className="text-[10px] text-success-ink">{item.tag}</span></p>
              <p className={`text-[10px] mt-0.5 ${item.due === "overdue" ? "text-danger-ink" : "text-app-ink-faint"}`}>{item.due}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BentoNotes() {
  const folders = [
    { name: "Work",     icon: "💼", notes: 4 },
    { name: "Personal", icon: "🏠", notes: 7 },
    { name: "Ideas",    icon: "💡", notes: 2 },
  ];
  return (
    <div className="rounded-2xl border border-app-line bg-app-surface p-5 flex flex-col gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">Notes</p>
        <h3 className="font-serif-heading font-serif-heading-smooth mt-1.5 text-lg font-black text-app-ink tracking-tight">Everything in its place.</h3>
        <p className="mt-1 text-sm text-app-ink-muted leading-snug">
          Folders you'll actually use. Not a filing system you'll abandon by Thursday.
        </p>
      </div>
      <div className="rounded-xl border border-app-line bg-app-canvas p-3 flex-1 space-y-1.5">
        {folders.map((folder) => (
          <div
            key={folder.name}
            className="flex items-center gap-2 rounded-lg bg-app-surface border border-app-line px-2.5 py-2"
          >
            <span className="text-sm leading-none shrink-0">{folder.icon}</span>
            <span className="text-xs font-medium text-app-ink-muted flex-1">{folder.name}</span>
            <span className="text-[10px] text-app-ink-faint">{folder.notes} notes</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BentoBookmarks() {
  return (
    <div className="sm:col-span-2 rounded-2xl border border-app-line bg-app-surface p-5 flex flex-col gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">Bookmarks</p>
        <h3 className="font-serif-heading font-serif-heading-smooth mt-1.5 text-lg font-black text-app-ink tracking-tight">Paste a URL. Done.</h3>
        <p className="mt-1 text-sm text-app-ink-muted leading-snug">
          Title, description, thumbnail — fetched automatically. You paste and keep going. Share any folder as a public link when you're ready to show it off.
        </p>
      </div>
      <div className="rounded-xl border border-app-line bg-app-canvas p-3 flex-1 space-y-2">
        <div className="flex items-center gap-1.5 px-0.5 pb-1.5 border-b border-app-line">
          <span className="text-xs leading-none">📚</span>
          <span className="text-[10px] font-bold text-app-ink-muted flex-1">Reading</span>
          <Share2 className="h-3 w-3 text-app-ink-faint" />
        </div>
        {BOOKMARKS.slice(0, 3).map((bm, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 rounded-lg bg-app-surface border border-app-line px-2.5 py-2"
          >
            <div className="w-6 h-6 rounded bg-app-surface-muted flex items-center justify-center shrink-0">
              <Link2 className="h-3 w-3 text-app-ink-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-app-ink truncate">{bm.title}</p>
              <p className="text-[10px] text-app-ink-faint">{bm.domain}</p>
            </div>
            <span className="text-[10px] rounded-full bg-app-surface-muted px-2 py-0.5 text-app-ink-muted shrink-0 flex items-center gap-0.5">
              <span className="text-xs leading-none">{bm.categoryIcon}</span>
              {bm.category}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BentoEvent() {
  return (
    <div className="rounded-2xl border border-app-line bg-app-surface p-5 flex flex-col gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">Event</p>
        <h3 className="font-serif-heading font-serif-heading-smooth mt-1.5 text-lg font-black text-app-ink tracking-tight">Time-stamped and done.</h3>
        <p className="mt-1 text-sm text-app-ink-muted leading-snug">
          Completed todos auto-appear on the timeline. Log the rest yourself. It ends up feeling weirdly satisfying.
        </p>
      </div>
      <div className="rounded-xl border border-app-line bg-app-canvas p-3 flex-1">
        <div className="relative pl-5">
          <div className="absolute left-1.5 top-1 bottom-1 w-px bg-app-line" />
          <div className="space-y-2.5">
            {EVENT.slice(0, 4).map((entry, i) => (
              <div key={i} className="relative flex items-center gap-2">
                <div
                  className={`absolute -left-5 w-2.5 h-2.5 rounded-full border-2 ${
                    entry.auto ? "bg-app-ink border-app-ink" : "bg-app-surface border-app-line-strong"
                  }`}
                />
                <span className="text-[10px] text-app-ink-faint w-12 shrink-0">{entry.time}</span>
                <span className="text-xs text-app-ink-muted">{entry.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BentoExplore() {
  const nodes = [
    { tag: "#work",    x: 50, y: 50 },
    { tag: "#health",  x: 19, y: 75 },
    { tag: "#books",   x: 81, y: 25 },
    { tag: "#morning", x: 25, y: 25 },
    { tag: "#tools",   x: 81, y: 75 },
  ];
  return (
    <div className="rounded-2xl border border-app-line bg-app-surface p-5 flex flex-col gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">Explore</p>
        <h3 className="font-serif-heading font-serif-heading-smooth mt-1.5 text-lg font-black text-app-ink tracking-tight">The big picture.</h3>
        <p className="mt-1 text-sm text-app-ink-muted leading-snug">
          Tap any hashtag and see everything you've ever written, saved, or done under it. Like pulling on a thread.
        </p>
      </div>
      <div className="rounded-xl border border-app-line bg-app-canvas p-3 flex-1 flex items-center justify-center">
        <div className="relative" style={{ width: 170, height: 110 }}>
          <svg className="absolute inset-0" width="170" height="110" viewBox="0 0 170 110" fill="none">
            <line x1="85" y1="55" x2="32" y2="82" stroke={color.zinc300} strokeWidth="1" />
            <line x1="85" y1="55" x2="138" y2="28" stroke={color.zinc300} strokeWidth="1" />
            <line x1="85" y1="55" x2="42" y2="28" stroke={color.zinc300} strokeWidth="1" />
            <line x1="85" y1="55" x2="138" y2="82" stroke={color.zinc300} strokeWidth="1" />
          </svg>
          {nodes.map((n) => (
            <div
              key={n.tag}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-0.5 text-[9px] font-bold shadow-sm select-none ${tagColor(n.tag)}`}
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              {n.tag}
            </div>
          ))}
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

function BentoRss() {
  const feeds = [
    { name: "The Verge", unread: 5, active: false },
    { name: "Hacker News", unread: 12, active: true },
    { name: "Design Notes", unread: 2, active: false },
  ];
  const articles = [
    { title: "The future of AI-native interfaces is already here", time: "2h ago", read: false },
    { title: "Why local-first software matters more than ever", time: "4h ago", read: false },
    { title: "Figma's new auto-layout engine, explained", time: "Yesterday", read: true },
  ];
  return (
    <div className="rounded-2xl border border-app-line bg-app-surface p-5 flex flex-col gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">RSS Reader</p>
        <h3 className="font-serif-heading font-serif-heading-smooth mt-1.5 text-lg font-black text-app-ink tracking-tight">Read without the noise.</h3>
        <p className="mt-1 text-sm text-app-ink-muted leading-snug">
          Subscribe to any feed, read in-app, and save what matters straight to your bookmarks.
        </p>
      </div>
      <div className="rounded-xl border border-app-line bg-app-canvas flex flex-1 overflow-hidden" style={{ minHeight: 110 }}>
        {/* Feed sidebar */}
        <div className="w-[88px] shrink-0 border-r border-app-line py-1.5 space-y-0.5">
          {feeds.map((f) => (
            <div
              key={f.name}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md mx-1 ${f.active ? "bg-app-surface" : ""}`}
            >
              <span className={`flex-1 truncate text-[9px] font-medium ${f.active ? "text-app-ink" : "text-app-ink-muted"}`}>{f.name}</span>
              <span className="shrink-0 rounded-full bg-info-surface text-info-ink px-1 text-[8px] font-bold leading-4">{f.unread}</span>
            </div>
          ))}
        </div>
        {/* Article list */}
        <div className="flex-1 py-1.5 space-y-0.5 overflow-hidden">
          {articles.map((a, i) => (
            <div key={i} className={`px-2.5 py-1 ${i === 0 ? "bg-app-surface rounded-lg mx-1" : "mx-1"}`}>
              <div className="flex items-start gap-1.5">
                {!a.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-info-ink" />}
                <p className={`text-[9px] leading-snug flex-1 ${a.read ? "text-app-ink-faint pl-3" : "font-semibold text-app-ink"}`}>{a.title}</p>
              </div>
              <p className="text-[8px] text-app-ink-faint mt-0.5 pl-3">{a.time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── RSS announcement banner ──────────────────────────────────────────────────
function RssBanner() {
  return (
    <div className="px-4 py-2" style={{ backgroundColor: CTA_BG }}>
      <p className="text-center text-sm font-medium text-white">
        Feature announcement: omanote reader is here. Read your favorite authors right from the app.{" "}
        <a href="#reader" className="font-bold underline underline-offset-2 hover:no-underline">
          Learn more →
        </a>
      </p>
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

function RssSection() {
  return (
    <section id="reader" className="border-t border-app-line">
      <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: copy */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">
              RSS Reader
            </p>
            <h2 className="font-serif-heading font-serif-heading-smooth mt-4 text-3xl sm:text-4xl font-black tracking-[-0.025em] leading-tight">
              Your reading list,<br className="hidden sm:block" /> inside your workspace.
            </h2>
            <p className="mt-5 text-app-ink-muted leading-relaxed text-[15px]">
              Paste any RSS or Atom feed URL and subscribe. Articles arrive automatically, organized
              into categories you set up — and everything you save lands straight in your bookmarks.
            </p>

            <ul className="mt-7 space-y-4">
              {[
                {
                  icon: Rss,
                  title: "Subscribe by pasting a URL",
                  body: "Direct feed URLs, or just paste the site — omanote finds the feed for you.",
                },
                {
                  icon: BookOpen,
                  title: "Read without leaving the app",
                  body: "Full-height reader slides in alongside your feed list. No context switch, no new tab.",
                },
                {
                  icon: Bookmark,
                  title: "Save what matters",
                  body: "Heart an article to save it, or push it straight to Bookmarks with one tap.",
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

            <div className="mt-8">
              <p className="text-xs text-app-ink-faint">
                Opt-in from Settings → Features. Off by default — no change to your workspace until you turn it on.
              </p>
            </div>
          </div>

          {/* Right: reader mockup */}
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
  );
}

// ─── Extension section ────────────────────────────────────────────────────────
function ExtensionSection() {
  return (
    <section id="extension" className="border-t border-app-line">
      <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: copy + download buttons */}
          <div>
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
                className="inline-flex items-center gap-2 rounded-xl border border-app-line bg-app-surface px-4 py-2.5 text-sm font-bold text-app-ink hover:border-app-line-strong hover:bg-app-canvas transition-colors shadow-sm"
              >
                <span className="text-base leading-none">🌐</span>
                Add to Chrome / Chromium
              </a>
              <a
                href="https://addons.mozilla.org/en-US/firefox/addon/omanote/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-app-line bg-app-surface px-4 py-2.5 text-sm font-bold text-app-ink hover:border-app-line-strong hover:bg-app-canvas transition-colors shadow-sm"
              >
                <span className="text-base leading-none">🦊</span>
                Add to Firefox
              </a>
            </div>
            <p className="mt-3 text-xs text-app-ink-faint">
              Free. No account needed to install — sign in to sync with your workspace.
            </p>
          </div>

          {/* Right: popup mockup */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              {/* Subtle glow behind the popup */}
              <div
                className="absolute inset-0 rounded-3xl blur-3xl opacity-20 -z-10"
                style={{ background: `radial-gradient(ellipse at center, ${CTA_BG} 0%, transparent 70%)` }}
              />
              <ExtensionPopupMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Desktop section ──────────────────────────────────────────────────────────
function DesktopSection() {
  return (
    <section id="desktop" className="border-t border-app-line">
      <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: window mockup */}
          <div className="order-2 lg:order-1 flex justify-center lg:justify-start">
            <div className="relative w-full max-w-[440px]">
              <div
                className="absolute inset-0 rounded-3xl blur-3xl opacity-20 -z-10"
                style={{ background: `radial-gradient(ellipse at center, ${CTA_BG} 0%, transparent 70%)` }}
              />
              <div className="rounded-2xl border border-app-line bg-app-surface shadow-soft overflow-hidden">
                {/* Title bar */}
                <div className="flex items-center gap-2 border-b border-app-line bg-app-canvas px-4 py-2.5">
                  <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                  <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                  <span className="ml-3 text-xs font-bold text-app-ink-muted">omanote</span>
                </div>
                {/* Window body */}
                <div className="px-5 py-6 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">Today</p>
                  <p className="text-sm text-app-ink">Had the best matcha this morning <span className="text-app-ink-faint">#morning</span></p>
                  <p className="text-sm text-app-ink">Call mom tonight <span className="text-app-ink-faint">#family</span></p>
                  {/* Native notification toast */}
                  <div className="mt-4 ml-auto w-[85%] rounded-xl border border-app-line bg-app-canvas px-3.5 py-2.5 shadow-soft">
                    <div className="flex items-start gap-2.5">
                      <Bell className="h-4 w-4 shrink-0 mt-0.5 text-app-ink-muted" />
                      <div>
                        <p className="text-xs font-bold text-app-ink">Reminder</p>
                        <p className="text-xs text-app-ink-muted">Call mom tonight</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: copy + download button */}
          <div className="order-1 lg:order-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">
              Desktop app
            </p>
            <h2 className="font-serif-heading font-serif-heading-smooth mt-4 text-3xl sm:text-4xl font-black tracking-[-0.025em] leading-tight">
              Your daily workspace,<br className="hidden sm:block" /> in its own window.
            </h2>
            <p className="mt-5 text-app-ink-muted leading-relaxed text-[15px]">
              omanote as a real app on Windows, Mac, and Linux. Same workspace, same encryption —
              with its own place in your dock and reminders that reach you through your system.
            </p>

            <ul className="mt-7 space-y-4">
              {[
                {
                  icon: Bell,
                  title: "Native notifications",
                  body: "Todo reminders arrive as real system notifications, even when omanote is in the background.",
                },
                {
                  icon: Monitor,
                  title: "Its own window",
                  body: "Lives in your dock or taskbar instead of getting lost in a sea of browser tabs.",
                },
                {
                  icon: RefreshCw,
                  title: "Always current",
                  body: "The app picks up every omanote update on launch — nothing to reinstall.",
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

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={desktopAppReleaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-app-line bg-app-surface px-4 py-2.5 text-sm font-bold text-app-ink hover:border-app-line-strong hover:bg-app-canvas transition-colors shadow-sm"
              >
                <Download className="h-4 w-4" />
                Download from GitHub
              </a>
            </div>
            <p className="mt-3 text-xs text-app-ink-faint">
              Free. Windows (.msi / .exe) · macOS (.dmg) · Linux (.deb / .rpm / .AppImage)
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA button ───────────────────────────────────────────────────────────────
function JournalCta({ label = "Start your daily workspace" }: { label?: string }) {
  return (
    <SignInButton mode="modal" fallbackRedirectUrl="/canvas">
      <button
        className="relative inline-flex items-center overflow-hidden rounded-xl px-5 py-2.5 text-sm font-bold text-white cursor-pointer transition-[transform,filter] duration-150 ease-out hover:brightness-110 active:translate-y-px active:scale-[0.98]"
        style={{
          backgroundColor: CTA_BG,
          border: `1px solid ${CTA_BORDER}`,
          boxShadow: "0px 1px 4px 0px rgba(0,0,0,0.35)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{ boxShadow: "inset 0px 3px 4px 0px rgba(255,255,255,0.22)" }}
        />
        <span className="relative z-10">{label}</span>
      </button>
    </SignInButton>
  );
}

// ─── Main landing page ────────────────────────────────────────────────────────
export function LandingScreen() {
  const year = new Date().getFullYear();
  const currentVersion = parseLatestVersion(readmeMarkdown)?.version ?? "v0.9";

  return (
    <div className="public-page min-h-screen flex flex-col bg-app-surface text-app-ink">
      {/* Nav */}
      <nav className="border-b border-app-line sticky top-0 bg-app-surface/95 backdrop-blur-sm z-20">
        <div className="max-w-[1136px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <img src="/logo.svg" alt="omanote home" className="h-6 sm:h-7 w-auto" />
          <div className="flex items-center gap-4 sm:gap-6">
            <DownloadNavDropdown />
            <SignInButton mode="modal" fallbackRedirectUrl="/canvas">
              <button className="text-sm text-app-ink-muted hover:text-app-ink transition-colors cursor-pointer font-medium">
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
        <section className="max-w-[1136px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20 lg:pt-28 pb-0 text-center">
          <p className="inline-flex items-center rounded-full border border-app-line bg-app-canvas px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-app-ink-muted">
            Opinionated daily workspace
          </p>
          <h1 className="font-serif-heading font-serif-heading-smooth mt-6 text-[44px] sm:text-[58px] lg:text-[72px] font-black leading-[1.02] tracking-[-0.035em] max-w-[860px] mx-auto">
            Capture the day
            <br className="hidden sm:block" /> before it disappears.
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-app-ink-muted max-w-[560px] mx-auto leading-relaxed">
            Notes, todos, bookmarks, events, and a built-in reader for everything you follow.
            omanote catches all of it before it slips away.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <JournalCta label="Start your daily workspace" />
            <a
              href="#why"
              className="inline-flex items-center rounded-xl border border-app-line bg-app-surface px-4 py-2.5 text-sm font-medium text-app-ink-muted hover:border-app-line-strong hover:text-app-ink transition-colors"
            >
              See how it works
            </a>
          </div>
          <a
            href="#desktop"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-app-ink-faint hover:text-app-ink-muted transition-colors"
          >
            <Monitor size={14} />
            <span>Desktop apps now available for any OS</span>
            <span className="text-app-ink-faint">→</span>
          </a>

          {/* App mockup — half-peeking below the fold */}
          <div className="mt-12 sm:mt-14 max-w-4xl mx-auto relative">
            <AppMockup />
            {/* Page-level bottom fade hints the page continues */}
            <div className="pointer-events-none absolute -bottom-1 inset-x-0 h-20 bg-gradient-to-t from-white to-transparent" />
          </div>
          {/* Disclaimer */}
          <p className="mt-6 text-xs text-app-ink-faint max-w-md mx-auto leading-relaxed">
            That's a preview up there. Sign in and it's yours for real — same shape, actual data.
          </p>
        </section>

        {/* Why omanote */}
        <section id="why" className="border-t border-app-line mt-0">
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
                  canvas to start, then notes, todos, bookmarks, events, and Explore when you want
                  to pull the thread.
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
                    body: "Tag a note, a todo, and an event with #health. Now they're connected. Explore shows you the whole thread.",
                  },
                  {
                    icon: CalendarDays,
                    title: "Day-first capture",
                    body: "Every capture is rooted in today. Because 'I think I wrote that down last Tuesday' is how things get lost.",
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

        {/* Bento grid */}
        <section id="features" className="border-t border-app-line">
          <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">
              What's inside
            </p>
            <h2 className="font-serif-heading font-serif-heading-smooth mt-4 text-2xl sm:text-3xl font-black tracking-[-0.025em] leading-tight">
              Notes, todos, bookmarks, events, and a reader — all in one daily home base.
            </h2>
            <p className="mt-3 text-app-ink-muted text-[15px]">
              Type it once on the canvas. When you're ready to find it, the focused views are there —
              task list, note library, link vault, timeline, reader, hashtag map, all of it.
            </p>
            <div className="mt-10 space-y-4">
              {/* Row 1: Canvas (wide) + Todos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <BentoCanvas />
                <BentoTodos />
              </div>
              {/* Row 2: Notes + Bookmarks (wide) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <BentoNotes />
                <BentoBookmarks />
              </div>
              {/* Row 3: Event + Explore + RSS Reader */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <BentoEvent />
                <BentoExplore />
                <BentoRss />
              </div>
            </div>
          </div>
        </section>

        {/* RSS Reader */}
        <RssSection />

        {/* Extension */}
        <ExtensionSection />

        {/* Desktop app */}
        <DesktopSection />

        {/* Capture and trust */}
        <section className="border-t border-app-line">
          <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-20">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">
                  Capture flow
                </p>
                <h2 className="font-serif-heading font-serif-heading-smooth mt-4 text-2xl sm:text-3xl font-black tracking-[-0.025em] leading-tight">
                  Capture first. Sort later.
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-app-ink-muted">
                  Type a thought, paste a link, or use a slash command if you already know it's a
                  todo or event. omanote keeps capture frictionless — then gives things a proper
                  home once you're ready to deal with them.
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">
                  Privacy and reliability
                </p>
                <h2 className="font-serif-heading font-serif-heading-smooth mt-4 text-2xl sm:text-3xl font-black tracking-[-0.025em] leading-tight">
                  Your stuff. Yours.
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-app-ink-muted">
                  Daily notes are personal. Like, really personal. omanote supports offline capture,
                  client-side encryption, passphrase unlock, and recovery keys — so your stuff stays
                  yours, and stays available, even when the network's being dramatic.
                </p>
              </div>
            </div>
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
          <div className="max-w-[1136px] mx-auto px-4 sm:px-6 py-20 sm:py-24 lg:py-32 text-center">
            <h2 className="font-serif-heading font-serif-heading-smooth text-3xl sm:text-4xl font-black tracking-[-0.025em] max-w-[480px] mx-auto leading-tight">
              Ready to just start typing?
            </h2>
            <p className="mt-4 text-app-ink-muted max-w-[380px] mx-auto leading-relaxed text-[15px]">
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
                  className="rounded-full border border-app-line bg-app-canvas px-2 py-0.5 text-[10px] font-bold text-app-ink-muted hover:border-app-line-strong hover:text-app-ink-muted transition-colors cursor-pointer"
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
                  className="underline underline-offset-2 hover:text-app-ink-muted transition-colors"
                >
                  iambishistha.com
                </a>
                .
                <span className="block">Built for personal use, shared publicly.</span>
              </p>
              <a
                href="mailto:omanote@iambishistha.com"
                className="mt-1.5 text-xs text-app-ink-faint underline underline-offset-2 hover:text-app-ink-muted transition-colors"
              >
                omanote@iambishistha.com
              </a>
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
                  className="underline underline-offset-2 hover:text-app-ink-muted transition-colors"
                >
                  Privacy Policy
                </Link>
                <Link
                  to="/terms"
                  className="underline underline-offset-2 hover:text-app-ink-muted transition-colors"
                >
                  Terms of Use
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Cookie notice */}
      <CookieNotice />
    </div>
  );
}
