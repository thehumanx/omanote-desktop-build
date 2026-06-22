import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

type Props = {
  icon: React.ReactNode;
  title: string;
  description: string;
};

export function EmptyState({ icon, title, description }: Props) {
  const theme = useTheme();
  const s = styles(theme);

  return (
    <View style={s.root}>
      <View style={s.iconWrap}>{icon}</View>
      <Text style={s.title}>{title}</Text>
      <Text style={s.description}>{description}</Text>
    </View>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      paddingVertical: 80,
      gap: 12,
    },
    iconWrap: {
      marginBottom: 4,
      opacity: 0.6,
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.ink,
      textAlign: 'center',
    },
    description: {
      fontSize: 14,
      color: theme.inkMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}
