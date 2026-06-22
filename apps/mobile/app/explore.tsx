import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Hash } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';
import { ScreenHeader } from '../components/ScreenHeader';
import { EmptyState } from '../components/EmptyState';

export default function ExploreScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.canvas, paddingTop: insets.top }}>
      <ScreenHeader title="Explore" showBack />
      <EmptyState
        icon={<Hash size={36} color={theme.inkFaint} />}
        title="No hashtags yet"
        description="Add #hashtags to your notes and todos to see them visualised here."
      />
    </View>
  );
}
