import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Doc } from '../lib/api';
import { isEncrypted } from '../lib/crypto';
import { formatTimestamp, truncate } from '../lib/utils';
import { useTheme } from '../hooks/useTheme';
import { useDecryptMany } from '../hooks/useDecrypt';
import { useEncryption } from '../contexts/EncryptionContext';

type Props = {
  note: Doc<'notes'>;
  onPress?: () => void;
};

export function NoteCard({ note, onPress }: Props) {
  const theme = useTheme();
  const { status } = useEncryption();
  const [displayTitle, displayBody] = useDecryptMany([
    note.title ?? '',
    note.body,
  ]);
  const s = styles(theme);

  const bodyIsEncrypted = isEncrypted(note.body);
  const stillEncrypted = bodyIsEncrypted && status !== 'unlocked';
  const preview = displayBody ? truncate(displayBody) : '';

  return (
    <Pressable
      style={({ pressed }) => [s.root, pressed && s.pressed]}
      onPress={onPress}
    >
      <View style={s.header}>
        <Text style={s.title} numberOfLines={1}>
          {displayTitle || 'Untitled'}
        </Text>
        <Text style={s.date}>{formatTimestamp(note.updatedAt)}</Text>
      </View>

      {stillEncrypted ? (
        <Text style={s.encrypted}>🔒 Encrypted — unlock to read</Text>
      ) : preview ? (
        <Text style={s.preview} numberOfLines={2}>{preview}</Text>
      ) : null}

      {note.hashtags && note.hashtags.length > 0 && (
        <View style={s.tags}>
          {note.hashtags.slice(0, 4).map((tag) => (
            <View key={tag} style={s.tag}>
              <Text style={s.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      marginHorizontal: 16,
      marginVertical: 5,
      borderWidth: 1,
      borderColor: theme.line,
      gap: 6,
    },
    pressed: { opacity: 0.7 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    title: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.ink },
    date: { fontSize: 12, color: theme.inkFaint },
    preview: { fontSize: 13, color: theme.inkMuted, lineHeight: 18 },
    encrypted: { fontSize: 13, color: theme.inkFaint, fontStyle: 'italic' },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
    tag: {
      backgroundColor: theme.accentMuted,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    tagText: { fontSize: 11, color: theme.accent },
  });
}
