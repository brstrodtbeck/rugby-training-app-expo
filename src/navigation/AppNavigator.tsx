import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import BaselineSetupScreen from '../screens/BaselineSetupScreen';
import My1RMs from '../screens/My1RMs';
import OneRMHistory from '../screens/OneRMHistory';   // <-- file is 1RMHistory.tsx
import SessionScreen from '../screens/SessionScreen';
import SessionSummaryScreen from '../screens/SessionSummary';

export type RootStackParamList = {
  Home: undefined;
  BaselineSetup: undefined;
  My1RMs: {
    onUpdate1RM?: (exerciseName: string, newValue: number) => void;
  } | undefined;
  '1RMHistory': { exerciseName: string };
  Session: { sessionId: string };
  SessionSummary: { sessionId: string; completed: number[] };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Home">
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
        name="OneRMHistory"
        component={OneRMHistory}
        options={({ route }) => ({
          title: `${route.params.exerciseName} History`,
        })}
      />
      <Stack.Screen
        name="Session"
        component={SessionScreen}
        options={{ title: 'Training Session' }}
      />
      <Stack.Screen
        name="SessionSummary"
        component={SessionSummaryScreen}
        options={{ title: 'Session Summary' }}
      />
    </Stack.Navigator>
  );
}