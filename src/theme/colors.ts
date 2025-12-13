/**
 * Progressive Overlord - Theme System
 * Backward compatibility export - use useTheme() hook for dynamic themes
 */

// Import THEME first
import { THEME as THEME_BASE, getTheme, type ThemeType } from './themeDefinitions';

// Create a mutable THEME object that can be updated
export const THEME: ThemeType = { ...THEME_BASE };

// Function to update the static THEME object (called by ThemeProvider)
export const updateTheme = (newTheme: ThemeType) => {
  Object.assign(THEME, newTheme);
  console.log('[colors.ts] Static THEME updated:', {
    primary: THEME.primary,
    background: THEME.background,
    card: THEME.card,
  });
};

export { getTheme, type ThemeType };

// Common style patterns
export const SHADOWS = {
  small: {
    shadowColor: THEME_BASE.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: THEME_BASE.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  large: {
    shadowColor: THEME_BASE.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};

// Font weights for consistency
export const FONTS = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export default THEME;

