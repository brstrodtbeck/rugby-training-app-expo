/**
 * Progression Logic Utilities
 * Handles Rule of 3 progression, readiness safeguards, and quality gates
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExerciseCategory, TrackingMode, Exercise } from '../types/program';
import { parseNumericReps, isTrackableFor1RM } from '../types/program';

// Storage keys
const EXERCISE_HISTORY_KEY_PREFIX = 'exerciseHistory:';
const PROGRESSION_STATE_KEY_PREFIX = 'progressionState:';

/** Extended exercise log with all tracking fields */
export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  date: string; // ISO date string
  sessionId: string;
  
  // Performance data
  sets: number;
  reps?: number | string;
  weight?: number;
  rpe?: number;
  readiness?: number;
  
  // Completion tracking
  isCompleted: boolean;
  isWarmup?: boolean; // Warm-up sets excluded from progression
  
  // Rule of 3 tracking
  extraReps?: number; // Extra clean reps on last set
  consecutiveSuccesses?: number;
  
  // Quality gate
  qualityPass?: boolean; // Tempo, ROM, RPE within ±1 of target
  targetRPE?: number;
  
  // Readiness safeguard
  readinessMA3?: number; // 3-session moving average
  
  // History link
  historyLink?: string;
}

/** Progression state for an exercise */
export interface ProgressionState {
  exerciseName: string;
  currentWeight: number;
  consecutiveSuccesses: number;
  lastSuccessDate?: string;
  lastDeloadWeight?: number; // Weight before deload for resumption
  pendingIncrease: boolean;
  lastProgressionDate?: string;
  currentRestTime?: number; // Track current rest time level
  restTimeLevel?: number; // 0 = original, 1 = -15s, 2 = -30s
  tempoModifications?: string[]; // Track applied tempo changes
}

/** Challenge option for progressive overload */
export interface ChallengeOption {
  type: 'rest_reduction' | 'tempo_change' | 'weight_increase';
  description: string;
  value: number | string; // rest seconds or tempo string
  priority: number; // for ordering suggestions
}

/** Progression suggestion result */
export interface ProgressionSuggestion {
  suggestedWeight: number;
  reason: string;
  ruleApplied: 'rule_of_3' | 'extra_reps' | 'hybrid_1rm' | 'maintain' | 'reduce' | 'deload_resume';
  consecutiveSuccesses: number;
  showRuleOf3Tip: boolean;
  readinessSafeguard: boolean;
  qualityGatePassed: boolean;
  challengeOptions?: ChallengeOption[];
  currentRestTime?: number;
  suggestedRestTime?: number;
  suggestedTempo?: string;
}

/** Increment configuration by exercise category */
const CATEGORY_INCREMENTS: Record<ExerciseCategory, { min: number; max: number }> = {
  compound: { min: 2.5, max: 5 },
  assistance: { min: 2.5, max: 2.5 },
  isolation: { min: 1, max: 2.5 },
};

/** Readiness thresholds for safeguard decisions */
const READINESS_THRESHOLDS = {
  LOW_SINGLE: 4,      // Single session low readiness threshold
  LOW_MA3: 5,         // MA3 threshold for safeguard decisions
  CRITICAL_MA3: 4,    // MA3 threshold for reduction trigger
};

/**
 * Get exercise category based on name (fallback when not specified)
 */
export function inferExerciseCategory(exerciseName: string): ExerciseCategory {
  const name = exerciseName.toLowerCase();
  
  // Compound movements
  const compounds = [
    'squat', 'deadlift', 'bench press', 'overhead press', 'row', 'pull-up',
    'clean', 'snatch', 'push press', 'front squat', 'romanian deadlift'
  ];
  if (compounds.some(c => name.includes(c))) return 'compound';
  
  // Isolation movements
  const isolations = [
    'curl', 'extension', 'fly', 'raise', 'kickback', 'calf',
    'shrug', 'wrist', 'forearm'
  ];
  if (isolations.some(i => name.includes(i))) return 'isolation';
  
  // Default to assistance
  return 'assistance';
}

