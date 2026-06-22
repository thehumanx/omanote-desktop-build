import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomNav } from "./BottomNav";

const {
  mockDispatch,
  mockSignOut,
  mockOpenModal,
  mockOpenAbout,
  mockUiState,
  mockUpdateSettings,
  mockSettings,
} = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockSignOut: vi.fn(),
  mockOpenModal: vi.fn(),
  mockOpenAbout: vi.fn(),
  mockUiState: {
    searchOpen: false,
    searchQuery: "",
    notesDrawerOpen: false,
  },
  mockUpdateSettings: vi.fn(),
  mockSettings: {
    saveShortcut: "mod_enter",
    newlineShortcut: "enter",
    showSaveShortcutHints: true,
    inAppReminderNotifications: true,
    browserReminderNotifications: true,
    reminderLeadMinutes: 0,
    defaultSnoozeMinutes: 10,
    reminderToastDurationSeconds: 30,
    themeMode: "system",
    navLabelStyle: "active-label",
  },
}));

vi.mock("../../app/AppProvider", () => ({
  useApp: () => ({
    state: {
      ui: mockUiState,
    },
    dispatch: mockDispatch,
  }),
}));

vi.mock("../../contexts/UpdateContext", () => ({
  useUpdate: () => ({
    hasUpdate: false,
    openModal: mockOpenModal,
  }),
}));

vi.mock("../../app/auth/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user_1",
      name: "Ava Example",
      email: "ava@example.com",
      imageUrl: null,
      provider: "clerk",
    },
    signOut: mockSignOut,
  }),
}));

vi.mock("../../contexts/UserSettingsContext", () => ({
  useUserSettings: () => ({
    settings: mockSettings,
    loading: false,
    updateSettings: mockUpdateSettings,
  }),
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({
    themeMode: mockSettings.themeMode,
    resolvedTheme: mockSettings.themeMode === "dark" ? "dark" : "light",
    setThemeMode: (themeMode: "system" | "light" | "dark") => mockUpdateSettings({ themeMode }),
  }),
}));

