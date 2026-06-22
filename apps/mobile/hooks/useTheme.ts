import { useColorScheme } from 'react-native';
import { getTheme, Theme } from '../lib/theme';

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return getTheme(scheme);
}
