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
import { FileText, FolderOpen, Plus } from 'lucide-react-native';
import { api, type Id } from '../../lib/api';
import { useTheme } from '../../hooks/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { NoteCard } from '../../components/NoteCard';
import { EmptyState } from '../../components/EmptyState';
import { CreateNoteSheet } from '../../components/CreateNoteSheet';

export default function NotesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [activeFolderId, setActiveFolderId] = useState<Id<'noteFolders'> | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const folders = useQuery(api.notes.listNoteFolders, {});
  const notes = useQuery(api.notes.listNotes, {});
  const s = styles(theme);

  const visibleNotes = activeFolderId
    ? (notes ?? []).filter((n) => n.folderId === activeFolderId)
    : notes ?? [];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Notes"
        action={{ icon: <Plus size={22} color={theme.ink} />, onPress: () => setShowCreate(true) }}
      />

      {/* Folder filter */}
      {folders && folders.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.folders}
        >
          <Pressable
            style={[s.folderChip, activeFolderId === null && s.folderChipActive]}
            onPress={() => setActiveFolderId(null)}
          >
            <Text style={[s.folderChipText, activeFolderId === null && s.folderChipTextActive]}>
              All
            </Text>
          </Pressable>
          {folders.map((f) => (
            <Pressable
              key={f._id}
              style={[s.folderChip, activeFolderId === f._id && s.folderChipActive]}
              onPress={() => setActiveFolderId(f._id)}
            >
              {f.icon ? (
                <Text style={s.folderIcon}>{f.icon}</Text>
              ) : (
                <FolderOpen size={13} color={activeFolderId === f._id ? theme.actionPrimaryInk : theme.inkMuted} />
              )}
              <Text style={[s.folderChipText, activeFolderId === f._id && s.folderChipTextActive]}>
                {f.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {notes === undefined ? (
        <View style={s.loader}>
          <ActivityIndicator color={theme.inkMuted} />
        </View>
      ) : visibleNotes.length === 0 ? (
        <ScrollView contentContainerStyle={s.emptyWrap}>
          <EmptyState
            icon={<FileText size={36} color={theme.inkFaint} />}
            title="No notes yet"
            description="Capture ideas and thoughts in markdown. Tap + to write one."
          />
        </ScrollView>
      ) : (
        <FlatList
          data={visibleNotes}
          keyExtractor={(n) => n._id}
          renderItem={({ item }) => <NoteCard note={item} />}
          contentContainerStyle={s.list}
        />
      )}

      <CreateNoteSheet visible={showCreate} onClose={() => setShowCreate(false)} />
    </View>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.canvas },
    folders: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 6,
    },
    folderChip: {
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
    folderChipActive: {
      backgroundColor: theme.actionPrimary,
      borderColor: theme.actionPrimary,
    },
    folderIcon: { fontSize: 13 },
    folderChipText: { fontSize: 13, fontWeight: '500', color: theme.inkMuted },
    folderChipTextActive: { color: theme.actionPrimaryInk },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyWrap: { flexGrow: 1 },
    list: { paddingVertical: 8, paddingBottom: 32 },
  });
}
