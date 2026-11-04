/**
 * 4-Month Test Data Generator
 * 16 weeks (112 days) of comprehensive test data to validate all progression logic
 * 
 * Test Scenarios Covered:
 * - Multiple Rule of 3 progressions
 * - Multiple +3 reps fallbacks
 * - Multiple deload weeks (weeks 4, 8, 12, 16)
 * - Readiness safeguards at various points
 * - 1RM progression over extended period
 * - Quality gate failures and recoveries
 * - Edge cases and boundary conditions
 * - Recovery scenarios after reductions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExerciseLog, saveExerciseLog, saveProgressionState, ProgressionState } from './progressionLogic';

// Test exercise definitions (same as original)
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
  LATERAL_RAISE: {
    name: 'Lateral Raise (Test)',
    trackingMode: 'volume' as const,
    exerciseCategory: 'assistance' as const,
    sets: 3,
    reps: 12, // High reps for rest reduction option
    rest: 90, // For rest reduction testing
    targetRPE: 7,
    // No tempo (for tempo modification option)
    // Not trackable for 1RM (trackingMode !== '1RM')
  },
};

/**
 * Generate 4 months (16 weeks) of comprehensive test logs
 * 64 sessions total (4 sessions per week)
 */
export function generate4MonthTestLogs(): ExerciseLog[] {
  const logs: ExerciseLog[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 112); // Start 112 days ago (16 weeks)

  // Helper to add days
  const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  // ========================================
  // DUMBBELL ROW TEST DATA (Rule of 3 - Assistance Exercise)
  // Starting weight: 35 lbs, target: 3x10 @ RPE 7
  // minIncrement: 2.5 lbs (assistance category)
  // ========================================
  const rowTestData: Array<{
    session: number;
    week: number;
    date: Date;
    weight: number;
    sets: number;
    reps: string;
    rpe: number;
    readiness: number;
    completed: boolean;
    extraReps: number;
    consecutiveSuccesses: number;
    qualityPass: boolean;
    testCase: string;
    expected: string;
  }> = [];

  // Track progression state properly
  let currentWeight = 35;
  let currentStreak = 0;
  let preDeloadWeight = 35; // Track weight before deload
  let sessionNum = 0;

  // Generate 16 weeks of data
  for (let week = 1; week <= 16; week++) {
    const isDeloadWeek = week === 4 || week === 8 || week === 12 || week === 16;
    const deloadSets = isDeloadWeek ? 2 : 3;

    for (let sessionInWeek = 1; sessionInWeek <= 4; sessionInWeek++) {
      sessionNum++;
      const daysFromStart = (week - 1) * 7 + (sessionInWeek - 1) * 2; // Sessions every 2 days
      const date = addDays(baseDate, daysFromStart);

      let weight: number;
      let reps: string;
      let rpe: number;
      let readiness: number;
      let completed: boolean;
      let extraReps = 0;
      let qualityPass: boolean;
      let testCase: string;
      let expected: string;
      let streakAfterSession = currentStreak;

      // Determine weight for this session
      if (isDeloadWeek) {
        weight = Math.round(preDeloadWeight * 0.85 * 2) / 2; // 85% of pre-deload weight
      } else if (week === 5 && sessionInWeek === 1) {
        // Post-deload: resume at pre-deload weight
        weight = preDeloadWeight;
      } else if (week === 9 && sessionInWeek === 1) {
        weight = preDeloadWeight;
      } else if (week === 13 && sessionInWeek === 1) {
        weight = preDeloadWeight;
      } else if (week === 17 && sessionInWeek === 1) {
        weight = preDeloadWeight;
      } else {
        weight = currentWeight;
      }

      if (isDeloadWeek) {
        // Deload week: reduced weight, reduced sets, progression suppressed
        reps = '10,10';
        rpe = 5;
        readiness = 8 + Math.floor(Math.random() * 2); // High readiness during deload
        completed = true;
        qualityPass = true;
        streakAfterSession = 0; // Streak reset during deload
        testCase = 'DELOAD_SUPPRESS';
        expected = 'Deload: progression blocked, streak=0';
      } else if (week === 1 && sessionInWeek <= 3) {
        // Week 1: Building initial streak
        reps = '10,10,10';
        rpe = 7;
        readiness = 7;
        completed = true;
        qualityPass = true;
        streakAfterSession = currentStreak + 1;
        testCase = 'RULE_OF_3_STREAK';
        expected = `Streak=${streakAfterSession}, building toward 3`;
      } else if (week === 1 && sessionInWeek === 4) {
        // Week 1 Session 4: First Rule of 3 trigger
        reps = '10,10,10';
        rpe = 7;
        readiness = 7;
        completed = true;
        qualityPass = true;
        streakAfterSession = 3; // This session completes streak of 3
        testCase = 'RULE_OF_3_TRIGGER';
        expected = 'Streak=3 → TRIGGERS PROGRESSION (weight increases next session)';
        // Progression happens after this session
        currentWeight = 37.5;
        preDeloadWeight = 37.5;
        streakAfterSession = 1; // Reset to 1 after progression
      } else if (week === 2 && sessionInWeek === 1) {
        // Week 2 Session 1: +3 reps fallback (at new weight 37.5)
        reps = '10,10,13';
        rpe = 8;
        readiness = 8;
        completed = true;
        extraReps = 3;
        qualityPass = true;
        streakAfterSession = 0; // Fallback resets streak
        testCase = 'FALLBACK_+3_REPS';
        expected = '+3 extra reps → TRIGGERS FALLBACK (weight increases next session)';
        // Fallback progression happens after this session
        currentWeight = 40;
        preDeloadWeight = 40;
        streakAfterSession = 1; // Reset to 1 after fallback
      } else if (week === 2 && sessionInWeek === 2) {
        // Week 2 Session 2: Low readiness but good performance (hold)
        reps = '10,10,10';
        rpe = 7;
        readiness = 4;
        completed = true;
        qualityPass = true;
        streakAfterSession = currentStreak + 1;
        testCase = 'SAFEGUARD_HOLD';
        expected = 'Low readiness + completed = NO reduction (hold)';
      } else if (week === 3 && sessionInWeek === 3) {
        // Week 3 Session 3: Another Rule of 3 trigger
        reps = '10,10,10';
        rpe = 7;
        readiness = 7;
        completed = true;
        qualityPass = true;
        streakAfterSession = 3; // Completes streak of 3
        testCase = 'RULE_OF_3_TRIGGER';
        expected = 'Streak=3 → TRIGGERS PROGRESSION';
        currentWeight = 42.5;
        preDeloadWeight = 42.5;
        streakAfterSession = 1;
      } else if (week === 5 && sessionInWeek === 1) {
        // Week 5 Session 1: Post-deload resume at pre-deload weight
        reps = '10,10,10';
        rpe = 7;
        readiness = 7;
        completed = true;
        qualityPass = true;
        streakAfterSession = 1; // Start fresh after deload
        testCase = 'POST_DELOAD_RESUME';
        expected = 'Resume at pre-deload weight (42.5), not deload weight';
      } else if (week === 6 && sessionInWeek <= 2) {
        // Week 6 Sessions 1-2: Consecutive low readiness + missed reps → reduction
        if (sessionInWeek === 1) {
          reps = '8,7,6';
          rpe = 9;
          readiness = 3;
          completed = false;
          qualityPass = false;
          streakAfterSession = 0;
          testCase = 'SAFEGUARD_FIRST_FAIL';
          expected = 'First failure: low readiness + missed = waiting';
        } else {
          reps = '7,6,5';
          rpe = 10;
          readiness = 2;
          completed = false;
          qualityPass = false;
          streakAfterSession = 0;
          testCase = 'SAFEGUARD_REDUCE';
          expected = '2nd consecutive failure → TRIGGERS REDUCTION (weight decreases next session)';
          // Reduction happens after this session
          currentWeight = 40; // -5% reduction
          preDeloadWeight = 40;
          streakAfterSession = 1; // Reset to 1 after reduction
        }
      } else if (week === 6 && sessionInWeek >= 3) {
        // Week 6 Sessions 3-4: Recovery at reduced weight
        reps = '10,10,10';
        rpe = 7;
        readiness = 6 + (sessionInWeek - 3);
        completed = true;
        qualityPass = true;
        streakAfterSession = currentStreak + 1;
        testCase = 'POST_REDUCTION_RECOVERY';
        expected = 'Recovery at reduced weight, streak building';
      } else if (week === 7 && sessionInWeek === 2) {
        // Week 7 Session 2: Quality gate failure (RPE too high)
        reps = '10,10,10';
        rpe = 9;
        readiness = 6;
        completed = true;
        qualityPass = false; // RPE 9 > target+1
        streakAfterSession = 0; // Streak broken
        testCase = 'QUALITY_GATE_FAIL_RPE';
        expected = 'Completed but RPE 9 > target+1 → qualityPass=false, streak=0';
      } else if (week === 9 && sessionInWeek === 1) {
        // Week 9 Session 1: Post-deload resume
        reps = '10,10,10';
        rpe = 7;
        readiness = 7;
        completed = true;
        qualityPass = true;
        streakAfterSession = 1;
        testCase = 'POST_DELOAD_RESUME';
        expected = 'Resume at pre-deload weight';
      } else if (week === 10 && sessionInWeek === 3) {
        // Week 10 Session 3: +4 reps fallback
        reps = '10,10,14';
        rpe = 8;
        readiness = 8;
        completed = true;
        extraReps = 4;
        qualityPass = true;
        streakAfterSession = 0;
        testCase = 'FALLBACK_+4_REPS';
        expected = '+4 extra reps → TRIGGERS FALLBACK (≥3)';
        currentWeight += 2.5;
        preDeloadWeight = currentWeight;
        streakAfterSession = 1;
      } else if (week === 11 && sessionInWeek === 4) {
        // Week 11 Session 4: Rule of 3 trigger
        reps = '10,10,10';
        rpe = 7;
        readiness = 7;
        completed = true;
        qualityPass = true;
        streakAfterSession = 3;
        testCase = 'RULE_OF_3_TRIGGER';
        expected = 'Streak=3 → TRIGGERS PROGRESSION';
        currentWeight += 2.5;
        preDeloadWeight = currentWeight;
        streakAfterSession = 1;
      } else if (week === 13 && sessionInWeek === 1) {
        // Week 13 Session 1: Post-deload resume
        reps = '10,10,10';
        rpe = 7;
        readiness = 7;
        completed = true;
        qualityPass = true;
        streakAfterSession = 1;
        testCase = 'POST_DELOAD_RESUME';
        expected = 'Resume at pre-deload weight';
      } else if (week === 14 && sessionInWeek <= 2) {
        // Week 14 Sessions 1-2: Another readiness safeguard scenario
        if (sessionInWeek === 1) {
          reps = '9,8,7';
          rpe = 9;
          readiness = 3;
          completed = false;
          qualityPass = false;
          streakAfterSession = 0;
          testCase = 'SAFEGUARD_FIRST_FAIL';
          expected = 'First failure: waiting for second';
        } else {
          reps = '8,7,6';
          rpe = 10;
          readiness = 2;
          completed = false;
          qualityPass = false;
          streakAfterSession = 0;
          testCase = 'SAFEGUARD_REDUCE';
          expected = '2nd consecutive failure → TRIGGERS REDUCTION';
          currentWeight = Math.round((currentWeight * 0.95) * 2) / 2; // -5%
          preDeloadWeight = currentWeight;
          streakAfterSession = 1;
        }
      } else if (week === 15 && sessionInWeek === 2) {
        // Week 15 Session 2: +3 reps fallback
        reps = '10,10,13';
        rpe = 8;
        readiness = 8;
        completed = true;
        extraReps = 3;
        qualityPass = true;
        streakAfterSession = 0;
        testCase = 'FALLBACK_+3_REPS';
        expected = '+3 extra reps → TRIGGERS FALLBACK';
        currentWeight += 2.5;
        preDeloadWeight = currentWeight;
        streakAfterSession = 1;
      } else {
        // Default: Normal progression sessions
        reps = '10,10,10';
        rpe = 7;
        readiness = 6 + Math.floor(Math.random() * 3); // 6-8
        completed = true;
        qualityPass = true;
        streakAfterSession = currentStreak + 1;
        if (streakAfterSession > 3) {
          // If we hit 3, trigger progression
          currentWeight += 2.5;
          preDeloadWeight = currentWeight;
          streakAfterSession = 1;
        }
        testCase = 'NORMAL_PROGRESSION';
        expected = 'Normal session, building streak';
      }

      rowTestData.push({
        session: sessionNum,
        week,
        date,
        weight,
        sets: deloadSets,
        reps,
        rpe,
        readiness,
        completed,
        extraReps,
        consecutiveSuccesses: streakAfterSession,
        qualityPass,
        testCase,
        expected,
      });

      // Update state for next session (progression happens after session completes)
      currentStreak = streakAfterSession;
      
      // Store pre-deload weight before deload week
      if (isDeloadWeek && sessionInWeek === 1) {
        preDeloadWeight = currentWeight;
      }
    }
  }

  // Generate logs from row test data
  for (const data of rowTestData) {
    const dateStr = data.date.toISOString().split('T')[0];
    const sessionId = `test-week${data.week - 1}-day-1`; // Using day-1 for all sessions
    
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
  // ========================================
  const squatTestData: Array<{
    session: number;
    week: number;
    date: Date;
    weight: number;
    sets: number;
    reps: number;
    rpe: number;
    readiness: number;
    completed: boolean;
    testCase: string;
  }> = [];

  let squatTM = 225; // Starting training max
  let squatWorkingWeight = Math.round(squatTM * 0.75 * 2) / 2; // 169 lbs
  sessionNum = 0;

  for (let week = 1; week <= 16; week++) {
    const isDeloadWeek = week === 4 || week === 8 || week === 12 || week === 16;
    const deloadWeight = isDeloadWeek ? Math.round(squatWorkingWeight * 0.6 * 2) / 2 : squatWorkingWeight;
    const deloadSets = isDeloadWeek ? 3 : 5;

    for (let sessionInWeek = 1; sessionInWeek <= 4; sessionInWeek++) {
      sessionNum++;
      const daysFromStart = (week - 1) * 7 + (sessionInWeek - 1) * 2;
      const date = addDays(baseDate, daysFromStart);

      let weight = isDeloadWeek ? deloadWeight : squatWorkingWeight;
      let reps: number;
      let rpe: number;
      let readiness: number;
      let completed: boolean;
      let testCase: string;

      if (isDeloadWeek) {
        reps = 5;
        rpe = 5;
        readiness = 8;
        completed = true;
        testCase = '1RM_DELOAD';
      } else if (week === 2 && sessionInWeek === 1) {
        // TM increase opportunity (RPE 6 on previous session)
        squatTM = 230;
        squatWorkingWeight = Math.round(squatTM * 0.75 * 2) / 2; // 172.5
        weight = squatWorkingWeight;
        reps = 5;
        rpe = 7;
        readiness = 8;
        completed = true;
        testCase = '1RM_TM_INCREASE';
      } else if (week === 2 && sessionInWeek === 2) {
        // Low readiness but completed
        reps = 5;
        rpe = 8;
        readiness = 4;
        completed = true;
        testCase = '1RM_LOW_READY';
      } else if (week === 6 && sessionInWeek <= 2) {
        // Consecutive failures → reduction
        if (sessionInWeek === 1) {
          reps = 4;
          rpe = 9;
          readiness = 3;
          completed = false;
          testCase = '1RM_FAIL_1';
        } else {
          reps = 3;
          rpe = 10;
          readiness = 2;
          completed = false;
          testCase = '1RM_FAIL_2_REDUCE';
          // Reduction: TM reduced by 5%
          squatTM = Math.round(squatTM * 0.95);
          squatWorkingWeight = Math.round(squatTM * 0.75 * 2) / 2;
        }
      } else if (week === 6 && sessionInWeek >= 3) {
        // Recovery at reduced weight
        weight = squatWorkingWeight;
        reps = 5;
        rpe = 7;
        readiness = 6 + (sessionInWeek - 3);
        completed = true;
        testCase = '1RM_REDUCED';
      } else if (week === 9 && sessionInWeek === 2) {
        // TM increase after recovery
        squatTM = Math.round(squatTM * 1.05);
        squatWorkingWeight = Math.round(squatTM * 0.75 * 2) / 2;
        weight = squatWorkingWeight;
        reps = 5;
        rpe = 7;
        readiness = 7;
        completed = true;
        testCase = '1RM_TM_UP';
      } else if (week === 11 && sessionInWeek === 3) {
        // Another TM increase
        squatTM = Math.round(squatTM * 1.05);
        squatWorkingWeight = Math.round(squatTM * 0.75 * 2) / 2;
        weight = squatWorkingWeight;
        reps = 5;
        rpe = 7;
        readiness = 7;
        completed = true;
        testCase = '1RM_TM_UP';
      } else if (week === 14 && sessionInWeek <= 2) {
        // Another readiness safeguard scenario
        if (sessionInWeek === 1) {
          reps = 4;
          rpe = 9;
          readiness = 3;
          completed = false;
          testCase = '1RM_FAIL_1';
        } else {
          reps = 3;
          rpe = 10;
          readiness = 2;
          completed = false;
          testCase = '1RM_FAIL_2_REDUCE';
          squatTM = Math.round(squatTM * 0.95);
          squatWorkingWeight = Math.round(squatTM * 0.75 * 2) / 2;
        }
      } else {
        // Normal sessions
        reps = 5;
        rpe = 6 + Math.floor(Math.random() * 2); // 6-7
        readiness = 6 + Math.floor(Math.random() * 3); // 6-8
        completed = true;
        testCase = '1RM_NORMAL';
      }

      squatTestData.push({
        session: sessionNum,
        week,
        date,
        weight,
        sets: deloadSets,
        reps,
        rpe,
        readiness,
        completed,
        testCase,
      });
    }
  }

  for (const data of squatTestData) {
    const dateStr = data.date.toISOString().split('T')[0];
    const sessionId = `test-week${data.week - 1}-day-1`; // Using day-1 for all sessions
    
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
  // ========================================
  const vo2TestData: Array<{
    session: number;
    week: number;
    date: Date;
    sets: number;
    duration: string;
    readiness: number;
    intensity: string;
    testCase: string;
  }> = [];

  sessionNum = 0;
  for (let week = 1; week <= 16; week++) {
    const isDeloadWeek = week === 4 || week === 8 || week === 12 || week === 16;
    const deloadSets = isDeloadWeek ? 2 : 4;

    for (let sessionInWeek = 1; sessionInWeek <= 4; sessionInWeek++) {
      sessionNum++;
      const daysFromStart = (week - 1) * 7 + (sessionInWeek - 1) * 2;
      const date = addDays(baseDate, daysFromStart);

      const sets = deloadSets;
      const duration = '4 min';
      const readiness = isDeloadWeek ? 8 : (6 + Math.floor(Math.random() * 3)); // 6-8 normally, 8-9 deload
      const intensity = isDeloadWeek ? '80%' : (90 + Math.floor(Math.random() * 3)) + '%'; // 90-92% normally
      const testCase = isDeloadWeek ? 'CARDIO_DELOAD' : 'CARDIO_TRACK';

      vo2TestData.push({
        session: sessionNum,
        week,
        date,
        sets,
        duration,
        readiness,
        intensity,
        testCase,
      });
    }
  }

  for (const data of vo2TestData) {
    const dateStr = data.date.toISOString().split('T')[0];
    const sessionId = `test-week${data.week - 1}-day-1`; // Using day-1 for all sessions
    
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

  // ========================================
  // LATERAL RAISE TEST DATA (Challenge Options - Non-Main Lift)
  // Starting weight: 15 lbs, target: 3x12 @ RPE 7
  // Tests: Challenge options generation when Rule of 3 is met
  // ========================================
  let lateralRaiseWeight = 15;
  let lateralRaiseStreak = 0;
  const lateralRaiseReadiness: number[] = [];
  
  sessionNum = 0;
  for (let week = 1; week <= 16; week++) {
    const isDeloadWeek = week === 4 || week === 8 || week === 12 || week === 16;
    const deloadSets = isDeloadWeek ? 2 : 3;
    const deloadWeight = isDeloadWeek ? Math.round(lateralRaiseWeight * 0.85 * 2) / 2 : lateralRaiseWeight;

    for (let sessionInWeek = 1; sessionInWeek <= 4; sessionInWeek++) {
      sessionNum++;
      const daysFromStart = (week - 1) * 7 + (sessionInWeek - 1) * 2;
      const date = addDays(baseDate, daysFromStart);

      let currentStreak = 0;
      if (isDeloadWeek) {
        lateralRaiseStreak = 0; // Reset streak during deload
        currentStreak = 0;
      } else {
        // Build streak, progress every 3 successes
        lateralRaiseStreak++;
        currentStreak = lateralRaiseStreak; // Save current streak value BEFORE resetting
        if (lateralRaiseStreak >= 3) {
          lateralRaiseWeight = Math.round((lateralRaiseWeight + 2.5) * 2) / 2; // +2.5 lbs
          lateralRaiseStreak = 1; // Reset to 1 after progression (for next session)
        }
      }

      const readiness = isDeloadWeek ? 8 : (6 + Math.floor(Math.random() * 3)); // 6-8 normally, 8-9 deload
      lateralRaiseReadiness.push(readiness);
      if (lateralRaiseReadiness.length > 3) lateralRaiseReadiness.shift();
      const readinessMA3 = lateralRaiseReadiness.length >= 3
        ? Math.round((lateralRaiseReadiness.reduce((a, b) => a + b, 0) / lateralRaiseReadiness.length) * 10) / 10
        : undefined;

      const dateStr = date.toISOString().split('T')[0];
      const sessionId = `test-week${week - 1}-day-1`;
      
      logs.push({
        exerciseId: `${sessionId}-lateral`,
        exerciseName: TEST_EXERCISES.LATERAL_RAISE.name,
        date: dateStr,
        sessionId,
        sets: deloadSets,
        reps: 12,
        weight: deloadWeight,
        rpe: isDeloadWeek ? 5 : 7,
        readiness,
        isCompleted: true,
        isWarmup: false,
        extraReps: 0,
        consecutiveSuccesses: currentStreak,
        qualityPass: true,
        targetRPE: 7,
        readinessMA3,
        historyLink: `history:${encodeURIComponent(TEST_EXERCISES.LATERAL_RAISE.name)}`,
      });
    }
  }

  return logs;
}

/**
 * Generate detailed set logs for 4 months of sessions
 */
function generate4MonthSetLogs(): Record<string, Record<number, { weight: string; reps: string }[]>> {
  const setLogs: Record<string, Record<number, { weight: string; reps: string }[]>> = {};
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 112);

  const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  // Track progression state
  let rowWeight = 35;
  let squatTM = 225;
  let squatWorkingWeight = 169;

  for (let week = 0; week < 16; week++) {
    const isDeloadWeek = week === 3 || week === 7 || week === 11 || week === 15;
    
    for (let day = 1; day <= 4; day++) {
      const sessionId = `test-week${week}-day-1`; // Using day-1 for all sessions
      const daysFromStart = week * 7 + (day - 1) * 2;
      
      // Update weights based on progression (simplified logic)
      if (week === 0 && day === 4) rowWeight = 37.5; // First Rule of 3
      if (week === 1 && day === 1) rowWeight = 40; // +3 reps fallback
      if (week === 2 && day === 3) rowWeight = 42.5; // Second Rule of 3
      if (week === 4 && day === 2) rowWeight = 40; // Reduction
      if (week === 5 && day === 3) rowWeight = 42.5; // Recovery progression
      if (week === 9 && day === 3) rowWeight = 45; // +4 reps fallback
      if (week === 10 && day === 4) rowWeight = 47.5; // Rule of 3
      if (week === 13 && day === 2) rowWeight = 45; // Another reduction
      if (week === 14 && day === 2) rowWeight = 47.5; // +3 reps fallback

      if (week === 1 && day === 1) {
        squatTM = 230;
        squatWorkingWeight = 172.5;
      }
      if (week === 5 && day === 2) {
        squatTM = Math.round(squatTM * 0.95);
        squatWorkingWeight = Math.round(squatTM * 0.75 * 2) / 2;
      }
      if (week === 8 && day === 2) {
        squatTM = Math.round(squatTM * 1.05);
        squatWorkingWeight = Math.round(squatTM * 0.75 * 2) / 2;
      }
      if (week === 10 && day === 3) {
        squatTM = Math.round(squatTM * 1.05);
        squatWorkingWeight = Math.round(squatTM * 0.75 * 2) / 2;
      }
      if (week === 13 && day === 2) {
        squatTM = Math.round(squatTM * 0.95);
        squatWorkingWeight = Math.round(squatTM * 0.75 * 2) / 2;
      }

      const currentRowWeight = isDeloadWeek ? Math.round(rowWeight * 0.85 * 2) / 2 : rowWeight;
      const currentSquatWeight = isDeloadWeek ? Math.round(squatWorkingWeight * 0.6 * 2) / 2 : squatWorkingWeight;
      const rowSets = isDeloadWeek ? 2 : 3;
      const squatSets = isDeloadWeek ? 3 : 5;

      setLogs[sessionId] = {
        0: [
          { weight: '135', reps: '5' }, // Warmup
          { weight: '155', reps: '5' }, // Warmup
          ...Array(squatSets).fill({ weight: currentSquatWeight.toString(), reps: '5' }),
        ],
        1: Array(rowSets).fill({ weight: currentRowWeight.toString(), reps: '10' }),
        2: Array(isDeloadWeek ? 2 : 4).fill({ weight: '', reps: '4min' }),
      };
    }
  }

  return setLogs;
}

/**
 * Seed 4 months of test data into AsyncStorage
 */
export async function seed4MonthTestData(): Promise<{ success: boolean; message: string }> {
  try {
    const logs = generate4MonthTestLogs();
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 112); // Start 112 days ago (16 weeks)

    const addDays = (date: Date, days: number): Date => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };

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
    // 2. SAVE COMPLETED SESSIONS
    // ============================================
    const completedSessions: { id: string; date: string }[] = [];
    
    for (let week = 0; week < 16; week++) {
      for (let day = 1; day <= 4; day++) {
        const sessionId = `test-week${week}-day-1`; // Using day-1 for all
        const daysFromStart = week * 7 + (day - 1) * 2;
        const sessionDate = addDays(baseDate, daysFromStart);
        
        completedSessions.push({
          id: sessionId,
          date: sessionDate.toISOString(),
        });
      }
    }
    
    await AsyncStorage.setItem('completedSessions', JSON.stringify(completedSessions));

    // ============================================
    // 3. SAVE SET LOGS
    // ============================================
    const allSetLogs = generate4MonthSetLogs();
    
    for (const [sessionId, setLogData] of Object.entries(allSetLogs)) {
      await AsyncStorage.setItem(`setLogs:${sessionId}`, JSON.stringify(setLogData));
      
      const exerciseCount = Object.keys(setLogData).length;
      const completedIndices = Array.from({ length: exerciseCount }, (_, i) => i);
      await AsyncStorage.setItem(`completed:${sessionId}`, JSON.stringify(completedIndices));
    }

    // ============================================
    // 4. SAVE PROGRESSION STATES
    // ============================================
    // Final state after 64 sessions (16 weeks)
    const finalRowWeight = 47.5; // After multiple progressions
    const finalSquatTM = 250; // Approximate final TM
    
    const rowState: ProgressionState = {
      exerciseName: TEST_EXERCISES.DUMBBELL_ROW.name,
      currentWeight: finalRowWeight,
      consecutiveSuccesses: 1,
      lastSuccessDate: addDays(baseDate, 110).toISOString().split('T')[0],
      lastDeloadWeight: 45,
      pendingIncrease: false,
    };
    
    const squatState: ProgressionState = {
      exerciseName: TEST_EXERCISES.BACK_SQUAT.name,
      currentWeight: Math.round(finalSquatTM * 0.75 * 2) / 2,
      consecutiveSuccesses: 1,
      lastSuccessDate: addDays(baseDate, 110).toISOString().split('T')[0],
      lastDeloadWeight: Math.round(finalSquatTM * 0.75 * 0.6 * 2) / 2,
      pendingIncrease: false,
    };
    
    const lateralRaiseState: ProgressionState = {
      exerciseName: TEST_EXERCISES.LATERAL_RAISE.name,
      currentWeight: 30, // After 16 weeks of progression (15 → 17.5 → 20 → 22.5 → 25 → 27.5 → 30)
      consecutiveSuccesses: 1, // After final progression
      lastSuccessDate: addDays(baseDate, 110).toISOString().split('T')[0],
      pendingIncrease: false,
    };
    
    await saveProgressionState(rowState);
    await saveProgressionState(squatState);
    await saveProgressionState(lateralRaiseState);

    // ============================================
    // 5. SAVE 1RM DATA
    // ============================================
    await AsyncStorage.setItem('1RM:Back Squat (Test)', finalSquatTM.toString());

    // ============================================
    // 6. SAVE START DATE
    // ============================================
    await AsyncStorage.setItem('startDateYMD', baseDate.toISOString().split('T')[0]);

    return {
      success: true,
      message: `✅ Seeded 64 sessions over 112 days (16 weeks / 4 months)\n📊 ${logs.length} exercise logs (4 exercises × 64 sessions)\n🏋️ Complete set logs for validation\n📅 Start date: ${baseDate.toISOString().split('T')[0]}\n\n📋 TEST COVERAGE:\n• Multiple Rule of 3 progressions\n• Multiple +3 reps fallbacks\n• 4 deload weeks (weeks 4, 8, 12, 16)\n• Readiness safeguards at various points\n• 1RM progression over extended period\n• Quality gate failures and recoveries\n• Edge cases and boundary conditions\n• Recovery scenarios after reductions\n\n🆕 NEW: Lateral Raise (Challenge Options Testing)`,
    };
  } catch (error) {
    console.error('Error seeding 4-month test data:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

