import { Bookmark, CalendarDays, CheckSquare, FileText, SquarePen } from "lucide-react";

/**
 * The write-side tabs, in order. Its own module so the landing page's preview
 * chrome can show the same tabs without importing BottomNav — which imports
 * AppProvider, and with it the whole sync engine, outbox and local database,
 * into the bundle every first-time visitor downloads.
 */
export const writeTabs = [
  { to: "/canvas", label: "Canvas", icon: SquarePen },
  { to: "/todos", label: "Todos", icon: CheckSquare },
  { to: "/notes", label: "Notes", icon: FileText },
  { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { to: "/event", label: "Events", icon: CalendarDays },
];
