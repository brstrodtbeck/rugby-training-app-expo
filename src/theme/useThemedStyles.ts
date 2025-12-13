import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from './ThemeContext';
import type { ThemeType } from './themeDefinitions';

/**
 * Hook to create styles that update when theme changes
 * Usage:
 *   const styles = useThemedStyles((theme) => StyleSheet.create({
 *     container: { backgroundColor: theme.background },
 *     text: { color: theme.textPrimary },
 *   }));
 */
export function useThemedStyles<T extends Record<string, any>>(
  styleFactory: (theme: ThemeType) => T
): T {
  const { theme } = useTheme();
  
  return useMemo(() => {
    return styleFactory(theme);
  }, [theme, styleFactory]);
}

