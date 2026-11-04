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
  if (__DEV__) {
    console.log('[colors.ts] Static THEME updated:', {
      primary: THEME.primary,
      background: THEME.background,
      card: THEME.card,
    });
  }
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

// Typography scale – use these instead of magic number font sizes
export const typography = {
  fontSize: {
    caption: 11,
    xs: 12,
    sm: 13,
    body: 14,
    base: 16,
    md: 18,
    lg: 20,
    xl: 22,
    title: 24,
    h2: 28,
    h1: 32,
    display: 48,
  },
};

// Spacing scale – use these for margin, padding, gap instead of literals
export const spacing = {
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export default THEME;

