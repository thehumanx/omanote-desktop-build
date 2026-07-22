import {
  BarChart3,
  BookOpen,
  Bookmark,
  CalendarDays,
  CheckSquare,
  Compass,
  FileText,
  LayoutGrid,
  Megaphone,
  RefreshCw,
  Rss,
  Settings,
  Share2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

// Topic bodies are authored as markdown and imported raw (Vite `?raw`), the
// same mechanism the changelog uses. Add a new topic by dropping a `.md` file
// beside this manifest and registering it below.
import gettingStarted from "./getting-started.md?raw";
import dailyCanvas from "./daily-canvas.md?raw";
import capturing from "./capturing.md?raw";
import todos from "./todos.md?raw";
import recurringTodos from "./recurring-todos.md?raw";
import notes from "./notes.md?raw";
import bookmarks from "./bookmarks.md?raw";
import events from "./events.md?raw";
import rss from "./rss.md?raw";
import hashtags from "./hashtags.md?raw";
import search from "./search.md?raw";
import sharing from "./sharing.md?raw";
import settings from "./settings.md?raw";
import encryption from "./encryption.md?raw";
import googleSync from "./google-sync.md?raw";
import greetings from "./greetings.md?raw";
import insights from "./insights.md?raw";
import writeReadMode from "./write-read-mode.md?raw";
import profile from "./profile.md?raw";
import feedback from "./feedback.md?raw";
import changelog from "./changelog.md?raw";
import downloadAndInstall from "./download-and-install.md?raw";

export interface GuideTopic {
  slug: string;
  title: string;
  /** One-line summary used for the sidebar subtitle and the page meta description. */
  description: string;
  /** Markdown body. `undefined` marks a planned-but-unwritten topic (shown dimmed). */
  body?: string;
}

export interface GuideCategory {
  id: string;
  title: string;
  icon: LucideIcon;
  topics: GuideTopic[];
}

export const guideCategories: GuideCategory[] = [
  {
    id: "start",
    title: "Getting started",
    icon: BookOpen,
    topics: [
      {
        slug: "getting-started",
        title: "Getting started",
        description: "What omanote is and how to capture your first day.",
        body: gettingStarted,
      },
      {
        slug: "download-and-install",
        title: "Download & install",
        description: "Web app, desktop app, browser extension, and mobile.",
        body: downloadAndInstall,
      },
    ],
  },
  {
    id: "canvas",
    title: "The canvas",
    icon: LayoutGrid,
    topics: [
      { slug: "daily-canvas", title: "The daily canvas", description: "One day, everything in one place.", body: dailyCanvas },
      { slug: "capturing", title: "Capturing anything", description: "The composer, slash commands, and natural language.", body: capturing },
      { slug: "greetings", title: "Dynamic greetings", description: "A greeting that changes with the time of day.", body: greetings },
    ],
  },
  {
    id: "todos",
    title: "Todos",
    icon: CheckSquare,
    topics: [
      { slug: "todos", title: "Todos", description: "Due dates, checklists, folders, and priorities.", body: todos },
      {
        slug: "recurring-todos",
        title: "Recurring todos & reminders",
        description: "Repeat tasks on a schedule and get reminders that keep up.",
        body: recurringTodos,
      },
    ],
  },
  {
    id: "notes",
    title: "Notes",
    icon: FileText,
    topics: [{ slug: "notes", title: "Notes", description: "Write in markdown and organize into folders.", body: notes }],
  },
  {
    id: "bookmarks",
    title: "Bookmarks",
    icon: Bookmark,
    topics: [{ slug: "bookmarks", title: "Bookmarks", description: "Save links with previews, sorted into categories.", body: bookmarks }],
  },
  {
    id: "events",
    title: "Events",
    icon: CalendarDays,
    topics: [{ slug: "events", title: "Events", description: "Log what happened and build a timeline.", body: events }],
  },
  {
    id: "rss",
    title: "RSS reader",
    icon: Rss,
    topics: [
      { slug: "rss", title: "RSS reader", description: "Subscribe to feeds and read in omanote.", body: rss },
      { slug: "write-read-mode", title: "Write & Read mode", description: "Switch between canvas and reader in one workspace.", body: writeReadMode },
    ],
  },
  {
    id: "google-sync",
    title: "Google Calendar",
    icon: RefreshCw,
    topics: [
      {
        slug: "google-sync",
        title: "Google Calendar",
        description: "Sync todos and events with Google Calendar, both ways.",
        body: googleSync,
      },
    ],
  },
  {
    id: "organize",
    title: "Organizing & finding",
    icon: Compass,
    topics: [
      { slug: "hashtags", title: "Hashtags & Explore", description: "Tag anything and see the connections.", body: hashtags },
      { slug: "search", title: "Search", description: "Find anything across every artifact.", body: search },
    ],
  },
  {
    id: "insights",
    title: "Insights",
    icon: BarChart3,
    topics: [{ slug: "insights", title: "Insights", description: "Completion rates, activity heatmaps, and trends.", body: insights }],
  },
  {
    id: "sharing",
    title: "Sharing",
    icon: Share2,
    topics: [{ slug: "sharing", title: "Public links", description: "Share a folder with anyone via a link.", body: sharing }],
  },
  {
    id: "settings",
    title: "Settings & account",
    icon: Settings,
    topics: [
      { slug: "settings", title: "Settings", description: "Appearance, notifications, devices, and data.", body: settings },
      { slug: "profile", title: "Profile & account", description: "Your display name, avatar, and account settings.", body: profile },
    ],
  },
  {
    id: "feedback",
    title: "Feedback & updates",
    icon: Megaphone,
    topics: [
      { slug: "feedback", title: "Send feedback & request features", description: "How to report bugs and suggest improvements.", body: feedback },
      { slug: "changelog", title: "What's new & changelogs", description: "Update notifications, version history, and roadmap.", body: changelog },
    ],
  },
  {
    id: "privacy",
    title: "Privacy & security",
    icon: ShieldCheck,
    topics: [{ slug: "encryption", title: "How your data is protected", description: "Encryption and your recovery key, in plain language.", body: encryption }],
  },
];

// Shown in the guide header (like the changelog version on /updates). Bump
// when guide content is meaningfully revised.
export const GUIDE_LAST_UPDATED = "Jul 22, 2026";

export const guideTopics: GuideTopic[] = guideCategories.flatMap((category) => category.topics);

export const defaultGuideSlug = guideCategories[0].topics[0].slug;

export function findGuideTopic(slug: string): { category: GuideCategory; topic: GuideTopic } | null {
  for (const category of guideCategories) {
    const topic = category.topics.find((entry) => entry.slug === slug);
    if (topic) return { category, topic };
  }
  return null;
}
