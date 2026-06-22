import { useAuth, useUser } from '@clerk/expo';
import { useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Activity,
  Search,
  Hash,
  BarChart2,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';

type MenuRow = {
  icon: React.ReactNode;
  label: string;
  href: string;
};

export default function MoreScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const sections: { title: string; rows: MenuRow[] }[] = [
    {
      title: 'Workspace',
      rows: [
        { icon: <Activity size={20} color={theme.ink} />, label: 'Events', href: '/events' },
        { icon: <Search size={20} color={theme.ink} />, label: 'Search', href: '/search' },
        { icon: <Hash size={20} color={theme.ink} />, label: 'Explore', href: '/explore' },
        { icon: <BarChart2 size={20} color={theme.ink} />, label: 'Insights', href: '/insights' },
      ],
    },
    {
      title: 'Account',
      rows: [
        { icon: <Settings size={20} color={theme.ink} />, label: 'Settings', href: '/settings' },
      ],
    },
  ];

  const s = styles(theme);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="More" />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 16 }]}>
        {/* Profile card */}
        <View style={s.profileCard}>
          {user?.imageUrl ? (
            <Image source={{ uri: user.imageUrl }} style={s.avatar} />
          ) : (
            <View style={s.avatarFallback}>
              <Text style={s.avatarLetter}>
                {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? '?'}
              </Text>
            </View>
          )}
          <View style={s.profileText}>
            <Text style={s.profileName} numberOfLines={1}>
              {user?.fullName ?? 'Omanote User'}
            </Text>
            <Text style={s.profileEmail} numberOfLines={1}>
              {user?.emailAddresses?.[0]?.emailAddress}
            </Text>
          </View>
        </View>

        {/* Sections */}
        {sections.map((section) => (
          <View key={section.title} style={s.section}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <View style={s.sectionCard}>
              {section.rows.map((row, idx) => (
                <Pressable
                  key={row.label}
                  style={({ pressed }) => [
                    s.row,
                    idx < section.rows.length - 1 && s.rowBorder,
                    pressed && s.rowPressed,
                  ]}
                  onPress={() => router.push(row.href as any)}
                >
                  <View style={s.rowLeft}>
                    <View style={s.rowIcon}>{row.icon}</View>
                    <Text style={s.rowLabel}>{row.label}</Text>
                  </View>
                  <ChevronRight size={16} color={theme.inkFaint} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* Sign out */}
        <View style={s.section}>
          <View style={s.sectionCard}>
            <Pressable
              style={({ pressed }) => [s.row, pressed && s.rowPressed]}
              onPress={() => signOut()}
            >
              <View style={s.rowLeft}>
                <View style={s.rowIcon}>
                  <LogOut size={20} color={theme.dangerInk} />
                </View>
                <Text style={[s.rowLabel, { color: theme.dangerInk }]}>Sign out</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.canvas,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 8,
      gap: 8,
    },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      gap: 14,
      borderWidth: 1,
      borderColor: theme.line,
      marginBottom: 8,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    avatarFallback: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarLetter: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.ink,
      textTransform: 'uppercase',
    },
    profileText: {
      flex: 1,
      gap: 2,
    },
    profileName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.ink,
    },
    profileEmail: {
      fontSize: 13,
      color: theme.inkMuted,
    },
    section: {
      gap: 6,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.inkFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: 4,
    },
    sectionCard: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.line,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: theme.line,
    },
    rowPressed: {
      backgroundColor: theme.surfaceHover,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    rowIcon: {
      width: 28,
      alignItems: 'center',
    },
    rowLabel: {
      fontSize: 15,
      fontWeight: '400',
      color: theme.ink,
    },
  });
}
