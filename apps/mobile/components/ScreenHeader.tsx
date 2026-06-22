import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';

type Props = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  action?: { icon: React.ReactNode; onPress: () => void };
};

export function ScreenHeader({ title, subtitle, showBack, action }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const s = styles(theme);

  return (
    <View style={s.root}>
      <View style={s.left}>
        {showBack && (
          <Pressable
            style={({ pressed }) => [s.backBtn, pressed && s.pressed]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <ChevronLeft size={22} color={theme.ink} />
          </Pressable>
        )}
        <View>
          <Text style={s.title}>{title}</Text>
          {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
        </View>
      </View>
      {action && (
        <Pressable
          style={({ pressed }) => [s.actionBtn, pressed && s.pressed]}
          onPress={action.onPress}
          hitSlop={8}
        >
          {action.icon}
        </Pressable>
      )}
    </View>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.line,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    backBtn: {
      padding: 4,
      marginLeft: -4,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.ink,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 13,
      color: theme.inkMuted,
      marginTop: 1,
    },
    actionBtn: {
      padding: 6,
    },
    pressed: {
      opacity: 0.6,
    },
  });
}
