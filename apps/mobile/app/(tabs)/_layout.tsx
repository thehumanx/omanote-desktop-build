import { useAuth } from '@clerk/expo';
import { Redirect, Tabs } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { ActivityIndicator, Platform, View } from 'react-native';
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  Bookmark,
  MoreHorizontal,
} from 'lucide-react-native';
import { useEncryption } from '../../contexts/EncryptionContext';
import { UnlockView } from '../../components/UnlockView';

export default function TabLayout() {
  const { isSignedIn } = useAuth();
  const theme = useTheme();
  const { status } = useEncryption();

  if (!isSignedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  // While checking whether encryption is set up, show a spinner
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.canvas }}>
        <ActivityIndicator color={theme.inkMuted} />
      </View>
    );
  }

  // Encryption is set up but not yet unlocked — show full-screen unlock UI
  if (status === 'locked') {
    return <UnlockView />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tabActive,
        tabBarInactiveTintColor: theme.tabInactive,
        tabBarStyle: {
          backgroundColor: theme.tabBarBg,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 0 : 8,
          height: Platform.OS === 'ios' ? 88 : 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginBottom: 4,
        },
      }}
    >
      <Tabs.Screen
        name="canvas"
        options={{
          title: 'Canvas',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="todos"
        options={{
          title: 'Todos',
          tabBarIcon: ({ color, size }) => (
            <CheckSquare color={color} size={size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: 'Notes',
          tabBarIcon: ({ color, size }) => (
            <FileText color={color} size={size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookmarks"
        options={{
          title: 'Bookmarks',
          tabBarIcon: ({ color, size }) => (
            <Bookmark color={color} size={size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <MoreHorizontal color={color} size={size - 2} />
          ),
        }}
      />
    </Tabs>
  );
}
