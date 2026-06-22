import { useQuery } from 'convex/react';
import { format } from 'date-fns';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Activity, Plus } from 'lucide-react-native';
import { api } from '../lib/api';
import { formatDateKey } from '../lib/utils';
import { useTheme } from '../hooks/useTheme';
import { ScreenHeader } from '../components/ScreenHeader';
import { EventItem } from '../components/EventItem';
import { EmptyState } from '../components/EmptyState';
import { LogEventSheet } from '../components/LogEventSheet';

export default function EventsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [showLog, setShowLog] = useState(false);

  const events = useQuery(api.events.listEventEntries, {});
  const s = styles(theme);

  // Group by date
  const sections = groupByDate(events ?? []);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Events"
        showBack
        action={{ icon: <Plus size={22} color={theme.ink} />, onPress: () => setShowLog(true) }}
      />

      {events === undefined ? (
        <View style={s.loader}>
          <ActivityIndicator color={theme.inkMuted} />
        </View>
      ) : sections.length === 0 ? (
        <ScrollView contentContainerStyle={s.emptyWrap}>
          <EmptyState
            icon={<Activity size={36} color={theme.inkFaint} />}
            title="No events yet"
            description="Log activities, habits, and milestones on your timeline. Tap + to record one."
          />
        </ScrollView>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <EventItem event={item} />}
          renderSectionHeader={({ section }) => (
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{section.title}</Text>
              <View style={s.sectionLine} />
            </View>
          )}
          contentContainerStyle={s.list}
          stickySectionHeadersEnabled={false}
        />
      )}

      <LogEventSheet visible={showLog} onClose={() => setShowLog(false)} />
    </View>
  );
}

type AnyEvent = NonNullable<ReturnType<typeof useQuery<typeof api.events.listEventEntries>>>[number];

function groupByDate(items: AnyEvent[]) {
  const map = new Map<string, AnyEvent[]>();
  for (const item of items) {
    const dk = item.createdDateKey;
    const arr = map.get(dk) ?? [];
    arr.push(item);
    map.set(dk, arr);
  }
  return Array.from(map.entries()).map(([dk, data]) => ({
    title: formatDateKey(dk),
    data,
  }));
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.canvas },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyWrap: { flexGrow: 1 },
    list: { paddingBottom: 32 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 8,
      gap: 10,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.inkFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.line,
    },
  });
}
