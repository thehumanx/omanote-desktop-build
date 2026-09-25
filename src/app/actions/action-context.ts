import type { Dispatch, MutableRefObject } from "react";
import type { HistoryEntry, LocalAction } from "../AppProvider";
import type { SyncTableName } from "../sync";
import type { AppAction, AppState } from "../types";

/**
 * What AppProvider hands every artifact action hook (todo-, note- and
 * bookmark-actions). Refs are read at call time, so a handler created once still
 * sees current state; everything else is a stable callback.
 */
export type AppActionContext = {
  localDispatch: Dispatch<LocalAction>;
  dispatchRef: MutableRefObject<(action: AppAction) => void>;
  historySuppressedRef: MutableRefObject<boolean>;
  stateRef: MutableRefObject<AppState | null>;
  pushHistory: (entry: HistoryEntry) => void;
  showDeleteToast: (kind: "todo" | "note" | "bookmark" | "event" | "page", content: string, onUndo?: () => void) => void;
  scheduleSync: (tables?: readonly SyncTableName[]) => void;
};
