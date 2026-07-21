import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  GripHorizontal,
  X,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button, CheckboxField, cn, Input, OptionCard } from "../components/ui";
import { applyTypographySettings } from "../design-system/theme";
import { ModalPortal } from "../components/ModalPortal";
import { BaseModal } from "../components/BaseModal";
import { useTopChrome } from "../components/layout/useTopChrome";
import { useAuth } from "../app/auth/AuthContext";
import { storageKeys } from "../app/storage";
import { useUserSettings } from "../contexts/UserSettingsContext";
import { useTheme } from "../contexts/ThemeContext";
import { useEncryption } from "../contexts/EncryptionContext";
import { maskEmail } from "../lib/update-checker";
import { friendlyErrorMessage } from "../lib/errors";
import {
  DEFAULT_SNOOZE_MINUTES,
  REMINDER_LEAD_MINUTES,
  REMINDER_TOAST_DURATION_SECONDS,
  type FontFamily,
  type NavLabelStyle,
} from "../lib/user-settings";
import { isNotificationBannerDismissed, setNotificationBannerDismissed } from "../lib/notification-permission";
import {
  isTauri,
  getDesktopNotificationPermission,
  requestDesktopNotificationPermission,
  type DesktopNotificationPermission,
} from "../lib/desktop";
import {
  desktopNotificationsEnabled,
  setDesktopNotificationsEnabled,
} from "../lib/desktop-notifications";
import { subscribeToPush, unsubscribeFromPush, extractSubscriptionKeys } from "../lib/push-subscription";
import { validatePassphraseChange } from "../lib/passphrase-form";
import { detectWebClientType, getCurrentDeviceMetadata } from "../lib/device-info";
import { useDrawerDrag } from "../lib/useDrawerDrag";
import {
  CATEGORIES,
  NavLabelPreview,
  appearanceDraftsMatch,
  clientTypeLabel,
  formatDeviceDate,
  formatLeadMinutesLabel,
  formatToastDurationLabel,
  notificationDraftsMatch,
  type AppearanceDraft,
  type BrowserPermissionState,
  type CategoryId,
  type NotificationDraft,
} from "./settings-screen-helpers";

const SettingsDataPanels = lazy(() =>
  import("../app/SettingsDataPanels").then((module) => ({ default: module.SettingsDataPanels })),
);

const MOBILE_CATEGORY_SUMMARIES: Record<CategoryId, string> = {
  appearance: "Theme, navigation labels, and canvas look",
  features: "Enable or disable optional features",
  notifications: "In-app alerts, browser reminders, and snooze defaults",
  security: "Passphrase controls and app lock behavior",
  devices: "Signed-in sessions and device access",
  data: "Import, export, and backup tools",
  account: "Profile details and account deletion",
};

