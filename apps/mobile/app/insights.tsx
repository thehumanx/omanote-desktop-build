import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart2 } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';
import { ScreenHeader } from '../components/ScreenHeader';
import { EmptyState } from '../components/EmptyState';

export default function InsightsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.canvas, paddingTop: insets.top }}>
      <ScreenHeader title="Insights" showBack />
      <EmptyState
        icon={<BarChart2 size={36} color={theme.inkFaint} />}
        title="No insights yet"
        description="Your activity heatmap and streaks will appear here once you start logging events."
      />
    </View>
  );
}
