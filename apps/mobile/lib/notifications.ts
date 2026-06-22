import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { parseISO, parse, isAfter } from 'date-fns';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366F1',
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

type TodoForReminder = {
  _id: string;
  title: string;
  dueDateKey?: string;
  dueTime?: string;
  status: string;
  deletedAt?: number;
};

export async function syncTodoReminders(todos: TodoForReminder[]): Promise<void> {
  // Cancel all existing scheduled notifications before rescheduling
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();

  for (const todo of todos) {
    if (todo.status === 'done' || todo.deletedAt) continue;
    if (!todo.dueDateKey || !todo.dueTime) continue;

    try {
      // Combine dueDateKey (YYYY-MM-DD) and dueTime (HH:mm) into a Date
      const triggerDate = parse(
        `${todo.dueDateKey} ${todo.dueTime}`,
        'yyyy-MM-dd HH:mm',
        new Date(),
      );

      if (!isAfter(triggerDate, now)) continue;

      await Notifications.scheduleNotificationAsync({
        identifier: `todo-${todo._id}`,
        content: {
          title: 'Reminder',
          body: todo.title,
          data: { todoId: todo._id },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });
    } catch {
      // Skip invalid dates silently
    }
  }
}
