import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import BaselineSetupScreen from '../screens/BaselineSetupScreen';
import My1RMs from '../screens/My1RMs';
import OneRMHistory from '../screens/OneRMHistory';   // <-- file is 1RMHistory.tsx
import SessionScreen from '../screens/SessionScreen';
import SessionSummaryScreen from '../screens/SessionSummary';
import TestValidationScreen from '../screens/TestValidationScreen';
import ThemeMockups from '../screens/ThemeMockups';
import OnboardingScreen from '../screens/OnboardingScreen';
import HelpScreen from '../screens/HelpScreen';
import { useTheme } from '../theme/ThemeContext';

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  BaselineSetup: undefined;
  My1RMs: {
    onUpdate1RM?: (exerciseName: string, newValue: number) => void;
    isOnboarding?: boolean;
    onContinue?: () => void;
  } | undefined;
  '1RMHistory': { exerciseName: string };
  Session: { sessionId: string };
  SessionSummary: { sessionId: string; completed: number[] };
  TestValidation: undefined;
  ThemeMockups: undefined;
  Help: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const ONBOARDING_COMPLETE_KEY = 'onboardingComplete';

export default function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState<'Onboarding' | 'Home'>('Onboarding');
  const { theme } = useTheme();

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const onboardingComplete = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        setInitialRoute(onboardingComplete === 'true' ? 'Home' : 'Onboarding');
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setInitialRoute('Onboarding');
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboarding();
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator 
      initialRouteName={initialRoute}
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.card,
        },
        headerTintColor: theme.textPrimary,
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <Stack.Screen
        name="BaselineSetup"
        component={BaselineSetupScreen}
        options={{ title: 'Baseline Setup' }}
      />
      <Stack.Screen
        name="My1RMs"
        component={My1RMs}
        options={{ title: 'My 1RMs' }}
      />
      <Stack.Screen
        name="1RMHistory"
        component={OneRMHistory}
        options={({ route }) => ({
          title: `${route.params.exerciseName} History`,
        })}
      />
      <Stack.Screen
        name="Session"
        component={SessionScreen}
        options={{ 
          title: 'Training Session',
          headerBackButtonMenuEnabled: false,
        }}
      />
      <Stack.Screen
        name="SessionSummary"
        component={SessionSummaryScreen}
        options={{ title: 'Session Summary' }}
      />
      <Stack.Screen
        name="TestValidation"
        component={TestValidationScreen}
        options={{ title: 'Progression Test' }}
      />
      <Stack.Screen
        name="ThemeMockups"
        component={ThemeMockups}
        options={{ title: 'Theme Mockups', headerShown: false }}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{ title: 'Help & Instructions' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});