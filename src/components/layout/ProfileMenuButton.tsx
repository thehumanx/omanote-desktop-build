import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Compass,
  Download,
  ExternalLink,
  GripHorizontal,
  Info,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  Puzzle,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  Sun,
} from "lucide-react";
import { useApp } from "../../app/AppProvider";
import { useAuth } from "../../app/auth/AuthContext";
import { removeStorage, storageKeys } from "../../app/storage";
import { useUpdate } from "../../contexts/UpdateContext";
import { useTheme } from "../../contexts/ThemeContext";
import { maskEmail } from "../../lib/update-checker";
import { useDrawerDrag } from "../../lib/useDrawerDrag";
import { useMeasuredHighlight } from "../../hooks/useMeasuredHighlight";
import { useOutsideClick } from "../../lib/useOutsideClick";
import { isMobileViewport } from "../../lib/mobile";
import { getExtensionStoreUrl } from "../../lib/device-info";
import { isTauri } from "../../lib/desktop";
import { MenuItem, SegmentedHighlight, SegmentedItem, SegmentedShell } from "../ui";
import { FeedbackModal } from "../FeedbackModal";
import { ModalPortal } from "../ModalPortal";

const defaultAvatarSrc =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="20" fill="rgb(var(--color-line))"/>
      <circle cx="20" cy="15" r="6" fill="rgb(var(--color-ink-faint))"/>
      <path d="M8 32c2.8-5.2 7-7.8 12-7.8S29.2 26.8 32 32" fill="rgb(var(--color-ink-faint))"/>
    </svg>
  `);
const accountProfileUrl = "https://accounts.omanote.com/user";
const desktopAppReleaseUrl = "https://github.com/thehumanx/omanote-releases/releases/latest";

const THEME_OPTIONS = [
  { mode: "system" as const, label: "System", ariaLabel: "Use system theme", Icon: Monitor },
  { mode: "light" as const, label: "Light", ariaLabel: "Use light theme", Icon: Sun },
  { mode: "dark" as const, label: "Dark", ariaLabel: "Use dark theme", Icon: Moon },
];

function ThemeToggle({ themeMode, setThemeMode }: { themeMode: "system" | "light" | "dark"; setThemeMode: (mode: "system" | "light" | "dark") => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({ system: null, light: null, dark: null });
  const highlightStyle = useMeasuredHighlight({ activeKey: themeMode, containerRef, itemRefs });

  return (
    <SegmentedShell ref={containerRef} className="w-full p-1.5">
      {highlightStyle && <SegmentedHighlight style={highlightStyle} />}
      {THEME_OPTIONS.map(({ mode, label, ariaLabel, Icon }) => (
        <SegmentedItem
          key={mode}
          ref={(node) => { itemRefs.current[mode] = node; }}
          aria-label={ariaLabel}
          active={themeMode === mode}
          onClick={() => setThemeMode(mode)}
          className="relative z-10 flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium text-app-ink-faint transition-colors duration-150 md:py-1.5"
        >
          <Icon className="h-3.5 w-3.5 flex-shrink-0" />
          {label}
        </SegmentedItem>
      ))}
    </SegmentedShell>
  );
}

function ProfileOptionsDrawer({
  open,
  userName,
  userEmail,
  userImageUrl,
  onClose,
  children,
}: {
  open: boolean;
  userName: string;
  userEmail: string;
  userImageUrl: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { dragOffset, isDragging, dragHandleProps } = useDrawerDrag(onClose);
  const [isEntered, setIsEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsEntered(false);
      return;
    }

    let secondFrame: number | null = null;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setIsEntered(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div
        data-testid="profile-options-backdrop"
        aria-hidden="true"
        className="fixed inset-0 z-app-overlay bg-black/65 opacity-100 transition-opacity duration-app-drawer ease-app-drawer md:hidden"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      />
      <section
        role="dialog"
        aria-label="Profile options"
        className={[
          "fixed inset-x-0 bottom-0 z-app-drawer flex max-h-[92dvh] min-h-0 flex-col rounded-t-2xl bg-app-surface-raised shadow-drawer transform-gpu md:hidden",
          isDragging ? "" : "transition-transform duration-app-drawer ease-app-drawer",
          isEntered ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
        style={isDragging || dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
      >
        <div className="shrink-0 px-4 pt-3 pb-2" {...dragHandleProps} onClick={onClose}>
          <GripHorizontal className="mx-auto h-5 w-5 text-app-line-strong" />
        </div>
        <div
          data-testid="profile-options-header"
          className="shrink-0 border-b border-app-line px-5 py-4"
          onClick={onClose}
          {...dragHandleProps}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex flex-1 items-center gap-3">
              <img
                src={userImageUrl}
                alt={userName ? `${userName} profile` : "Profile avatar"}
                className="h-10 w-10 shrink-0 rounded-full border border-app-line object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="w-full truncate text-base font-bold text-app-ink">{userName}</p>
                <p className="mt-1 w-full truncate text-sm text-app-ink-faint">{userEmail}</p>
              </div>
            </div>
            <a
              href={accountProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-sm font-medium text-app-accent hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              Edit
            </a>
          </div>
        </div>
        <div className="space-y-1 px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">{children}</div>
      </section>
    </ModalPortal>
  );
}

/**
 * The one profile entry point for the whole app — an avatar trigger that
 * opens a dropdown on desktop or a bottom drawer on mobile, with the same
 * action list either way. Rendered once by AppShell inside the shared
 * header bar, so every route gets it "for free" instead of each screen (or
 * BottomNav) reimplementing its own copy.
 */
export function ProfileMenuButton({ onOpenAbout }: { onOpenAbout: () => void }) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { hasUpdate, openModal } = useUpdate();
  const { themeMode, setThemeMode } = useTheme();
  const runningInDesktopApp = isTauri();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);

  useOutsideClick(menuRef, menuOpen, () => setMenuOpen(false));

  const closeProfileOptions = () => {
    setMenuOpen(false);
    setProfileDrawerOpen(false);
    setLearnMoreOpen(false);
  };

  const handleProfileClick = () => {
    if (isMobileViewport()) {
      setMenuOpen(false);
      setProfileDrawerOpen((open) => !open);
      return;
    }
    setProfileDrawerOpen(false);
    setMenuOpen((open) => !open);
  };

  const renderThemeActions = () => (
    <div className="px-2 py-1">
      <ThemeToggle themeMode={themeMode} setThemeMode={setThemeMode} />
    </div>
  );

  const renderLearnMoreActions = () => (
    <>
      <MenuItem onClick={() => setLearnMoreOpen(false)}>
        <ChevronLeft className="h-4 w-4" />
        Learn more
      </MenuItem>
      <div className="my-2 h-px bg-app-line" />
      <MenuItem
        onClick={() => {
          navigate("/guide");
          closeProfileOptions();
        }}
      >
        <BookOpen className="h-4 w-4" />
        Guide
      </MenuItem>
      <MenuItem
        onClick={() => {
          onOpenAbout();
          closeProfileOptions();
        }}
      >
        <Info className="h-4 w-4" />
        About
      </MenuItem>
      <MenuItem
        onClick={() => {
          openModal();
          closeProfileOptions();
        }}
      >
        <Sparkles className="h-4 w-4" />
        What&apos;s new
        {hasUpdate && <span className="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-app-ink" />}
      </MenuItem>
      <div className="my-2 h-px bg-app-line" />
      <MenuItem
        onClick={() => {
          closeProfileOptions();
          window.open("/privacy", "_blank", "noopener,noreferrer");
        }}
      >
        <Shield className="h-4 w-4" />
        Privacy policy
        <ExternalLink className="ml-auto h-3.5 w-3.5 text-app-ink-faint" />
      </MenuItem>
      <MenuItem
        onClick={() => {
          closeProfileOptions();
          window.open("/terms", "_blank", "noopener,noreferrer");
        }}
      >
        <ScrollText className="h-4 w-4" />
        Terms of service
        <ExternalLink className="ml-auto h-3.5 w-3.5 text-app-ink-faint" />
      </MenuItem>
    </>
  );

  const renderProfileActions = ({
    includeExtension,
    includeDownloadApp,
  }: {
    includeExtension: boolean;
    includeDownloadApp: boolean;
  }) => {
    if (learnMoreOpen) return renderLearnMoreActions();

    return (
      <>
        <MenuItem
          onClick={() => {
            navigate("/explore");
            closeProfileOptions();
          }}
        >
          <Compass className="h-4 w-4" />
          Explore
        </MenuItem>
        <MenuItem
          onClick={() => {
            navigate("/settings");
            closeProfileOptions();
          }}
        >
          <Settings className="h-4 w-4" />
          Settings
        </MenuItem>
        <MenuItem onClick={() => setLearnMoreOpen(true)}>
          <Info className="h-4 w-4" />
          Learn more
          {hasUpdate && <span className="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-app-ink" />}
          <ChevronRight className="h-4 w-4 text-app-ink-faint" />
        </MenuItem>
        {includeExtension ? (
          <MenuItem
            onClick={() => {
              closeProfileOptions();
              window.open(getExtensionStoreUrl(), "_blank", "noopener,noreferrer");
            }}
          >
            <Puzzle className="h-4 w-4" />
            Download extension
            <ExternalLink className="ml-auto h-3.5 w-3.5 text-app-ink-faint" />
          </MenuItem>
        ) : null}
        {includeDownloadApp ? (
          <MenuItem
            onClick={() => {
              closeProfileOptions();
              window.open(desktopAppReleaseUrl, "_blank", "noopener,noreferrer");
            }}
          >
            <Download className="h-4 w-4" />
            Download app
            <ExternalLink className="ml-auto h-3.5 w-3.5 text-app-ink-faint" />
          </MenuItem>
        ) : null}
        <MenuItem
          onClick={() => {
            closeProfileOptions();
            setFeedbackModalOpen(true);
          }}
        >
          <MessageSquare className="h-4 w-4" />
          Share feedback
        </MenuItem>
        <div className="my-2 h-px bg-app-line" />
        {renderThemeActions()}
        <div className="my-2 h-px bg-app-line" />
        <MenuItem
          onClick={() => {
            removeStorage(storageKeys.uiState);
            signOut();
            window.location.assign("/");
            closeProfileOptions();
          }}
        >
          <LogOut className="h-4 w-4" />
          Log out
        </MenuItem>
      </>
    );
  };

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          data-testid="profile-trigger"
          className="relative flex h-10 w-10 overflow-hidden rounded-full border border-app-line bg-app-surface p-0 transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-app-surface-hover active:translate-y-px active:scale-[0.98]"
          onClick={handleProfileClick}
          aria-label="Profile menu"
        >
          <img
            src={user?.imageUrl ?? defaultAvatarSrc}
            alt={user?.name ? `${user.name} profile` : "Profile avatar"}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </button>
        {hasUpdate && (
          <span className="pointer-events-none absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-app-surface bg-app-ink" />
        )}
        {menuOpen ? (
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-app-line bg-app-surface-raised p-3 shadow-menu">
            <div className="px-1 py-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-bold text-app-ink">{user?.name ?? "Guest"}</p>
                  <p className="truncate text-xs text-app-ink-faint">{user?.email ? maskEmail(user.email) : ""}</p>
                </div>
                <a
                  href={accountProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-medium text-app-accent hover:underline"
                >
                  Edit
                </a>
              </div>
            </div>
            <div className="my-2 h-px bg-app-line" />
            {renderProfileActions({
              includeExtension: !runningInDesktopApp,
              includeDownloadApp: !runningInDesktopApp && !isMobileViewport(),
            })}
          </div>
        ) : null}
      </div>
      <ProfileOptionsDrawer
        open={profileDrawerOpen}
        userName={user?.name ?? "Guest"}
        userEmail={user?.email ? maskEmail(user.email) : ""}
        userImageUrl={user?.imageUrl ?? defaultAvatarSrc}
        onClose={closeProfileOptions}
      >
        {renderProfileActions({ includeExtension: false, includeDownloadApp: false })}
      </ProfileOptionsDrawer>
      {feedbackModalOpen && <FeedbackModal onClose={() => setFeedbackModalOpen(false)} />}
    </>
  );
}
