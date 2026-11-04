import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME as DEFAULT_THEME, getTheme, type ThemeType } from './themeDefinitions';
import { updateTheme } from './colors';

const THEME_STORAGE_KEY = 'selectedTheme';

type ThemeKey = 'dominionBold' | 'ironSteel' | 'overlordInferno' | 'adaptiveProgression';

interface ThemeContextType {
  theme: ThemeType;
  themeKey: ThemeKey;
  setTheme: (key: ThemeKey) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeKey, setThemeKey] = useState<ThemeKey>('adaptiveProgression');
  const [theme, setThemeState] = useState<ThemeType>(DEFAULT_THEME);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (__DEV__) {
        console.log('[ThemeProvider] Loading theme from storage:', savedTheme);
      }
      if (savedTheme && (savedTheme === 'dominionBold' || savedTheme === 'ironSteel' || savedTheme === 'overlordInferno' || savedTheme === 'adaptiveProgression')) {
        const selectedKey = savedTheme as ThemeKey;
        if (__DEV__) {
          console.log('[ThemeProvider] Setting theme to:', selectedKey);
        }
        setThemeKey(selectedKey);
        const loadedTheme = getTheme(selectedKey);
        setThemeState(loadedTheme);
        // Update the static THEME export so all components use the new theme
        updateTheme(loadedTheme);
        if (__DEV__) {
          console.log('[ThemeProvider] Theme loaded successfully:', {
            key: selectedKey,
            primary: loadedTheme.primary,
            background: loadedTheme.background,
          });
        }
      } else {
        if (__DEV__) {
          console.log('[ThemeProvider] No saved theme found, using default');
        }
        setThemeState(DEFAULT_THEME);
        // Update static THEME to default
        updateTheme(DEFAULT_THEME);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[ThemeProvider] Error loading theme:', error);
      }
      setThemeState(DEFAULT_THEME);
    }
  };

  useEffect(() => {
    loadTheme();
  }, []);

  const setTheme = async (key: ThemeKey) => {
    try {
      if (__DEV__) {
        console.log('[ThemeProvider] Saving theme:', key);
      }
      await AsyncStorage.setItem(THEME_STORAGE_KEY, key);
      const newTheme = getTheme(key);
      setThemeKey(key);
      setThemeState(newTheme);
      // Update the static THEME export so all components use the new theme
      updateTheme(newTheme);
      if (__DEV__) {
        console.log('[ThemeProvider] Theme saved successfully:', {
          key,
          primary: newTheme.primary,
          background: newTheme.background,
        });
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[ThemeProvider] Error saving theme:', error);
      }
      throw error;
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, themeKey, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

