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
import { Bookmark, Plus } from 'lucide-react-native';
import { api, type Id } from '../../lib/api';
import { useTheme } from '../../hooks/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { BookmarkCard } from '../../components/BookmarkCard';
import { EmptyState } from '../../components/EmptyState';

export default function BookmarksScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [activeCategoryId, setActiveCategoryId] = useState<Id<'bookmarkCategories'> | null>(null);

  const categories = useQuery(api.bookmarks.listBookmarkCategories, {});
  const bookmarks = useQuery(
    api.bookmarks.listBookmarks,
    activeCategoryId ? { categoryId: activeCategoryId } : {},
  );
  const s = styles(theme);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Bookmarks"
        action={{ icon: <Plus size={22} color={theme.ink} />, onPress: () => {} }}
      />

      {/* Category tabs */}
      {categories && categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.categories}
        >
          <Pressable
            style={[s.catChip, activeCategoryId === null && s.catChipActive]}
            onPress={() => setActiveCategoryId(null)}
          >
            <Text style={[s.catChipText, activeCategoryId === null && s.catChipTextActive]}>All</Text>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat._id}
              style={[s.catChip, activeCategoryId === cat._id && s.catChipActive]}
              onPress={() => setActiveCategoryId(cat._id)}
            >
              {cat.icon ? <Text style={s.catIcon}>{cat.icon}</Text> : null}
              <Text style={[s.catChipText, activeCategoryId === cat._id && s.catChipTextActive]}>
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {bookmarks === undefined ? (
        <View style={s.loader}>
          <ActivityIndicator color={theme.inkMuted} />
        </View>
      ) : bookmarks.length === 0 ? (
        <ScrollView contentContainerStyle={s.emptyWrap}>
          <EmptyState
            icon={<Bookmark size={36} color={theme.inkFaint} />}
            title="No bookmarks"
            description={
              activeCategoryId
                ? 'No bookmarks in this category.'
                : 'Save links here. Use the browser extension to capture from anywhere.'
            }
          />
        </ScrollView>
      ) : (
        <FlatList
          data={bookmarks}
          keyExtractor={(b) => b._id}
          renderItem={({ item }) => <BookmarkCard bookmark={item} />}
          contentContainerStyle={s.list}
        />
      )}
    </View>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.canvas },
    categories: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 6,
    },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.surface,
    },
    catChipActive: {
      backgroundColor: theme.actionPrimary,
      borderColor: theme.actionPrimary,
    },
    catIcon: { fontSize: 13 },
    catChipText: { fontSize: 13, fontWeight: '500', color: theme.inkMuted },
    catChipTextActive: { color: theme.actionPrimaryInk },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyWrap: { flexGrow: 1 },
    list: { paddingBottom: 32 },
  });
}
