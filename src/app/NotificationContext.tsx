import React, { createContext, useContext, useMemo } from "react";
import { useApp } from "./AppProvider";
import { randomId } from "@omanote/shared";

interface NotificationContextValue {
  notify: (title: string, body?: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { dispatch } = useApp();

  const value = useMemo<NotificationContextValue>(
    () => ({
      notify: (title, body) => {
        dispatch({
          type: "toast/add",
          toast: {
            id: randomId(),
            createdAt: Date.now(),
            title,
            body,
            tone: "warning",
            actionLabel: "Got it",
          },
        });
      },
    }),
    [dispatch],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("useNotifications must be used inside NotificationProvider");
  return value;
}
