import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useApp } from "../app/AppProvider";
import { Button } from "./ui";
import { Bell, Clock, X } from "lucide-react";
import { useUserSettings } from "../contexts/UserSettingsContext";
import type { ToastItem } from "../app/types";

function isEditableTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const isEditableElement = (node: HTMLElement | null) =>
    Boolean(
      node &&
        (node.isContentEditable ||
          node.matches("input, textarea, select, [role='textbox']") ||
          node.closest("[contenteditable='true'], input, textarea, select, [role='textbox']")),
    );

  return isEditableElement(element) || isEditableElement(activeElement);
}

const PEEK_OFFSET = 8;
const PEEK_SCALE = 0.04;
const EXPANDED_GAP = 10;
const TOAST_EXIT_MS = 180;

type RenderedToast = ToastItem & {
  isEntering?: boolean;
  isExiting?: boolean;
};

function ToastStack({
  toasts,
  dispatch,
  settings,
}: {
  toasts: RenderedToast[];
  dispatch: ReturnType<typeof useApp>["dispatch"];
  settings: ReturnType<typeof useUserSettings>["settings"];
}) {
  const [hovered, setHovered] = useState(false);
  const nodeMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const heightMapRef = useRef<Map<string, number>>(new Map());
  const [, rerender] = useState(0);

  useLayoutEffect(() => {
    const observers: ResizeObserver[] = [];
    for (const [id, node] of nodeMapRef.current) {
      heightMapRef.current.set(id, node.offsetHeight);
      const ro = new ResizeObserver(() => {
        heightMapRef.current.set(id, node.offsetHeight);
        rerender((n) => n + 1);
      });
      ro.observe(node);
      observers.push(ro);
    }
    rerender((n) => n + 1);
    return () => observers.forEach((ro) => ro.disconnect());
  }, [toasts]);

  const peekCount = Math.min(toasts.length - 1, 2);
  const frontHeight = heightMapRef.current.get(toasts[0]?.id ?? "") ?? 60;
  const collapsedContainerHeight = frontHeight + peekCount * PEEK_OFFSET;

  let acc = 0;
  const expandedOffsets = toasts.map((toast, i) => {
    const offset = acc;
    acc += (heightMapRef.current.get(toast.id) ?? 60) + (i < toasts.length - 1 ? EXPANDED_GAP : 0);
    return offset;
  });
  const expandedContainerHeight = acc;

  const containerHeight = hovered ? expandedContainerHeight : collapsedContainerHeight;

  return (
    <div
      className="relative w-full"
      style={{
        height: containerHeight,
        transition: "height var(--motion-duration-drawer) var(--motion-easing-out)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {toasts.map((toast, index) => {
        const collapsedY = Math.min(index, 2) * PEEK_OFFSET;
        const collapsedScale = 1 - Math.min(index, 2) * PEEK_SCALE;
        const expandedY = expandedOffsets[index] ?? 0;
        const isHiddenInStack = !hovered && index >= 3;

        return (
          <div
            key={toast.id}
            ref={(node) => {
              if (node) nodeMapRef.current.set(toast.id, node);
              else nodeMapRef.current.delete(toast.id);
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: toasts.length - index,
              transform: hovered
                ? `translateY(${expandedY}px) scale(1)`
                : `translateY(${collapsedY}px) scale(${collapsedScale})`,
              opacity: isHiddenInStack ? 0 : hovered ? 1 : Math.max(0.65, 1 - index * 0.18),
              transition: "transform var(--motion-duration-drawer) var(--motion-easing-out), opacity var(--motion-duration-drawer) var(--motion-easing-out)",
              pointerEvents: hovered || index === 0 ? "auto" : "none",
            }}
          >
            <div className={toast.isExiting ? "omanote-toast-exit" : toast.isEntering ? "omanote-toast-enter" : undefined}>
              {toast.kind === "reminder" ? (
                <div className="rounded-xl border border-app-line bg-app-surface px-4 py-3 shadow-soft">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      <div className="rounded-full bg-warning-surface p-1.5">
                        <Bell className="h-3.5 w-3.5 text-warning-solid" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-app-ink-faint">Reminder</p>
                      <p className="mt-0.5 text-sm font-medium text-app-ink leading-snug">{toast.title}</p>
                    </div>
                    <Button
                      tone="ghost"
                      className="mt-0.5 flex-shrink-0 p-1.5"
                      onClick={() => dispatch({ type: "toast/remove", toastId: toast.id })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {toast.todoId && (
                    <div className="mt-3 flex items-center gap-2 pl-9">
                      <Button
                        tone="default"
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs"
                        onClick={() => {
                          dispatch({ type: "todo/toggle", todoId: toast.todoId! });
                          dispatch({ type: "toast/remove", toastId: toast.id });
                        }}
                      >
                        ✓ Complete
                      </Button>
                      <Button
                        tone="soft"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
                        onClick={() => {
                          dispatch({ type: "todo/snooze", todoId: toast.todoId!, minutes: settings.defaultSnoozeMinutes });
                          dispatch({ type: "toast/remove", toastId: toast.id });
                        }}
                      >
                        <Clock className="h-3 w-3" />
                        Snooze {settings.defaultSnoozeMinutes}m
                      </Button>
                      <Button
                        tone="ghost"
                        className="px-2.5 py-1.5 text-xs text-app-ink-faint"
                        onClick={() => dispatch({ type: "toast/remove", toastId: toast.id })}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-app-line bg-app-surface px-4 py-3 shadow-soft">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-app-ink">
                      <span className="font-medium">{toast.title}</span>
                      {toast.highlight ? <span className="ml-1 font-bold text-app-ink">{toast.highlight}</span> : null}
                    </p>
                    {toast.body && <p className="mt-0.5 text-xs text-app-ink-faint">{toast.body}</p>}
                  </div>
                  {toast.onAction && (
                    <Button
                      tone="soft"
                      className="flex-shrink-0 px-3 py-1.5 text-xs"
                      onClick={() => {
                        toast.onAction?.();
                        dispatch({ type: "toast/remove", toastId: toast.id });
                      }}
                    >
                      Undo
                    </Button>
                  )}
                  <Button tone="ghost" className="p-2" onClick={() => dispatch({ type: "toast/remove", toastId: toast.id })}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ToastHost() {
  const { state, dispatch, undo, redo } = useApp();
  const { settings } = useUserSettings();
  const reminderToastTimeoutMs = settings.reminderToastDurationSeconds * 1_000;
  const defaultToastTimeoutMs = 5_000;
  const [renderedToasts, setRenderedToasts] = useState<RenderedToast[]>([]);

  useEffect(() => {
    const timers = state.toasts.map((toast) =>
      window.setTimeout(
        () => dispatch({ type: "toast/remove", toastId: toast.id }),
        toast.kind === "reminder" ? reminderToastTimeoutMs : defaultToastTimeoutMs,
      ),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [defaultToastTimeoutMs, dispatch, reminderToastTimeoutMs, state.toasts]);

  useEffect(() => {
    setRenderedToasts((prev) => {
      const prevById = new Map(prev.map((toast) => [toast.id, toast]));
      const nextIds = new Set(state.toasts.map((toast) => toast.id));

      const nextRendered: RenderedToast[] = state.toasts.map((toast) => {
        const prevToast = prevById.get(toast.id);
        if (prevToast) {
          return { ...toast, isEntering: false, isExiting: false };
        }
        return { ...toast, isEntering: true, isExiting: false };
      });

      const exiting = prev
        .filter((toast) => !nextIds.has(toast.id))
        .map((toast) => ({ ...toast, isEntering: false, isExiting: true }));

      return [...nextRendered, ...exiting];
    });
  }, [state.toasts]);

  useEffect(() => {
    if (!renderedToasts.some((toast) => toast.isEntering)) return;
    const timer = window.setTimeout(() => {
      setRenderedToasts((prev) => prev.map((toast) => (toast.isEntering ? { ...toast, isEntering: false } : toast)));
    }, 120);
    return () => window.clearTimeout(timer);
  }, [renderedToasts]);

  useEffect(() => {
    if (!renderedToasts.some((toast) => toast.isExiting)) return;
    const timer = window.setTimeout(() => {
      setRenderedToasts((prev) => prev.filter((toast) => !toast.isExiting));
    }, TOAST_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [renderedToasts]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isUndoShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey;
      const isRedoShortcut = ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && event.shiftKey) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y");
      if (!isUndoShortcut && !isRedoShortcut) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      void (isRedoShortcut ? redo() : undo());
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

  if (!renderedToasts.length) return null;

  return (
    <div className="fixed left-1/2 top-4 z-50 w-[min(92vw,420px)] -translate-x-1/2">
      <ToastStack toasts={renderedToasts} dispatch={dispatch} settings={settings} />
    </div>
  );
}
