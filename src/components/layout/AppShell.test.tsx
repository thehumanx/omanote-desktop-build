import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

const mockDispatch = vi.fn();
const { mockBottomNav, mockFounderNoteModal, mockMobileKeyboardState, mockUpdateSettings } = vi.hoisted(() => ({
  mockBottomNav: vi.fn(() => null),
  mockFounderNoteModal: vi.fn(() => null),
  mockMobileKeyboardState: {
    isMobileViewport: false,
    keyboardOpen: false,
    focusedNavSearchInput: false,
    viewportHeight: 0,
  },
  mockUpdateSettings: vi.fn(),
}));

vi.mock("../../app/AppProvider", () => ({
  useApp: () => ({
    state: {
      ui: {
        searchOpen: false,
        notesDrawerOpen: false,
      },
    },
    dispatch: mockDispatch,
  }),
}));

vi.mock("./BottomNav", () => ({
  BottomNav: mockBottomNav,
}));

vi.mock("../FounderNoteModal", () => ({
  FounderNoteModal: mockFounderNoteModal,
}));

vi.mock("./useMobileKeyboardState", () => ({
  useMobileKeyboardState: () => mockMobileKeyboardState,
}));

vi.mock("../ReminderMonitor", () => ({
  ReminderMonitor: () => null,
}));

vi.mock("../FaviconBadgeSync", () => ({
  FaviconBadgeSync: () => null,
}));

vi.mock("../NotificationPermissionBanner", () => ({
  NotificationPermissionBanner: () => null,
}));

vi.mock("../UpdateNotificationBanner", () => ({
  UpdateNotificationBanner: () => null,
}));

vi.mock("../UpdateModal", () => ({
  UpdateModal: () => null,
}));

vi.mock("../OfflineStatusBanner", () => ({
  OfflineStatusBanner: () => null,
}));

vi.mock("../ToastHost", () => ({
  ToastHost: () => null,
}));

vi.mock("../ExploreOverlay", () => ({
  ExploreOverlay: () => null,
}));

vi.mock("../PushSubscriptionSync", () => ({
  PushSubscriptionSync: () => null,
}));

vi.mock("../../contexts/UserSettingsContext", () => ({
  useUserSettings: () => ({
    settings: {
      canvasDotGrid: true,
      founderNoteSeen: false,
    },
    loading: false,
    updateSettings: mockUpdateSettings,
  }),
}));

function CanvasPage() {
  return (
    <div data-testid="canvas-page">
      <Link to="/todos">Todos</Link>
    </div>
  );
}

function TodosPage() {
  return <div data-testid="todos-page">Todos page</div>;
}

function ExplorePage() {
  return <div data-testid="explore-page">Explore page</div>;
}

describe("AppShell", () => {
  beforeEach(() => {
    mockBottomNav.mockClear();
    mockFounderNoteModal.mockClear();
    mockMobileKeyboardState.isMobileViewport = false;
    mockMobileKeyboardState.keyboardOpen = false;
    mockMobileKeyboardState.focusedNavSearchInput = false;
    mockMobileKeyboardState.viewportHeight = 0;
    mockUpdateSettings.mockClear();
  });

  it("uses a fade-only page transition when switching primary routes", async () => {
    render(
      <MemoryRouter initialEntries={["/canvas"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/canvas" element={<CanvasPage />} />
            <Route path="/todos" element={<TodosPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Todos" }));

    const todosPage = await screen.findByTestId("todos-page");

    await waitFor(() => {
      const transitionShell = todosPage.parentElement;
      expect(transitionShell).toBeInstanceOf(HTMLElement);
      expect((transitionShell as HTMLElement).style.animation).toContain("omanote-page-fade");
      expect((transitionShell as HTMLElement).style.animation).not.toContain("slide");
    });

    const main = todosPage.closest("main");
    expect(main).toBeInstanceOf(HTMLElement);
    expect(main?.className).not.toContain("padding-top");
    expect(main?.className).not.toContain("height");
  });

  it("gives explore an explicit viewport-height canvas area", async () => {
    render(
      <MemoryRouter initialEntries={["/explore"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/explore" element={<ExplorePage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const explorePage = await screen.findByTestId("explore-page");
    const main = explorePage.closest("main");

    expect(main).toBeInstanceOf(HTMLElement);
    expect(main?.className).toContain("max-w-none");
    expect(main?.className).toContain("overflow-hidden");
    expect(main).toHaveStyle({
      height: "100dvh",
      paddingTop: "var(--omanote-top-chrome-height, 0px)",
      paddingBottom: "calc(var(--omanote-bottom-nav-height, 64px) + 1.5rem)",
    });
  });

  it("removes extra vertical page padding on settings", async () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/settings" element={<div data-testid="settings-page" />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const settingsPage = await screen.findByTestId("settings-page");
    const main = settingsPage.closest("main");

    expect(main).toBeInstanceOf(HTMLElement);
    expect(main?.className).toContain("pb-0");
    expect(main).toHaveStyle({
      height: "100dvh",
      paddingTop: "var(--omanote-top-chrome-height, 0px)",
      paddingBottom: "calc(var(--omanote-bottom-nav-height, 64px) + 1.5rem)",
    });
  });

  it("force hides the bottom nav whenever the mobile keyboard is open", async () => {
    mockMobileKeyboardState.isMobileViewport = true;
    mockMobileKeyboardState.keyboardOpen = true;
    mockMobileKeyboardState.focusedNavSearchInput = true;
    mockMobileKeyboardState.viewportHeight = 520;

    render(
      <MemoryRouter initialEntries={["/explore"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/explore" element={<ExplorePage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId("explore-page");

    expect(mockBottomNav).toHaveBeenLastCalledWith(
      expect.objectContaining({
        hidden: true,
        forceHidden: true,
      }),
      expect.anything(),
    );
  });

  it("opens the founder note automatically for users who have not seen it yet", async () => {
    render(
      <MemoryRouter initialEntries={["/canvas"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/canvas" element={<CanvasPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockFounderNoteModal).toHaveBeenLastCalledWith(
        expect.objectContaining({ open: true }),
        expect.anything(),
      );
    });
  });
});
