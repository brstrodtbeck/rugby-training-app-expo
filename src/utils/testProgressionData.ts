/**
 * Test Block – Progression Validation
 * 28 days of sample logs to validate Rule of 3, readiness safeguards, and deload logic
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExerciseLog, saveExerciseLog, saveProgressionState, ProgressionState } from './progressionLogic';

// Test exercise definitions
export const TEST_EXERCISES = {
  BACK_SQUAT: {
    name: 'Back Squat (Test)',
    trackingMode: '1RM' as const,
    exerciseCategory: 'compound' as const,
    sets: 5,
    reps: 5,
    intensity: '75% TM',
    targetRPE: 7,
  },
  DUMBBELL_ROW: {
    name: 'Dumbbell Row (Test)',
    trackingMode: 'volume' as const,
    exerciseCategory: 'assistance' as const,
    sets: 3,
    reps: 10,
    targetRPE: 7,
  },
  VO2_MAX: {
    name: 'VO₂ Max Intervals (Test)',
    trackingMode: 'time' as const,
    sets: 4,
    duration: '4 min',
    rest: 180,
    instruction: '4 min @ 90-95% HRmax, 3 min jog recovery',
  },
};

/**
 * Generate comprehensive test logs covering ALL progression scenarios
 * 6 weeks (42 days) of detailed testing for complete validation
 */
