import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import { spacing, typography, FONTS } from '../theme/colors';
import { triggerHaptic } from '../utils/haptics';
import {
  loadSoundSettings,
  saveSoundSettings,
  getSoundEnabled,
  playTimerStart,
  playTimerStop,
  playTimerComplete,
  playCountdownSequence,
} from '../utils/sounds';
import {
  loadVoiceSettings,
  setVoiceEnabled,
  speakWorkStart,
  speakRestStart,
  speakComplete,
  speakRestComplete,
  speakCountdown,
  stopSpeaking,
} from '../utils/voice';
import { analytics } from '../utils/analytics';
import { getTickIntervalMs, getTickDecrement } from '../utils/e2eFastTimers';

// Storage key for alert settings (shared with sounds/voice)
const ALERT_SETTINGS_KEY = 'soundAlertsEnabled';

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
  /** Custom label for work phase (e.g., "Go", "Sprint", "Start") - defaults to "Go" */
  workLabel?: string;
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
  workLabel = 'Go',
  restLabel = 'REST',
  onComplete,
  onSetComplete,
}: IntervalTimerProps): React.ReactElement {
  const [state, setState] = useState<TimerState>({
    phase: 'idle',
    currentRound: 1,
    timeRemaining: workDuration,
    isRunning: false,
    isPaused: false,
  });

  const { theme } = useTheme();
  const styles = useThemedStyles((t) => ({
    container: {
      backgroundColor: t.card,
      borderRadius: spacing.md,
      padding: spacing.base,
      marginVertical: spacing.sm,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    exerciseName: {
      fontSize: typography.fontSize.md,
      fontWeight: FONTS.bold,
      color: t.primary,
      flex: 1,
    },
    alertToggle: {
      padding: spacing.sm,
    },
    alertToggleText: {
      fontSize: typography.fontSize.lg,
      color: t.textPrimary,
    },
    instruction: {
      fontSize: typography.fontSize.sm,
      color: t.secondary,
      marginBottom: spacing.md,
      lineHeight: 18,
    },
    phaseContainer: {
      borderRadius: spacing.sm,
      padding: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    phaseLabel: {
      fontSize: typography.fontSize.lg,
      fontWeight: FONTS.extrabold,
      letterSpacing: 1,
    },
    roundIndicator: {
      fontSize: typography.fontSize.body,
      color: t.textSecondary,
      marginTop: spacing.xxs,
    },
    timerDisplay: {
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    timerText: {
      fontSize: typography.fontSize.display,
      fontWeight: '200',
      fontVariant: ['tabular-nums'],
    },
    pausedText: {
      fontSize: typography.fontSize.body,
      color: t.warning,
      fontWeight: FONTS.semibold,
      marginTop: spacing.xxs,
    },
    progressBarContainer: {
      height: 6,
      backgroundColor: t.backgroundDark,
      borderRadius: 3,
      marginBottom: spacing.base,
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      borderRadius: 3,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: spacing.base,
      paddingVertical: spacing.sm,
      backgroundColor: t.backgroundLight,
      borderRadius: spacing.sm,
    },
    summaryItem: {
      alignItems: 'center',
    },
    summaryLabel: {
      fontSize: typography.fontSize.caption,
      color: t.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    summaryValue: {
      fontSize: typography.fontSize.base,
      fontWeight: FONTS.semibold,
      color: t.textPrimary,
      marginTop: 2,
    },
    controls: {
      marginTop: spacing.sm,
    },
    controlRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    button: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    startButton: {
      backgroundColor: t.primary,
    },
    controlButton: {
      backgroundColor: t.secondary,
      flex: 1,
    },
    skipButton: {
      backgroundColor: t.warning,
    },
    resetButton: {
      backgroundColor: t.secondary,
    },
    resetButtonSmall: {
      backgroundColor: t.accentMuted,
      flex: 0,
      paddingHorizontal: spacing.base,
    },
    buttonText: {
      color: t.textOnPrimary,
      fontSize: typography.fontSize.body,
      fontWeight: FONTS.semibold,
    },
    completeMessage: {
      marginTop: spacing.md,
      padding: spacing.md,
      backgroundColor: t.primaryFaded,
      borderRadius: spacing.sm,
      alignItems: 'center',
    },
    completeText: {
      fontSize: typography.fontSize.base,
      fontWeight: FONTS.semibold,
      color: t.primary,
    },
    countdownIndicator: {
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      padding: spacing.sm,
      borderRadius: spacing.xs,
      alignItems: 'center',
    },
    countdownText: {
      fontSize: typography.fontSize.body,
      fontWeight: FONTS.semibold,
    },
  }));

  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownInProgress = useRef<boolean>(false);
  /** End timestamp (ms) for current phase - used to recalc remaining when app returns from background */
  const phaseEndTimeRef = useRef<number | null>(null);
  const lastPhaseRoundRef = useRef<{ phase: TimerPhase; round: number }>({ phase: 'idle', round: 0 });
  const stateRef = useRef<TimerState>(state);
  stateRef.current = state;

  // Load alert settings from storage (shared for sounds, voice, and haptics)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const soundEnabled = await loadSoundSettings();
        const voiceEnabled = await loadVoiceSettings();
        // Both should be the same (shared toggle)
        setAlertsEnabled(soundEnabled && voiceEnabled);
        setVoiceEnabled(soundEnabled && voiceEnabled);
      } catch (error) {
        console.error('Error loading alert settings:', error);
        setAlertsEnabled(true); // Default to enabled
      }
    };
    loadSettings();
  }, []);

  // Save alert settings (controls sounds, voice, and haptics)
  const toggleAlerts = async () => {
    const newValue = !alertsEnabled;
    setAlertsEnabled(newValue);
    setVoiceEnabled(newValue);
    try {
      await saveSoundSettings(newValue);
      // Stop any ongoing speech when disabling
      if (!newValue) {
        stopSpeaking();
      }
    } catch (error) {
      console.error('Error saving alert settings:', error);
    }
  };

  // Trigger alert (vibration + sound + voice)
  const triggerAlert = useCallback(async (pattern: 'work' | 'rest' | 'complete') => {
    if (!alertsEnabled) return;

    // Haptic feedback
    const patterns: Record<string, number | number[]> = {
      work: Platform.OS === 'ios' ? 100 : [0, 200, 100, 200], // Double pulse for work
      rest: Platform.OS === 'ios' ? 50 : [0, 100], // Single short for rest
      complete: Platform.OS === 'ios' ? 300 : [0, 300, 100, 300, 100, 300], // Triple long for complete
    };

    try {
      Vibration.vibrate(patterns[pattern]);
    } catch (error) {
      if (__DEV__) {
        console.log('Vibration not available:', error);
      }
    }

    // Sound feedback
    if (pattern === 'work') {
      await playTimerStart();
    } else if (pattern === 'rest') {
      await playTimerStop();
    } else if (pattern === 'complete') {
      await playTimerComplete();
    }

    // Voice feedback
    if (pattern === 'work') {
      await speakWorkStart(workLabel);
    } else if (pattern === 'rest') {
      await speakRestStart(restLabel);
    } else if (pattern === 'complete') {
      await speakComplete();
    }
  }, [alertsEnabled, workLabel, restLabel]);

  // Keep phase end time ref updated when entering a new phase (for background resume)
  useEffect(() => {
    if (
      state.isRunning &&
      !state.isPaused &&
      (state.phase === 'work' || state.phase === 'rest') &&
      (lastPhaseRoundRef.current.phase !== state.phase || lastPhaseRoundRef.current.round !== state.currentRound)
    ) {
      phaseEndTimeRef.current = Date.now() + state.timeRemaining * 1000;
      lastPhaseRoundRef.current = { phase: state.phase, round: state.currentRound };
    }
    if (state.phase === 'idle' || state.phase === 'complete') {
      phaseEndTimeRef.current = null;
      lastPhaseRoundRef.current = { phase: state.phase, round: state.currentRound };
    }
  }, [state.phase, state.currentRound, state.timeRemaining, state.isRunning, state.isPaused]);

  // On app/screen return (AppState active), recalc remaining from end time so timer is correct after backgrounding
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState !== 'active') return;
      const current = stateRef.current;
      if (
        !current.isRunning ||
        current.isPaused ||
        current.phase === 'idle' ||
        current.phase === 'complete' ||
        phaseEndTimeRef.current == null
      ) {
        return;
      }
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((phaseEndTimeRef.current - now) / 1000));
      if (remaining <= 0) {
        // Phase ended while away - run same logic as interval tick (advance phase/round or complete)
        setState(prev => {
          if (prev.phase === 'work') {
            onSetComplete?.(prev.currentRound);
            if (prev.currentRound >= totalSets) {
              triggerAlert('complete');
              analytics.timerCompleted('interval', workDuration).catch(() => {});
              onComplete?.();
              phaseEndTimeRef.current = null;
              return { ...prev, phase: 'complete', timeRemaining: 0, isRunning: false };
            }
            triggerAlert('rest');
            analytics.intervalPhaseTransition('work', 'rest', prev.currentRound).catch(() => {});
            phaseEndTimeRef.current = Date.now() + restDuration * 1000;
            lastPhaseRoundRef.current = { phase: 'rest', round: prev.currentRound };
            return { ...prev, phase: 'rest', timeRemaining: restDuration };
          } else {
            // rest -> work (next round)
            triggerAlert('work');
            analytics.intervalPhaseTransition('rest', 'work', prev.currentRound + 1).catch(() => {});
            phaseEndTimeRef.current = Date.now() + workDuration * 1000;
            lastPhaseRoundRef.current = { phase: 'work', round: prev.currentRound + 1 };
            return {
              ...prev,
              phase: 'work',
              currentRound: prev.currentRound + 1,
              timeRemaining: workDuration,
            };
          }
        });
      } else {
        setState(prev => ({ ...prev, timeRemaining: remaining }));
      }
    });
    return () => subscription.remove();
  }, [totalSets, workDuration, restDuration, triggerAlert, onComplete, onSetComplete]);

  // Timer logic
  useEffect(() => {
    if (state.isRunning && !state.isPaused && state.phase !== 'idle' && state.phase !== 'complete') {
      const tickMs = getTickIntervalMs();
      const tickDec = getTickDecrement();
      intervalRef.current = setInterval(() => {
        setState(prev => {
          if (prev.timeRemaining <= tickDec) {
            // Time's up for current phase
            if (prev.phase === 'work') {
              // Work phase complete
              onSetComplete?.(prev.currentRound);
              
              if (prev.currentRound >= totalSets) {
                // All rounds complete
                triggerAlert('complete');
                // Track timer completed
                analytics.timerCompleted('interval', workDuration).catch(() => {
                  // Silently fail - analytics is optional
                });
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
                // Track phase transition
                analytics.intervalPhaseTransition('work', 'rest', prev.currentRound).catch(() => {
                  // Silently fail - analytics is optional
                });
                return {
                  ...prev,
                  phase: 'rest',
                  timeRemaining: restDuration,
                };
              }
            } else if (prev.phase === 'rest') {
              // Rest phase complete, start next work phase with countdown
              if (alertsEnabled && !countdownInProgress.current) {
                countdownInProgress.current = true;
                speakCountdown(workLabel, async () => {
                  await triggerAlert('work');
                  setState(prevState => ({
                    ...prevState,
                    phase: 'work',
                    currentRound: prevState.currentRound + 1,
                    timeRemaining: workDuration,
                  }));
                  countdownInProgress.current = false;
                });
                // Return current state while countdown plays
                return prev;
              } else {
                // No countdown, start immediately
                triggerAlert('work');
                // Track phase transition
                analytics.intervalPhaseTransition('rest', 'work', prev.currentRound + 1).catch(() => {
                  // Silently fail - analytics is optional
                });
                return {
                  ...prev,
                  phase: 'work',
                  currentRound: prev.currentRound + 1,
                  timeRemaining: workDuration,
                };
              }
            }
          }
          return {
            ...prev,
            timeRemaining: prev.timeRemaining - tickDec,
          };
        });
      }, tickMs);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state.isRunning, state.isPaused, state.phase, totalSets, workDuration, restDuration, alertsEnabled, triggerAlert, onComplete, onSetComplete]);

  // Start the timer with countdown
  const handleStart = async () => {
    if (countdownInProgress.current) return;
    
    countdownInProgress.current = true;
    
    // Track timer started
    analytics.timerStarted('interval', workDuration, exerciseName).catch(() => {
      // Silently fail - analytics is optional
    });
    
    // Play countdown sequence (beep-beep-beep-go or 3-2-1-go)
    if (alertsEnabled) {
      // Use voice countdown (3-2-1-Go) which includes beeps
      await speakCountdown(workLabel, async () => {
        // After countdown, start the timer
        await triggerAlert('work');
        setState({
          phase: 'work',
          currentRound: 1,
          timeRemaining: workDuration,
          isRunning: true,
          isPaused: false,
        });
        countdownInProgress.current = false;
      });
    } else {
      // If alerts disabled, start immediately
      setState({
        phase: 'work',
        currentRound: 1,
        timeRemaining: workDuration,
        isRunning: true,
        isPaused: false,
      });
      countdownInProgress.current = false;
    }
  };

  // Pause/Resume
  const handlePauseResume = () => {
    setState(prev => {
      const next = { ...prev, isPaused: !prev.isPaused };
      if (next.isRunning && !next.isPaused && (next.phase === 'work' || next.phase === 'rest')) {
        phaseEndTimeRef.current = Date.now() + next.timeRemaining * 1000;
        lastPhaseRoundRef.current = { phase: next.phase, round: next.currentRound };
      }
      return next;
    });
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
  const handleSkip = async () => {
    stopSpeaking(); // Stop any countdown in progress
    countdownInProgress.current = false;
    
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
        // Skip countdown when manually skipping
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
        return { label: '🏃 WORK', color: theme.error };
      case 'rest':
        return { label: `${getRestEmoji(restLabel)} ${restLabel.toUpperCase()}`, color: theme.primary };
      case 'complete':
        return { label: '🎉 COMPLETE', color: theme.secondary };
      default:
        return { label: '⏱️ READY', color: theme.textMuted };
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
      
      {/* Countdown indicator */}
      {countdownInProgress.current && (
        <View style={[styles.countdownIndicator, { backgroundColor: theme.warning + '20' }]}>
          <Text style={[styles.countdownText, { color: theme.warning }]}>⏱️ Get ready...</Text>
        </View>
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
