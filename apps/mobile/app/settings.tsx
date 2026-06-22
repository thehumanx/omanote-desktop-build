import { useAuth } from '@clerk/expo';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ScreenHeader } from '../components/ScreenHeader';
import { ChevronRight, Moon, Bell, Shield, Smartphone, LogOut } from 'lucide-react-native';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const s = styles(theme);

  type Row = { label: string; icon: React.ReactNode; onPress?: () => void; trailing?: React.ReactNode };
  const sections: { title: string; rows: Row[] }[] = [
    {
      title: 'Preferences',
      rows: [
        { icon: <Moon size={18} color={theme.ink} />, label: 'Appearance', onPress: () => {} },
        { icon: <Bell size={18} color={theme.ink} />, label: 'Notifications', onPress: () => {} },
      ],
    },
    {
      title: 'Security',
      rows: [
        { icon: <Shield size={18} color={theme.ink} />, label: 'Encryption', onPress: () => {} },
        { icon: <Smartphone size={18} color={theme.ink} />, label: 'Devices', onPress: () => {} },
      ],
    },
    {
      title: 'Account',
      rows: [
        {
          icon: <LogOut size={18} color={theme.dangerInk} />,
          label: 'Sign out',
          onPress: () => signOut(),
        },
      ],
    },
  ];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Settings" showBack />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}>
        {sections.map((section) => (
          <View key={section.title} style={s.section}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <View style={s.card}>
              {section.rows.map((row, idx) => (
                <Pressable
                  key={row.label}
                  style={({ pressed }) => [
                    s.row,
                    idx < section.rows.length - 1 && s.rowBorder,
                    pressed && s.rowPressed,
                  ]}
                  onPress={row.onPress}
                >
                  <View style={s.rowLeft}>
                    <View style={s.rowIcon}>{row.icon}</View>
                    <Text style={[s.rowLabel, row.label === 'Sign out' && { color: theme.dangerInk }]}>
                      {row.label}
                    </Text>
                  </View>
                  {row.trailing ?? <ChevronRight size={16} color={theme.inkFaint} />}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.canvas },
    content: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
    section: { gap: 6 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.inkFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: 4,
    },
    card: {
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
    rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.line },
    rowPressed: { backgroundColor: theme.surfaceHover },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowIcon: { width: 24, alignItems: 'center' },
    rowLabel: { fontSize: 15, color: theme.ink },
  });
}
