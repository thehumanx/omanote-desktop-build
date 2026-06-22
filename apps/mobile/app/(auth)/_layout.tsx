import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';

export default function AuthLayout() {
  const { isSignedIn } = useAuth();
  const theme = useTheme();

  if (isSignedIn) {
    return <Redirect href="/(tabs)/canvas" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.canvas } }} />
  );
}
