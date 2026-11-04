import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Sound feedback utility functions
 * Provides race-like beep sounds for timer events
 * 
 * Note: Currently uses placeholder implementation.
 * For production, replace with actual audio files or a tone generation library.
 */

const SOUND_SETTINGS_KEY = 'soundAlertsEnabled';

// Sound settings state
let soundsEnabled = true;

// Load sound settings
export const loadSoundSettings = async (): Promise<boolean> => {
  try {
    const stored = await AsyncStorage.getItem(SOUND_SETTINGS_KEY);
    if (stored !== null) {
      soundsEnabled = JSON.parse(stored);
    } else {
      // Default to enabled
      soundsEnabled = true;
      await AsyncStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(true));
    }
  } catch (error) {
    console.error('Error loading sound settings:', error);
    soundsEnabled = true; // Default to enabled on error
  }
  return soundsEnabled;
};

// Save sound settings
export const saveSoundSettings = async (enabled: boolean): Promise<void> => {
  try {
    soundsEnabled = enabled;
    await AsyncStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(enabled));
  } catch (error) {
    console.error('Error saving sound settings:', error);
  }
};

// Get current sound settings
export const getSoundEnabled = (): boolean => soundsEnabled;

// Initialize audio mode
let audioInitialized = false;
const initializeAudio = async (): Promise<void> => {
  if (audioInitialized) return;
  
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false, // Respect silent mode
      staysActiveInBackground: false,
      shouldDuckAndroid: true, // Lower other audio on Android
    });
    audioInitialized = true;
  } catch (error) {
    if (__DEV__) {
      console.log('Audio initialization error:', error);
    }
  }
};

/**
 * Play a simple beep sound
 * 
 * Note: This is a placeholder implementation.
 * For production, replace with actual audio files or use a tone generation library.
 * The sounds will respect system media volume automatically.
 */
const playBeep = async (frequency: number, duration: number, volume: number = 0.5): Promise<void> => {
  if (!soundsEnabled) return;
  
  try {
    await initializeAudio();
    
    // Placeholder: In production, you would:
    // 1. Load an audio file (e.g., from assets)
    // 2. Use Audio.Sound.createAsync() to create sound object
    // 3. Play it with sound.playAsync()
    // 4. Or use a library like react-native-sound or expo-av with audio files
    
    // For now, this is a no-op that can be enhanced later
    // The TTS voice cues will still work, providing audio feedback
    if (__DEV__) {
      console.log(`[Sound] Beep: ${frequency}Hz for ${duration}s at ${volume} volume`);
    }
  } catch (error) {
    // Silently fail if audio unavailable
    if (__DEV__) {
      console.log('Audio playback error:', error);
    }
  }
};

/**
 * Play a timer start sound (short, positive beep)
 */
export const playTimerStart = async (): Promise<void> => {
  await playBeep(800, 0.1, 0.6);
};

/**
 * Play a timer stop/rest sound (distinct from start)
 */
export const playTimerStop = async (): Promise<void> => {
  await playBeep(600, 0.15, 0.6);
};

/**
 * Play a timer pause sound (subtle click)
 */
export const playTimerPause = async (): Promise<void> => {
  await playBeep(400, 0.05, 0.4);
};

/**
 * Play a timer complete sound (celebration - multiple beeps)
 */
export const playTimerComplete = async (): Promise<void> => {
  if (!soundsEnabled) return;
  try {
    // Play a sequence: high-low-high (celebration pattern)
    await playBeep(800, 0.1, 0.6);
    await new Promise(resolve => setTimeout(resolve, 100));
    await playBeep(600, 0.1, 0.6);
    await new Promise(resolve => setTimeout(resolve, 100));
    await playBeep(800, 0.15, 0.7);
  } catch (error) {
    // Silently fail if audio unavailable
  }
};

/**
 * Play a rest timer complete sound
 */
export const playRestComplete = async (): Promise<void> => {
  await playBeep(650, 0.2, 0.6);
};

/**
 * Play countdown beeps (3-2-1)
 */
export const playCountdownBeep = async (): Promise<void> => {
  await playBeep(700, 0.08, 0.5);
};

/**
 * Play countdown sequence (beep-beep-beep-go)
 * Returns a promise that resolves when countdown completes
 */
export const playCountdownSequence = async (onComplete?: () => void): Promise<void> => {
  if (!soundsEnabled) {
    onComplete?.();
    return;
  }
  
  try {
    // Play 3 beeps with delays
    for (let i = 0; i < 3; i++) {
      await playCountdownBeep();
      await new Promise(resolve => setTimeout(resolve, 700)); // 700ms between beeps
    }
    // Final "go" beep (slightly longer)
    await playBeep(800, 0.15, 0.7);
    onComplete?.();
  } catch (error) {
    // If audio fails, still call onComplete
    onComplete?.();
  }
};