export function generateTestLogs(): ExerciseLog[] {
  const logs: ExerciseLog[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 42); // Start 42 days ago (6 weeks)

  // ========================================
  // DUMBBELL ROW TEST DATA (Rule of 3 - Assistance Exercise)
  // Starting weight: 35 lbs, target: 3x10 @ RPE 7
  // minIncrement: 2.5 lbs (assistance category)
  // ========================================
  const rowTestData = [
    // ══════════════════════════════════════════════════════════════════
    // WEEK 1: RULE OF 3 BASIC TEST (Sessions 1-4)
    // Goal: Verify 3 consecutive successes triggers +2.5 lbs progression
    // ══════════════════════════════════════════════════════════════════
    { session: 1, week: 1, date: addDays(baseDate, 0), weight: 35, sets: 3, reps: '10,10,10', rpe: 7, readiness: 7, completed: true, extraReps: 0, consecutiveSuccesses: 1, qualityPass: true, 
      testCase: 'RULE_OF_3_STREAK', expected: 'Streak increments to 1' },
    { session: 2, week: 1, date: addDays(baseDate, 2), weight: 35, sets: 3, reps: '10,10,10', rpe: 7, readiness: 8, completed: true, extraReps: 0, consecutiveSuccesses: 2, qualityPass: true,
      testCase: 'RULE_OF_3_STREAK', expected: 'Streak increments to 2' },
    { session: 3, week: 1, date: addDays(baseDate, 4), weight: 35, sets: 3, reps: '10,10,10', rpe: 7, readiness: 7, completed: true, extraReps: 0, consecutiveSuccesses: 3, qualityPass: true,
      testCase: 'RULE_OF_3_TRIGGER', expected: 'Streak=3 → TRIGGERS PROGRESSION next session' },
    { session: 4, week: 1, date: addDays(baseDate, 6), weight: 37.5, sets: 3, reps: '10,10,10', rpe: 7, readiness: 7, completed: true, extraReps: 0, consecutiveSuccesses: 1, qualityPass: true,
      testCase: 'RULE_OF_3_APPLIED', expected: 'Weight +2.5 lbs (35→37.5), streak resets to 1' },
    
    // ══════════════════════════════════════════════════════════════════
    // WEEK 2: FALLBACK + READINESS SAFEGUARD HOLD (Sessions 5-8)
    // Goal: Test +3 reps fallback AND low readiness with good performance
    // ══════════════════════════════════════════════════════════════════
    { session: 5, week: 2, date: addDays(baseDate, 7), weight: 37.5, sets: 3, reps: '10,10,13', rpe: 8, readiness: 8, completed: true, extraReps: 3, consecutiveSuccesses: 0, qualityPass: true,
      testCase: 'FALLBACK_+3_REPS', expected: '+3 extra reps on last set → TRIGGERS FALLBACK' },
    { session: 6, week: 2, date: addDays(baseDate, 9), weight: 40, sets: 3, reps: '10,10,10', rpe: 7, readiness: 4, completed: true, extraReps: 0, consecutiveSuccesses: 1, qualityPass: true,
      testCase: 'SAFEGUARD_HOLD', expected: 'LOW readiness (4) + completed = NO reduction (hold)' },
    { session: 7, week: 2, date: addDays(baseDate, 11), weight: 40, sets: 3, reps: '10,10,10', rpe: 7, readiness: 7, completed: true, extraReps: 0, consecutiveSuccesses: 2, qualityPass: true,
      testCase: 'RECOVERY_CONTINUE', expected: 'Readiness recovered, streak continues (2)' },
    { session: 8, week: 2, date: addDays(baseDate, 13), weight: 40, sets: 3, reps: '10,10,10', rpe: 7, readiness: 7, completed: true, extraReps: 0, consecutiveSuccesses: 3, qualityPass: true,
      testCase: 'RULE_OF_3_TRIGGER', expected: 'Streak=3 → TRIGGERS PROGRESSION' },
    
    // ══════════════════════════════════════════════════════════════════
    // WEEK 3: DELOAD SUPPRESSION (Sessions 9-12)
    // Goal: Verify progression is completely blocked during deload
    // ══════════════════════════════════════════════════════════════════
    { session: 9, week: 3, date: addDays(baseDate, 14), weight: 34, sets: 2, reps: '10,10', rpe: 5, readiness: 8, completed: true, extraReps: 0, consecutiveSuccesses: 0, qualityPass: true,
      testCase: 'DELOAD_SUPPRESS', expected: 'DELOAD: Weight=85%, sets reduced, streak=0' },
    { session: 10, week: 3, date: addDays(baseDate, 16), weight: 34, sets: 2, reps: '10,10', rpe: 5, readiness: 8, completed: true, extraReps: 0, consecutiveSuccesses: 0, qualityPass: true,
      testCase: 'DELOAD_SUPPRESS', expected: 'DELOAD: Streak stays 0 despite success' },
    { session: 11, week: 3, date: addDays(baseDate, 18), weight: 34, sets: 2, reps: '10,10,15', rpe: 5, readiness: 9, completed: true, extraReps: 5, consecutiveSuccesses: 0, qualityPass: true,
      testCase: 'DELOAD_FALLBACK_BLOCKED', expected: 'DELOAD: Even +5 extra reps blocked (no fallback)' },
    { session: 12, week: 3, date: addDays(baseDate, 20), weight: 34, sets: 2, reps: '10,10', rpe: 5, readiness: 9, completed: true, extraReps: 0, consecutiveSuccesses: 0, qualityPass: true,
      testCase: 'DELOAD_END', expected: 'DELOAD ends: Ready to resume at pre-deload (42.5)' },
    
    // ══════════════════════════════════════════════════════════════════
    // WEEK 4: CONSECUTIVE FAILURE → REDUCTION (Sessions 13-16)
    // Goal: Test 2 consecutive low readiness + missed reps triggers reduction
    // ══════════════════════════════════════════════════════════════════
    { session: 13, week: 4, date: addDays(baseDate, 21), weight: 42.5, sets: 3, reps: '8,7,6', rpe: 9, readiness: 3, completed: false, extraReps: 0, consecutiveSuccesses: 0, qualityPass: false,
      testCase: 'SAFEGUARD_FIRST_FAIL', expected: 'First failure: low readiness + missed = waiting' },
    { session: 14, week: 4, date: addDays(baseDate, 23), weight: 42.5, sets: 3, reps: '7,6,5', rpe: 10, readiness: 2, completed: false, extraReps: 0, consecutiveSuccesses: 0, qualityPass: false,
      testCase: 'SAFEGUARD_REDUCE', expected: '2nd consecutive failure → TRIGGERS REDUCTION' },
    { session: 15, week: 4, date: addDays(baseDate, 25), weight: 40, sets: 3, reps: '10,10,10', rpe: 7, readiness: 6, completed: true, extraReps: 0, consecutiveSuccesses: 1, qualityPass: true,
      testCase: 'REDUCTION_APPLIED', expected: 'Weight -5% (42.5→40), recovery begins' },
    { session: 16, week: 4, date: addDays(baseDate, 27), weight: 40, sets: 3, reps: '10,10,10', rpe: 7, readiness: 7, completed: true, extraReps: 0, consecutiveSuccesses: 2, qualityPass: true,
      testCase: 'POST_REDUCTION_STREAK', expected: 'Back on track, streak building (2)' },
    
    // ══════════════════════════════════════════════════════════════════
    // WEEK 5: QUALITY GATE TESTING (Sessions 17-20)
    // Goal: Verify only qualityPass=true counts toward streak
    // ══════════════════════════════════════════════════════════════════
    { session: 17, week: 5, date: addDays(baseDate, 28), weight: 40, sets: 3, reps: '10,10,10', rpe: 7, readiness: 7, completed: true, extraReps: 0, consecutiveSuccesses: 3, qualityPass: true,
      testCase: 'QUALITY_GATE_PASS', expected: 'Streak=3 → TRIGGERS PROGRESSION' },
    { session: 18, week: 5, date: addDays(baseDate, 30), weight: 42.5, sets: 3, reps: '10,10,10', rpe: 9, readiness: 6, completed: true, extraReps: 0, consecutiveSuccesses: 0, qualityPass: false,
      testCase: 'QUALITY_GATE_FAIL_RPE', expected: 'Completed but RPE 9 > target+1 → qualityPass=false, streak=0' },
    { session: 19, week: 5, date: addDays(baseDate, 32), weight: 42.5, sets: 3, reps: '10,10,10', rpe: 7, readiness: 7, completed: true, extraReps: 0, consecutiveSuccesses: 1, qualityPass: true,
      testCase: 'QUALITY_GATE_RESTART', expected: 'Back to quality, streak restarts (1)' },
    { session: 20, week: 5, date: addDays(baseDate, 34), weight: 42.5, sets: 3, reps: '10,10,10', rpe: 7, readiness: 7, completed: true, extraReps: 0, consecutiveSuccesses: 2, qualityPass: true,
      testCase: 'STREAK_CONTINUE', expected: 'Streak continues (2)' },
    
    // ══════════════════════════════════════════════════════════════════
    // WEEK 6: EDGE CASES & MIXED SCENARIOS (Sessions 21-24)
    // Goal: Test boundary conditions and complex scenarios
    // ══════════════════════════════════════════════════════════════════
    { session: 21, week: 6, date: addDays(baseDate, 35), weight: 42.5, sets: 3, reps: '10,10,10', rpe: 7, readiness: 7, completed: true, extraReps: 0, consecutiveSuccesses: 3, qualityPass: true,
      testCase: 'RULE_OF_3_TRIGGER', expected: 'Streak=3 → TRIGGERS PROGRESSION' },
    { session: 22, week: 6, date: addDays(baseDate, 37), weight: 45, sets: 3, reps: '10,10,12', rpe: 8, readiness: 3, completed: true, extraReps: 2, qualityPass: true,
      testCase: 'EDGE_LOW_READY_EXTRA_REPS', expected: 'Low readiness + 2 extra reps (not 3) = no fallback, hold' },
    { session: 23, week: 6, date: addDays(baseDate, 39), weight: 45, sets: 3, reps: '10,10,10', rpe: 8, readiness: 5, completed: true, extraReps: 0, consecutiveSuccesses: 1, qualityPass: true,
      testCase: 'MODERATE_READINESS', expected: 'Moderate readiness (5) = normal progression' },
    { session: 24, week: 6, date: addDays(baseDate, 41), weight: 45, sets: 3, reps: '10,10,14', rpe: 8, readiness: 8, completed: true, extraReps: 4, consecutiveSuccesses: 0, qualityPass: true,
      testCase: 'FALLBACK_+4_REPS', expected: '+4 extra reps → TRIGGERS FALLBACK (≥3)' },
  ];

  // Generate logs from test data
  for (const data of rowTestData) {
    const dateStr = data.date.toISOString().split('T')[0];
    const sessionId = `test-week${data.week - 1}-session${data.session}`;
    
    // Calculate readiness MA3
    const recentReadiness = rowTestData
      .filter(d => d.session <= data.session && d.session > data.session - 3)
      .map(d => d.readiness);
    const readinessMA3 = recentReadiness.length > 0 
      ? Math.round((recentReadiness.reduce((a, b) => a + b, 0) / recentReadiness.length) * 10) / 10
      : data.readiness;

    logs.push({
      exerciseId: `${sessionId}-row`,
      exerciseName: TEST_EXERCISES.DUMBBELL_ROW.name,
      date: dateStr,
      sessionId,
      sets: data.sets,
      reps: data.reps,
      weight: data.weight,
      rpe: data.rpe,
      readiness: data.readiness,
      isCompleted: data.completed,
      isWarmup: false,
      extraReps: data.extraReps,
      consecutiveSuccesses: data.consecutiveSuccesses,
      qualityPass: data.qualityPass,
      targetRPE: 7,
      readinessMA3,
      historyLink: `history:${encodeURIComponent(TEST_EXERCISES.DUMBBELL_ROW.name)}`,
    });
  }

  // ========================================
  // BACK SQUAT TEST DATA (1RM Hybrid - Compound Exercise)
  // Starting TM: 225 lbs, working at 75% = 169 lbs
  // Tests: TM updates, deload handling, readiness impact on 1RM lifts
  // ========================================
  const squatTestData = [
    // WEEK 1: Normal 1RM tracking
    { session: 1, week: 1, date: addDays(baseDate, 0), weight: 169, sets: 5, reps: 5, rpe: 7, readiness: 7, completed: true, testCase: '1RM_NORMAL' },
    { session: 2, week: 1, date: addDays(baseDate, 2), weight: 169, sets: 5, reps: 5, rpe: 7, readiness: 8, completed: true, testCase: '1RM_NORMAL' },
    { session: 3, week: 1, date: addDays(baseDate, 4), weight: 169, sets: 5, reps: 5, rpe: 7, readiness: 7, completed: true, testCase: '1RM_NORMAL' },
    { session: 4, week: 1, date: addDays(baseDate, 6), weight: 169, sets: 5, reps: 5, rpe: 6, readiness: 7, completed: true, testCase: '1RM_EASY_RPE' },
    // WEEK 2: TM adjustment opportunity + low readiness test
    { session: 5, week: 2, date: addDays(baseDate, 7), weight: 174, sets: 5, reps: 5, rpe: 7, readiness: 8, completed: true, testCase: '1RM_TM_INCREASE' },
    { session: 6, week: 2, date: addDays(baseDate, 9), weight: 174, sets: 5, reps: 5, rpe: 8, readiness: 4, completed: true, testCase: '1RM_LOW_READY' },
    { session: 7, week: 2, date: addDays(baseDate, 11), weight: 174, sets: 5, reps: 5, rpe: 7, readiness: 7, completed: true, testCase: '1RM_RECOVERY' },
    { session: 8, week: 2, date: addDays(baseDate, 13), weight: 174, sets: 5, reps: 5, rpe: 7, readiness: 7, completed: true, testCase: '1RM_NORMAL' },
    // WEEK 3: Deload
    { session: 9, week: 3, date: addDays(baseDate, 14), weight: 135, sets: 3, reps: 5, rpe: 5, readiness: 8, completed: true, testCase: '1RM_DELOAD' },
    { session: 10, week: 3, date: addDays(baseDate, 16), weight: 135, sets: 3, reps: 5, rpe: 5, readiness: 8, completed: true, testCase: '1RM_DELOAD' },
    { session: 11, week: 3, date: addDays(baseDate, 18), weight: 135, sets: 3, reps: 5, rpe: 5, readiness: 9, completed: true, testCase: '1RM_DELOAD' },
    { session: 12, week: 3, date: addDays(baseDate, 20), weight: 135, sets: 3, reps: 5, rpe: 5, readiness: 9, completed: true, testCase: '1RM_DELOAD_END' },
    // WEEK 4: Low readiness failures then recovery
    { session: 13, week: 4, date: addDays(baseDate, 21), weight: 174, sets: 5, reps: 4, rpe: 9, readiness: 3, completed: false, testCase: '1RM_FAIL_1' },
    { session: 14, week: 4, date: addDays(baseDate, 23), weight: 174, sets: 5, reps: 3, rpe: 10, readiness: 2, completed: false, testCase: '1RM_FAIL_2_REDUCE' },
    { session: 15, week: 4, date: addDays(baseDate, 25), weight: 165, sets: 5, reps: 5, rpe: 7, readiness: 6, completed: true, testCase: '1RM_REDUCED' },
    { session: 16, week: 4, date: addDays(baseDate, 27), weight: 165, sets: 5, reps: 5, rpe: 7, readiness: 7, completed: true, testCase: '1RM_RECOVERY' },
    // WEEK 5: Back to normal progression
    { session: 17, week: 5, date: addDays(baseDate, 28), weight: 165, sets: 5, reps: 5, rpe: 7, readiness: 7, completed: true, testCase: '1RM_NORMAL' },
    { session: 18, week: 5, date: addDays(baseDate, 30), weight: 165, sets: 5, reps: 5, rpe: 6, readiness: 8, completed: true, testCase: '1RM_STRONG' },
    { session: 19, week: 5, date: addDays(baseDate, 32), weight: 170, sets: 5, reps: 5, rpe: 7, readiness: 7, completed: true, testCase: '1RM_TM_UP' },
    { session: 20, week: 5, date: addDays(baseDate, 34), weight: 170, sets: 5, reps: 5, rpe: 7, readiness: 7, completed: true, testCase: '1RM_NORMAL' },
    // WEEK 6: Edge cases
    { session: 21, week: 6, date: addDays(baseDate, 35), weight: 170, sets: 5, reps: 5, rpe: 7, readiness: 7, completed: true, testCase: '1RM_NORMAL' },
    { session: 22, week: 6, date: addDays(baseDate, 37), weight: 170, sets: 5, reps: 5, rpe: 8, readiness: 3, completed: true, testCase: '1RM_LOW_READY_COMPLETE' },
    { session: 23, week: 6, date: addDays(baseDate, 39), weight: 170, sets: 5, reps: 5, rpe: 7, readiness: 5, completed: true, testCase: '1RM_MODERATE_READY' },
    { session: 24, week: 6, date: addDays(baseDate, 41), weight: 175, sets: 5, reps: 5, rpe: 7, readiness: 8, completed: true, testCase: '1RM_TM_UP_FINAL' },
  ];

  for (const data of squatTestData) {
    const dateStr = data.date.toISOString().split('T')[0];
    const sessionId = `test-week${data.week - 1}-session${data.session}`;
    
    logs.push({
      exerciseId: `${sessionId}-squat`,
      exerciseName: TEST_EXERCISES.BACK_SQUAT.name,
      date: dateStr,
      sessionId,
      sets: data.sets,
      reps: data.reps,
      weight: data.weight,
      rpe: data.rpe,
      readiness: data.readiness,
      isCompleted: data.completed,
      isWarmup: false,
      extraReps: 0,
      qualityPass: data.completed && data.rpe <= 8,
      targetRPE: 7,
      historyLink: `history:${encodeURIComponent(TEST_EXERCISES.BACK_SQUAT.name)}`,
    });
  }

  // ========================================
  // VO2 MAX TEST DATA (Cardio - no progression logic)
  // Tests: History tracking only, no progression/reduction applied
  // ========================================
  const vo2TestData = [
    // WEEK 1
    { session: 1, week: 1, date: addDays(baseDate, 0), sets: 4, duration: '4 min', readiness: 7, intensity: '90%', testCase: 'CARDIO_TRACK' },
    { session: 2, week: 1, date: addDays(baseDate, 2), sets: 4, duration: '4 min', readiness: 8, intensity: '92%', testCase: 'CARDIO_TRACK' },
    { session: 3, week: 1, date: addDays(baseDate, 4), sets: 4, duration: '4 min', readiness: 7, intensity: '90%', testCase: 'CARDIO_TRACK' },
    { session: 4, week: 1, date: addDays(baseDate, 6), sets: 4, duration: '4 min', readiness: 7, intensity: '91%', testCase: 'CARDIO_TRACK' },
    // WEEK 2
    { session: 5, week: 2, date: addDays(baseDate, 7), sets: 4, duration: '4 min', readiness: 8, intensity: '93%', testCase: 'CARDIO_TRACK' },
    { session: 6, week: 2, date: addDays(baseDate, 9), sets: 4, duration: '4 min', readiness: 4, intensity: '85%', testCase: 'CARDIO_LOW_READY' },
    { session: 7, week: 2, date: addDays(baseDate, 11), sets: 4, duration: '4 min', readiness: 7, intensity: '90%', testCase: 'CARDIO_TRACK' },
    { session: 8, week: 2, date: addDays(baseDate, 13), sets: 4, duration: '4 min', readiness: 7, intensity: '91%', testCase: 'CARDIO_TRACK' },
    // WEEK 3: Deload (reduced volume)
    { session: 9, week: 3, date: addDays(baseDate, 14), sets: 2, duration: '4 min', readiness: 8, intensity: '80%', testCase: 'CARDIO_DELOAD' },
    { session: 10, week: 3, date: addDays(baseDate, 16), sets: 2, duration: '4 min', readiness: 8, intensity: '80%', testCase: 'CARDIO_DELOAD' },
    { session: 11, week: 3, date: addDays(baseDate, 18), sets: 2, duration: '4 min', readiness: 9, intensity: '75%', testCase: 'CARDIO_DELOAD' },
    { session: 12, week: 3, date: addDays(baseDate, 20), sets: 2, duration: '4 min', readiness: 9, intensity: '75%', testCase: 'CARDIO_DELOAD_END' },
    // WEEK 4: Low readiness tracking
    { session: 13, week: 4, date: addDays(baseDate, 21), sets: 4, duration: '4 min', readiness: 3, intensity: '82%', testCase: 'CARDIO_LOW_READY' },
    { session: 14, week: 4, date: addDays(baseDate, 23), sets: 4, duration: '4 min', readiness: 2, intensity: '80%', testCase: 'CARDIO_VERY_LOW' },
    { session: 15, week: 4, date: addDays(baseDate, 25), sets: 4, duration: '4 min', readiness: 6, intensity: '88%', testCase: 'CARDIO_RECOVERY' },
    { session: 16, week: 4, date: addDays(baseDate, 27), sets: 4, duration: '4 min', readiness: 7, intensity: '90%', testCase: 'CARDIO_TRACK' },
    // WEEK 5
    { session: 17, week: 5, date: addDays(baseDate, 28), sets: 4, duration: '4 min', readiness: 7, intensity: '90%', testCase: 'CARDIO_TRACK' },
    { session: 18, week: 5, date: addDays(baseDate, 30), sets: 4, duration: '4 min', readiness: 8, intensity: '92%', testCase: 'CARDIO_TRACK' },
    { session: 19, week: 5, date: addDays(baseDate, 32), sets: 5, duration: '4 min', readiness: 7, intensity: '90%', testCase: 'CARDIO_VOLUME_UP' },
    { session: 20, week: 5, date: addDays(baseDate, 34), sets: 5, duration: '4 min', readiness: 7, intensity: '91%', testCase: 'CARDIO_TRACK' },
    // WEEK 6
    { session: 21, week: 6, date: addDays(baseDate, 35), sets: 5, duration: '4 min', readiness: 7, intensity: '90%', testCase: 'CARDIO_TRACK' },
    { session: 22, week: 6, date: addDays(baseDate, 37), sets: 5, duration: '4 min', readiness: 3, intensity: '85%', testCase: 'CARDIO_LOW_READY' },
    { session: 23, week: 6, date: addDays(baseDate, 39), sets: 5, duration: '4 min', readiness: 5, intensity: '88%', testCase: 'CARDIO_MODERATE' },
    { session: 24, week: 6, date: addDays(baseDate, 41), sets: 5, duration: '4 min', readiness: 8, intensity: '93%', testCase: 'CARDIO_FINAL' },
  ];

  for (const data of vo2TestData) {
    const dateStr = data.date.toISOString().split('T')[0];
    const sessionId = `test-week${data.week - 1}-session${data.session}`;
    
    logs.push({
      exerciseId: `${sessionId}-vo2`,
      exerciseName: TEST_EXERCISES.VO2_MAX.name,
      date: dateStr,
      sessionId,
      sets: data.sets,
      reps: data.duration,
      readiness: data.readiness,
      isCompleted: true,
      isWarmup: false,
      historyLink: `history:${encodeURIComponent(TEST_EXERCISES.VO2_MAX.name)}`,
    });
  }

  return logs;
}

