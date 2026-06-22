import React, { lazy, Suspense } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { LandingScreen } from "./screens/LandingScreen";
import { useUserSettings } from "./contexts/UserSettingsContext";
import { isTauri } from "./lib/desktop";
import { DesktopAuthListener } from "./components/desktop/DesktopAuthListener";
import { DesktopUpdateBanner } from "./components/desktop/DesktopUpdateBanner";

const AuthenticatedAppLayout = lazy(() =>
  import("./app/AuthenticatedAppLayout").then((module) => ({ default: module.AuthenticatedAppLayout })),
);
const CanvasScreen = lazy(() =>
  import("./screens/CanvasScreen").then((module) => ({ default: module.CanvasScreen })),
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
const SharedNoteFolderPage = lazy(() =>
  import("./screens/SharedNoteFolderPage").then((module) => ({ default: module.SharedNoteFolderPage })),
);
const InsightsScreen = lazy(() =>
  import("./screens/InsightsScreen").then((module) => ({ default: module.InsightsScreen })),
);
const ReaderScreen = lazy(() =>
  import("./screens/reader/ReaderScreen").then((module) => ({ default: module.ReaderScreen })),
);
const NotFoundPage = lazy(() =>
  import("./screens/NotFoundPage").then((module) => ({ default: module.NotFoundPage })),
);

export function getAuthenticatedLayoutKind(pathname: string) {
  void pathname;
  return "app";
}

function RootRoute() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const location = useLocation();

  if (isLoading) return null;

  if (!isAuthenticated) {
    // The desktop app behaves like an app, not a website: no landing page,
    // just a first-run onboarding screen that hands sign-in to the browser.
    if (isTauri()) {
      return <DesktopOnboardingScreen />;
    }

    if (location.pathname.startsWith("/updates")) {
      return <PublicUpdatesLayout />;
    }

    return <LandingScreen />;
  }

  return <AuthenticatedAppLayout />;
}

function ReaderGuard({ children }: { children: React.ReactNode }) {
  const { settings, loading } = useUserSettings();
  if (loading) return null;
  if (!settings.rssReaderEnabled) return <Navigate to="/canvas" replace />;
  return <>{children}</>;
}

function PublicUpdatesLayout() {
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
        <Route path="/n/:shareCode" element={<SharedNoteFolderPage />} />
        <Route path="/" element={<RootRoute />}>
          <Route index element={<Navigate to="/canvas" replace />} />
          <Route path="canvas" element={<CanvasScreen />} />
          <Route path="todos" element={<TodosScreen />} />
          <Route path="search" element={<SearchScreen />} />
          <Route path="explore" element={<ExploreScreen />} />
          <Route path="notes" element={<NotesScreen />} />
          <Route path="bookmarks" element={<BookmarksScreen />} />
          <Route path="event" element={<EventScreen />} />
          <Route path="routine" element={<Navigate to="/event" replace />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="updates" element={<UpdatesScreen />} />
          <Route path="insights" element={<InsightsScreen />} />
          <Route path="reader" element={<ReaderGuard><ReaderScreen /></ReaderGuard>} />
          <Route path="reader/saved" element={<ReaderGuard><ReaderScreen savedView /></ReaderGuard>} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