export function SettingsScreen() {
  const { user, deleteAccount, signOut } = useAuth();
  const { settings, loading, updateSettings } = useUserSettings();
  const { themeMode, setThemeMode } = useTheme();
  const { changePassphrase, exportRecoveryKeyText, lock } = useEncryption();
  const deleteMyData = useMutation(api.account.deleteMyData);
  const removeDevice = useMutation(api.devices.removeDevice);
  const upsertPushSubscription = useMutation(api.pushSubscriptions.upsertPushSubscription);
  const removePushSubscription = useMutation(api.pushSubscriptions.removePushSubscription);
  const devices = useQuery(api.devices.listMyDevices, { limit: 20 });
  const currentDevice = useMemo(() => getCurrentDeviceMetadata(detectWebClientType()), []);
  const googleConnection = useQuery(api.googleAuth.getConnectionStatus, {});
  const startGoogleConnect = useAction(api.googleAuth.startConnect);
  const disconnectGoogle = useAction(api.googleAuth.disconnect);
  const setGoogleSyncEnabled = useMutation(api.googleAuth.setSyncEnabled);
  const [googleActionPending, setGoogleActionPending] = useState(false);
  const [googleActionError, setGoogleActionError] = useState<string | null>(null);

  async function handleConnectGoogle() {
    setGoogleActionError(null);
    setGoogleActionPending(true);
    try {
      const { url } = await startGoogleConnect({});
      window.location.href = url;
    } catch (err) {
      setGoogleActionError(friendlyErrorMessage(err, "Could not connect to Google."));
      setGoogleActionPending(false);
    }
  }

  async function handleDisconnectGoogle() {
    setGoogleActionError(null);
    setGoogleActionPending(true);
    try {
      await disconnectGoogle({});
    } catch (err) {
      setGoogleActionError(friendlyErrorMessage(err, "Could not disconnect Google."));
    } finally {
      setGoogleActionPending(false);
    }
  }

  async function handleToggleGoogleSync(enabled: boolean) {
    setGoogleActionError(null);
    try {
      await setGoogleSyncEnabled({ enabled });
    } catch (err) {
      setGoogleActionError(friendlyErrorMessage(err, "Could not update sync setting."));
    }
  }

  const [selectedCategory, setSelectedCategory] = useState<CategoryId>("appearance");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { dragOffset, isDragging, dragHandleProps } = useDrawerDrag(() => setMobileOpen(false));

  const appearanceSettingsDraft = useMemo<AppearanceDraft>(
    () => ({
      themeMode,
      navLabelStyle: settings.navLabelStyle,
      fontFamily: settings.fontFamily,
      canvasDotGrid: settings.canvasDotGrid,
    }),
    [settings.navLabelStyle, settings.fontFamily, settings.canvasDotGrid, themeMode],
  );
  const notificationSettingsDraft = useMemo<NotificationDraft>(
    () => ({
      inAppReminderNotifications: settings.inAppReminderNotifications,
      browserReminderNotifications: settings.browserReminderNotifications,
      reminderLeadMinutes: settings.reminderLeadMinutes,
      defaultSnoozeMinutes: settings.defaultSnoozeMinutes,
      reminderToastDurationSeconds: settings.reminderToastDurationSeconds,
    }),
    [
      settings.browserReminderNotifications,
      settings.defaultSnoozeMinutes,
      settings.inAppReminderNotifications,
      settings.reminderLeadMinutes,
      settings.reminderToastDurationSeconds,
    ],
  );

  const [appearanceDraft, setAppearanceDraft] = useState<AppearanceDraft>(appearanceSettingsDraft);
  const [syncedAppearanceDraft, setSyncedAppearanceDraft] = useState<AppearanceDraft>(appearanceSettingsDraft);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [waitingForAppearanceContextSync, setWaitingForAppearanceContextSync] = useState(false);
  const [appearanceSaveTimeContextDraft, setAppearanceSaveTimeContextDraft] = useState<AppearanceDraft | null>(null);
  const [appearanceSaveError, setAppearanceSaveError] = useState<string | null>(null);

  const [notificationDraft, setNotificationDraft] = useState<NotificationDraft>(notificationSettingsDraft);
  const [syncedNotificationDraft, setSyncedNotificationDraft] = useState<NotificationDraft>(notificationSettingsDraft);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [waitingForNotificationContextSync, setWaitingForNotificationContextSync] = useState(false);
  const [notificationSaveTimeContextDraft, setNotificationSaveTimeContextDraft] = useState<NotificationDraft | null>(null);
  const [notificationSaveError, setNotificationSaveError] = useState<string | null>(null);
  const [browserPermission, setBrowserPermission] = useState<BrowserPermissionState>(() => {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  });
  const [bannerDismissed, setBannerDismissed] = useState(() => isNotificationBannerDismissed());

  // Desktop app: its own local notification toggle + OS-level permission,
  // independent of the synced browser-notification setting above.
  const inDesktop = isTauri();
  const [desktopNotifyEnabled, setDesktopNotifyEnabled] = useState(() => desktopNotificationsEnabled());
  const [desktopPermission, setDesktopPermission] = useState<DesktopNotificationPermission | null>(null);
  useEffect(() => {
    if (!inDesktop) return;
    void getDesktopNotificationPermission().then(setDesktopPermission);
  }, [inDesktop]);

  const [currentPassphrase, setCurrentPassphrase] = useState("");
  const [nextPassphrase, setNextPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [changingPassphrase, setChangingPassphrase] = useState(false);
  const [passphraseError, setPassphraseError] = useState<string | null>(null);
  const [passphraseSuccess, setPassphraseSuccess] = useState<string | null>(null);
  const [exportingRecovery, setExportingRecovery] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);

  const [removingDeviceId, setRemovingDeviceId] = useState<string | null>(null);

  type ConfirmDialogOptions = {
    title: string;
    message: string;
    confirmLabel: string;
    variant: "danger" | "default";
    onConfirm: () => Promise<void>;
  };
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  function openConfirm(opts: ConfirmDialogOptions) {
    setConfirmDialog(opts);
  }

  function closeConfirm() {
    if (!confirmLoading) setConfirmDialog(null);
  }

  async function handleConfirmOk() {
    if (!confirmDialog) return;
    setConfirmLoading(true);
    try {
      await confirmDialog.onConfirm();
    } finally {
      setConfirmLoading(false);
      setConfirmDialog(null);
    }
  }

  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const hasPendingAppearanceChanges = !appearanceDraftsMatch(appearanceDraft, syncedAppearanceDraft);
  const appearanceContextMatchesSyncedDraft = appearanceDraftsMatch(appearanceSettingsDraft, syncedAppearanceDraft);
  const appearanceContextMovedSinceSave =
    appearanceSaveTimeContextDraft !== null && !appearanceDraftsMatch(appearanceSettingsDraft, appearanceSaveTimeContextDraft);

  const hasPendingNotificationChanges = !notificationDraftsMatch(notificationDraft, syncedNotificationDraft);
  const notificationContextMatchesSyncedDraft = notificationDraftsMatch(notificationSettingsDraft, syncedNotificationDraft);
  const notificationContextMovedSinceSave =
    notificationSaveTimeContextDraft !== null &&
    !notificationDraftsMatch(notificationSettingsDraft, notificationSaveTimeContextDraft);

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setBrowserPermission("unsupported");
      return;
    }
    setBrowserPermission(Notification.permission);
    setBannerDismissed(isNotificationBannerDismissed());
  }, []);

  useEffect(() => {
    if (waitingForAppearanceContextSync) {
      if (appearanceContextMatchesSyncedDraft) {
        setWaitingForAppearanceContextSync(false);
        setAppearanceSaveTimeContextDraft(null);
      } else if (appearanceContextMovedSinceSave) {
        setAppearanceDraft(appearanceSettingsDraft);
        setSyncedAppearanceDraft(appearanceSettingsDraft);
        setWaitingForAppearanceContextSync(false);
        setAppearanceSaveTimeContextDraft(null);
      }
      return;
    }
    if (hasPendingAppearanceChanges) return;
    setAppearanceDraft(appearanceSettingsDraft);
    setSyncedAppearanceDraft(appearanceSettingsDraft);
    setAppearanceSaveError(null);
    setAppearanceSaveTimeContextDraft(null);
  }, [
    appearanceContextMatchesSyncedDraft,
    appearanceContextMovedSinceSave,
    appearanceSettingsDraft,
    hasPendingAppearanceChanges,
    waitingForAppearanceContextSync,
  ]);

  useEffect(() => {
    if (waitingForNotificationContextSync) {
      if (notificationContextMatchesSyncedDraft) {
        setWaitingForNotificationContextSync(false);
        setNotificationSaveTimeContextDraft(null);
      } else if (notificationContextMovedSinceSave) {
        setNotificationDraft(notificationSettingsDraft);
        setSyncedNotificationDraft(notificationSettingsDraft);
        setWaitingForNotificationContextSync(false);
        setNotificationSaveTimeContextDraft(null);
      }
      return;
    }
    if (hasPendingNotificationChanges) return;
    setNotificationDraft(notificationSettingsDraft);
    setSyncedNotificationDraft(notificationSettingsDraft);
    setNotificationSaveError(null);
    setNotificationSaveTimeContextDraft(null);
  }, [
    hasPendingNotificationChanges,
    notificationContextMatchesSyncedDraft,
    notificationContextMovedSinceSave,
    notificationSettingsDraft,
    waitingForNotificationContextSync,
  ]);

  useEffect(() => {
    applyTypographySettings(appearanceDraft.fontFamily);
  }, [appearanceDraft.fontFamily]);

  const disableAppearanceSave = loading || savingAppearance || !hasPendingAppearanceChanges;
  const disableNotificationSave = loading || savingNotifications || !hasPendingNotificationChanges;
  const canChangePassphrase = currentPassphrase.length > 0 && nextPassphrase.length > 0 && confirmPassphrase.length > 0;
  const canDeleteAccount = deleteConfirmation.trim() === "DELETE";

  const topChrome = useMemo(
    () => (
      <div className="flex h-full w-full items-center">
        <h1 className="truncate text-lg font-bold text-app-ink">Settings</h1>
      </div>
    ),
    [],
  );
  useTopChrome(topChrome);

  function cancelWaitingNotificationContextSync() {
    setWaitingForNotificationContextSync(false);
    setNotificationSaveTimeContextDraft(null);
  }

  function cancelWaitingAppearanceContextSync() {
    setWaitingForAppearanceContextSync(false);
    setAppearanceSaveTimeContextDraft(null);
  }

  function resetAppearanceChanges() {
    cancelWaitingAppearanceContextSync();
    setAppearanceDraft(appearanceSettingsDraft);
    setSyncedAppearanceDraft(appearanceSettingsDraft);
    setAppearanceSaveError(null);
  }

  function resetNotificationChanges() {
    cancelWaitingNotificationContextSync();
    setNotificationDraft(notificationSettingsDraft);
    setSyncedNotificationDraft(notificationSettingsDraft);
    setNotificationSaveError(null);
  }

  async function handleSaveAppearancePreferences() {
    if (disableAppearanceSave) return;
    setSavingAppearance(true);
    setAppearanceSaveError(null);
    const nextDraft = appearanceDraft;
    const currentContextDraft = appearanceSettingsDraft;
    try {
      if (nextDraft.themeMode !== themeMode) {
        await setThemeMode(nextDraft.themeMode);
      }
      const appearancePatch: { navLabelStyle?: NavLabelStyle; fontFamily?: FontFamily; canvasDotGrid?: boolean } = {};
      if (nextDraft.navLabelStyle !== settings.navLabelStyle) {
        appearancePatch.navLabelStyle = nextDraft.navLabelStyle;
      }
      if (nextDraft.fontFamily !== settings.fontFamily) {
        appearancePatch.fontFamily = nextDraft.fontFamily;
      }
      if (nextDraft.canvasDotGrid !== settings.canvasDotGrid) {
        appearancePatch.canvasDotGrid = nextDraft.canvasDotGrid;
      }
      if (Object.keys(appearancePatch).length > 0) {
        await updateSettings(appearancePatch);
      }
      setSyncedAppearanceDraft(nextDraft);
      setAppearanceSaveTimeContextDraft(currentContextDraft);
      setWaitingForAppearanceContextSync(true);
    } catch {
      setAppearanceSaveError("We couldn't save your appearance settings. Please try again.");
    } finally {
      setSavingAppearance(false);
    }
  }

  async function handleSaveNotificationPreferences() {
    if (disableNotificationSave) return;
    setSavingNotifications(true);
    setNotificationSaveError(null);
    const nextDraft = notificationDraft;
    const prevDraft = syncedNotificationDraft;
    const currentContextDraft = notificationSettingsDraft;
    try {
      await updateSettings(nextDraft);
      setSyncedNotificationDraft(nextDraft);
      setNotificationSaveTimeContextDraft(currentContextDraft);
      setWaitingForNotificationContextSync(true);
      if (nextDraft.browserReminderNotifications) {
        setNotificationBannerDismissed(false);
        setBannerDismissed(false);
      }
      if (typeof Notification !== "undefined") {
        setBrowserPermission(Notification.permission);
      }

      const permissionGranted =
        typeof Notification !== "undefined" && Notification.permission === "granted";

      if (nextDraft.browserReminderNotifications && permissionGranted) {
        try {
          const sub = await subscribeToPush();
          if (sub) {
            const { p256dh, auth } = extractSubscriptionKeys(sub);
            await upsertPushSubscription({ endpoint: sub.endpoint, p256dh, auth });
          }
        } catch {
          // Push subscription is best-effort; don't block settings save
        }
      } else if (!nextDraft.browserReminderNotifications && prevDraft.browserReminderNotifications) {
        try {
          const endpoint = await unsubscribeFromPush();
          if (endpoint) await removePushSubscription({ endpoint });
        } catch {
          // Unsubscribe is best-effort
        }
      }
    } catch {
      setNotificationSaveError("We couldn't save your notification settings. Please try again.");
    } finally {
      setSavingNotifications(false);
    }
  }

  async function handleRequestBrowserPermission() {
    if (typeof Notification === "undefined") return;
    try {
      const result = await Notification.requestPermission();
      setBrowserPermission(result);
      if (result === "granted") {
        setNotificationBannerDismissed(false);
        setBannerDismissed(false);
        try {
          const sub = await subscribeToPush();
          if (sub) {
            const { p256dh, auth } = extractSubscriptionKeys(sub);
            await upsertPushSubscription({ endpoint: sub.endpoint, p256dh, auth });
          }
        } catch {
          // Push subscription is best-effort
        }
      }
    } catch {
      // Some browsers do not support promise-based requestPermission.
    }
  }

  function handleResetBrowserPrompt() {
    setNotificationBannerDismissed(false);
    setBannerDismissed(false);
    if (typeof Notification !== "undefined") {
      setBrowserPermission(Notification.permission);
    }
  }

  async function handleChangePassphrase() {
    const validation = validatePassphraseChange({
      current: currentPassphrase,
      next: nextPassphrase,
      confirm: confirmPassphrase,
    });
    if (!validation.ok) {
      setPassphraseError(validation.message);
      setPassphraseSuccess(null);
      return;
    }
    setChangingPassphrase(true);
    setPassphraseError(null);
    setPassphraseSuccess(null);
    try {
      await changePassphrase(currentPassphrase, nextPassphrase);
      setCurrentPassphrase("");
      setNextPassphrase("");
      setConfirmPassphrase("");
      setPassphraseSuccess("Passphrase updated successfully.");
    } catch (error) {
      setPassphraseError(friendlyErrorMessage(error, "Could not change passphrase."));
    } finally {
      setChangingPassphrase(false);
    }
  }

  async function handleExportRecoveryKey() {
    if (exportingRecovery) return;
    setExportingRecovery(true);
    setRecoveryError(null);
    setRecoverySuccess(null);
    try {
      await exportRecoveryKeyText();
      setRecoverySuccess("Recovery key downloaded. Older keys are no longer valid.");
    } catch (error) {
      setRecoveryError(friendlyErrorMessage(error, "Could not export recovery key."));
    } finally {
      setExportingRecovery(false);
    }
  }

  function handleRemoveDevice(id: Id<"userDevices">, isCurrentDevice: boolean) {
    openConfirm({
      title: "Remove device",
      message: isCurrentDevice
        ? "You'll be signed out of this device and will need to re-enter your passphrase to continue."
        : "This device will be signed out on its next activity.",
      confirmLabel: "Remove",
      variant: "danger",
      onConfirm: async () => {
        setRemovingDeviceId(String(id));
        try {
          await removeDevice({ id });
          if (isCurrentDevice) {
            lock();
            signOut();
            window.localStorage.removeItem(storageKeys.uiState);
          }
        } finally {
          setRemovingDeviceId(null);
        }
      },
    });
  }

  async function handleDeleteAccount() {
    if (deletingAccount || !canDeleteAccount) return;
    openConfirm({
      title: "Delete account",
      message: "This permanently deletes your omanote data and your account. This cannot be undone.",
      confirmLabel: "Delete account",
      variant: "danger",
      onConfirm: async () => {
        setDeletingAccount(true);
        setDeleteError(null);
        try {
          await deleteMyData({});
          await deleteAccount();
          window.localStorage.removeItem(storageKeys.uiState);
          window.location.assign("/");
        } catch (error) {
          setDeleteError(friendlyErrorMessage(error, "Could not delete your account."));
        } finally {
          setDeletingAccount(false);
        }
      },
    });
  }

  function renderContent() {
    switch (selectedCategory) {
      case "features":
        return (
          <section className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-app-ink">Features</h2>
              <p className="mt-1 text-sm leading-6 text-app-ink-muted">
                Turn optional features on or off. Disabled features are hidden from the interface.
              </p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-app-line bg-app-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-app-ink">Google Calendar</p>
                    <p className="mt-0.5 text-[13px] leading-5 text-app-ink-faint">
                      {googleConnection === undefined
                        ? "Checking connection…"
                        : googleConnection.connected
                          ? googleConnection.status === "needs_reconnect"
                            ? "Google access was revoked or expired — reconnect to resume syncing."
                            : `Connected as ${maskEmail(googleConnection.googleEmail ?? "")}. Todos and events push to a dedicated "omanote" Google Calendar, including recurring todos. Events you create on your primary Google Calendar sync back as todos.`
                          : "Push todos and events to a dedicated Google Calendar, and sync events from your primary calendar back as todos."}
                    </p>
                    {googleActionError && (
                      <p className="mt-1 text-[13px] leading-5 text-danger-ink">{googleActionError}</p>
                    )}
                  </div>
                  {googleConnection?.connected ? (
                    googleConnection.status === "needs_reconnect" ? (
                      <Button tone="default" disabled={googleActionPending} onClick={() => void handleConnectGoogle()}>
                        Reconnect
                      </Button>
                    ) : (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={googleConnection.syncEnabled}
                        aria-label="Toggle Google sync"
                        onClick={() => void handleToggleGoogleSync(!googleConnection.syncEnabled)}
                        className={cn(
                          "mt-0.5 flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:ring-offset-2",
                          googleConnection.syncEnabled ? "bg-app-ink" : "bg-app-line-strong",
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
                            googleConnection.syncEnabled ? "translate-x-5" : "translate-x-0",
                          )}
                        />
                      </button>
                    )
                  ) : (
                    <Button disabled={googleActionPending} onClick={() => void handleConnectGoogle()}>
                      Connect
                    </Button>
                  )}
                </div>
                {googleConnection?.connected && (
                  <div className="mt-3 flex items-center justify-between border-t border-app-line pt-3">
                    <p className="text-[13px] leading-5 text-app-ink-faint">
                      Disconnecting removes omanote's access to your Google account and stops all syncing.
                    </p>
                    <Button
                      tone="dangerGhost"
                      disabled={googleActionPending}
                      onClick={() => void handleDisconnectGoogle()}
                    >
                      Disconnect
                    </Button>
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-app-line bg-app-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-app-ink">RSS reader</p>
                    <p className="mt-0.5 text-[13px] leading-5 text-app-ink-faint">
                      Subscribe to RSS feeds and read articles without leaving omanote. Adds a Read/Write toggle to the top bar.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.rssReaderEnabled}
                    onClick={() => void updateSettings({ rssReaderEnabled: !settings.rssReaderEnabled }).catch(() => {})}
                    className={cn(
                      "mt-0.5 flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:ring-offset-2",
                      settings.rssReaderEnabled ? "bg-app-ink" : "bg-app-line-strong",
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
                        settings.rssReaderEnabled ? "translate-x-5" : "translate-x-0",
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          </section>
        );
      case "appearance":
        return (
          <section className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-app-ink">Look & feel</h2>
              <p className="mt-1 text-sm leading-6 text-app-ink-muted">
                Customize how omanote looks and behaves on this account.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-app-ink">Theme</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { mode: "system" as const, label: "System" },
                  { mode: "light" as const, label: "Light" },
                  { mode: "dark" as const, label: "Dark" },
                ].map((option) => {
                  const selected = appearanceDraft.themeMode === option.mode;
                  return (
                    <OptionCard
                      key={option.mode}
                      current={appearanceSettingsDraft.themeMode === option.mode}
                      selected={selected}
                      onClick={() => {
                        cancelWaitingAppearanceContextSync();
                        setAppearanceSaveError(null);
                        setAppearanceDraft((cur) => ({ ...cur, themeMode: option.mode }));
                      }}
                    >
                      {option.label}
                    </OptionCard>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-bold text-app-ink">Typography</p>
                <p className="mt-0.5 text-xs text-app-ink-faint">Choose the font style used across the app.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "sans" as FontFamily, label: "Sans", sub: "Lato", fontFamily: '"Lato", ui-sans-serif, system-ui, sans-serif' },
                  { value: "serif" as FontFamily, label: "Serif", sub: "Aleo", fontFamily: '"Aleo", Georgia, ui-serif, serif' },
                ] as const).map((option) => {
                  const selected = appearanceDraft.fontFamily === option.value;
                  const current = appearanceSettingsDraft.fontFamily === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        cancelWaitingAppearanceContextSync();
                        setAppearanceSaveError(null);
                        setAppearanceDraft((cur) => ({ ...cur, fontFamily: option.value }));
                      }}
                      className={cn(
                        "relative flex flex-col items-start gap-1.5 rounded-app-panel border px-4 py-3.5 text-left transition-[background-color,border-color] duration-app-fast",
                        selected
                          ? "border-app-line-strong bg-app-surface-muted"
                          : "border-app-line bg-app-surface hover:bg-app-surface-hover",
                      )}
                    >
                      {current && !selected && (
                        <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-app-ink-faint" aria-hidden="true" />
                      )}
                      <span
                        className={cn("text-2xl leading-none", selected ? "text-app-ink" : "text-app-ink-muted")}
                        style={{ fontFamily: option.fontFamily }}
                        aria-hidden="true"
                      >
                        Aa
                      </span>
                      <span className={cn("text-sm font-bold", selected ? "text-app-ink" : "text-app-ink-muted")}>
                        {option.label}
                      </span>
                      <span className="text-xs text-app-ink-faint">{option.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-app-ink">Navigation labels</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {([
                  { value: "active-label" as NavLabelStyle, label: "Active label" },
                  { value: "icon-label" as NavLabelStyle, label: "Icon & label" },
                  { value: "label-only" as NavLabelStyle, label: "Label only" },
                ]).map((option) => {
                  const selected = appearanceDraft.navLabelStyle === option.value;
                  return (
                    <OptionCard
                      key={option.value}
                      current={appearanceSettingsDraft.navLabelStyle === option.value}
                      selected={selected}
                      onClick={() => {
                        cancelWaitingAppearanceContextSync();
                        setAppearanceSaveError(null);
                        setAppearanceDraft((cur) => ({ ...cur, navLabelStyle: option.value }));
                      }}
                    >
                      {option.label}
                    </OptionCard>
                  );
                })}
              </div>
              <NavLabelPreview style={appearanceDraft.navLabelStyle} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-app-ink">Canvas</p>
              <CheckboxField
                checked={appearanceDraft.canvasDotGrid}
                onCheckedChange={(checked) => {
                  cancelWaitingAppearanceContextSync();
                  setAppearanceSaveError(null);
                  setAppearanceDraft((cur) => ({ ...cur, canvasDotGrid: checked }));
                }}
              >
                Show dot grid background on canvas
              </CheckboxField>
            </div>

            {appearanceSaveError && (
              <p role="alert" className="mt-4 rounded-md border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger-ink">
                {appearanceSaveError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              {hasPendingAppearanceChanges ? (
                <Button type="button" tone="ghost" onClick={resetAppearanceChanges} disabled={loading || savingAppearance}>
                  Reset changes
                </Button>
              ) : null}
              <Button type="button" onClick={() => void handleSaveAppearancePreferences()} disabled={disableAppearanceSave}>
                {savingAppearance ? "Saving..." : "Save appearance preferences"}
              </Button>
            </div>
          </section>
        );
      case "notifications":
        return (
          <div>
            <h2 className="text-lg font-bold text-app-ink">Notifications</h2>
            <p className="mt-1 text-sm leading-relaxed text-app-ink-faint">
              Control reminder channels, lead time, and snooze behavior across all todos.
            </p>

            <div className="mt-6 space-y-4">
              <CheckboxField
                checked={notificationDraft.inAppReminderNotifications}
                onCheckedChange={(checked) => {
                  cancelWaitingNotificationContextSync();
                  setNotificationSaveError(null);
                  setNotificationDraft((cur) => ({ ...cur, inAppReminderNotifications: checked }));
                }}
              >
                Show reminder toasts inside omanote
              </CheckboxField>

              {inDesktop ? (
                <>
                  <CheckboxField
                    checked={desktopNotifyEnabled}
                    onCheckedChange={(checked) => {
                      setDesktopNotifyEnabled(checked);
                      setDesktopNotificationsEnabled(checked);
                    }}
                  >
                    Show system notifications from the desktop app
                  </CheckboxField>

                  <div className="rounded-md border border-app-line bg-app-surface-muted p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-app-ink-muted">
                        System permission:{" "}
                        <span className={cn(
                          "font-bold",
                          desktopPermission === "granted" ? "text-success-ink" :
                          desktopPermission === "denied" ? "text-danger-ink" :
                          "text-app-ink"
                        )}>
                          {desktopPermission ?? "checking…"}
                        </span>
                      </span>
                      {desktopPermission === "default" && (
                        <button
                          type="button"
                          onClick={() => void requestDesktopNotificationPermission().then(setDesktopPermission)}
                          className="text-xs font-medium text-app-ink underline underline-offset-2 hover:text-app-ink-muted transition"
                        >
                          Grant permission
                        </button>
                      )}
                    </div>
                    {desktopPermission === "denied" && (
                      <p className="text-xs text-danger-ink">
                        Notifications are blocked. Allow omanote in your system's notification settings, then restart the app.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
              <CheckboxField
                checked={notificationDraft.browserReminderNotifications}
                onCheckedChange={(checked) => {
                  cancelWaitingNotificationContextSync();
                  setNotificationSaveError(null);
                  setNotificationDraft((cur) => ({ ...cur, browserReminderNotifications: checked }));
                }}
              >
                Allow browser/system reminders when the tab is in background
              </CheckboxField>

              <div className="rounded-md border border-app-line bg-app-surface-muted p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-app-ink-muted">
                    Browser permission:{" "}
                    <span className={cn(
                      "font-bold",
                      browserPermission === "granted" ? "text-success-ink" :
                      browserPermission === "denied" ? "text-danger-ink" :
                      "text-app-ink"
                    )}>
                      {browserPermission === "unsupported" ? "Not supported" : browserPermission}
                    </span>
                  </span>
                  {browserPermission === "default" && (
                    <button
                      type="button"
                      onClick={() => void handleRequestBrowserPermission()}
                      className="text-xs font-medium text-app-ink underline underline-offset-2 hover:text-app-ink-muted transition"
                    >
                      Grant permission
                    </button>
                  )}
                  {browserPermission === "granted" && (
                    <button
                      type="button"
                      onClick={handleResetBrowserPrompt}
                      className="text-xs font-medium text-app-ink-faint underline underline-offset-2 hover:text-app-ink transition"
                    >
                      Reset prompt
                    </button>
                  )}
                </div>
                {browserPermission === "denied" && (
                  <p className="text-xs text-danger-ink">
                    Notifications are blocked. To re-enable, open your browser's site settings and allow notifications for this site, then reload.
                  </p>
                )}
              </div>
                </>
              )}

              <div>
                <span className="text-sm font-bold text-app-ink">Reminder timing</span>
                <div role="group" aria-label="Reminder timing" className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {REMINDER_LEAD_MINUTES.map((m) => {
                    const selected = notificationDraft.reminderLeadMinutes === m;
                    return (
                      <OptionCard
                        key={m}
                        current={notificationSettingsDraft.reminderLeadMinutes === m}
                        selected={selected}
                        onClick={() => {
                          cancelWaitingNotificationContextSync();
                          setNotificationSaveError(null);
                          setNotificationDraft((cur) => ({ ...cur, reminderLeadMinutes: m }));
                        }}
                      >
                        {formatLeadMinutesLabel(m)}
                      </OptionCard>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-sm font-bold text-app-ink">Default snooze</span>
                <div role="group" aria-label="Default snooze" className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {DEFAULT_SNOOZE_MINUTES.map((m) => {
                    const selected = notificationDraft.defaultSnoozeMinutes === m;
                    return (
                      <OptionCard
                        key={m}
                        current={notificationSettingsDraft.defaultSnoozeMinutes === m}
                        selected={selected}
                        onClick={() => {
                          cancelWaitingNotificationContextSync();
                          setNotificationSaveError(null);
                          setNotificationDraft((cur) => ({ ...cur, defaultSnoozeMinutes: m }));
                        }}
                      >
                        {m} minutes
                      </OptionCard>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-sm font-bold text-app-ink">Reminder toast duration</span>
                <div role="group" aria-label="Reminder toast duration" className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {REMINDER_TOAST_DURATION_SECONDS.map((s) => {
                    const selected = notificationDraft.reminderToastDurationSeconds === s;
                    return (
                      <OptionCard
                        key={s}
                        current={notificationSettingsDraft.reminderToastDurationSeconds === s}
                        selected={selected}
                        onClick={() => {
                          cancelWaitingNotificationContextSync();
                          setNotificationSaveError(null);
                          setNotificationDraft((cur) => ({ ...cur, reminderToastDurationSeconds: s }));
                        }}
                      >
                        {formatToastDurationLabel(s)}
                      </OptionCard>
                    );
                  })}
                </div>
              </div>
            </div>

            {notificationSaveError && (
              <p role="alert" className="mt-4 rounded-md border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger-ink">
                {notificationSaveError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              {hasPendingNotificationChanges ? (
                <Button type="button" tone="ghost" onClick={resetNotificationChanges} disabled={loading || savingNotifications}>
                  Reset changes
                </Button>
              ) : null}
              <Button type="button" onClick={() => void handleSaveNotificationPreferences()} disabled={disableNotificationSave}>
                {savingNotifications ? "Saving..." : "Save notification preferences"}
              </Button>
            </div>
          </div>
        );

      case "security":
        return (
          <div>
            <h2 className="text-lg font-bold text-app-ink">Security</h2>
            <p className="mt-1 text-sm leading-relaxed text-app-ink-faint">
              Rotate your passphrase and manage recovery access for encrypted content.
            </p>

            <div className="mt-6 space-y-3">
              <label className="block">
                <span className="text-sm font-bold text-app-ink">Current passphrase</span>
                <Input
                  type="password"
                  autoComplete="current-password"
                  aria-label="Current passphrase"
                  className="mt-2"
                  value={currentPassphrase}
                  onChange={(e) => setCurrentPassphrase(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-app-ink">New passphrase</span>
                <Input
                  type="password"
                  autoComplete="new-password"
                  aria-label="New passphrase"
                  className="mt-2"
                  value={nextPassphrase}
                  onChange={(e) => setNextPassphrase(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-app-ink">Confirm new passphrase</span>
                <Input
                  type="password"
                  autoComplete="new-password"
                  aria-label="Confirm new passphrase"
                  className="mt-2"
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                />
              </label>
            </div>

            {passphraseError && (
              <p role="alert" className="mt-4 rounded-md border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger-ink">
                {passphraseError}
              </p>
            )}
            {passphraseSuccess && (
              <p className="mt-4 rounded-md border border-success-line bg-success-surface px-3 py-2 text-sm text-success-ink">
                {passphraseSuccess}
              </p>
            )}

            <div className="mt-5 flex justify-end">
              <Button type="button" onClick={() => void handleChangePassphrase()} disabled={changingPassphrase || !canChangePassphrase}>
                {changingPassphrase ? "Changing..." : "Change passphrase"}
              </Button>
            </div>

            <div className="mt-8 border-t border-app-line pt-6">
              <p className="text-sm font-bold text-app-ink">Recovery key</p>
              <p className="mt-1 text-sm text-app-ink-faint">
                Download a fresh recovery key when needed. Previous recovery keys become invalid.
              </p>

              {recoveryError && (
                <p role="alert" className="mt-4 rounded-md border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger-ink">
                  {recoveryError}
                </p>
              )}
              {recoverySuccess && (
                <p className="mt-4 rounded-md border border-success-line bg-success-surface px-3 py-2 text-sm text-success-ink">
                  {recoverySuccess}
                </p>
              )}

              <div className="mt-4 flex justify-end">
                <Button type="button" tone="soft" onClick={() => void handleExportRecoveryKey()} disabled={exportingRecovery}>
                  {exportingRecovery ? "Preparing..." : "Download Recovery Key (.txt)"}
                </Button>
              </div>
            </div>
          </div>
        );

      case "devices":
        return (
          <div>
            <h2 className="text-lg font-bold text-app-ink">Devices</h2>
            <p className="mt-1 text-sm leading-relaxed text-app-ink-faint">
              Manage web, desktop, and extension sessions for your account. Removing a device signs it out.
            </p>

            <div className="mt-6 space-y-3">
              {devices === undefined ? (
                <p className="rounded-md border border-app-line bg-app-surface-muted px-3 py-3 text-sm text-app-ink-faint">
                  Loading devices...
                </p>
              ) : devices.length === 0 ? (
                <p className="rounded-md border border-app-line bg-app-surface-muted px-3 py-3 text-sm text-app-ink-faint">
                  No device activity has been recorded yet.
                </p>
              ) : (
                devices.map((device) => {
                  const isCurrentDevice = device.deviceId === currentDevice.deviceId;
                  const isRemoving = removingDeviceId === String(device._id);
                  return (
                    <div key={device._id} className="rounded-xl border border-app-line bg-app-surface p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-bold text-app-ink">
                          {device.deviceName}
                        </p>
                        <span className="rounded-full border border-app-line bg-app-surface-muted px-2 py-0.5 text-xs font-medium text-app-ink-muted">
                          {clientTypeLabel(device.clientType)}
                        </span>
                        {isCurrentDevice && (
                          <span className="rounded-full border border-success-line bg-success-surface px-2 py-0.5 text-xs font-medium text-success-ink">
                            This device
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label="Remove device"
                          disabled={isRemoving}
                          onClick={() => void handleRemoveDevice(device._id, isCurrentDevice)}
                          className="ml-auto rounded-md p-1 text-app-ink-faint transition hover:bg-danger-surface hover:text-danger-ink disabled:opacity-40"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-app-ink-faint sm:grid-cols-2">
                        <span>Last active {formatDeviceDate(device.lastActiveAt)}</span>
                        <span>First seen {formatDeviceDate(device.firstSeenAt)}</span>
                      </div>
                      {(device.browserName || device.platformName || device.appVersion) && (
                        <p className="mt-1.5 text-xs text-app-ink-faint">
                          {[
                            device.browserName,
                            device.platformName,
                            device.appVersion && `v${device.appVersion}`,
                          ].filter(Boolean).join(" / ")}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );

      case "data":
        return (
          <div>
            <h2 className="text-lg font-bold text-app-ink">Export Data</h2>
            <p className="mt-1 text-sm leading-relaxed text-app-ink-faint">
              Download your workspace as plaintext JSON. Store the file securely.
            </p>
            <Suspense fallback={<div className="mt-4 h-24 rounded-xl border border-app-line bg-app-surface-muted" aria-hidden="true" />}>
              <SettingsDataPanels />
            </Suspense>
          </div>
        );

      case "account":
        return (
          <div>
            <h2 className="text-lg font-bold text-app-ink">Account</h2>
            <p className="mt-1 text-sm leading-relaxed text-app-ink-faint">
              Delete your account and all associated omanote data.
            </p>
            {user && (
              <p className="mt-2 text-xs text-app-ink-faint">Signed in as {maskEmail(user.email)}</p>
            )}

            <div className="mt-6 rounded-xl border border-danger-line bg-danger-surface p-4">
              <p className="text-sm font-bold text-danger-ink">Danger zone</p>
              <p className="mt-1 text-xs leading-relaxed text-danger-ink">
                Type <span className="font-bold">DELETE</span> to enable permanent account removal.
              </p>
              <input
                type="text"
                aria-label="Delete account confirmation"
                className="mt-3 w-full rounded-md border border-danger-line bg-app-surface px-3 py-2 text-sm text-app-ink outline-none focus:border-danger-ink"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
              />
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  tone="danger"
                  onClick={() => void handleDeleteAccount()}
                  disabled={!canDeleteAccount || deletingAccount}
                >
                  {deletingAccount ? "Deleting..." : "Delete account"}
                </Button>
              </div>
            </div>

            {deleteError && (
              <p role="alert" className="mt-4 rounded-md border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger-ink">
                {deleteError}
              </p>
            )}
          </div>
        );
    }
  }

  function handleSelectCategory(id: CategoryId) {
    setSelectedCategory(id);
    setMobileOpen(true);
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--omanote-top-chrome-height,0px))] w-full max-w-[980px] flex-1 flex-col">
      {/* Two-panel layout */}
      <div className="flex min-h-0 flex-1 items-stretch gap-0 lg:gap-8">
        {/* Left sidebar — desktop only */}
        <aside className="hidden w-[200px] flex-shrink-0 flex-col gap-0.5 self-stretch py-4 lg:flex">
          {CATEGORIES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedCategory(id)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition",
                selectedCategory === id
                  ? "bg-app-surface-muted text-app-ink"
                  : "text-app-ink-faint hover:bg-app-surface-hover hover:text-app-ink",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </aside>

        {/* Mobile category list */}
        <div className="flex w-full flex-col gap-4 py-4 lg:hidden">
          {CATEGORIES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleSelectCategory(id)}
              className="flex items-start gap-3 rounded-app-panel py-1 text-left transition hover:bg-app-surface-hover"
            >
              <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-app-ink-faint" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-app-ink">{label}</span>
                <span className="mt-0.5 block text-xs text-app-ink-faint">{MOBILE_CATEGORY_SUMMARIES[id]}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Right content panel — desktop only */}
        <div className="hidden min-h-0 flex-1 flex-col overflow-y-auto border-l border-app-line py-4 pl-8 lg:flex">
          {renderContent()}
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmDialog ? (
        <BaseModal
          onClose={closeConfirm}
          zIndex="z-app-dialog"
          className="bg-black/30 transition-[background-color,opacity] duration-200 ease-out"
          backdropProps={{ onClick: closeConfirm }}
        >
          <div
            className={cn(
              "w-full max-w-sm transform-gpu rounded-2xl border border-app-line bg-app-surface shadow-dialog transition-[transform,opacity] duration-200 ease-out",
              "translate-y-0 scale-100 opacity-100",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <p className="text-base font-bold text-app-ink">{confirmDialog?.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-app-ink-faint">{confirmDialog?.message}</p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-app-line px-5 py-4">
              <Button type="button" tone="plain" onClick={closeConfirm} disabled={confirmLoading}>
                Cancel
              </Button>
              <Button
                type="button"
                tone={confirmDialog?.variant === "danger" ? "danger" : "default"}
                onClick={() => void handleConfirmOk()}
                disabled={confirmLoading}
              >
                {confirmLoading ? "Please wait..." : confirmDialog?.confirmLabel}
              </Button>
            </div>
          </div>
        </BaseModal>
      ) : null}

      {/* Mobile drawer */}
      <ModalPortal>
        <div
          aria-hidden="true"
          className={cn(
            "fixed inset-0 z-app-overlay transform-gpu bg-app-canvas/55 transition-opacity duration-app-drawer ease-app-drawer lg:hidden",
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-app-drawer flex max-h-[92dvh] min-h-0 flex-col rounded-t-2xl bg-app-surface shadow-drawer transform-gpu lg:hidden",
            isDragging ? "" : "transition-transform duration-app-drawer ease-app-drawer",
            mobileOpen ? "translate-y-0" : "pointer-events-none translate-y-full",
          )}
          style={isDragging || dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
        >
          {/* Drag handle */}
          <div className="flex flex-col" {...dragHandleProps}>
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <GripHorizontal className="mx-auto h-5 w-5 text-app-line-strong" />
            </div>
            <div className="flex items-center justify-between border-b border-app-line px-4 pb-3">
              <p className="text-sm font-bold text-app-ink">
                {CATEGORIES.find((c) => c.id === selectedCategory)?.label}
              </p>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-full p-1 text-app-ink-faint hover:bg-app-surface-hover hover:text-app-ink-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Drawer content */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-10">
            {renderContent()}
          </div>
        </div>
      </ModalPortal>
    </div>
  );
}
