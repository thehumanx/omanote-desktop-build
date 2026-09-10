import React, { lazy, Suspense } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { LandingScreen } from "./screens/LandingScreen";
import { useUserSettings } from "./contexts/UserSettingsContext";
import { isTauri } from "./lib/desktop";
import { readLocalStorageOptional, stringCodec } from "./lib/local-storage";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { DesktopAuthListener } from "./components/desktop/DesktopAuthListener";
import { DesktopUpdateBanner } from "./components/desktop/DesktopUpdateBanner";

const AuthenticatedAppLayout = lazy(() =>
  import("./app/AuthenticatedAppLayout").then((module) => ({ default: module.AuthenticatedAppLayout })),
);
const CanvasScreen = lazy(() =>
  import("./screens/CanvasScreen").then((module) => ({ default: module.CanvasScreen })),
);
const HistoryScreen = lazy(() =>
  import("./screens/HistoryScreen").then((module) => ({ default: module.HistoryScreen })),
);
const LoginScreen = lazy(() =>
  import("./screens/auth/LoginScreen").then((module) => ({ default: module.LoginScreen })),
);
const SignupScreen = lazy(() =>
  import("./screens/auth/SignupScreen").then((module) => ({ default: module.SignupScreen })),
);
const ExtensionAuthScreen = lazy(() =>
  import("./screens/auth/ExtensionAuthScreen").then((module) => ({
    default: module.ExtensionAuthScreen,
  })),
);
const DesktopAuthScreen = lazy(() =>
  import("./screens/auth/DesktopAuthScreen").then((module) => ({
    default: module.DesktopAuthScreen,
  })),
);
const DesktopOnboardingScreen = lazy(() =>
  import("./screens/desktop/DesktopOnboardingScreen").then((module) => ({
    default: module.DesktopOnboardingScreen,
  })),
);
const PrivacyPolicyScreen = lazy(() =>
  import("./screens/PrivacyPolicyScreen").then((module) => ({
    default: module.PrivacyPolicyScreen,
  })),
);
const TermsScreen = lazy(() =>
  import("./screens/TermsScreen").then((module) => ({ default: module.TermsScreen })),
);
const GuideScreen = lazy(() =>
  import("./screens/GuideScreen").then((module) => ({ default: module.GuideScreen })),
);
const BookmarksScreen = lazy(() =>
  import("./screens/BookmarksScreen").then((module) => ({ default: module.BookmarksScreen })),
);
const NotesScreen = lazy(() =>
  import("./screens/NotesScreen").then((module) => ({ default: module.NotesScreen })),
);
const SearchScreen = lazy(() =>
  import("./screens/SearchScreen").then((module) => ({ default: module.SearchScreen })),
);
const EventScreen = lazy(() =>
  import("./screens/EventScreen").then((module) => ({ default: module.EventScreen })),
);
const SettingsScreen = lazy(() =>
  import("./screens/SettingsScreen").then((module) => ({ default: module.SettingsScreen })),
);
const ExploreScreen = lazy(() =>
  import("./screens/ExploreScreen").then((module) => ({ default: module.ExploreScreen })),
);
const TodosScreen = lazy(() =>
  import("./screens/TodosScreen").then((module) => ({ default: module.TodosScreen })),
);
const UpdatesScreen = lazy(() =>
  import("./screens/UpdatesScreen").then((module) => ({ default: module.UpdatesScreen })),
);
const SharedFolderPage = lazy(() =>
  import("./screens/SharedFolderPage").then((module) => ({ default: module.SharedFolderPage })),
);

// All shared-folder links now live under /s/ (bookmarks, todos, and notes
// alike — see SharedFolderPage). /n/ is the legacy note-folder route; links
// already shared with it must keep working, so it redirects rather than 404s.
function LegacySharedNoteFolderRedirect() {
  const { shareCode } = useParams<{ shareCode: string }>();
  return <Navigate to={`/s/${shareCode ?? ""}`} replace />;
}
const InsightsScreen = lazy(() =>
  import("./screens/InsightsScreen").then((module) => ({ default: module.InsightsScreen })),
);
const ReaderScreen = lazy(() =>
  import("./screens/reader/ReaderScreen").then((module) => ({ default: module.ReaderScreen })),
);
const NotFoundPage = lazy(() =>
  import("./screens/NotFoundPage").then((module) => ({ default: module.NotFoundPage })),
);
const AdminDashboardScreen = lazy(() =>
  import("./screens/AdminDashboardScreen").then((module) => ({ default: module.AdminDashboardScreen })),
);
const PageScreen = lazy(() =>
  import("./screens/PageScreen").then((module) => ({ default: module.PageScreen })),
);

export function getAuthenticatedLayoutKind(pathname: string) {
  void pathname;
  return "app";
}

