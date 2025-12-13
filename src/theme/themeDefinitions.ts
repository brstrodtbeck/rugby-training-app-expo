/**
 * Theme definitions for Progressive Overlord
 * Each theme includes all color properties needed throughout the app
 */

export type ThemeType = {
  // Primary colors
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryFaded: string;
  
  // Secondary colors
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
  secondaryFaded: string;
  
  // Background colors
  background: string;
  backgroundDark: string;
  backgroundLight: string;
  
  // Card backgrounds
  card: string;
  cardElevated: string;
  
  // Accent colors
  accent: string;
  accentLight: string;
  accentMuted: string;
  accentFaded: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;
  textOnSecondary: string;
  
  // Semantic colors
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Progression indicators
  progressionRule3: string;
  progressionFallback: string;
  progressionReduction: string;
  progressionDeload: string;
  progressionSafeguard: string;
  
  // Readiness colors
  readinessHigh: string;
  readinessMedium: string;
  readinessLow: string;
  
  // Borders
  border: string;
  borderLight: string;
  borderDark: string;
  
  // Shadows
  shadow: string;
};

type ThemeKey = 'dominionBold' | 'ironSteel' | 'overlordInferno' | 'adaptiveProgression';

// Helper function to lighten a color
const lighten = (color: string, amount: number): string => {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + amount);
  const b = Math.min(255, (num & 0x0000FF) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

// Helper function to darken a color
const darken = (color: string, amount: number): string => {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
  const b = Math.max(0, (num & 0x0000FF) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

// Helper function to add opacity
const withOpacity = (color: string, opacity: number): string => {
  const num = parseInt(color.replace('#', ''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const createTheme = (
  primary: string,
  secondary: string,
  background: string,
  accent: string,
  textOnBackground: string,
  card: string
): ThemeType => {
  const isDark = background === '#1C1C1C' || background === '#2E2E2E' || background === '#2A2A2A' || background === '#3D3D3D';
  
  return {
    primary,
    primaryLight: lighten(primary, 30),
    primaryDark: darken(primary, 30),
    primaryFaded: withOpacity(primary, 0.15),
    
    secondary,
    secondaryLight: lighten(secondary, 30),
    secondaryDark: darken(secondary, 30),
    secondaryFaded: withOpacity(secondary, 0.15),
    
    background,
    backgroundDark: isDark ? darken(background, 20) : lighten(background, -20),
    backgroundLight: isDark ? lighten(background, 20) : lighten(background, 20),
    
    card,
    cardElevated: isDark ? lighten(card, 10) : darken(card, 5),
    
    accent,
    accentLight: isDark ? lighten(accent, 30) : darken(accent, 30),
    accentMuted: withOpacity(accent, 0.6),
    accentFaded: withOpacity(accent, 0.1),
    
    textPrimary: textOnBackground,
    textSecondary: withOpacity(textOnBackground, 0.7),
    textMuted: withOpacity(textOnBackground, 0.5),
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#FFFFFF',
    
    success: primary,
    warning: '#CC7000',
    error: '#B22222',
    info: secondary,
    
    progressionRule3: primary,
    progressionFallback: '#CC7000',
    progressionReduction: '#B22222',
    progressionDeload: '#666666',
    progressionSafeguard: '#CC7000',
    
    readinessHigh: primary,
    readinessMedium: '#CC7000',
    readinessLow: '#B22222',
    
    border: isDark ? withOpacity(accent, 0.3) : withOpacity(accent, 0.2),
    borderLight: isDark ? withOpacity(accent, 0.2) : withOpacity(accent, 0.1),
    borderDark: isDark ? withOpacity(accent, 0.5) : withOpacity(accent, 0.4),
    
    shadow: '#000000',
  };
};

// Theme definitions
const THEMES: Record<ThemeKey, ThemeType> = {
  dominionBold: createTheme(
    '#B22222',      // Crimson red
    '#FFD700',      // Gold
    '#1C1C1C',      // Charcoal black
    '#FFFFFF',      // White
    '#FFFFFF',      // White text
    '#2A2A2A'       // Dark card
  ),
  ironSteel: createTheme(
    '#2F4F4F',      // Gunmetal gray
    '#1E90FF',      // Electric blue
    '#F5F5F5',      // Off-white
    '#000000',      // Black
    '#000000',      // Black text
    '#FFFFFF'       // White card
  ),
  overlordInferno: createTheme(
    '#FF4500',      // Fiery orange
    '#4B0082',      // Deep purple
    '#2E2E2E',      // Dark slate
    '#C0C0C0',      // Silver
    '#FFFFFF',      // White text
    '#3D3D3D'       // Dark card
  ),
  adaptiveProgression: createTheme(
    '#228B22',      // Emerald green
    '#000080',      // Navy blue
    '#E0E0E0',      // Light gray
    '#111111',      // Black
    '#111111',      // Black text
    '#FFFFFF'       // White card
  ),
};

export const getTheme = (key: ThemeKey): ThemeType => {
  return THEMES[key] || THEMES.adaptiveProgression;
};

// Export default theme (Adaptive Progression)
export const THEME = THEMES.adaptiveProgression;

