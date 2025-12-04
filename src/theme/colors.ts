/**
 * Progressive Overlord - Adaptive Progression Theme
 * Trainer-Friendly color palette with professional appearance
 */

export const THEME = {
  // Primary: Emerald Green - Used for main actions, titles, success states
  primary: '#228B22',
  primaryLight: '#2ea82e',
  primaryDark: '#1a6b1a',
  primaryFaded: 'rgba(34, 139, 34, 0.15)',
  
  // Secondary: Navy Blue - Used for accents, links, secondary actions
  secondary: '#000080',
  secondaryLight: '#1a1a99',
  secondaryDark: '#000066',
  secondaryFaded: 'rgba(0, 0, 128, 0.15)',
  
  // Background: Light Gray - Main background color
  background: '#E0E0E0',
  backgroundDark: '#C8C8C8',
  backgroundLight: '#F0F0F0',
  
  // Card backgrounds
  card: '#FFFFFF',
  cardElevated: '#F8F8F8',
  
  // Accent: Black - Used for text and borders
  accent: '#111111',
  accentLight: '#333333',
  accentMuted: '#666666',
  accentFaded: 'rgba(17, 17, 17, 0.1)',
  
  // Text colors
  textPrimary: '#111111',
  textSecondary: '#444444',
  textMuted: '#777777',
  textOnPrimary: '#FFFFFF',
  textOnSecondary: '#FFFFFF',
  
  // Semantic colors
  success: '#228B22',      // Same as primary (green)
  warning: '#CC7000',      // Orange-amber for warnings
  error: '#B22222',        // Red for errors
  info: '#000080',         // Same as secondary (navy)
  
  // Progression indicators
  progressionRule3: '#228B22',    // Green - Rule of 3 met
  progressionFallback: '#CC7000', // Orange - Fallback triggered
  progressionReduction: '#B22222', // Red - Reduction
  progressionDeload: '#666666',   // Gray - Deload
  progressionSafeguard: '#CC7000', // Orange - Safeguard active
  
  // Readiness colors
  readinessHigh: '#228B22',    // 8-10
  readinessMedium: '#CC7000',  // 4-7
  readinessLow: '#B22222',     // 1-3
  
  // Borders
  border: '#C0C0C0',
  borderLight: '#D8D8D8',
  borderDark: '#999999',
  
  // Shadows (for elevation)
  shadow: '#000000',
};

// Common style patterns
export const SHADOWS = {
  small: {
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  large: {
    shadowColor: THEME.shadow,
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

