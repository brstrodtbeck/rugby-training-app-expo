/**
 * Analytics utility for tracking user behavior and app performance
 * 
 * This module provides a safe, non-blocking way to track analytics events.
 * All analytics calls are wrapped in try-catch to ensure they never break the app.
 * 
 * Analytics is optional. Native Firebase Analytics is not linked in this build,
 * so events are recorded locally in development logs only.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Track if analytics is enabled (can be disabled for privacy)
let analyticsEnabled = true;

/**
 * Initialize analytics (optional - called on app start)
 * Safe to call even if Firebase isn't configured
 */
export const initAnalytics = async (): Promise<void> => {
  try {
    // Check if user has disabled analytics
    const disabled = await AsyncStorage.getItem('analyticsDisabled');
    if (disabled === 'true') {
      analyticsEnabled = false;
      return;
    }

    // Set user properties if needed (optional)
    // Note: We don't track personal information
    if (__DEV__) {
      console.log('📊 Analytics initialized');
    }
  } catch (error) {
    // Silently fail - analytics shouldn't break the app
    if (__DEV__) {
      console.log('Analytics init error (non-critical):', error);
    }
  }
};

/**
 * Log an analytics event
 * Safe to call - won't break app if analytics fails
 */
const logEvent = async (
  eventName: string,
  params?: Record<string, any>
): Promise<void> => {
  // Skip if disabled
  if (!analyticsEnabled) return;

  // Skip in dev mode if desired (optional - remove this if you want dev tracking)
  // if (__DEV__) {
  //   console.log('📊 Analytics:', eventName, params);
  //   return;
  // }

  try {
    if (__DEV__) {
      const sanitizedParams = params
        ? Object.fromEntries(Object.entries(params).filter(([_, value]) => value !== undefined))
        : undefined;
      console.log('📊 Analytics:', eventName, sanitizedParams);
    }
  } catch (error) {
    // Silently fail - analytics errors should never break the app
    if (__DEV__) {
      console.log('Analytics error (non-critical):', error);
    }
  }
};

/**
 * Set a user property (optional)
 * Safe to call - won't break app if analytics fails
 */
export const setUserProperty = async (name: string, value: string): Promise<void> => {
  if (!analyticsEnabled) return;

  try {
    if (__DEV__) {
      console.log('📊 Analytics user property:', name, value);
    }
  } catch (error) {
    if (__DEV__) {
      console.log('Analytics setUserProperty error (non-critical):', error);
    }
  }
};

/**
 * Set user ID (optional - use anonymized ID, not personal info)
 * Safe to call - won't break app if analytics fails
 */
export const setUserId = async (userId: string): Promise<void> => {
  if (!analyticsEnabled) return;

  try {
    if (__DEV__) {
      console.log('📊 Analytics user id set');
    }
  } catch (error) {
    if (__DEV__) {
      console.log('Analytics setUserId error (non-critical):', error);
    }
  }
};

/**
 * Disable analytics (for privacy)
 */
export const disableAnalytics = async (): Promise<void> => {
  analyticsEnabled = false;
  try {
    await AsyncStorage.setItem('analyticsDisabled', 'true');
  } catch (error) {
    if (__DEV__) {
      console.log('Error disabling analytics:', error);
    }
  }
};

/**
 * Enable analytics
 */
export const enableAnalytics = async (): Promise<void> => {
  analyticsEnabled = true;
  try {
    await AsyncStorage.removeItem('analyticsDisabled');
  } catch (error) {
    if (__DEV__) {
      console.log('Error enabling analytics:', error);
    }
  }
};

/**
 * Analytics event helpers
 * All methods are safe to call and won't break the app
 */
