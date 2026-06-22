import { StyleSheet, Text, View } from 'react-native';
import { Doc } from '../lib/api';
import { formatTimestamp } from '../lib/utils';
import { useTheme } from '../hooks/useTheme';
import { useDecryptMany } from '../hooks/useDecrypt';

type Props = {
  event: Doc<'eventEntries'> | Doc<'routineEntries'>;
};

export function EventItem({ event }: Props) {
  const theme = useTheme();
  const [displayLabel, displayNotes] = useDecryptMany([event.label, event.notes]);
  const s = styles(theme);

  return (
    <View style={s.root}>
      <View style={s.dot} />
      <View style={s.content}>
        <Text style={s.label}>{displayLabel || '…'}</Text>
        <View style={s.meta}>
          <Text style={s.time}>{formatTimestamp(event.loggedAt)}</Text>
          {event.hashtags?.slice(0, 3).map((tag) => (
            <View key={tag} style={s.tag}>
              <Text style={s.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
        {displayNotes ? (
          <Text style={s.notes} numberOfLines={2}>{displayNotes}</Text>
        ) : null}
      </View>
    </View>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: {
      flexDirection: 'row',
      paddingVertical: 10,
      paddingHorizontal: 16,
      gap: 14,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.accent,
      marginTop: 6,
    },
    content: { flex: 1, gap: 4 },
    label: { fontSize: 14, fontWeight: '500', color: theme.ink },
    meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
    time: { fontSize: 12, color: theme.inkFaint },
    tag: {
      backgroundColor: theme.accentMuted,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    tagText: { fontSize: 11, color: theme.accent },
    notes: { fontSize: 12, color: theme.inkMuted, lineHeight: 17 },
  });
}
