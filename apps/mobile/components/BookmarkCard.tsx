import { Linking, Pressable, StyleSheet, Text, View, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ExternalLink } from 'lucide-react-native';
import { Doc } from '../lib/api';
import { domainFromUrl } from '../lib/utils';
import { useTheme } from '../hooks/useTheme';
import { useDecryptMany } from '../hooks/useDecrypt';

type Props = {
  bookmark: Doc<'bookmarks'>;
};

export function BookmarkCard({ bookmark }: Props) {
  const theme = useTheme();
  const [displayTitle, displayDescription] = useDecryptMany([
    bookmark.title,
    bookmark.description,
  ]);
  const s = styles(theme);
  const domain = domainFromUrl(bookmark.url);

  async function handleOpen() {
    await Haptics.selectionAsync();
    Linking.openURL(bookmark.url);
  }

  return (
    <Pressable
      style={({ pressed }) => [s.root, pressed && s.pressed]}
      onPress={handleOpen}
    >
      <View style={s.left}>
        {bookmark.faviconUrl ? (
          <Image source={{ uri: bookmark.faviconUrl }} style={s.favicon} />
        ) : (
          <View style={s.faviconFallback}>
            <Text style={s.faviconLetter}>{domain[0]?.toUpperCase() ?? '?'}</Text>
          </View>
        )}
      </View>

      <View style={s.content}>
        <Text style={s.title} numberOfLines={2}>{displayTitle || '…'}</Text>
        <Text style={s.domain} numberOfLines={1}>{domain}</Text>
        {displayDescription ? (
          <Text style={s.description} numberOfLines={2}>{displayDescription}</Text>
        ) : null}
      </View>

      <ExternalLink size={16} color={theme.inkFaint} />
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
    left: { paddingTop: 2 },
    favicon: { width: 20, height: 20, borderRadius: 4 },
    faviconFallback: {
      width: 20,
      height: 20,
      borderRadius: 4,
      backgroundColor: theme.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    faviconLetter: { fontSize: 11, fontWeight: '600', color: theme.inkMuted },
    content: { flex: 1, gap: 3 },
    title: { fontSize: 14, fontWeight: '500', color: theme.ink, lineHeight: 19 },
    domain: { fontSize: 12, color: theme.inkFaint },
    description: { fontSize: 12, color: theme.inkMuted, lineHeight: 17, marginTop: 1 },
  });
}
