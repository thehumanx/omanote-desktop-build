import { useQuery } from 'convex/react';
import { format } from 'date-fns';
import { useState } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, Plus } from 'lucide-react-native';
import { api } from '../../lib/api';
import { todayKey } from '../../lib/utils';
import { useTheme } from '../../hooks/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TodoItem } from '../../components/TodoItem';
import { EmptyState } from '../../components/EmptyState';
import { CreateTodoSheet } from '../../components/CreateTodoSheet';

export default function CanvasScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [showCreate, setShowCreate] = useState(false);
  const dateKey = todayKey();
  const displayDate = format(new Date(), 'EEEE, MMMM d');

  const items = useQuery(api.canvas.listCanvasForDate, { dateKey });
  useNotifications();
  const s = styles(theme);

  const todos = items?.map((item) => item.todo) ?? [];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Canvas"
        subtitle={displayDate}
        action={{ icon: <Plus size={22} color={theme.ink} />, onPress: () => setShowCreate(true) }}
      />

      {items === undefined ? (
        <View style={s.loader}>
          <ActivityIndicator color={theme.inkMuted} />
        </View>
      ) : todos.length === 0 ? (
        <ScrollView contentContainerStyle={s.emptyWrap}>
          <EmptyState
            icon={<LayoutDashboard size={36} color={theme.inkFaint} />}
            title="Today's canvas is empty"
            description="Todos you create today will appear here. Tap + to add one."
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
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyWrap: { flexGrow: 1 },
    list: { paddingBottom: 32 },
  });
}