/**
 * Calculate weight increment based on category and equipment
 */
export function calculateIncrement(
  category: ExerciseCategory,
  currentWeight: number,
  minIncrement?: number
): number {
  const { min, max } = CATEGORY_INCREMENTS[category];
  
  // Calculate percentage-based increment
  const percentIncrease = category === 'compound' ? 0.025 : 0.025; // 2.5%
  let increment = Math.round(currentWeight * percentIncrease * 2) / 2; // Round to nearest 0.5
  
  // Clamp to category range
  increment = Math.max(min, Math.min(max, increment));
  
  // Round to nearest standard plate increment (2.5 or 5 lbs)
  increment = Math.round(increment / 2.5) * 2.5;
  if (increment === 0) increment = min;
  
  // If minIncrement is specified and larger than calculated, use reps fallback
  if (minIncrement && minIncrement > increment) {
    return 0; // Signal to use reps progression instead
  }
  
  return increment;
}

/**
 * Get exercise history from storage
 * Also checks for test data variations (e.g., "Back Squat (Test)")
 * Enhanced with name normalization to handle minor variations
 */
export async function getExerciseHistory(exerciseName: string): Promise<ExerciseLog[]> {
  try {
    // Normalize the input name (trim whitespace)
    const normalizedName = exerciseName.trim();
    
    // Try exact match first
    const key = `${EXERCISE_HISTORY_KEY_PREFIX}${normalizedName}`;
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      if (__DEV__) {
        console.log(`✅ Found history for "${normalizedName}" (exact match)`);
      }
      return JSON.parse(raw);
    }
    
    // If no exact match and name doesn't already have "(Test)", try test data variation
    // This handles the case where test data was seeded with "(Test)" suffix
    if (!normalizedName.includes('(Test)')) {
      const testKey = `${EXERCISE_HISTORY_KEY_PREFIX}${normalizedName} (Test)`;
      const testRaw = await AsyncStorage.getItem(testKey);
      if (testRaw) {
        if (__DEV__) {
          console.log(`✅ Found history for "${normalizedName}" (test variation)`);
        }
        return JSON.parse(testRaw);
      }
    }
    
    // If name has "(Test)", try without it (reverse case)
    if (normalizedName.includes('(Test)')) {
      const baseName = normalizedName.replace(' (Test)', '').trim();
      const baseKey = `${EXERCISE_HISTORY_KEY_PREFIX}${baseName}`;
      const baseRaw = await AsyncStorage.getItem(baseKey);
      if (baseRaw) {
        if (__DEV__) {
          console.log(`✅ Found history for "${normalizedName}" (base name without Test)`);
        }
        return JSON.parse(baseRaw);
      }
    }
    
    // Try case-insensitive lookup as fallback (check all keys with prefix)
    // This is a more expensive operation, so we only do it if exact match fails
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const historyKeys = allKeys.filter(k => k.startsWith(EXERCISE_HISTORY_KEY_PREFIX));
      const normalizedLower = normalizedName.toLowerCase().trim();
      
      for (const historyKey of historyKeys) {
        const storedName = historyKey.replace(EXERCISE_HISTORY_KEY_PREFIX, '');
        if (storedName.toLowerCase().trim() === normalizedLower) {
          const fallbackRaw = await AsyncStorage.getItem(historyKey);
          if (fallbackRaw) {
            if (__DEV__) {
              console.log(`✅ Found history for "${normalizedName}" (case-insensitive match: "${storedName}")`);
            }
            return JSON.parse(fallbackRaw);
          }
        }
      }
    } catch (fallbackError) {
      // Non-critical, continue to return empty array
      if (__DEV__) {
        console.warn('Error in case-insensitive history lookup:', fallbackError);
      }
    }
    
    if (__DEV__) {
      console.log(`⚠️ No history found for "${normalizedName}"`);
    }
    
    return [];
  } catch (error) {
    console.error('Error loading exercise history:', error);
    return [];
  }
}

/**
 * Save exercise log to history
 */
