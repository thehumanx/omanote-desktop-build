import { useQuery } from 'convex/react';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { api } from '../lib/api';
import { requestNotificationPermission, syncTodoReminders } from '../lib/notifications';

export function useNotifications() {
  const todos = useQuery(api.todos.listTodos, {});
  const permissionRequested = useRef(false);

  // Request permission once on mount
  useEffect(() => {
    if (permissionRequested.current) return;
    permissionRequested.current = true;
    requestNotificationPermission();
  }, []);

  // Re-sync reminders whenever todos change or app comes to foreground
  useEffect(() => {
    if (!todos) return;

    const todosWithTime = todos.filter((t) => t.dueTime);
    if (todosWithTime.length === 0) return;

    syncTodoReminders(todosWithTime);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncTodoReminders(todosWithTime);
      }
    });

    return () => sub.remove();
  }, [todos]);
}