function RootRoute() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const location = useLocation();
  const { isOffline } = useNetworkStatus();

  // Convex can't confirm a session with no network, so `isLoading` never
  // resolves offline — without this the app would render nothing forever on
  // a device that's already signed in. `omanote.dexie-user` is written on
  // every successful sign-in (see AppProvider), so its presence is a durable
  // "this device has signed in before" signal independent of a live Convex
  // connection. Once connectivity returns, real auth state takes over again.
  const hasLocalSession = isOffline && !!readLocalStorageOptional("omanote.dexie-user", stringCodec);

  if (isLoading && !hasLocalSession) return null;

  if (!isAuthenticated && !hasLocalSession) {
    // The desktop app behaves like an app, not a website: no landing page,
    // just a first-run onboarding screen that hands sign-in to the browser.
    if (isTauri()) {
      return <DesktopOnboardingScreen />;
    }

    if (location.pathname.startsWith("/updates") || location.pathname.startsWith("/guide")) {
      return <PublicDocLayout />;
    }

    return <LandingScreen />;
  }

  return <AuthenticatedAppLayout />;
}

/**
 * The real gate is server-side in `convex/adminMetrics.ts` — this only decides
 * whether to render the route or bounce to the canvas, so non-admins never see
 * an error boundary.
 *
 * Web-only by design: the desktop shell loads the same production site, so
 * without the `isTauri()` check this route would show up there for free. It's a
 * wide, table-heavy analysis screen meant for a browser.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const isAdmin = useQuery(api.adminMetrics.isAdmin, {});
  if (isTauri()) return <Navigate to="/canvas" replace />;
  if (isAdmin === undefined) return null;
  if (!isAdmin) return <Navigate to="/canvas" replace />;
  return <>{children}</>;
}

function ReaderGuard({ children }: { children: React.ReactNode }) {
  const { settings, loading } = useUserSettings();
  if (loading) return null;
  if (!settings.rssReaderEnabled) return <Navigate to="/canvas" replace />;
  return <>{children}</>;
}

function PublicDocLayout() {
  return (
    <div className="public-page min-h-screen flex flex-col bg-app-surface text-app-ink">
      <nav className="border-b border-zinc-200 sticky top-0 bg-white/95 backdrop-blur-sm z-20">
        <div className="max-w-[1136px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/">
            <img src="/logo.svg" alt="omanote home" className="h-6 sm:h-7 w-auto" />
          </Link>
          <Link
            to="/"
            className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium"
          >
            ← Back to home
          </Link>
        </div>
      </nav>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  const inDesktopShell = isTauri();
  return (
    <Suspense fallback={null}>
      {inDesktopShell && <DesktopAuthListener />}
      {inDesktopShell && <DesktopUpdateBanner />}
      <Routes>
        <Route path="/login" element={inDesktopShell ? <Navigate to="/" replace /> : <LoginScreen />} />
        <Route path="/signup" element={inDesktopShell ? <Navigate to="/" replace /> : <SignupScreen />} />
        <Route path="/auth/extension" element={<ExtensionAuthScreen />} />
        <Route path="/auth/desktop" element={<DesktopAuthScreen />} />
        <Route path="/privacy" element={<PrivacyPolicyScreen />} />
        <Route path="/terms" element={<TermsScreen />} />
        <Route path="/s/:shareCode" element={<SharedFolderPage />} />
        <Route path="/n/:shareCode" element={<LegacySharedNoteFolderRedirect />} />
        <Route path="/" element={<RootRoute />}>
          <Route index element={<Navigate to="/canvas" replace />} />
          <Route path="canvas" element={<CanvasScreen />} />
          <Route path="history" element={<HistoryScreen />} />
          {/* One canvas, full page and chromeless — see AppShell's
              isChromelessRoute. A real route rather than a modal so it can be
              opened in a new tab and linked to. */}
          <Route path="p/:pageId" element={<PageScreen />} />
          <Route path="todos" element={<TodosScreen />} />
          <Route path="search" element={<SearchScreen />} />
          <Route path="explore" element={<ExploreScreen />} />
          <Route path="notes" element={<NotesScreen />} />
          <Route path="bookmarks" element={<BookmarksScreen />} />
          <Route path="event" element={<EventScreen />} />
          <Route path="routine" element={<Navigate to="/event" replace />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="updates" element={<UpdatesScreen />} />
          <Route path="guide" element={<GuideScreen />} />
          <Route path="guide/:topic" element={<GuideScreen />} />
          <Route path="insights" element={<InsightsScreen />} />
          <Route path="admin" element={<AdminGuard><AdminDashboardScreen /></AdminGuard>} />
          <Route path="reader" element={<ReaderGuard><ReaderScreen /></ReaderGuard>} />
          <Route path="reader/saved" element={<ReaderGuard><ReaderScreen savedView /></ReaderGuard>} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
