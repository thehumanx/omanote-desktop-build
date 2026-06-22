import { useMutation } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { Doc, api } from '../lib/api';
import { formatDateKey, isOverdue, todayKey } from '../lib/utils';
import { useTheme } from '../hooks/useTheme';
import { useDecryptMany } from '../hooks/useDecrypt';

type Props = {
  todo: Doc<'todos'>;
};

export function TodoItem({ todo }: Props) {
  const theme = useTheme();
  const toggleTodo = useMutation(api.todos.toggleTodo);
  const [displayTitle, displayNotes] = useDecryptMany([todo.title, todo.notes]);

  async function handleToggle() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleTodo({
      todoId: todo._id,
      eventLabel: displayTitle || todo.title,
      eventDateKey: todayKey(),
    });
  }

  const done = todo.status === 'done';
  const overdue = !done && isOverdue(todo.dueDateKey);
  const s = styles(theme);

  return (
    <Pressable
      style={({ pressed }) => [s.root, pressed && s.pressed]}
      onPress={handleToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
    >
      <View style={[s.checkbox, done && s.checkboxDone]}>
        {done && <View style={s.checkmark} />}
      </View>

      <View style={s.content}>
        <Text style={[s.title, done && s.titleDone]} numberOfLines={2}>
          {displayTitle || '…'}
        </Text>
        {displayNotes ? (
          <Text style={s.notes} numberOfLines={1}>{displayNotes}</Text>
        ) : null}
        <View style={s.meta}>
          {todo.priority === 'high' && !done && (
            <View style={s.priorityBadge}>
              <Text style={s.priorityText}>High</Text>
            </View>
          )}
          {todo.dueDateKey && (
            <View style={[s.dateChip, overdue && s.dateChipOverdue]}>
              {overdue && <AlertTriangle size={10} color={theme.dangerInk} style={{ marginRight: 3 }} />}
              <Text style={[s.dateText, overdue && s.dateTextOverdue]}>
                {formatDateKey(todo.dueDateKey)}
              </Text>
            </View>
          )}
          {todo.hashtags?.slice(0, 2).map((tag) => (
            <View key={tag} style={s.hashtagChip}>
              <Text style={s.hashtagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.line,
      gap: 12,
    },
    pressed: { backgroundColor: theme.surfaceHover },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: theme.lineStrong,
      marginTop: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxDone: {
      backgroundColor: theme.actionPrimary,
      borderColor: theme.actionPrimary,
    },
    checkmark: {
      width: 10,
      height: 6,
      borderLeftWidth: 2,
      borderBottomWidth: 2,
      borderColor: theme.actionPrimaryInk,
      transform: [{ rotate: '-45deg' }, { translateY: -1 }],
    },
    content: { flex: 1, gap: 4 },
    title: {
      fontSize: 15,
      color: theme.ink,
      lineHeight: 20,
    },
    titleDone: {
      color: theme.inkFaint,
      textDecorationLine: 'line-through',
    },
    notes: {
      fontSize: 13,
      color: theme.inkMuted,
    },
    meta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    priorityBadge: {
      backgroundColor: '#fef3c7',
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    priorityText: { fontSize: 11, color: '#92400e', fontWeight: '600' },
    dateChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surfaceMuted,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    dateChipOverdue: { backgroundColor: theme.dangerSurface },
    dateText: { fontSize: 11, color: theme.inkMuted },
    dateTextOverdue: { color: theme.dangerInk },
    hashtagChip: {
      backgroundColor: theme.accentMuted,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    hashtagText: { fontSize: 11, color: theme.accent },
  });
}
