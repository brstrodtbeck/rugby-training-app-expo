import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME } from '../theme/colors';

// Storage key for alert settings
const ALERT_SETTINGS_KEY = 'intervalTimerAlerts';

export interface IntervalTimerProps {
  /** Number of work intervals/sets */
  totalSets: number;
  /** Work interval duration in seconds */
  workDuration: number;
  /** Rest interval duration in seconds */
  restDuration: number;
  /** Exercise name for display */
  exerciseName: string;
  /** Optional instruction text */
  instruction?: string;
  /** Custom label for rest phase (e.g., "Jog", "Walk", "Easy Spin") - defaults to "REST" */
  restLabel?: string;
  /** Callback when all intervals complete */
  onComplete?: () => void;
  /** Callback when a set completes */
  onSetComplete?: (setNumber: number) => void;
}

type TimerPhase = 'idle' | 'work' | 'rest' | 'complete';

interface TimerState {
  phase: TimerPhase;
  currentRound: number;
  timeRemaining: number;
  isRunning: boolean;
  isPaused: boolean;
}

/**
 * IntervalTimer component for conditioning and cardio exercises
 * Tracks work/rest phases, rounds, and provides vibration alerts
 */
export default function IntervalTimer({
  totalSets,
  workDuration,
  restDuration,
  exerciseName,
  instruction,
  restLabel = 'REST',
  onComplete,
  onSetComplete,
}: IntervalTimerProps): JSX.Element {
  const [state, setState] = useState<TimerState>({
    phase: 'idle',
    currentRound: 1,
    timeRemaining: workDuration,
    isRunning: false,
    isPaused: false,
  });

  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load alert settings from storage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem(ALERT_SETTINGS_KEY);
        if (stored !== null) {
          setAlertsEnabled(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Error loading alert settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Save alert settings
  const toggleAlerts = async () => {
    const newValue = !alertsEnabled;
    setAlertsEnabled(newValue);
    try {
      await AsyncStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(newValue));
    } catch (error) {
      console.error('Error saving alert settings:', error);
    }
  };

  // Trigger vibration alert
  const triggerAlert = useCallback((pattern: 'work' | 'rest' | 'complete') => {
    if (!alertsEnabled) return;

    // Different vibration patterns for different phases
    const patterns: Record<string, number | number[]> = {
      work: Platform.OS === 'ios' ? 100 : [0, 200, 100, 200], // Double pulse for work
      rest: Platform.OS === 'ios' ? 50 : [0, 100], // Single short for rest
      complete: Platform.OS === 'ios' ? 300 : [0, 300, 100, 300, 100, 300], // Triple long for complete
    };

    try {
      Vibration.vibrate(patterns[pattern]);
    } catch (error) {
      console.log('Vibration not available:', error);
    }
  }, [alertsEnabled]);

  // Timer logic
  useEffect(() => {
    if (state.isRunning && !state.isPaused && state.phase !== 'idle' && state.phase !== 'complete') {
      intervalRef.current = setInterval(() => {
        setState(prev => {
          if (prev.timeRemaining <= 1) {
            // Time's up for current phase
            if (prev.phase === 'work') {
              // Work phase complete
              onSetComplete?.(prev.currentRound);
              
              if (prev.currentRound >= totalSets) {
                // All rounds complete
                triggerAlert('complete');
                onComplete?.();
                return {
                  ...prev,
                  phase: 'complete',
                  timeRemaining: 0,
                  isRunning: false,
                };
              } else {
                // Move to rest phase
                triggerAlert('rest');
                return {
                  ...prev,
                  phase: 'rest',
                  timeRemaining: restDuration,
                };
              }
            } else if (prev.phase === 'rest') {
              // Rest phase complete, start next work phase
              triggerAlert('work');
              return {
                ...prev,
                phase: 'work',
                currentRound: prev.currentRound + 1,
                timeRemaining: workDuration,
              };
            }
          }
          return {
            ...prev,
            timeRemaining: prev.timeRemaining - 1,
          };
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state.isRunning, state.isPaused, state.phase, totalSets, workDuration, restDuration, triggerAlert, onComplete, onSetComplete]);

  // Start the timer
  const handleStart = () => {
    triggerAlert('work');
    setState({
      phase: 'work',
      currentRound: 1,
      timeRemaining: workDuration,
      isRunning: true,
      isPaused: false,
    });
  };

  // Pause/Resume
  const handlePauseResume = () => {
    setState(prev => ({
      ...prev,
      isPaused: !prev.isPaused,
    }));
  };

  // Reset timer
  const handleReset = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setState({
      phase: 'idle',
      currentRound: 1,
      timeRemaining: workDuration,
      isRunning: false,
      isPaused: false,
    });
  };

  // Skip to next phase
  const handleSkip = () => {
    setState(prev => {
      if (prev.phase === 'work') {
        onSetComplete?.(prev.currentRound);
        if (prev.currentRound >= totalSets) {
          triggerAlert('complete');
          onComplete?.();
          return {
            ...prev,
            phase: 'complete',
            timeRemaining: 0,
            isRunning: false,
          };
        }
        triggerAlert('rest');
        return {
          ...prev,
          phase: 'rest',
          timeRemaining: restDuration,
        };
      } else if (prev.phase === 'rest') {
        triggerAlert('work');
        return {
          ...prev,
          phase: 'work',
          currentRound: prev.currentRound + 1,
          timeRemaining: workDuration,
        };
      }
      return prev;
    });
  };

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get appropriate emoji for rest activity
  const getRestEmoji = (label: string): string => {
    const lower = label.toLowerCase();
    if (lower.includes('jog')) return '🏃‍♂️';
    if (lower.includes('walk')) return '🚶';
    if (lower.includes('spin') || lower.includes('bike') || lower.includes('cycle')) return '🚴';
    if (lower.includes('row')) return '🚣';
    if (lower.includes('swim')) return '🏊';
    if (lower.includes('easy') || lower.includes('light')) return '😌';
    return '😮‍💨';
  };

  // Get phase display info
  const getPhaseInfo = (): { label: string; color: string } => {
    switch (state.phase) {
      case 'work':
        return { label: '🏃 WORK', color: THEME.error };
      case 'rest':
        return { label: `${getRestEmoji(restLabel)} ${restLabel.toUpperCase()}`, color: THEME.primary };
      case 'complete':
        return { label: '🎉 COMPLETE', color: THEME.secondary };
      default:
        return { label: '⏱️ READY', color: THEME.textMuted };
    }
  };

  const phaseInfo = getPhaseInfo();
  const progress = state.phase === 'work' 
    ? (workDuration - state.timeRemaining) / workDuration 
    : state.phase === 'rest' 
      ? (restDuration - state.timeRemaining) / restDuration 
      : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.exerciseName}>{exerciseName}</Text>
        <TouchableOpacity onPress={toggleAlerts} style={styles.alertToggle}>
          <Text style={styles.alertToggleText}>
            {alertsEnabled ? '🔔' : '🔕'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Instruction */}
      {instruction && state.phase === 'idle' && (
        <Text style={styles.instruction}>💡 {instruction}</Text>
      )}

      {/* Phase indicator */}
      <View style={[styles.phaseContainer, { backgroundColor: phaseInfo.color + '20' }]}>
        <Text style={[styles.phaseLabel, { color: phaseInfo.color }]}>
          {phaseInfo.label}
        </Text>
        {state.phase !== 'idle' && state.phase !== 'complete' && (
          <Text style={styles.roundIndicator}>
            Round {state.currentRound} of {totalSets}
          </Text>
        )}
      </View>

      {/* Timer display */}
      <View style={styles.timerDisplay}>
        <Text style={[styles.timerText, { color: phaseInfo.color }]}>
          {state.phase === 'idle' 
            ? formatTime(workDuration) 
            : state.phase === 'complete'
              ? '0:00'
              : formatTime(state.timeRemaining)}
        </Text>
        {state.isPaused && (
          <Text style={styles.pausedText}>PAUSED</Text>
        )}
      </View>

      {/* Progress bar */}
      {(state.phase === 'work' || state.phase === 'rest') && (
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar, 
              { 
                width: `${progress * 100}%`,
                backgroundColor: phaseInfo.color,
              }
            ]} 
          />
        </View>
      )}

      {/* Set summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Work</Text>
          <Text style={styles.summaryValue}>{formatTime(workDuration)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{restLabel}</Text>
          <Text style={styles.summaryValue}>{formatTime(restDuration)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Sets</Text>
          <Text style={styles.summaryValue}>{totalSets}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {state.phase === 'idle' ? (
          <TouchableOpacity 
            style={[styles.button, styles.startButton]} 
            onPress={handleStart}
          >
            <Text style={styles.buttonText}>▶️ Start Intervals</Text>
          </TouchableOpacity>
        ) : state.phase === 'complete' ? (
          <TouchableOpacity 
            style={[styles.button, styles.resetButton]} 
            onPress={handleReset}
          >
            <Text style={styles.buttonText}>🔄 Reset</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.controlRow}>
            <TouchableOpacity 
              style={[styles.button, styles.controlButton]} 
              onPress={handlePauseResume}
            >
              <Text style={styles.buttonText}>
                {state.isPaused ? '▶️ Resume' : '⏸️ Pause'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.controlButton, styles.skipButton]} 
              onPress={handleSkip}
            >
              <Text style={styles.buttonText}>⏭️ Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.controlButton, styles.resetButtonSmall]} 
              onPress={handleReset}
            >
              <Text style={styles.buttonText}>🔄</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Complete message */}
      {state.phase === 'complete' && (
        <View style={styles.completeMessage}>
          <Text style={styles.completeText}>
            🏆 All {totalSets} rounds complete!
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.primary,
    flex: 1,
  },
  alertToggle: {
    padding: 8,
  },
  alertToggleText: {
    fontSize: 20,
  },
  instruction: {
    fontSize: 13,
    color: THEME.secondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  phaseContainer: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  phaseLabel: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  roundIndicator: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginTop: 4,
  },
  timerDisplay: {
    alignItems: 'center',
    marginBottom: 12,
  },
  timerText: {
    fontSize: 64,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
  },
  pausedText: {
    fontSize: 14,
    color: THEME.warning,
    fontWeight: '600',
    marginTop: 4,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: THEME.backgroundDark,
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 8,
    backgroundColor: THEME.backgroundLight,
    borderRadius: 8,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginTop: 2,
  },
  controls: {
    marginTop: 8,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {
    backgroundColor: THEME.primary,
  },
  controlButton: {
    backgroundColor: THEME.secondary,
    flex: 1,
  },
  skipButton: {
    backgroundColor: THEME.warning,
  },
  resetButton: {
    backgroundColor: THEME.secondary,
  },
  resetButtonSmall: {
    backgroundColor: THEME.accentMuted,
    flex: 0,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: THEME.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  completeMessage: {
    marginTop: 12,
    padding: 12,
    backgroundColor: THEME.primaryFaded,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.primary,
  },
});

