import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const theme = useTheme();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.canvas }}>
        <ActivityIndicator color={theme.inkMuted} />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(tabs)/canvas" />;
}