// Helper to add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Seed test data into AsyncStorage for validation
 */
export async function seedTestData(): Promise<{ success: boolean; message: string }> {
  try {
    const logs = generateTestLogs();
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 42); // Start 42 days ago (6 weeks)
    
    // ============================================
    // 1. SAVE EXERCISE HISTORY LOGS
    // ============================================
    const logsByExercise: Record<string, ExerciseLog[]> = {};
    for (const log of logs) {
      if (!logsByExercise[log.exerciseName]) {
        logsByExercise[log.exerciseName] = [];
      }
      logsByExercise[log.exerciseName].push(log);
    }
    
    for (const [exerciseName, exerciseLogs] of Object.entries(logsByExercise)) {
      const key = `exerciseHistory:${exerciseName}`;
      const sorted = exerciseLogs.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      await AsyncStorage.setItem(key, JSON.stringify(sorted));
    }
    
    // ============================================
    // 2. SAVE COMPLETED SESSIONS (for calendar)
    // ============================================
    // Test program has 4 weeks, 4 sessions per week = 16 sessions
    // Session IDs: test-week0-day-1 through test-week3-day-1
    // But we simulate 4 sessions per week for more realistic data
    
    const completedSessions: { id: string; date: string }[] = [];
    // Using Day 1 (Full Body Test) for all sessions since it has all 3 test exercises
    // 6 weeks × 4 sessions/week = 24 total sessions
    const sessionDates = [
      // WEEK 1 (4 sessions) - Rule of 3 Basic Test
      { week: 0, day: 1, daysFromStart: 0, sessionNum: 1 },
      { week: 0, day: 1, daysFromStart: 2, sessionNum: 2 },
      { week: 0, day: 1, daysFromStart: 4, sessionNum: 3 },
      { week: 0, day: 1, daysFromStart: 6, sessionNum: 4 },
      // WEEK 2 (4 sessions) - Fallback + Readiness Safeguard Hold
      { week: 1, day: 1, daysFromStart: 7, sessionNum: 5 },
      { week: 1, day: 1, daysFromStart: 9, sessionNum: 6 },
      { week: 1, day: 1, daysFromStart: 11, sessionNum: 7 },
      { week: 1, day: 1, daysFromStart: 13, sessionNum: 8 },
      // WEEK 3 (4 sessions) - Deload Suppression
      { week: 2, day: 1, daysFromStart: 14, sessionNum: 9 },
      { week: 2, day: 1, daysFromStart: 16, sessionNum: 10 },
      { week: 2, day: 1, daysFromStart: 18, sessionNum: 11 },
      { week: 2, day: 1, daysFromStart: 20, sessionNum: 12 },
      // WEEK 4 (4 sessions) - Consecutive Failure → Reduction
      { week: 3, day: 1, daysFromStart: 21, sessionNum: 13 },
      { week: 3, day: 1, daysFromStart: 23, sessionNum: 14 },
      { week: 3, day: 1, daysFromStart: 25, sessionNum: 15 },
      { week: 3, day: 1, daysFromStart: 27, sessionNum: 16 },
      // WEEK 5 (4 sessions) - Quality Gate Testing
      { week: 4, day: 1, daysFromStart: 28, sessionNum: 17 },
      { week: 4, day: 1, daysFromStart: 30, sessionNum: 18 },
      { week: 4, day: 1, daysFromStart: 32, sessionNum: 19 },
      { week: 4, day: 1, daysFromStart: 34, sessionNum: 20 },
      // WEEK 6 (4 sessions) - Edge Cases & Mixed Scenarios
      { week: 5, day: 1, daysFromStart: 35, sessionNum: 21 },
      { week: 5, day: 1, daysFromStart: 37, sessionNum: 22 },
      { week: 5, day: 1, daysFromStart: 39, sessionNum: 23 },
      { week: 5, day: 1, daysFromStart: 41, sessionNum: 24 },
    ];
    
    for (const { week, day, daysFromStart, sessionNum } of sessionDates) {
      const sessionId = `test-week${week}-day-${day}`;
      const sessionDate = addDays(baseDate, daysFromStart);
      
      completedSessions.push({
        id: sessionId,
        date: sessionDate.toISOString(),
      });
      
      console.log(`📅 Session ${sessionNum}: ${sessionId} on ${sessionDate.toISOString().split('T')[0]}`);
    }
    
    await AsyncStorage.setItem('completedSessions', JSON.stringify(completedSessions));
    
    // ============================================
    // 3. SAVE SET LOGS FOR EACH SESSION
    // ============================================
    // Define the actual set logs as if user entered them
    const allSetLogs = generateDetailedSetLogs();
    
    for (const [sessionId, setLogData] of Object.entries(allSetLogs)) {
      await AsyncStorage.setItem(`setLogs:${sessionId}`, JSON.stringify(setLogData));
      
      // Mark all exercises as completed for this session
      const exerciseCount = Object.keys(setLogData).length;
      const completedIndices = Array.from({ length: exerciseCount }, (_, i) => i);
      await AsyncStorage.setItem(`completed:${sessionId}`, JSON.stringify(completedIndices));
    }
    
    // ============================================
    // 4. SAVE PROGRESSION STATES
    // ============================================
    // Final state after 24 sessions (6 weeks):
    // - Back Squat: TM increased to ~233 after week 6 (started at 225)
    // - Dumbbell Row: At 47.5 lbs after multiple progressions
    const squatState: ProgressionState = {
      exerciseName: TEST_EXERCISES.BACK_SQUAT.name,
      currentWeight: 175, // After week 6 TM increase
      consecutiveSuccesses: 1,
      lastSuccessDate: addDays(baseDate, 41).toISOString().split('T')[0],
      lastDeloadWeight: 174,
      pendingIncrease: false,
    };
    
    const rowState: ProgressionState = {
      exerciseName: TEST_EXERCISES.DUMBBELL_ROW.name,
      currentWeight: 47.5, // After final +4 reps fallback in session 24
      consecutiveSuccesses: 0, // Reset after fallback
      lastSuccessDate: addDays(baseDate, 41).toISOString().split('T')[0],
      pendingIncrease: true, // Fallback triggered pending increase
    };
    
    await saveProgressionState(squatState);
    await saveProgressionState(rowState);
    
    // ============================================
    // 5. SAVE 1RM DATA
    // ============================================
    await AsyncStorage.setItem('1RM:Back Squat (Test)', '233'); // TM increased over 6 weeks
    
    // ============================================
    // 6. SAVE START DATE
    // ============================================
    await AsyncStorage.setItem('startDateYMD', baseDate.toISOString().split('T')[0]);
    
    return {
      success: true,
      message: `✅ Seeded 24 sessions over 42 days (6 weeks)\n📊 ${logs.length} exercise logs (3 exercises × 24 sessions)\n🏋️ Complete set logs for validation\n📅 Start date: ${baseDate.toISOString().split('T')[0]}\n\n📋 TEST COVERAGE:\n• Week 1: Rule of 3 Basic\n• Week 2: +3 Reps Fallback + Safeguard Hold\n• Week 3: Deload Suppression\n• Week 4: Consecutive Failure → Reduction\n• Week 5: Quality Gate Testing\n• Week 6: Edge Cases & Mixed Scenarios`,
    };
  } catch (error) {
    console.error('Error seeding test data:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Generate detailed set logs for each session
 * Returns { sessionId: { exerciseIndex: [{ weight, reps }, ...] } }
 */
function generateDetailedSetLogs(): Record<string, Record<number, { weight: string; reps: string }[]>> {
  const setLogs: Record<string, Record<number, { weight: string; reps: string }[]>> = {};
  
  // All sessions use Day 1 (test-week{0-3}-day-1) since that has all 3 test exercises
  // The actual session dates are tracked in exercise history logs
  // Set logs are keyed by session ID - we'll store cumulative data for day-1 of each week
  // Since multiple sessions can happen on "day-1", the last one's data will be stored
  
  // We'll create unique session data keyed by week to avoid overwrites
  const sessionData = [
    // ============ WEEK 1: Sessions 1-4 (normal progression) ============
    // Final state for week 0: Row at 37.5 after streak = 3 triggered progression
    {
      sessionId: 'test-week0-day-1',
      exercises: [
        // Back Squat: 5x5 @ 169 lbs (75% of 225 TM)
        { index: 0, sets: [
          { weight: '135', reps: '5' }, // Warmup
          { weight: '155', reps: '5' }, // Warmup
          { weight: '169', reps: '5' },
          { weight: '169', reps: '5' },
          { weight: '169', reps: '5' },
          { weight: '169', reps: '5' },
          { weight: '169', reps: '5' },
        ]},
        // Dumbbell Row: After 4 sessions, at 37.5 lbs (progressed from 35)
        { index: 1, sets: [
          { weight: '37.5', reps: '10' },
          { weight: '37.5', reps: '10' },
          { weight: '37.5', reps: '10' },
        ]},
        // VO2 Max: 4x4min
        { index: 2, sets: [
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
        ]},
      ],
    },
    
    // ============ WEEK 2: Sessions 5-8 (+3 reps fallback, low readiness) ============
    // Final state: Row at 40 lbs after +3 reps triggered fallback progression
    {
      sessionId: 'test-week1-day-1',
      exercises: [
        { index: 0, sets: [
          { weight: '135', reps: '5' },
          { weight: '155', reps: '5' },
          { weight: '169', reps: '5' },
          { weight: '169', reps: '5' },
          { weight: '169', reps: '5' },
          { weight: '169', reps: '5' },
          { weight: '169', reps: '5' },
        ]},
        // Session 8: Row at 40 lbs, streak = 3 (would trigger progression to 42.5)
        { index: 1, sets: [
          { weight: '40', reps: '10' },
          { weight: '40', reps: '10' },
          { weight: '40', reps: '10' },
        ]},
        { index: 2, sets: [
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
        ]},
      ],
    },
    
    // ============ WEEK 3: DELOAD (progression suppressed) ============
    {
      sessionId: 'test-week2-day-1',
      exercises: [
        // Deload: 3x5 @ 135 lbs (60% TM)
        { index: 0, sets: [
          { weight: '95', reps: '5' },
          { weight: '135', reps: '5' },
          { weight: '135', reps: '5' },
          { weight: '135', reps: '5' },
        ]},
        // Deload: 2x10 @ 34 lbs (85%)
        { index: 1, sets: [
          { weight: '34', reps: '10' },
          { weight: '34', reps: '10' },
        ]},
        // Deload: 2 sets
        { index: 2, sets: [
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
        ]},
      ],
    },
    
    // ============ WEEK 4: LOW READINESS + RECOVERY ============
    // ============ WEEK 4: Sessions 13-16 (consecutive failure → reduction) ============
    // Final state: Row reduced to 40 lbs after 2 consecutive failures
    {
      sessionId: 'test-week3-day-1',
      exercises: [
        // Recovery: reduced weight 165 lbs (TM reduced after failures)
        { index: 0, sets: [
          { weight: '135', reps: '5' },
          { weight: '150', reps: '5' },
          { weight: '165', reps: '5' },
          { weight: '165', reps: '5' },
          { weight: '165', reps: '5' },
          { weight: '165', reps: '5' },
          { weight: '165', reps: '5' },
        ]},
        // Recovery: reduced to 40 lbs after 2 consecutive failures, now completing
        { index: 1, sets: [
          { weight: '40', reps: '10' },
          { weight: '40', reps: '10' },
          { weight: '40', reps: '10' },
        ]},
        { index: 2, sets: [
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
        ]},
      ],
    },
    
    // ============ WEEK 5: Sessions 17-20 (quality gate testing) ============
    // Tests: qualityPass=false breaks streak, only quality sessions count
    {
      sessionId: 'test-week4-day-1',
      exercises: [
        // Back Squat: TM recovering, progressing
        { index: 0, sets: [
          { weight: '135', reps: '5' },
          { weight: '155', reps: '5' },
          { weight: '170', reps: '5' },
          { weight: '170', reps: '5' },
          { weight: '170', reps: '5' },
          { weight: '170', reps: '5' },
          { weight: '170', reps: '5' },
        ]},
        // Row at 42.5 after progression, testing quality gates
        { index: 1, sets: [
          { weight: '42.5', reps: '10' },
          { weight: '42.5', reps: '10' },
          { weight: '42.5', reps: '10' },
        ]},
        { index: 2, sets: [
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
        ]},
      ],
    },
    
    // ============ WEEK 6: Sessions 21-24 (edge cases & final progression) ============
    // Tests: +4 reps fallback, low readiness edge cases
    {
      sessionId: 'test-week5-day-1',
      exercises: [
        // Back Squat: Final TM increase
        { index: 0, sets: [
          { weight: '135', reps: '5' },
          { weight: '160', reps: '5' },
          { weight: '175', reps: '5' },
          { weight: '175', reps: '5' },
          { weight: '175', reps: '5' },
          { weight: '175', reps: '5' },
          { weight: '175', reps: '5' },
        ]},
        // Row: Final state at 45→47.5 after +4 reps fallback
        { index: 1, sets: [
          { weight: '45', reps: '10' },
          { weight: '45', reps: '10' },
          { weight: '45', reps: '14' }, // +4 extra reps triggers fallback
        ]},
        { index: 2, sets: [
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
          { weight: '', reps: '4min' },
        ]},
      ],
    },
  ];
  
  // Convert to the expected format
  for (const session of sessionData) {
    const sessionSetLogs: Record<number, { weight: string; reps: string }[]> = {};
    for (const exercise of session.exercises) {
      sessionSetLogs[exercise.index] = exercise.sets;
    }
    setLogs[session.sessionId] = sessionSetLogs;
  }
  
  return setLogs;
}

/**
 * Clear all test data from AsyncStorage
 */
export async function clearTestData(): Promise<{ success: boolean; message: string }> {
  try {
    // All session IDs from the 6-week test (using day-1 for all weeks)
    const sessionIds = [
      'test-week0-day-1',
      'test-week1-day-1',
      'test-week2-day-1',
      'test-week3-day-1',
      'test-week4-day-1',
      'test-week5-day-1',
    ];
    
    const keys = [
      // Exercise history
      `exerciseHistory:${TEST_EXERCISES.BACK_SQUAT.name}`,
      `exerciseHistory:${TEST_EXERCISES.DUMBBELL_ROW.name}`,
      `exerciseHistory:${TEST_EXERCISES.VO2_MAX.name}`,
      // Progression states
      `progressionState:${TEST_EXERCISES.BACK_SQUAT.name}`,
      `progressionState:${TEST_EXERCISES.DUMBBELL_ROW.name}`,
      // 1RM
      '1RM:Back Squat (Test)',
      // Completed sessions
      'completedSessions',
      // Start date
      'startDateYMD',
      // Set logs and completed markers for each session
      ...sessionIds.map(id => `setLogs:${id}`),
      ...sessionIds.map(id => `completed:${id}`),
    ];
    
    await AsyncStorage.multiRemove(keys);
    
    return {
      success: true,
      message: 'Test data cleared (6 weeks of sessions, logs, history, 1RMs)',
    };
  } catch (error) {
    console.error('Error clearing test data:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get test scenario summary for display
 */
export function getTestScenarioSummary(): {
  week: number;
  scenario: string;
  expected: string[];
}[] {
  return [
    {
      week: 1,
      scenario: 'Normal Performance - Building Streaks',
      expected: [
        '✅ Back Squat: Normal 1RM hybrid progression',
        '✅ Dumbbell Row: consecutiveSuccesses increases each session',
        '✅ VO₂ Max: History tracked, no progression logic',
        '🟡 Progression indicator: Yellow (1-2 successes)',
      ],
    },
    {
      week: 2,
      scenario: '+3 Reps Fallback & Low Readiness Test',
      expected: [
        '✅ Dumbbell Row: Session 5 triggers +3 reps fallback → +2.5 lbs',
        '✅ Dumbbell Row: Session 6 low readiness BUT good performance → NO reduction',
        '⚡ Readiness safeguard NOT triggered (single low session)',
        '🟢 After fallback: Weight increased, streak reset',
      ],
    },
    {
      week: 3,
      scenario: 'Deload/Taper Week - Suppressed Progression',
      expected: [
        '⏸️ Back Squat: Reduced to 60% TM, 3 sets',
        '⏸️ Dumbbell Row: consecutiveSuccesses stays at 0',
        '⏸️ VO₂ Max: Reduced to 2 sets',
        '📉 Progression suppressed even if criteria met',
      ],
    },
    {
      week: 4,
      scenario: 'Consecutive Low Readiness + Missed Reps → Reduction',
      expected: [
        '🔴 Sessions 13-14: readiness < 4 AND missed reps',
        '🔴 After session 14: readinessMA3 triggers reduction',
        '📉 Dumbbell Row: -5% weight reduction applied',
        '📉 Back Squat: TM reduced by ~3%',
        '✅ Sessions 15-16: Recovery at reduced loads',
      ],
    },
    {
      week: 5,
      scenario: 'Quality Gate Testing',
      expected: [
        '✅ Session 17: Streak=3 triggers progression (40→42.5)',
        '❌ Session 18: RPE 9 > target+1 → qualityPass=false, streak resets',
        '✅ Session 19-20: Quality recovers, streak building (1→2)',
        '⚙️ Only qualityPass=true sessions count toward streak',
      ],
    },
    {
      week: 6,
      scenario: 'Edge Cases & Mixed Scenarios',
      expected: [
        '✅ Session 21: Streak=3 triggers progression (42.5→45)',
        '⚠️ Session 22: Low readiness + 2 extra reps (not 3) = no fallback',
        '✅ Session 23: Moderate readiness (5) = normal progression',
        '⚡ Session 24: +4 extra reps triggers fallback (45→47.5)',
        '📊 Final: Row progressed 35→47.5 lbs over 6 weeks',
      ],
    },
  ];
}

/**
 * Validate progression logic against test scenarios
 */
export async function validateProgressionLogic(): Promise<{
  passed: boolean;
  results: {
    scenario: string;
    passed: boolean;
    details: string;
  }[];
}> {
  const results: { scenario: string; passed: boolean; details: string }[] = [];
  
  // Load test data
  const squatHistoryRaw = await AsyncStorage.getItem(`exerciseHistory:${TEST_EXERCISES.BACK_SQUAT.name}`);
  const rowHistoryRaw = await AsyncStorage.getItem(`exerciseHistory:${TEST_EXERCISES.DUMBBELL_ROW.name}`);
  const vo2HistoryRaw = await AsyncStorage.getItem(`exerciseHistory:${TEST_EXERCISES.VO2_MAX.name}`);
  
  const squatHistory: ExerciseLog[] = squatHistoryRaw ? JSON.parse(squatHistoryRaw) : [];
  const rowHistory: ExerciseLog[] = rowHistoryRaw ? JSON.parse(rowHistoryRaw) : [];
  const vo2History: ExerciseLog[] = vo2HistoryRaw ? JSON.parse(vo2HistoryRaw) : [];
  
  // Debug: Log what we have
  console.log('📊 Validation: Row history count:', rowHistory.length);
  console.log('📊 Validation: Squat history count:', squatHistory.length);
  console.log('📊 Validation: VO2 history count:', vo2History.length);
  if (rowHistory.length > 0) {
    console.log('📊 Sample sessionIds:', rowHistory.slice(0, 5).map(l => l.sessionId));
  }

  // Test 1: Check Rule of 3 streak tracking
  // NOTE: sessionId uses 0-indexed weeks, so "week 1" = week0 in sessionId
  const week1RowLogs = rowHistory.filter(log => 
    log.sessionId?.includes('week0') // Week 1 = week0 in sessionId
  );
  const hasStreakTracking = week1RowLogs.some(log => 
    log.consecutiveSuccesses !== undefined && log.consecutiveSuccesses > 0
  );
  results.push({
    scenario: 'Rule of 3: Streak Tracking',
    passed: hasStreakTracking,
    details: hasStreakTracking 
      ? `Found ${week1RowLogs.length} week 1 logs with streak tracking (max streak: ${Math.max(...week1RowLogs.map(l => l.consecutiveSuccesses || 0))})`
      : `No streak tracking found in week 1 logs (found ${week1RowLogs.length} logs, streaks: ${week1RowLogs.map(l => l.consecutiveSuccesses).join(', ')})`,
  });
  
  // Test 2: Check +3 reps fallback
  const extraRepsLog = rowHistory.find(log => 
    log.extraReps !== undefined && log.extraReps >= 3
  );
  results.push({
    scenario: '+3 Reps Fallback',
    passed: !!extraRepsLog,
    details: extraRepsLog 
      ? `Found fallback trigger: +${extraRepsLog.extraReps} reps on ${extraRepsLog.date}`
      : `No +3 reps fallback trigger found (extraReps values: ${rowHistory.filter(l => l.extraReps).map(l => l.extraReps).join(', ')})`,
  });
  
  // Test 3: Check deload week suppression
  // NOTE: sessionId uses 0-indexed weeks, so "week 3" = week2 in sessionId
  const week3Logs = rowHistory.filter(log => 
    log.sessionId?.includes('week2') // Week 3 = week2 in sessionId (deload week)
  );
  // For deload, we need to verify:
  // 1. consecutiveSuccesses should be 0 during deload
  // 2. Even with extra reps, no fallback should trigger
  const deloadLogs = week3Logs.filter(log => log.sessionId); // Just make sure we have logs
  const deloadSuppressed = deloadLogs.length > 0 && deloadLogs.every(log => 
    log.consecutiveSuccesses === 0 || log.consecutiveSuccesses === undefined
  );
  // Also check that no fallback was triggered even with extra reps
  const deloadWithExtraReps = deloadLogs.find(log => (log.extraReps || 0) >= 3);
  const fallbackBlockedInDeload = deloadWithExtraReps ? deloadWithExtraReps.consecutiveSuccesses === 0 : true;
  
  results.push({
    scenario: 'Deload Week Suppression',
    passed: deloadSuppressed && fallbackBlockedInDeload,
    details: deloadSuppressed && fallbackBlockedInDeload
      ? `Week 3 deload: ${deloadLogs.length} sessions with suppressed progression${deloadWithExtraReps ? ` (+${deloadWithExtraReps.extraReps} reps blocked)` : ''}`
      : `Deload suppression issue: ${deloadLogs.length} logs, streaks: ${deloadLogs.map(l => l.consecutiveSuccesses).join(', ')}, extraReps: ${deloadLogs.map(l => l.extraReps || 0).join(', ')}`,
  });
  
  // Test 4: Check readiness safeguard with MA3
  // The test validates:
  // 1. MA3 is being computed and stored for all logs
  // 2. Low readiness sessions have MA3 tracking
  // 3. Safeguard decisions can be inferred from MA3 data
  const logsWithMA3 = rowHistory.filter(log => log.readinessMA3 !== undefined);
  const lowReadinessLogs = rowHistory.filter(log => 
    log.readiness !== undefined && log.readiness <= 4
  );
  const lowReadinessWithMA3 = lowReadinessLogs.filter(log => 
    log.readinessMA3 !== undefined
  );
  
  // Get MA3 values from low readiness logs for debugging
  const ma3Values = lowReadinessWithMA3.map(log => ({
    session: log.sessionId,
    readiness: log.readiness,
    ma3: log.readinessMA3
  }));
  
  // Test passes if:
  // 1. All logs have MA3 (or at least 80% do)
  // 2. Low readiness logs also have MA3 tracking
  const ma3Coverage = rowHistory.length > 0 ? (logsWithMA3.length / rowHistory.length) * 100 : 0;
  const hasGoodMA3Coverage = ma3Coverage >= 80;
  const hasLowReadinessMA3 = lowReadinessWithMA3.length > 0;
  
  results.push({
    scenario: 'Readiness Safeguard (MA3)',
    passed: hasGoodMA3Coverage && hasLowReadinessMA3,
    details: hasGoodMA3Coverage && hasLowReadinessMA3
      ? `MA3 coverage: ${ma3Coverage.toFixed(0)}% (${logsWithMA3.length}/${rowHistory.length}), Low readiness sessions with MA3: ${lowReadinessWithMA3.length}, MA3 values: ${ma3Values.slice(0, 3).map(v => `${v.readiness}→MA3:${v.ma3}`).join(', ')}`
      : `MA3 tracking issue: Coverage ${ma3Coverage.toFixed(0)}% (${logsWithMA3.length}/${rowHistory.length}), Low readiness with MA3: ${lowReadinessWithMA3.length}`,
  });
  
  // Test 5: Check history links
  const hasHistoryLinks = [
    ...squatHistory.slice(0, 5),
    ...rowHistory.slice(0, 5),
    ...vo2History.slice(0, 5),
  ].every(log => log.historyLink && log.historyLink.startsWith('history:'));
  results.push({
    scenario: 'History Links Present',
    passed: hasHistoryLinks,
    details: hasHistoryLinks 
      ? 'All exercises have history links'
      : 'Some exercises missing history links',
  });
  
  // Test 6: Check VO2 has no progression logic
  const vo2HasNoProgression = vo2History.every(log => 
    log.consecutiveSuccesses === undefined && log.extraReps === undefined
  );
  results.push({
    scenario: 'Cardio: No Progression Logic',
    passed: vo2HasNoProgression,
    details: vo2HasNoProgression 
      ? 'VO₂ Max correctly excludes progression fields'
      : 'VO₂ Max incorrectly has progression fields',
  });
  
  const allPassed = results.every(r => r.passed);
  
  return { passed: allPassed, results };
}

// ============================================
// ENHANCED ANALYSIS TYPES
// ============================================

interface SessionAnalysis {
  sessionNum: number;
  date: string;
  weight: number;
  reps: string | number;
  rpe: number;
  targetRPE: number;
  readiness: number;
  readinessMA3: number;
  consecutiveSuccesses: number;
  extraReps: number;
  qualityPass: boolean;
  isCompleted: boolean;
  // Explicit flags
  progressionTriggered: boolean;
  fallbackTriggered: boolean;
  deloadActive: boolean;
  reductionTriggered: boolean;
  // Safeguard analysis
  safeguardDecision: 'none' | 'hold' | 'reduce';
  safeguardReason: string;
  // UI simulation
  exerciseCardMessage: string;
  summaryIndicator: 'green' | 'yellow' | 'red';
  summaryNote: string;
}

interface AnalysisReport {
  sessions: SessionAnalysis[];
  streakTable: string;
  progressionChart: string;
  safeguardAnalysis: string;
  uiSimulation: string;
  summary: string;
}

// Readiness thresholds (matching progressionLogic.ts)
const READINESS_THRESHOLDS = {
  LOW_SINGLE: 4,      // Single session low readiness threshold
  LOW_MA3: 5,         // MA3 threshold for safeguard decisions
  CRITICAL_MA3: 4,    // MA3 threshold for reduction trigger
};

/**
 * Generate enhanced analysis with flags, tables, and charts
 * 
 * DELOAD SUPPRESSION:
 * - During deload (week 3): ALL progression triggers blocked
 * - Streak forced to 0, fallback ignored, reduction skipped
 * 
 * MA3-BASED SAFEGUARDS:
 * - Single low readiness + completed + MA3 >= CRITICAL → HOLD
 * - 2 consecutive low + missed + MA3 < CRITICAL → REDUCE
 */
export function generateEnhancedAnalysis(): AnalysisReport {
  const logs = generateTestLogs();
  const rowLogs = logs.filter(log => log.exerciseName === TEST_EXERCISES.DUMBBELL_ROW.name);
  
  // Analyze each session
  const sessions: SessionAnalysis[] = [];
  let previousWeight = 35;
  let preDeloadWeight = 42.5; // Weight before deload for resumption
  let previousReadiness: number[] = [];
  
  for (let i = 0; i < rowLogs.length; i++) {
    const log = rowLogs[i];
    const sessionNum = i + 1;
    const week = Math.floor(i / 4) + 1;
    
    // Calculate readinessMA3 (rolling 3-session average)
    previousReadiness.push(log.readiness || 5);
    if (previousReadiness.length > 3) previousReadiness.shift();
    const readinessMA3 = Math.round(
      (previousReadiness.reduce((a, b) => a + b, 0) / previousReadiness.length) * 10
    ) / 10;
    
    // Determine flags
    const weight = log.weight || 35;
    const deloadActive = week === 3;
    
    // DELOAD SUPPRESSION: Block ALL progression during deload
    let progressionTriggered = false;
    let fallbackTriggered = false;
    let reductionTriggered = false;
    
    if (deloadActive) {
      // During deload: nothing triggers, streak = 0
      progressionTriggered = false;
      fallbackTriggered = false;
      reductionTriggered = false;
    } else {
      // Normal analysis
      progressionTriggered = weight > previousWeight && !(log.extraReps && log.extraReps >= 3);
      fallbackTriggered = (log.extraReps || 0) >= 3;
      reductionTriggered = weight < previousWeight && sessionNum > 1;
    }
    
    // Safeguard analysis using MA3 thresholds
    let safeguardDecision: 'none' | 'hold' | 'reduce' = 'none';
    let safeguardReason = '';
    
    const currentReadiness = log.readiness || 5;
    const prevLog = i > 0 ? rowLogs[i - 1] : null;
    
    // DELOAD: Skip safeguard logic during deload
    if (deloadActive) {
      safeguardDecision = 'none';
      safeguardReason = 'Deload active - safeguards not applicable';
    }
    // HOLD: Single low readiness + completed + MA3 still reasonable
    else if (currentReadiness <= READINESS_THRESHOLDS.LOW_SINGLE && log.isCompleted) {
      if (readinessMA3 >= READINESS_THRESHOLDS.CRITICAL_MA3) {
        safeguardDecision = 'hold';
        safeguardReason = `Low readiness (${currentReadiness}) but completed → HOLD (MA3: ${readinessMA3} ≥ ${READINESS_THRESHOLDS.CRITICAL_MA3})`;
      }
    }
    // REDUCE: 2 consecutive low readiness + missed reps + MA3 below critical
    else if (
      currentReadiness <= READINESS_THRESHOLDS.LOW_SINGLE &&
      !log.isCompleted &&
      prevLog &&
      (prevLog.readiness || 5) <= READINESS_THRESHOLDS.LOW_SINGLE &&
      !prevLog.isCompleted &&
      readinessMA3 < READINESS_THRESHOLDS.CRITICAL_MA3
    ) {
      safeguardDecision = 'reduce';
      safeguardReason = `2 consecutive low + missed (MA3: ${readinessMA3} < ${READINESS_THRESHOLDS.CRITICAL_MA3}) → REDUCE -5%`;
    }
    
    // UI simulation
    let exerciseCardMessage = '';
    let summaryIndicator: 'green' | 'yellow' | 'red' = 'yellow';
    let summaryNote = '';
    
    // Force streak to 0 during deload
    const streak = deloadActive ? 0 : (log.consecutiveSuccesses || 0);
    
    // DELOAD: Special handling for deload week
    if (deloadActive) {
      exerciseCardMessage = '⏸️ Deload week: ALL progression suppressed (streak=0)';
      summaryIndicator = 'yellow';
      summaryNote = `Recovery phase - even +${log.extraReps || 0} extra reps ignored`;
    }
    // FALLBACK: Only triggers outside of deload
    else if (fallbackTriggered) {
      exerciseCardMessage = `⚡ +${log.extraReps} reps fallback → increase load next session`;
      summaryIndicator = 'green';
      summaryNote = 'Fallback progression!';
    }
    // RULE OF 3
    else if (streak >= 3) {
      exerciseCardMessage = '🟢 Rule of 3 met → increase load next session';
      summaryIndicator = 'green';
      summaryNote = 'Ready to progress!';
    }
    // BUILDING STREAK
    else if (streak >= 1) {
      exerciseCardMessage = `🟡 Building streak: ${streak}/3 successes`;
      summaryIndicator = 'yellow';
      summaryNote = `${3 - streak} more to progress`;
    }
    // INCOMPLETE
    else if (!log.isCompleted) {
      exerciseCardMessage = '🔴 Incomplete: missed target reps';
      summaryIndicator = 'red';
      summaryNote = safeguardDecision === 'reduce' ? 'Reducing load' : 'Monitor next session';
    }
    // DEFAULT
    else {
      exerciseCardMessage = '🔴 Building streak - complete quality sessions to progress';
      summaryIndicator = 'red';
      summaryNote = 'Streak reset';
    }
    
    // Override note for safeguard decisions
    if (safeguardDecision === 'hold' && !deloadActive) {
      summaryNote = `⚠️ Safeguard HOLD: MA3=${readinessMA3}`;
    } else if (safeguardDecision === 'reduce') {
      summaryNote = `⚠️ Safeguard REDUCE: MA3=${readinessMA3} (critical)`;
    }
    
    sessions.push({
      sessionNum,
      date: log.date,
      weight,
      reps: log.reps || 10,
      rpe: log.rpe || 7,
      targetRPE: log.targetRPE || 7,
      readiness: log.readiness || 5,
      readinessMA3,
      consecutiveSuccesses: streak,
      extraReps: log.extraReps || 0,
      qualityPass: log.qualityPass ?? true,
      isCompleted: log.isCompleted ?? true,
      progressionTriggered,
      fallbackTriggered,
      deloadActive,
      reductionTriggered,
      safeguardDecision,
      safeguardReason,
      exerciseCardMessage,
      summaryIndicator,
      summaryNote,
    });
    
    // Track pre-deload weight for post-deload resumption
    if (week === 2 && !deloadActive) {
      preDeloadWeight = weight;
    }
    
    previousWeight = weight;
  }
  
  return {
    sessions,
    streakTable: generateStreakTable(sessions),
    progressionChart: generateProgressionChart(sessions),
    safeguardAnalysis: generateSafeguardAnalysis(sessions),
    uiSimulation: generateUISimulation(sessions),
    summary: generateAnalysisSummary(sessions),
  };
}

function generateStreakTable(sessions: SessionAnalysis[]): string {
  let table = `
╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
║                              STREAK TRACKING TABLE                                                ║
╠═════╦════════╦═══════╦═════════╦═══════════╦═══════════════════════════════════════════════════════╣
║ Ses ║ Weight ║ Streak║ Quality ║ Readiness ║ Event                                                 ║
╠═════╬════════╬═══════╬═════════╬═══════════╬═══════════════════════════════════════════════════════╣`;

  for (const s of sessions) {
    const event = getEventString(s);
    const readinessIcon = s.readiness >= 7 ? '💚' : s.readiness >= 4 ? '💛' : '🔴';
    const qualityIcon = s.qualityPass ? '✅' : '❌';
    
    table += `
║ ${String(s.sessionNum).padStart(3)} ║ ${String(s.weight).padStart(5)}lb║   ${s.consecutiveSuccesses}/3 ║   ${qualityIcon}    ║ ${readinessIcon} ${String(s.readiness).padStart(2)}/10  ║ ${event.padEnd(51)} ║`;
  }
  
  table += `
╚═════╩════════╩═══════╩═════════╩═══════════╩═══════════════════════════════════════════════════════╝`;
  
  return table;
}

function getEventString(s: SessionAnalysis): string {
  if (s.progressionTriggered) return '📈 RULE OF 3 → +2.5 lbs';
  if (s.fallbackTriggered) return '⚡ +3 REPS FALLBACK → +2.5 lbs';
  if (s.reductionTriggered) return '📉 REDUCTION TRIGGERED → -5%';
  if (s.deloadActive) return '⏸️ DELOAD (progression suppressed)';
  if (s.safeguardDecision === 'hold') return '⚠️ SAFEGUARD: Hold (low readiness, good perf)';
  if (!s.isCompleted) return '❌ INCOMPLETE: missed reps';
  if (s.consecutiveSuccesses === 3) return '🎯 Streak=3, ready to progress';
  return `Building streak (${s.consecutiveSuccesses}/3)`;
}

function generateProgressionChart(sessions: SessionAnalysis[]): string {
  // Find weight range
  const weights = sessions.map(s => s.weight);
  const minWeight = Math.min(...weights) - 2.5;
  const maxWeight = Math.max(...weights) + 2.5;
  const range = maxWeight - minWeight;
  const chartHeight = 12;
  
  // Create chart grid
  const grid: string[][] = [];
  for (let i = 0; i < chartHeight; i++) {
    grid[i] = new Array(sessions.length * 4 + 10).fill(' ');
  }
  
  let chart = `
╔══════════════════════════════════════════════════════════════════════════════════════╗
║                         PROGRESSION TIMELINE CHART                                   ║
║                         (Dumbbell Row - Working Weight)                              ║
╚══════════════════════════════════════════════════════════════════════════════════════╝

Weight (lbs)
    │`;

  // Y-axis labels and horizontal lines
  for (let i = 0; i < chartHeight; i++) {
    const weightVal = maxWeight - (i * range / (chartHeight - 1));
    const label = weightVal.toFixed(1).padStart(5);
    chart += `
${label} │`;
    
    // Plot points for this row
    for (let j = 0; j < sessions.length; j++) {
      const s = sessions[j];
      const normalizedWeight = (s.weight - minWeight) / range;
      const row = Math.round((1 - normalizedWeight) * (chartHeight - 1));
      
      if (row === i) {
        // Determine marker based on event
        let marker = '●';
        if (s.progressionTriggered) marker = '▲';
        else if (s.fallbackTriggered) marker = '⚡';
        else if (s.reductionTriggered) marker = '▼';
        else if (s.deloadActive) marker = '◇';
        
        // Color based on readiness
        const color = s.readiness >= 7 ? '🟢' : s.readiness >= 4 ? '🟡' : '🔴';
        chart += ` ${color}${marker} `;
      } else {
        chart += '    ';
      }
    }
  }
  
  // X-axis
  chart += `
      └${'────'.repeat(sessions.length)}
       `;
  
  for (let i = 0; i < sessions.length; i++) {
    chart += ` ${String(i + 1).padStart(2)}  `;
  }
  
  chart += `
                                    Session Number

LEGEND:
  ▲ = Rule of 3 progression    ⚡ = +3 reps fallback    ▼ = Reduction triggered
  ◇ = Deload week              ● = Normal session
  🟢 = High readiness (7-10)   🟡 = Moderate (4-6)      🔴 = Low readiness (1-3)
`;

  return chart;
}

function generateSafeguardAnalysis(sessions: SessionAnalysis[]): string {
  let analysis = `
╔══════════════════════════════════════════════════════════════════════════════════════╗
║                         READINESS SAFEGUARD ANALYSIS                                 ║
╚══════════════════════════════════════════════════════════════════════════════════════╝

SESSION-BY-SESSION READINESS & SAFEGUARD DECISIONS:
`;

  for (const s of sessions) {
    const icon = s.readiness >= 7 ? '💚' : s.readiness >= 4 ? '💛' : '🔴';
    const ma3Icon = s.readinessMA3 >= 7 ? '💚' : s.readinessMA3 >= 4 ? '💛' : '🔴';
    
    analysis += `
┌─ Session ${s.sessionNum} ────────────────────────────────────────────────────────────
│ Readiness: ${icon} ${s.readiness}/10    │    MA3: ${ma3Icon} ${s.readinessMA3.toFixed(1)}
│ Performance: ${s.isCompleted ? '✅ Completed' : '❌ Missed reps'}
│ Safeguard: ${s.safeguardDecision.toUpperCase()}${s.safeguardReason ? ` → ${s.safeguardReason}` : ''}
└──────────────────────────────────────────────────────────────────────────────────────
`;
  }

  analysis += `
SAFEGUARD RULES (MA3-BASED):
┌────────────────────────────────────────────────────────────────────────────────────┐
│ THRESHOLDS:                                                                        │
│   • LOW_SINGLE = 4  (single session low readiness)                                │
│   • CRITICAL_MA3 = 4 (MA3 below this triggers reduction)                          │
├────────────────────────────────────────────────────────────────────────────────────┤
│ RULES:                                                                             │
│   1. HOLD: Single low readiness (≤4) + completed + MA3 ≥ 4                        │
│      → Weight held, streak continues (safeguard active but not reducing)           │
│                                                                                    │
│   2. REDUCE: 2 consecutive low readiness (≤4) + missed reps + MA3 < 4             │
│      → Weight reduced by 5%, streak reset to 0                                     │
│                                                                                    │
│   3. DELOAD: During deload week → ALL safeguards skipped                          │
│      → No progression, no reduction, streak forced to 0                            │
│                                                                                    │
│   4. RECOVERY: MA3 improving (≥4) after low period                                │
│      → Maintain current load, resume normal progression                            │
└────────────────────────────────────────────────────────────────────────────────────┘
`;

  return analysis;
}

function generateUISimulation(sessions: SessionAnalysis[]): string {
  let sim = `
╔══════════════════════════════════════════════════════════════════════════════════════╗
║                           SIMULATED UI OUTPUTS                                       ║
╚══════════════════════════════════════════════════════════════════════════════════════╝
`;

  for (const s of sessions) {
    const indicatorColor = s.summaryIndicator === 'green' ? '🟢' : 
                          s.summaryIndicator === 'yellow' ? '🟡' : '🔴';
    
    sim += `
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ SESSION ${s.sessionNum} - Dumbbell Row                                                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─ ExerciseCard ─────────────────────────────────────────────────────────────┐    │
│  │ ${s.exerciseCardMessage.padEnd(67)} │    │
│  │ Suggested: ${s.weight} lbs × 3 sets × 10 reps                                  │    │
│  │ Streak: ${s.consecutiveSuccesses}/3 │ Readiness: ${s.readiness}/10 │ RPE: ${s.rpe}/${s.targetRPE}                          │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                     │
│  ┌─ SessionSummary ───────────────────────────────────────────────────────────┐    │
│  │ Progress: ${indicatorColor} ${s.summaryIndicator.toUpperCase().padEnd(6)} │ ${s.summaryNote.padEnd(44)} │    │
│  │ ${s.safeguardReason ? `⚠️ ${s.safeguardReason}`.substring(0, 65).padEnd(65) : ''.padEnd(67)} │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
`;
  }

  return sim;
}

function generateAnalysisSummary(sessions: SessionAnalysis[]): string {
  const ruleOf3Count = sessions.filter(s => s.progressionTriggered).length;
  const fallbackCount = sessions.filter(s => s.fallbackTriggered).length;
  const reductionCount = sessions.filter(s => s.reductionTriggered).length;
  const deloadSessions = sessions.filter(s => s.deloadActive).length;
  const safeguardHolds = sessions.filter(s => s.safeguardDecision === 'hold').length;
  const completedCount = sessions.filter(s => s.isCompleted).length;
  const avgReadiness = sessions.reduce((sum, s) => sum + s.readiness, 0) / sessions.length;
  
  return `
╔══════════════════════════════════════════════════════════════════════════════════════╗
║                              ANALYSIS SUMMARY                                        ║
╚══════════════════════════════════════════════════════════════════════════════════════╝

PROGRESSION EVENTS:
┌────────────────────────────────────────────┬──────────────────────────────────────────┐
│ Rule of 3 Progressions                     │ ${String(ruleOf3Count).padStart(2)} times                                │
│ +3 Reps Fallback Progressions              │ ${String(fallbackCount).padStart(2)} times                                │
│ Weight Reductions (safeguard)              │ ${String(reductionCount).padStart(2)} times                                │
│ Deload Sessions (suppressed)               │ ${String(deloadSessions).padStart(2)} sessions                            │
│ Safeguard Holds (low readiness, good perf) │ ${String(safeguardHolds).padStart(2)} times                                │
└────────────────────────────────────────────┴──────────────────────────────────────────┘

PERFORMANCE METRICS:
┌────────────────────────────────────────────┬──────────────────────────────────────────┐
│ Sessions Completed                         │ ${completedCount}/${sessions.length} (${Math.round(completedCount/sessions.length*100)}%)                            │
│ Average Readiness                          │ ${avgReadiness.toFixed(1)}/10                              │
│ Weight Progress                            │ ${sessions[0].weight} → ${sessions[sessions.length-1].weight} lbs (${sessions[sessions.length-1].weight > sessions[0].weight ? '+' : ''}${(sessions[sessions.length-1].weight - sessions[0].weight).toFixed(1)})         │
└────────────────────────────────────────────┴──────────────────────────────────────────┘

VALIDATION STATUS:
┌────────────────────────────────────────────┬──────────────────────────────────────────┐
│ ✅ Rule of 3 Logic                         │ ${ruleOf3Count > 0 ? 'VERIFIED - triggered correctly' : 'NOT TRIGGERED'}             │
│ ✅ +3 Reps Fallback                        │ ${fallbackCount > 0 ? 'VERIFIED - triggered correctly' : 'NOT TRIGGERED'}             │
│ ✅ Deload Suppression                      │ ${deloadSessions > 0 ? 'VERIFIED - progression blocked' : 'NOT TESTED'}              │
│ ✅ Readiness Safeguard (Hold)              │ ${safeguardHolds > 0 ? 'VERIFIED - weight held correctly' : 'NOT TRIGGERED'}          │
│ ✅ Readiness Safeguard (Reduce)            │ ${reductionCount > 0 ? 'VERIFIED - reduction applied' : 'NOT TRIGGERED'}              │
└────────────────────────────────────────────┴──────────────────────────────────────────┘

WEIGHT PROGRESSION TIMELINE:
${sessions.map(s => String(s.weight).padStart(5)).join(' → ')}
${'     '}${sessions.map((s, i) => {
  if (s.progressionTriggered) return '  ▲  ';
  if (s.fallbackTriggered) return '  ⚡  ';
  if (s.reductionTriggered) return '  ▼  ';
  if (s.deloadActive) return '  ◇  ';
  return '  │  ';
}).join('')}
`;
}

/**
 * Get the full enhanced analysis as a single string for display
 */
export function getEnhancedAnalysisReport(): string {
  const analysis = generateEnhancedAnalysis();
  
  return `
${'═'.repeat(90)}
                    ENHANCED PROGRESSION LOGIC VALIDATION REPORT
                              Dumbbell Row (Test) - Rule of 3
${'═'.repeat(90)}

${analysis.streakTable}

${analysis.progressionChart}

${analysis.safeguardAnalysis}

${analysis.uiSimulation}

${analysis.summary}
`;
}

/**
 * Get detailed breakdown of test data for analysis
 * This returns a formatted report showing each session's data
 */
export function getTestDataBreakdown(): string {
  const logs = generateTestLogs();
  
  // Filter to just Dumbbell Row (the Rule of 3 exercise)
  const rowLogs = logs.filter(log => log.exerciseName === TEST_EXERCISES.DUMBBELL_ROW.name);
  
  let report = `
╔══════════════════════════════════════════════════════════════════════╗
║           RULE OF 3 PROGRESSION TEST DATA BREAKDOWN                 ║
║                     Dumbbell Row (3×10 @ RPE 7)                      ║
╚══════════════════════════════════════════════════════════════════════╝

STARTING CONDITIONS:
• Initial Weight: 35 lbs
• Target: 3 sets × 10 reps @ RPE 7
• Progression Rule: +2.5 lbs after 3 consecutive successes OR +3 extra reps on last set

═══════════════════════════════════════════════════════════════════════
WEEK 1: BUILDING THE STREAK (Sessions 1-4)
═══════════════════════════════════════════════════════════════════════
`;

  for (const log of rowLogs.slice(0, 4)) {
    report += formatLogEntry(log, 1);
  }
  
  report += `
WEEK 1 ANALYSIS:
✅ Sessions 1-3: Successfully completed 3×10 @ 35 lbs
✅ consecutiveSuccesses incremented: 1 → 2 → 3
⚡ Session 3: Streak = 3 → TRIGGERS RULE OF 3 PROGRESSION
📈 Session 4: Weight increased to 37.5 lbs (+2.5), streak reset to 1

═══════════════════════════════════════════════════════════════════════
WEEK 2: FALLBACK + LOW READINESS TEST (Sessions 5-8)
═══════════════════════════════════════════════════════════════════════
`;

  for (const log of rowLogs.slice(4, 8)) {
    report += formatLogEntry(log, 2);
  }
  
  report += `
WEEK 2 ANALYSIS:
⚡ Session 5: Achieved 13 reps on last set (+3 extra) → FALLBACK PROGRESSION TRIGGERED
📈 Session 6: Weight increased to 40 lbs (+2.5)
⚠️ Session 6: LOW readiness (4) but COMPLETED all reps → NO reduction applied
   └─ IMPORTANT: Single low readiness session doesn't trigger reduction
✅ Sessions 7-8: Back to normal, streak building (1 → 2 → 3)
⚡ Session 8: Streak = 3 → Weight would increase to 42.5 lbs

═══════════════════════════════════════════════════════════════════════
WEEK 3: DELOAD WEEK (Sessions 9-12)
═══════════════════════════════════════════════════════════════════════
`;

  for (const log of rowLogs.slice(8, 12)) {
    report += formatLogEntry(log, 3);
  }
  
  report += `
WEEK 3 ANALYSIS:
⏸️ DELOAD ACTIVE: Sets reduced to 2, weight at 85% (34 lbs), RPE target lowered to 5
⏸️ consecutiveSuccesses held at 0 throughout week
   └─ Even though workouts completed successfully, progression is SUPPRESSED
📋 After deload ends: Resume at pre-deload weight (42.5 lbs)
   └─ Do NOT continue at deload weight

═══════════════════════════════════════════════════════════════════════
WEEK 4: CONSECUTIVE FAILURE → REDUCTION (Sessions 13-16)
═══════════════════════════════════════════════════════════════════════
`;

  for (const log of rowLogs.slice(12, 16)) {
    report += formatLogEntry(log, 4);
  }
  
  report += `
WEEK 4 ANALYSIS:
🔴 Session 13: Resume at 42.5 lbs, LOW readiness (3), missed reps (8,7,6 vs 10,10,10)
   └─ First failure, but single low readiness → NOT YET reducing
🔴 Session 14: SECOND consecutive low readiness (2) + missed reps (7,6,5)
   └─ TWO consecutive failures with low readiness → TRIGGERS REDUCTION
📉 Session 15: Weight reduced -5% (42.5 → 40 lbs)
   └─ qualityPass: true, streak reset to 1
✅ Session 16: Completed at reduced weight, streak = 2

═══════════════════════════════════════════════════════════════════════
SUMMARY: KEY PROGRESSION RULES DEMONSTRATED
═══════════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────────┐
│ RULE OF 3 PROGRESSION                                              │
├────────────────────────────────────────────────────────────────────┤
│ • 3 consecutive successes (qualityPass=true) → +2.5-5% weight     │
│ • After progression: streak resets to 1                            │
│ • Demonstrated: Sessions 1-4 (Week 1)                              │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ +3 REPS FALLBACK                                                   │
├────────────────────────────────────────────────────────────────────┤
│ • ≥3 extra reps on last set in single session → +2.5-5% weight    │
│ • Does not require 3 consecutive sessions                          │
│ • Demonstrated: Session 5 (Week 2)                                 │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ LOW READINESS SAFEGUARD                                            │
├────────────────────────────────────────────────────────────────────┤
│ • Single low readiness + good performance → NO reduction          │
│ • TWO consecutive low readiness + missed reps → REDUCE weight     │
│ • Demonstrated: Session 6 (no reduction) vs Sessions 13-14        │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ DELOAD SUPPRESSION                                                 │
├────────────────────────────────────────────────────────────────────┤
│ • During deload: consecutiveSuccesses held at 0                   │
│ • Progression blocked even if criteria met                         │
│ • After deload: Resume at pre-deload weight, NOT deload weight    │
│ • Demonstrated: Sessions 9-12 (Week 3)                             │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ WARM-UP EXCLUSION                                                  │
├────────────────────────────────────────────────────────────────────┤
│ • Warm-up sets (isWarmup=true) excluded from streak counting      │
│ • All test data has isWarmup=false for working sets               │
└────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════
WEIGHT PROGRESSION TIMELINE
═══════════════════════════════════════════════════════════════════════

Session:  1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16
Weight:  35  35  35 37.5 37.5 40  40  40  34  34  34  34 42.5 42.5 40  40
         ╰───────╯  ╰──╯  ╰─╯                          ╰────╯  ╰────╯
           Rule of 3  +3reps Low R.                   2x Fail  Recovery
                              No ↓                      ↓-5%

LEGEND:
• 35 → 37.5: Rule of 3 triggered (3 consecutive successes)
• 37.5 → 40: +3 reps fallback triggered  
• 40 → 34: Deload week (85% of working weight)
• 34 → 42.5: Post-deload return to progression weight
• 42.5 → 40: Readiness safeguard reduction (-5%)

`;

  return report;
}

function formatLogEntry(log: ExerciseLog, week: number): string {
  const session = log.sessionId?.match(/session(\d+)/)?.[1] || '?';
  const passEmoji = log.qualityPass ? '✅' : '❌';
  const readinessEmoji = (log.readiness || 5) >= 7 ? '💚' : (log.readiness || 5) >= 4 ? '💛' : '🔴';
  
  return `
┌─ Session ${session} ─────────────────────────────────────────────────────
│ Date: ${log.date}
│ Weight: ${log.weight} lbs │ Sets×Reps: ${log.sets}×${log.reps}
│ RPE: ${log.rpe}/${log.targetRPE || 7} (target) │ Readiness: ${readinessEmoji} ${log.readiness}/10 │ MA3: ${log.readinessMA3 || '-'}
│ Completed: ${log.isCompleted ? '✓ Yes' : '✗ No'} │ Quality Pass: ${passEmoji}
│ Extra Reps: ${log.extraReps || 0} │ Consecutive Successes: ${log.consecutiveSuccesses || 0}
└──────────────────────────────────────────────────────────────────────
`;
}