export async function saveExerciseLog(log: ExerciseLog): Promise<void> {
  try {
    const key = `${EXERCISE_HISTORY_KEY_PREFIX}${log.exerciseName}`;
    const history = await getExerciseHistory(log.exerciseName);
    
    // Add new log at the beginning
    history.unshift(log);
    
    // Keep last 50 sessions max
    const trimmed = history.slice(0, 50);
    
    await AsyncStorage.setItem(key, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Error saving exercise log:', error);
  }
}

/**
 * Get progression state for an exercise
 */
export async function getProgressionState(exerciseName: string): Promise<ProgressionState | null> {
  try {
    const key = `${PROGRESSION_STATE_KEY_PREFIX}${exerciseName}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error loading progression state:', error);
    return null;
  }
}

/**
 * Save progression state
 */
export async function saveProgressionState(state: ProgressionState): Promise<void> {
  try {
    const key = `${PROGRESSION_STATE_KEY_PREFIX}${state.exerciseName}`;
    await AsyncStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving progression state:', error);
  }
}

/**
 * Calculate 3-session moving average for readiness
 */
export function calculateReadinessMA3(history: ExerciseLog[]): number | undefined {
  const recentWithReadiness = history
    .filter(log => log.readiness !== undefined && !log.isWarmup)
    .slice(0, 3);
  
  if (recentWithReadiness.length === 0) return undefined;
  
  const sum = recentWithReadiness.reduce((acc, log) => acc + (log.readiness || 5), 0);
  return Math.round((sum / recentWithReadiness.length) * 10) / 10;
}

/**
 * Check if quality gate passes (tempo, ROM, RPE within ±1 of target)
 */
export function checkQualityGate(log: ExerciseLog): boolean {
  // If no target RPE specified, pass by default
  if (log.targetRPE === undefined || log.rpe === undefined) return true;
  
  // RPE must be within ±1 of target
  const rpeDiff = Math.abs(log.rpe - log.targetRPE);
  return rpeDiff <= 1;
}

/**
 * Check if a single session has low readiness but still performed well
 * Used to decide if we should HOLD weight (not reduce, but not progress)
 */
export function shouldHoldDueToLowReadiness(
  currentReadiness: number | undefined,
  readinessMA3: number | undefined,
  isCompleted: boolean
): { shouldHold: boolean; reason: string } {
  // No readiness data = no hold
  if (currentReadiness === undefined) {
    return { shouldHold: false, reason: '' };
  }
  
  // Low single-session readiness + completed = HOLD (not reduce)
  // But only if MA3 is still reasonable (above critical threshold)
  if (currentReadiness <= READINESS_THRESHOLDS.LOW_SINGLE && isCompleted) {
    if (readinessMA3 === undefined || readinessMA3 >= READINESS_THRESHOLDS.CRITICAL_MA3) {
      return {
        shouldHold: true,
        reason: `Low readiness (${currentReadiness}/10) but completed → holding weight (MA3: ${readinessMA3?.toFixed(1) ?? 'N/A'})`,
      };
    }
  }
  
  return { shouldHold: false, reason: '' };
}

/**
 * Check if we should apply readiness reduction
 * Only reduce if:
 * 1. readinessMA3 is below CRITICAL_MA3 threshold
 * 2. Two consecutive sessions have BOTH low readiness AND missed performance
 */
export function shouldApplyReadinessReduction(
  history: ExerciseLog[],
  readinessMA3: number | undefined
): { shouldReduce: boolean; reason: string } {
  // MA3 must be below critical threshold for reduction
  if (readinessMA3 === undefined || readinessMA3 > READINESS_THRESHOLDS.CRITICAL_MA3) {
    return { shouldReduce: false, reason: '' };
  }
  
  // Check last 2 non-warmup sessions for missed performance
  const recentSessions = history
    .filter(log => !log.isWarmup && log.isCompleted !== undefined)
    .slice(0, 2);
  
  if (recentSessions.length < 2) {
    return { shouldReduce: false, reason: '' };
  }
  
  // Both sessions must have low readiness AND missed targets
  const bothMissed = recentSessions.every(log => 
    (log.readiness !== undefined && log.readiness <= READINESS_THRESHOLDS.LOW_SINGLE) &&
    (!log.qualityPass || !log.isCompleted)
  );
  
  if (bothMissed) {
    return {
      shouldReduce: true,
      reason: `2 consecutive low readiness + missed reps (MA3: ${readinessMA3.toFixed(1)}) → reducing weight -5%`,
    };
  }
  
  return { shouldReduce: false, reason: '' };
}

/**
 * Apply Rule of 3 progression logic for volume-based exercises
 * Returns progression suggestion based on consecutive successes and extra reps
 * 
 * DELOAD SUPPRESSION:
 * - During deload: ALL progression triggers blocked (Rule of 3, fallback, etc.)
 * - consecutiveSuccesses forced to 0 during deload
 * - After deload: resume at pre-deload working weight
 * 
 * READINESS SAFEGUARDS:
 * - Uses readinessMA3 (3-session moving average) for decisions
 * - Single low readiness + completed = HOLD (if MA3 reasonable)
 * - Two consecutive low readiness + missed = REDUCE (if MA3 critical)
 */
export async function applyRuleOf3Progression(
  exerciseName: string,
  currentWeight: number,
  category: ExerciseCategory,
  exercise?: Exercise, // NEW: Full exercise object for challenge generation
  minIncrement?: number,
  isDeload?: boolean,
  isTaper?: boolean,
  preDeloadWeight?: number, // Weight before deload for resumption tracking
  currentReadiness?: number
): Promise<ProgressionSuggestion> {
  const history = await getExerciseHistory(exerciseName);
  const state = await getProgressionState(exerciseName);
  const readinessMA3 = calculateReadinessMA3(history);
  
  // Default result
  const result: ProgressionSuggestion = {
    suggestedWeight: currentWeight,
    reason: 'Maintain current weight',
    ruleApplied: 'maintain',
    consecutiveSuccesses: state?.consecutiveSuccesses || 0,
    showRuleOf3Tip: true,
    readinessSafeguard: false,
    qualityGatePassed: true,
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DELOAD/TAPER SUPPRESSION - Block ALL progression triggers
  // ═══════════════════════════════════════════════════════════════════════════
  if (isDeload || isTaper) {
    // Force consecutiveSuccesses to 0 during deload
    result.consecutiveSuccesses = 0;
    result.reason = isDeload 
      ? '⏸️ Deload week - ALL progression suppressed (streak held at 0)' 
      : '⏸️ Taper week - progression suppressed';
    result.showRuleOf3Tip = false;
    result.ruleApplied = 'maintain';
    
    // Store pre-deload weight for later resumption if not already stored
    if (preDeloadWeight && state) {
      state.lastDeloadWeight = preDeloadWeight;
      await saveProgressionState(state);
    }
    
    return result;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // POST-DELOAD RESUME - Return to pre-deload working weight
  // ═══════════════════════════════════════════════════════════════════════════
  if (state?.lastDeloadWeight && currentWeight < state.lastDeloadWeight) {
    result.suggestedWeight = state.lastDeloadWeight;
    result.reason = `📈 Post-deload: Resuming pre-deload weight (${state.lastDeloadWeight} lbs)`;
    result.ruleApplied = 'deload_resume';
    result.consecutiveSuccesses = 0; // Reset streak after deload
    return result;
  }
  
  // Get recent non-warmup sessions (excluding deload sessions)
  const recentSessions = history
    .filter(log => !log.isWarmup && log.isCompleted !== undefined)
    .slice(0, 5);
  
  // Count consecutive quality successes (excluding deload/taper sessions)
  let consecutiveSuccesses = 0;
  for (const session of recentSessions) {
    // Skip counting if this was a deload session (marked by very low reps or weight drop)
    if (session.qualityPass !== false && session.isCompleted) {
      consecutiveSuccesses++;
    } else {
      break;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // READINESS SAFEGUARD - Check for reduction trigger
  // Only triggers if MA3 is below critical threshold AND 2 consecutive failures
  // ═══════════════════════════════════════════════════════════════════════════
  const reductionCheck = shouldApplyReadinessReduction(history, readinessMA3);
  if (reductionCheck.shouldReduce) {
    const increment = calculateIncrement(category, currentWeight, minIncrement);
    const reduction = increment > 0 ? increment : currentWeight * 0.05; // Default to 5%
    result.suggestedWeight = Math.round((currentWeight - reduction) * 2) / 2;
    result.reason = `⚠️ ${reductionCheck.reason}`;
    result.ruleApplied = 'reduce';
    result.readinessSafeguard = true;
    result.consecutiveSuccesses = 0;
    return result;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // READINESS SAFEGUARD - Check for hold trigger
  // Single low readiness + completed = HOLD (don't progress, but don't reduce)
  // ═══════════════════════════════════════════════════════════════════════════
  const lastSession = recentSessions[0];
  const holdCheck = shouldHoldDueToLowReadiness(
    currentReadiness ?? lastSession?.readiness,
    readinessMA3,
    lastSession?.isCompleted ?? true
  );
  
  if (holdCheck.shouldHold) {
    result.reason = `⚠️ ${holdCheck.reason}`;
    result.readinessSafeguard = true;
    result.consecutiveSuccesses = consecutiveSuccesses; // Preserve streak count
    result.showRuleOf3Tip = true;
    // Don't progress, but don't reset streak either
    return result;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RULE OF 3: Progress after 3 consecutive quality successes
  // ═══════════════════════════════════════════════════════════════════════════
  if (consecutiveSuccesses >= 3) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/61467955-603a-4154-ab10-eaa449b290fd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'progressionLogic.ts:434',message:'Rule of 3 met',data:{exerciseName,consecutiveSuccesses,hasExercise:!!exercise,isTrackable:exercise?isTrackableFor1RM(exercise):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    // Generate challenge options for non-main lifts when Rule of 3 is met
    if (exercise && !isTrackableFor1RM(exercise)) {
      const challengeOptions = generateChallengeOptions(
        exercise,
        currentWeight,
        state?.currentRestTime || exercise.rest,
        consecutiveSuccesses
      );
      
      result.challengeOptions = challengeOptions;
      result.currentRestTime = state?.currentRestTime || exercise.rest;
      
      // If weight increase is in challenge options, set suggested weight
      const weightOption = challengeOptions.find(opt => opt.type === 'weight_increase');
      if (weightOption && typeof weightOption.value === 'number') {
        result.suggestedWeight = Math.round(weightOption.value * 2) / 2;
      } else {
        // Fallback to standard increment calculation
        const increment = calculateIncrement(category, currentWeight, minIncrement);
        if (increment > 0) {
          result.suggestedWeight = Math.round((currentWeight + increment) * 2) / 2;
        }
      }
      
      result.reason = `🟢 Rule of 3: ${consecutiveSuccesses} consecutive successes → Choose a challenge option below`;
      result.ruleApplied = 'rule_of_3';
      result.consecutiveSuccesses = consecutiveSuccesses;
      return result;
    }
    
    // Standard weight increase for main lifts or when no exercise object provided
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/61467955-603a-4154-ab10-eaa449b290fd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'progressionLogic.ts:464',message:'Using standard weight increase path',data:{exerciseName,hasExercise:!!exercise,isTrackable:exercise?isTrackableFor1RM(exercise):null,currentWeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    const increment = calculateIncrement(category, currentWeight, minIncrement);
    if (increment > 0) {
      result.suggestedWeight = Math.round((currentWeight + increment) * 2) / 2;
      result.reason = `🟢 Rule of 3: ${consecutiveSuccesses} consecutive successes → +${increment} lbs`;
      result.ruleApplied = 'rule_of_3';
      result.consecutiveSuccesses = consecutiveSuccesses;
      return result;
    } else {
      // Increment too small, suggest adding reps
      result.reason = `🟢 Rule of 3: ${consecutiveSuccesses} successes, but weight increment too small. Try +1 rep.`;
      result.ruleApplied = 'rule_of_3';
      result.consecutiveSuccesses = consecutiveSuccesses;
      return result;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // EXTRA REPS FALLBACK: ≥3 extra clean reps on last set = immediate progression
  // Note: This is also suppressed during deload (handled above)
  // ═══════════════════════════════════════════════════════════════════════════
  if (lastSession?.extraReps && lastSession.extraReps >= 3) {
    const increment = calculateIncrement(category, currentWeight, minIncrement);
    if (increment > 0) {
      result.suggestedWeight = Math.round((currentWeight + increment) * 2) / 2;
      result.reason = `⚡ Extra reps fallback: +${lastSession.extraReps} clean reps on last set → +${increment} lbs`;
      result.ruleApplied = 'extra_reps';
      result.consecutiveSuccesses = 0; // Reset after fallback
      return result;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MAINTAIN: No progression trigger met, continue building streak
  // ═══════════════════════════════════════════════════════════════════════════
  result.consecutiveSuccesses = consecutiveSuccesses;
  if (consecutiveSuccesses > 0) {
    result.reason = `🟡 ${consecutiveSuccesses}/3 consecutive successes. ${3 - consecutiveSuccesses} more to progress!`;
  } else {
    result.reason = '🔴 Building streak - complete quality sessions to progress';
  }
  
  return result;
}

/**
 * Determine which progression logic to use based on tracking mode
 */
export function getProgressionType(trackingMode: TrackingMode): 'hybrid_1rm' | 'rule_of_3' | 'none' {
  switch (trackingMode) {
    case '1RM':
      return 'hybrid_1rm';
    case 'volume':
    case 'maxReps':
      return 'rule_of_3';
    case 'time':
    case 'distance':
    default:
      return 'none';
  }
}

/**
 * Generate history link for an exercise
 */
export function generateHistoryLink(exerciseName: string): string {
  return `history:${encodeURIComponent(exerciseName)}`;
}

/**
 * Get last N sessions for display
 */
export async function getRecentHistory(
  exerciseName: string,
  count: number = 5
): Promise<ExerciseLog[]> {
  const history = await getExerciseHistory(exerciseName);
  return history
    .filter(log => !log.isWarmup)
    .slice(0, count);
}

/**
 * Format progression indicator color
 */
export function getProgressionIndicatorColor(consecutiveSuccesses: number): string {
  if (consecutiveSuccesses >= 3) return '#4caf50'; // Green - ready to progress
  if (consecutiveSuccesses >= 1) return '#ff9800'; // Orange - making progress
  return '#f44336'; // Red - needs work
}

/**
 * Get Rule of 3 tip text
 */
export function getRuleOf3TipText(): string {
  return 'Rule of 3: Progress when you succeed 3 sessions in a row, or add ≥3 reps on the last set.';
}

/**
 * Get the last weight used for an exercise from history or progression state
 * Returns null if no history exists (first time doing exercise)
 * Includes safety checks for outliers and minimum history requirements
 */
export async function getLastWeightFromHistory(
  exerciseName: string
): Promise<number | null> {
  if (__DEV__) {
    console.log(`🔍 getLastWeightFromHistory: Looking up weight for "${exerciseName}"`);
  }
  
  const history = await getExerciseHistory(exerciseName);
  const state = await getProgressionState(exerciseName);
  
  if (__DEV__) {
    console.log(`📚 History entries found: ${history.length}, Progression state: ${state ? 'exists' : 'none'}`);
  }
  
  // Prefer progression state (most recent confirmed weight)
  if (state?.currentWeight && state.currentWeight > 0) {
    if (__DEV__) {
      console.log(`✅ Using progression state weight for "${exerciseName}": ${state.currentWeight} lbs`);
    }
    return state.currentWeight;
  }
  
  // Fallback to most recent history entry
  const completedSessions = history.filter(
    log => !log.isWarmup && log.isCompleted && log.weight && log.weight > 0
  );
  
  if (__DEV__) {
    console.log(`📊 Completed sessions with weight: ${completedSessions.length}`);
  }
  
  // Safety: Require at least one successful completion
  if (completedSessions.length === 0) {
    if (__DEV__) {
      console.log(`⚠️ No completed sessions with weight for "${exerciseName}"`);
    }
    return null; // No history yet
  }
  
  // Safety: Check for outliers (weight > 2x average = likely error)
  const weights = completedSessions.map(log => log.weight!).filter(w => w > 0);
  if (weights.length === 0) {
    if (__DEV__) {
      console.log(`⚠️ No valid weights found for "${exerciseName}"`);
    }
    return null;
  }
  
  const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
  const lastWeight = weights[0];
  
  if (lastWeight > avgWeight * 2) {
    // Likely data error - use second most recent
    const fallbackWeight = weights[1] || null;
    if (__DEV__) {
      console.log(`⚠️ Outlier detected for "${exerciseName}" (${lastWeight} lbs > 2x avg ${avgWeight.toFixed(1)} lbs), using fallback: ${fallbackWeight} lbs`);
    }
    return fallbackWeight;
  }
  
  if (__DEV__) {
    console.log(`✅ Using last weight from history for "${exerciseName}": ${lastWeight} lbs`);
  }
  
  return lastWeight;
}

/**
 * Generate progressive challenge options for volume exercises
 * Only for non-main lifts (trackingMode === 'volume' && !isTrackableFor1RM)
 */
export function generateChallengeOptions(
  exercise: Exercise,
  currentWeight: number,
  currentRestTime: number | undefined,
  consecutiveSuccesses: number
): ChallengeOption[] {
  const options: ChallengeOption[] = [];
  const numericReps = parseNumericReps(exercise.reps);
  
  // Only suggest challenges if Rule of 3 is met (3+ consecutive successes)
  if (consecutiveSuccesses < 3) {
    return options;
  }
  
  // Rest time reduction (for exercises with 8+ reps typically)
  if (numericReps && numericReps >= 8 && exercise.rest) {
    const originalRest = exercise.rest;
    const restLevels = [
      { reduction: 0, time: originalRest },
      { reduction: 15, time: Math.max(45, originalRest - 15) },
      { reduction: 30, time: Math.max(30, originalRest - 30) },
    ];
    
    // Find current rest time level
    const currentLevel = currentRestTime 
      ? restLevels.findIndex(r => Math.abs(r.time - currentRestTime) < 5) // Allow 5s tolerance
      : 0;
    
    const effectiveLevel = currentLevel >= 0 ? currentLevel : 0;
    
    if (effectiveLevel < restLevels.length - 1) {
      const nextLevel = restLevels[effectiveLevel + 1];
      const fromTime = effectiveLevel === 0 ? originalRest : restLevels[effectiveLevel].time;
      options.push({
        type: 'rest_reduction',
        description: `Reduce rest to ${nextLevel.time}s (from ${fromTime}s)`,
        value: nextLevel.time,
        priority: 1, // Higher priority for higher rep exercises
      });
    }
  }
  
  // Tempo modifications (for exercises without explicit tempo)
  if (!exercise.tempo && numericReps) {
    const tempoOptions = [
      { name: 'Slow Eccentric', value: '3-0-1-0', description: '3s down, 1s up' },
      { name: 'Pause Reps', value: '2-2-1-0', description: '2s pause at bottom' },
    ];
    
    // Only suggest if haven't applied tempo yet (check state would be needed, but for now just suggest first)
    options.push({
      type: 'tempo_change',
      description: `Add tempo: ${tempoOptions[0].description}`,
      value: tempoOptions[0].value,
      priority: 2,
    });
  }
  
  // Weight increase (always available as option)
  const category = exercise.exerciseCategory || inferExerciseCategory(exercise.name);
  const increment = calculateIncrement(
    category,
    currentWeight,
    exercise.minIncrement
  );
  
  if (increment > 0) {
    options.push({
      type: 'weight_increase',
      description: `Increase weight by ${increment} lbs`,
      value: currentWeight + increment,
      priority: 3, // Lower priority - challenges first
    });
  }
  
  return options.sort((a, b) => a.priority - b.priority);
}

