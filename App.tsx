import React, { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import AppNavigator from './src/navigation/AppNavigator'; // adjust path if needed
import { ThemeProvider } from './src/theme/ThemeContext';
import { initAnalytics } from './src/utils/analytics';
import { loadFastTimersFromStorage } from './src/utils/e2eFastTimers';
import { ensureAnonymousAuth } from './src/config/firebase';
import { backupToCloudIfNeeded } from './src/storage/cloudBackup';

export default function App() {
  useEffect(() => {
    loadFastTimersFromStorage();
  }, []);

  // Initialize analytics on app start (safe - won't break if Firebase not configured)
  useEffect(() => {
    initAnalytics().catch(() => {
      // Silently fail - analytics is optional
    });
  }, []);

  // Cloud backup: ensure anonymous auth ready; on app background, trigger backup
  useEffect(() => {
    ensureAnonymousAuth().catch(() => {});
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background') {
        backupToCloudIfNeeded().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider>
      <PaperProvider>
        <NavigationContainer>
          <AppNavigator />
          <Toast />
        </NavigationContainer>
      </PaperProvider>
    </ThemeProvider>
  );
}