vi.mock("../ExtensionModal", () => ({
  ExtensionModal: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Extension modal">
      <button type="button" onClick={onClose}>
        Close extension modal
      </button>
    </div>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderBottomNav(initialPath = "/canvas", bottomNavProps: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <BottomNav {...bottomNavProps} />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function stubMobileViewport(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(max-width: 767px)" ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function stubDesktopShell(active: boolean) {
  if (active) {
    vi.stubGlobal("__TAURI_INTERNALS__", {});
  }
}

describe("BottomNav profile menu", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockDispatch.mockReset();
    mockOpenModal.mockReset();
    mockOpenAbout.mockReset();
    mockSignOut.mockReset();
    mockUpdateSettings.mockReset();
    mockUiState.searchOpen = false;
    mockUiState.searchQuery = "";
    mockUiState.notesDrawerOpen = false;
    mockSettings.themeMode = "system";
    mockSettings.navLabelStyle = "active-label";
  });

  it("opens profile options as a mobile drawer that covers the nav and closes from the backdrop", () => {
    stubMobileViewport(true);
    stubDesktopShell(false);

    renderBottomNav();
    fireEvent.click(screen.getByRole("button", { name: "Profile menu" }));

    expect(screen.getByRole("dialog", { name: "Profile options" })).toBeInTheDocument();
    expect(screen.getByTestId("profile-options-backdrop")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download extension" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Profile menu" }).closest("nav")).toHaveClass("pointer-events-none");

    fireEvent.click(screen.getByTestId("profile-options-backdrop"));

    expect(screen.queryByRole("dialog", { name: "Profile options" })).not.toBeInTheDocument();
  });

  it("closes the mobile profile drawer when the header is clicked", () => {
    stubMobileViewport(true);
    stubDesktopShell(false);

    renderBottomNav();
    fireEvent.click(screen.getByRole("button", { name: "Profile menu" }));
    fireEvent.click(screen.getByTestId("profile-options-header"));

    expect(screen.queryByRole("dialog", { name: "Profile options" })).not.toBeInTheDocument();
  });

  it("animates the mobile profile drawer up from the bottom", () => {
    stubMobileViewport(true);
    stubDesktopShell(false);
    const enterFrames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      enterFrames.push(callback);
      return enterFrames.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    renderBottomNav();
    fireEvent.click(screen.getByRole("button", { name: "Profile menu" }));

    const drawer = screen.getByRole("dialog", { name: "Profile options" });
    expect(drawer).toHaveClass("translate-y-full");

    act(() => {
      enterFrames.shift()?.(0);
    });

    expect(drawer).toHaveClass("translate-y-full");

    act(() => {
      enterFrames.shift()?.(16);
    });

    expect(drawer).toHaveClass("translate-y-0");
  });

  it("offers three theme options from the desktop profile menu", () => {
    stubMobileViewport(false);
    stubDesktopShell(false);

    renderBottomNav();
    fireEvent.click(screen.getByRole("button", { name: "Profile menu" }));

    expect(screen.getByRole("button", { name: "About" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download extension" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download app" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use system theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use light theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use dark theme" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Use dark theme" }));

    expect(mockUpdateSettings).toHaveBeenCalledWith({ themeMode: "dark" });
  });

  it("opens the founder note from the profile menu", () => {
    stubMobileViewport(false);
    stubDesktopShell(false);

    renderBottomNav("/canvas", { onOpenAbout: mockOpenAbout });
    fireEvent.click(screen.getByRole("button", { name: "Profile menu" }));
    fireEvent.click(screen.getByRole("button", { name: "About" }));

    expect(mockOpenAbout).toHaveBeenCalledTimes(1);
  });

  it("closes the desktop profile menu when clicking outside it", () => {
    stubMobileViewport(false);
    stubDesktopShell(false);

    renderBottomNav();
    fireEvent.click(screen.getByRole("button", { name: "Profile menu" }));

    expect(screen.getByRole("button", { name: "Download extension" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download app" })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole("button", { name: "Download extension" })).not.toBeInTheDocument();
  });

  it("opens the GitHub repo from the desktop web profile menu", () => {
    stubMobileViewport(false);
    stubDesktopShell(false);
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderBottomNav();
    fireEvent.click(screen.getByRole("button", { name: "Profile menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Download app" }));

    expect(openSpy).toHaveBeenCalledWith(
      "https://github.com/thehumanx/omanote-releases/releases/latest",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("hides download actions in the desktop shell", () => {
    stubMobileViewport(false);
    stubDesktopShell(true);

    renderBottomNav();
    fireEvent.click(screen.getByRole("button", { name: "Profile menu" }));

    expect(screen.queryByRole("button", { name: "Download extension" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download app" })).not.toBeInTheDocument();
  });

  it("keeps the bottom tab bar on the segmented pill style contract", () => {
    stubMobileViewport(false);
    stubDesktopShell(false);

    renderBottomNav();

    const canvasTab = screen.getByRole("link", { name: "Canvas" });
    const tabBar = canvasTab.parentElement;

    expect(tabBar).toHaveClass("omanote-segmented-shell");
    expect(canvasTab).toHaveClass("omanote-segmented-item");
    expect(canvasTab).toHaveClass("omanote-segmented-item-active");
  });

  it("uses animated segmented labels so active-label navigation resizes smoothly", () => {
    stubMobileViewport(false);
    stubDesktopShell(false);

    renderBottomNav("/event");

    expect(screen.getByText("Events")).toHaveClass("omanote-segmented-label-visible");
    expect(screen.getByText("Bookmarks")).toHaveClass("omanote-segmented-label");
    expect(screen.getByText("Bookmarks")).not.toHaveClass("omanote-segmented-label-visible");
  });

  it("keeps the theme toggle on the segmented pill style contract", () => {
    stubMobileViewport(false);
    stubDesktopShell(false);

    renderBottomNav();
    fireEvent.click(screen.getByRole("button", { name: "Profile menu" }));

    const systemThemeButton = screen.getByRole("button", { name: "Use system theme" });
    const themeToggle = systemThemeButton.parentElement;

    expect(themeToggle).toHaveClass("omanote-segmented-shell");
    expect(systemThemeButton).toHaveClass("omanote-segmented-item");
    expect(systemThemeButton).toHaveClass("omanote-segmented-item-active");
  });
});
