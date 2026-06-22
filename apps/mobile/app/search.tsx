import { useQuery } from 'convex/react';
import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { api } from '../lib/api';
import { truncate } from '../lib/utils';
import { useTheme } from '../hooks/useTheme';
import { ScreenHeader } from '../components/ScreenHeader';
import { TodoItem } from '../components/TodoItem';
import { NoteCard } from '../components/NoteCard';
import { BookmarkCard } from '../components/BookmarkCard';
import { EmptyState } from '../components/EmptyState';

export default function SearchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const s = styles(theme);

  const todos = useQuery(api.todos.listTodos, {});
  const notes = useQuery(api.notes.listNotes, {});
  const bookmarks = useQuery(api.bookmarks.listBookmarks, {});

  const q = query.toLowerCase().trim();

  const results = useMemo(() => {
    if (!q) return [];
    const sections = [];

    const matchedTodos = (todos ?? []).filter(
      (t) => t.title.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q),
    );
    if (matchedTodos.length > 0) {
      sections.push({ title: 'Todos', data: matchedTodos, type: 'todo' as const });
    }

    const matchedNotes = (notes ?? []).filter(
      (n) =>
        n.title?.toLowerCase().includes(q) ||
        (!n.body.startsWith('enc:') && n.body.toLowerCase().includes(q)),
    );
    if (matchedNotes.length > 0) {
      sections.push({ title: 'Notes', data: matchedNotes, type: 'note' as const });
    }

    const matchedBookmarks = (bookmarks ?? []).filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q),
    );
    if (matchedBookmarks.length > 0) {
      sections.push({ title: 'Bookmarks', data: matchedBookmarks, type: 'bookmark' as const });
    }

    return sections;
  }, [q, todos, notes, bookmarks]);

  const loading = todos === undefined || notes === undefined || bookmarks === undefined;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Search" showBack />

      <View style={s.inputRow}>
        <Search size={18} color={theme.inkFaint} />
        <TextInput
          style={s.input}
          placeholder="Search todos, notes, bookmarks…"
          placeholderTextColor={theme.inkFaint}
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {loading && q ? (
        <View style={s.loader}>
          <ActivityIndicator color={theme.inkMuted} />
        </View>
      ) : !q ? (
        <View style={s.emptyWrap}>
          <EmptyState
            icon={<Search size={36} color={theme.inkFaint} />}
            title="Search everything"
            description="Find any note, todo, or bookmark across your workspace."
          />
        </View>
      ) : results.length === 0 ? (
        <View style={s.emptyWrap}>
          <EmptyState
            icon={<Search size={36} color={theme.inkFaint} />}
            title={`No results for "${query}"`}
            description="Try a different word or check your spelling."
          />
        </View>
      ) : (
        <SectionList
          sections={results}
          keyExtractor={(item) => item._id}
          renderSectionHeader={({ section }) => (
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item, section }) => {
            if (section.type === 'todo') return <TodoItem todo={item as any} />;
            if (section.type === 'note') return <NoteCard note={item as any} />;
            if (section.type === 'bookmark') return <BookmarkCard bookmark={item as any} />;
            return null;
          }}
          contentContainerStyle={s.list}
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.canvas },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
      backgroundColor: theme.surfaceMuted,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
    },
    input: { flex: 1, fontSize: 16, color: theme.ink },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyWrap: { flex: 1 },
    list: { paddingBottom: 32 },
    sectionHeader: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 6,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.inkFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  });
}
