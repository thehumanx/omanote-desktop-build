/**
 * The web-push payload for a reminder.
 *
 * Todo titles are end-to-end encrypted, so the server only ever holds
 * ciphertext and can't put the title in the notification (it used to, and
 * users saw `enc:v1:…`). The body stays generic; `todoId` lets the service
 * worker's "Mark done" action and the app find the todo.
 */
export function buildReminderPushPayload(todoId: string) {
  return {
    title: "Reminder",
    body: "A todo is due. Open omanote to see it.",
    icon: "/android-chrome-192x192.png",
    tag: `omanote-reminder-${todoId}`,
    todoId,
  };
}
