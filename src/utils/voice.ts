import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Voice/TTS utility functions
 * Provides text-to-speech cues for timer events
 */

const VOICE_SETTINGS_KEY = 'voiceAlertsEnabled';

// Voice settings state (shared with sounds - one toggle controls both)
let voiceEnabled = true;

// Load voice settings (shared with sound settings)
export const loadVoiceSettings = async (): Promise<boolean> => {
  try {
    // Voice and sounds share the same setting
    const stored = await AsyncStorage.getItem('soundAlertsEnabled');
    if (stored !== null) {
      voiceEnabled = JSON.parse(stored);
    } else {
      // Default to enabled
      voiceEnabled = true;
    }
  } catch (error) {
    console.error('Error loading voice settings:', error);
    voiceEnabled = true; // Default to enabled on error
  }
  return voiceEnabled;
};

// Get current voice settings
export const getVoiceEnabled = (): boolean => voiceEnabled;

// Update voice enabled state (synced with sound settings)
export const setVoiceEnabled = (enabled: boolean): void => {
  voiceEnabled = enabled;
};

/**
 * Speak text using TTS
 */
const speak = async (text: string, options?: { rate?: number; pitch?: number }): Promise<void> => {
  if (!voiceEnabled) return;
  
  try {
    // Stop any currently speaking text
    Speech.stop();
    
    await Speech.speak(text, {
      language: 'en-US',
      pitch: options?.pitch || 1.0,
      rate: options?.rate || 0.9, // Slightly slower for clarity
    });
  } catch (error) {
    // Silently fail if TTS unavailable
    if (__DEV__) {
      console.log('TTS error:', error);
    }
  }
};

/**
 * Speak work label (e.g., "Go", "Start", "Sprint")
 */
export const speakWorkStart = async (workLabel: string = 'Go'): Promise<void> => {
  const label = workLabel.trim() || 'Go';
  await speak(label, { rate: 0.85, pitch: 1.1 }); // Slightly faster, higher pitch for urgency
};

/**
 * Speak rest label (e.g., "Stop", "Rest", "Jog", "Walk")
 */
export const speakRestStart = async (restLabel: string = 'Rest'): Promise<void> => {
  // Normalize the rest label
  const label = restLabel.trim() || 'Rest';
  await speak(label, { rate: 0.9, pitch: 1.0 });
};

/**
 * Speak "Complete" or "Finished"
 */
export const speakComplete = async (): Promise<void> => {
  await speak('Complete', { rate: 0.85, pitch: 1.05 });
};

/**
 * Speak "Rest complete"
 */
export const speakRestComplete = async (): Promise<void> => {
  await speak('Rest complete', { rate: 0.9, pitch: 1.0 });
};

/**
 * Speak countdown (3-2-1-workLabel)
 */
export const speakCountdown = async (workLabel: string = 'Go', onComplete?: () => void): Promise<void> => {
  if (!voiceEnabled) {
    onComplete?.();
    return;
  }
  
  try {
    // Speak countdown with delays
    await speak('3', { rate: 0.8, pitch: 1.0 });
    await new Promise(resolve => setTimeout(resolve, 800));
    
    await speak('2', { rate: 0.8, pitch: 1.0 });
    await new Promise(resolve => setTimeout(resolve, 800));
    
    await speak('1', { rate: 0.8, pitch: 1.0 });
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const label = workLabel.trim() || 'Go';
    await speak(label, { rate: 0.85, pitch: 1.2 }); // Higher pitch for work label
    onComplete?.();
  } catch (error) {
    // If TTS fails, still call onComplete
    onComplete?.();
  }
};

/**
 * Stop any currently speaking text
 */
export const stopSpeaking = (): void => {
  try {
    Speech.stop();
  } catch (error) {
    // Silently fail
  }
};