export const analytics = {
  // ============================================
  // Session Events
  // ============================================

  /**
   * Track when a workout session starts
   */
  sessionStarted: (
    sessionId: string,
    program: string,
    week: number,
    day: number,
    sessionType?: string
  ) =>
    logEvent('session_started', {
      session_id: sessionId,
      program,
      week,
      day,
      session_type: sessionType || 'unknown',
    }),

  /**
   * Track when a workout session completes
   */
  sessionCompleted: (sessionId: string, duration: number, exercisesCompleted: number) =>
    logEvent('session_completed', {
      session_id: sessionId,
      duration_seconds: duration,
      exercises_completed: exercisesCompleted,
    }),

  /**
   * Track when a session is abandoned (not completed)
   */
  sessionAbandoned: (sessionId: string, reason?: string, duration?: number) =>
    logEvent('session_abandoned', {
      session_id: sessionId,
      reason: reason || 'unknown',
      duration_seconds: duration || 0,
    }),

  // ============================================
  // Exercise Events
  // ============================================

  /**
   * Track when an exercise is completed
   */
  exerciseCompleted: (
    exerciseName: string,
    sets: number,
    reps?: number | string,
    weight?: number
  ) =>
    logEvent('exercise_completed', {
      exercise_name: exerciseName,
      sets,
      reps: reps?.toString() || 'N/A',
      weight: weight || null,
    }),

  /**
   * Track when an exercise is marked complete
   */
  exerciseMarkedComplete: (exerciseName: string, method: 'manual' | 'auto') =>
    logEvent('exercise_marked_complete', {
      exercise_name: exerciseName,
      method,
    }),

  // ============================================
  // Timer Events
  // ============================================

  /**
   * Track when a timer starts
   */
  timerStarted: (
    type: 'interval' | 'time-based' | 'rest',
    duration: number,
    exerciseName?: string
  ) =>
    logEvent('timer_started', {
      timer_type: type,
      duration_seconds: duration,
      exercise_name: exerciseName || 'N/A',
    }),

  /**
   * Track when a timer completes
   */
  timerCompleted: (type: string, duration: number) =>
    logEvent('timer_completed', {
      timer_type: type,
      duration_seconds: duration,
    }),

  /**
   * Track when a timer is paused
   */
  timerPaused: (type: string) =>
    logEvent('timer_paused', {
      timer_type: type,
    }),

  /**
   * Track when a timer is stopped
   */
  timerStopped: (type: string, reason?: string) =>
    logEvent('timer_stopped', {
      timer_type: type,
      reason: reason || 'manual',
    }),

  /**
   * Track interval timer phase transitions
   */
  intervalPhaseTransition: (
    fromPhase: 'work' | 'rest',
    toPhase: 'work' | 'rest',
    round: number
  ) =>
    logEvent('interval_phase_transition', {
      from_phase: fromPhase,
      to_phase: toPhase,
      round,
    }),

  // ============================================
  // Program & Setup Events
  // ============================================

  /**
   * Track when a program is selected
   */
  programSelected: (programId: string, programName: string) =>
    logEvent('program_selected', {
      program_id: programId,
      program_name: programName,
    }),

  /**
   * Track when start date is set
   */
  startDateSet: (programId: string, startDate: string) =>
    logEvent('start_date_set', {
      program_id: programId,
      start_date: startDate,
    }),

  // ============================================
  // 1RM Events
  // ============================================

  /**
   * Track when a 1RM is entered
   */
  oneRMEntered: (
    exerciseName: string,
    value: number,
    method: 'manual' | 'calculated'
  ) =>
    logEvent('1rm_entered', {
      exercise_name: exerciseName,
      value,
      method,
    }),

  /**
   * Track when a 1RM is updated
   */
  oneRMUpdated: (exerciseName: string, oldValue: number, newValue: number) =>
    logEvent('1rm_updated', {
      exercise_name: exerciseName,
      old_value: oldValue,
      new_value: newValue,
    }),

  // ============================================
  // Feature Usage Events
  // ============================================

  /**
   * Track feature usage
   */
  featureUsed: (featureName: string, details?: Record<string, any>) =>
    logEvent('feature_used', {
      feature_name: featureName,
      ...details,
    }),

  /**
   * Track when voice cues are toggled
   */
  voiceCuesToggled: (enabled: boolean) =>
    logEvent('voice_cues_toggled', {
      enabled,
    }),

  /**
   * Track when haptics are toggled
   */
  hapticsToggled: (enabled: boolean) =>
    logEvent('haptics_toggled', {
      enabled,
    }),

  /**
   * Track when readiness score is set
   */
  readinessScoreSet: (score: number, label: string) =>
    logEvent('readiness_score_set', {
      score,
      label,
    }),

  // ============================================
  // Navigation Events
  // ============================================

  /**
   * Track screen views (optional - can be added to navigation)
   */
  screenViewed: (screenName: string) =>
    logEvent('screen_viewed', {
      screen_name: screenName,
    }),

  // ============================================
  // Error Events (for tracking issues)
  // ============================================

  /**
   * Track errors (non-critical - for monitoring)
   */
  errorOccurred: (errorType: string, errorMessage: string, context?: Record<string, any>) =>
    logEvent('error_occurred', {
      error_type: errorType,
      error_message: errorMessage,
      ...context,
    }),
};

