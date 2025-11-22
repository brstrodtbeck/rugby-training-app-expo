import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import My1RMs from '../screens/My1RMs';
import { NavigationContainer } from '@react-navigation/native';

// Mock AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
}));

describe('My1RMs session-aware linking', () => {
  it('calls onUpdate1RM when a new 1RM is calculated', async () => {
    const mockCallback = jest.fn();

    // Render My1RMs with route params
    const { getByPlaceholderText, getByText } = render(
      <NavigationContainer>
        <My1RMs
          route={{ params: { onUpdate1RM: mockCallback } } as any}
          navigation={{ navigate: jest.fn() } as any}
        />
      </NavigationContainer>
    );

    // Fill in inputs
    fireEvent.changeText(getByPlaceholderText('Weight lifted'), '200');
    fireEvent.changeText(getByPlaceholderText('Reps performed'), '5');

    // Press calculate
    fireEvent.press(getByText('Calculate 1RM'));

    // Assert callback was called with correct values
    expect(mockCallback).toHaveBeenCalledWith('Back Squat', expect.any(Number));
  });
});