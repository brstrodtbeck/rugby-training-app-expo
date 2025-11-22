import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import AppNavigator from './src/navigation/AppNavigator'; // adjust path if needed

export default function App() {
  return (
    <PaperProvider>
      <NavigationContainer>
        <AppNavigator />
        <Toast />
      </NavigationContainer>
    </PaperProvider>
  );
}