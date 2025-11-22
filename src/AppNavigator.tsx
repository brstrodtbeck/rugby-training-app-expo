import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import HomeScreen from '../screens/HomeScreen';
import SessionSummary from '../screens/SessionSummary';
import BaselineSetup from '../screens/BaselineSetup';
import My1RMs from '../screens/My1RMs';

export type RootStackParamList = {
  Home: undefined;
  SessionSummary: { mesoId: string; weekNum: number; dayNum: number };
  BaselineSetup: { exerciseName?: string };
  My1RMs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="BaselineSetup">
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Home' }}
        />
        <Stack.Screen
          name="SessionSummary"
          component={SessionSummary}
          options={{ title: 'Session Summary' }}
        />
        <Stack.Screen
          name="BaselineSetup"
          component={BaselineSetup}
          options={{ title: 'Baseline 1RM Setup' }}
        />
        <Stack.Screen
          name="My1RMs"
          component={My1RMs}
          options={{ title: 'My 1RMs' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;