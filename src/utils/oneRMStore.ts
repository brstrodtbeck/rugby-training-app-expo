// utils/oneRMStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'exerciseOneRMs';

// Save or update 1RM for a given exercise
export async function setOneRM(exerciseName: string, oneRM: number) {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const oneRMs = stored ? JSON.parse(stored) : {};
    oneRMs[exerciseName] = oneRM;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(oneRMs));
  } catch (error) {
    console.error('Error saving 1RM:', error);
  }
}

// Get 1RM for a given exercise
export async function getOneRM(exerciseName: string): Promise<number | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const oneRMs = JSON.parse(stored);
    return oneRMs[exerciseName] ?? null;
  } catch (error) {
    console.error('Error loading 1RM:', error);
    return null;
  }
}

// Get all stored 1RMs
export async function getAllOneRMs(): Promise<Record<string, number>> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error loading all 1RMs:', error);
    return {};
  }
}