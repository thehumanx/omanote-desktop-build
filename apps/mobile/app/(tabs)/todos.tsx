import { useQuery } from 'convex/react';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckSquare, Plus } from 'lucide-react-native';
import { api } from '../../lib/api';
import { todayKey } from '../../lib/utils';
import { useTheme } from '../../hooks/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TodoItem } from '../../components/TodoItem';
import { EmptyState } from '../../components/EmptyState';
import { CreateTodoSheet } from '../../components/CreateTodoSheet';

type Filter = 'all' | 'today' | 'overdue' | 'upcoming' | 'completed';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Done' },
];

export default function TodosScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [showCreate, setShowCreate] = useState(false);

  const convexFilter = filter === 'all' ? undefined : filter === 'completed' ? 'completed' : filter;
  const todos = useQuery(api.todos.listTodos, {
    filter: convexFilter,
    dateKey: todayKey(),
  });

  const s = styles(theme);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Todos"
        action={{ icon: <Plus size={22} color={theme.ink} />, onPress: () => setShowCreate(true) }}
      />

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filters}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[s.chip, filter === f.key && s.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {todos === undefined ? (
        <View style={s.loader}>
          <ActivityIndicator color={theme.inkMuted} />
        </View>
      ) : todos.length === 0 ? (
        <ScrollView contentContainerStyle={s.emptyWrap}>
          <EmptyState
            icon={<CheckSquare size={36} color={theme.inkFaint} />}
            title="No todos"
            description={
              filter === 'today'
                ? "No todos due today."
                : filter === 'overdue'
                ? "You're all caught up — nothing overdue."
                : filter === 'upcoming'
                ? "No upcoming todos scheduled."
                : filter === 'completed'
                ? "No completed todos yet."
                : "Add tasks to track your work. Tap + to create one."
            }
          />
        </ScrollView>
      ) : (
        <FlatList
          data={todos}
          keyExtractor={(t) => t._id}
          renderItem={({ item }) => <TodoItem todo={item} />}
          contentContainerStyle={s.list}
        />
      )}

      <CreateTodoSheet visible={showCreate} onClose={() => setShowCreate(false)} />
    </View>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.canvas },
    filters: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 6,
    },
    chip: {
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.surface,
    },
    chipActive: {
      backgroundColor: theme.actionPrimary,
      borderColor: theme.actionPrimary,
    },
    chipText: { fontSize: 13, fontWeight: '500', color: theme.inkMuted },
    chipTextActive: { color: theme.actionPrimaryInk },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyWrap: { flexGrow: 1 },
    list: { paddingBottom: 32 },
  });
}
