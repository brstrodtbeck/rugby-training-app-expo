/**
 * Hybrid 1RM utilities with warm-up set generation
 */

/** Represents a single warm-up set */
export interface WarmupSet {
  /** Weight to use for this warm-up set (in lbs) */
  weight: number;
  /** Number of reps for this warm-up set */
  reps: number;
  /** Percentage of training max used */
  percentage: number;
  /** Indicates this is a warm-up set (non-loggable) */
  isWarmup: true;
}

/** Configuration for warm-up set percentages and rep scaling */
interface WarmupConfig {
  percentage: number;
  repMultiplier: number; // multiplier of target reps
}

/** Default warm-up progression percentages */
const WARMUP_PERCENTAGES: WarmupConfig[] = [
  { percentage: 0.40, repMultiplier: 1.0 },   // 40% - full target reps
  { percentage: 0.55, repMultiplier: 0.75 },  // 55% - 75% of target reps
  { percentage: 0.70, repMultiplier: 0.5 },   // 70% - 50% of target reps
];

/** Minimum reps for any warm-up set */
const MIN_WARMUP_REPS = 2;

/** Maximum reps for any warm-up set */
const MAX_WARMUP_REPS = 10;

/** Maximum warm-up volume as a fraction of working set volume (increased to allow all 3 warm-up sets) */
const MAX_WARMUP_VOLUME_RATIO = 1.5;

/**
 * Generates warm-up sets for a given target rep scheme and training max.
 * 
 * Logic:
 * - Uses percentages of training max (40%, 55%, 70%)
 * - Scales reps based on target reps (higher % = fewer reps)
 * - Caps total warm-up volume to ~50% of a single working set volume
 * 
 * @param targetReps - The number of reps planned for working sets
 * @param trainingMax - The training max weight (typically 90% of 1RM)
 * @returns Array of warm-up sets with weight, reps, and percentage
 */
export function getWarmupSetsForTargetReps(
  targetReps: number,
  trainingMax: number
): WarmupSet[] {
  // Validate inputs
  if (!trainingMax || trainingMax <= 0 || !targetReps || targetReps <= 0) {
    return [];
  }

  // Calculate working set volume for a single set (at ~80% of training max)
  const workingWeight = Math.round(trainingMax * 0.80);
  const workingSetVolume = workingWeight * targetReps;
  const maxWarmupVolume = workingSetVolume * MAX_WARMUP_VOLUME_RATIO;

  const warmupSets: WarmupSet[] = [];
  let accumulatedVolume = 0;

  for (const config of WARMUP_PERCENTAGES) {
    // Round to nearest 5 lbs for practical gym use
    const weight = Math.round((trainingMax * config.percentage) / 5) * 5;
    
    // Skip if weight is too light (less than 20 lbs or bar weight)
    if (weight < 20) {
      continue;
    }

    // Calculate reps: scale by multiplier, clamp to min/max
    let reps = Math.round(targetReps * config.repMultiplier);
    reps = Math.max(MIN_WARMUP_REPS, Math.min(MAX_WARMUP_REPS, reps));

    // Calculate volume for this set
    const setVolume = weight * reps;

    // Check if adding this set would exceed volume cap
    if (accumulatedVolume + setVolume > maxWarmupVolume) {
      // Try reducing reps to fit within volume cap
      const availableVolume = maxWarmupVolume - accumulatedVolume;
      const adjustedReps = Math.floor(availableVolume / weight);
      
      if (adjustedReps >= MIN_WARMUP_REPS) {
        warmupSets.push({
          weight,
          reps: adjustedReps,
          percentage: config.percentage,
          isWarmup: true,
        });
        accumulatedVolume += weight * adjustedReps;
      }
      break; // Stop adding more warm-up sets
    }

    warmupSets.push({
      weight,
      reps,
      percentage: config.percentage,
      isWarmup: true,
    });
    accumulatedVolume += setVolume;
  }

  return warmupSets;
}

/**
 * Formats a percentage as a display string (e.g., 0.40 → "40%")
 */
export function formatPercentage(decimal: number): string {
  return `${Math.round(decimal * 100)}%`;
}

/**
 * Calculates total warm-up volume from an array of warm-up sets
 */
export function calculateWarmupVolume(warmupSets: WarmupSet[]): number {
  return warmupSets.reduce((total, set) => total + set.weight * set.reps, 0);
}

// ============================================
// Readiness-Based Workout Adjustments
// ============================================

/** Readiness adjustment result */
export interface ReadinessAdjustment {
  /** Adjusted number of sets */
  adjustedSets: number;
  /** Adjusted working weight */
  adjustedWeight: number;
  /** Percentage modifier applied to weight (e.g., 1.03 = +3%) */
  weightModifier: number;
  /** Set modifier (e.g., +1, 0, -1) */
  setModifier: number;
  /** Description of the adjustment for UI display */
  adjustmentReason: string;
  /** Readiness category: 'high', 'moderate', 'low' */
  readinessCategory: 'high' | 'moderate' | 'low';
}

/** Readiness score ranges and their adjustments */
interface ReadinessConfig {
  minScore: number;
  maxScore: number;
  category: 'high' | 'moderate' | 'low';
  weightModifierMin: number;
  weightModifierMax: number;
  setModifier: number;
  description: string;
}

/** Configuration for readiness-based adjustments */
const READINESS_CONFIGS: ReadinessConfig[] = [
  {
    minScore: 8,
    maxScore: 10,
    category: 'high',
    weightModifierMin: 1.02,  // +2%
    weightModifierMax: 1.05,  // +5%
    setModifier: 1,           // +1 set
    description: 'Feeling great! Pushing harder today.',
  },
  {
    minScore: 4,
    maxScore: 7,
    category: 'moderate',
    weightModifierMin: 1.0,   // no change
    weightModifierMax: 1.0,   // no change
    setModifier: 0,           // no change
    description: 'Standard prescription.',
  },
  {
    minScore: 1,
    maxScore: 3,
    category: 'low',
    weightModifierMin: 0.90,  // -10%
    weightModifierMax: 0.95,  // -5%
    setModifier: -1,          // -1 set
    description: 'Recovery mode: lighter load today.',
  },
];

/** Minimum sets allowed after adjustment */
const MIN_SETS = 1;

/** Maximum sets allowed after adjustment */
const MAX_SETS = 8;

/** Minimum weight in lbs (to avoid too light weights) */
const MIN_WEIGHT = 20;

/**
 * Adjusts workout sets and weight based on user's readiness score.
 * 
 * Logic:
 * - High readiness (8-10): Increase weight by 2-5%, optionally add 1 set
 * - Moderate readiness (4-7): Keep base prescription unchanged
 * - Low readiness (1-3): Decrease weight by 5-10%, reduce sets by 1
 * 
 * @param readinessScore - User's readiness score (1-10)
 * @param baseSets - Base number of sets from the program
 * @param baseWeight - Base working weight (in lbs)
 * @returns ReadinessAdjustment object with adjusted values and metadata
 */
export function adjustWorkoutForReadiness(
  readinessScore: number,
  baseSets: number,
  baseWeight: number
): ReadinessAdjustment {
  // Validate readiness score (clamp to 1-10)
  const clampedScore = Math.max(1, Math.min(10, Math.round(readinessScore)));
  
  // Find the appropriate config for this score
  const config = READINESS_CONFIGS.find(
    c => clampedScore >= c.minScore && clampedScore <= c.maxScore
  ) || READINESS_CONFIGS[1]; // Default to moderate

  // Calculate weight modifier based on where the score falls within the range
  let weightModifier: number;
  if (config.category === 'moderate') {
    weightModifier = 1.0;
  } else {
    // Interpolate within the range
    const rangePosition = (clampedScore - config.minScore) / (config.maxScore - config.minScore);
    weightModifier = config.weightModifierMin + 
      (config.weightModifierMax - config.weightModifierMin) * rangePosition;
  }

  // Calculate adjusted weight
  let adjustedWeight = Math.round(baseWeight * weightModifier);
  
  // Ensure weight doesn't go below minimum
  adjustedWeight = Math.max(MIN_WEIGHT, adjustedWeight);
  
  // Round to nearest 5 lbs for practical gym use
  adjustedWeight = Math.round(adjustedWeight / 5) * 5;

  // Calculate adjusted sets
  let adjustedSets = baseSets + config.setModifier;
  
  // Clamp sets to safe range
  adjustedSets = Math.max(MIN_SETS, Math.min(MAX_SETS, adjustedSets));

  return {
    adjustedSets,
    adjustedWeight,
    weightModifier,
    setModifier: config.setModifier,
    adjustmentReason: config.description,
    readinessCategory: config.category,
  };
}

/**
 * Gets a description label for a readiness score
 */
export function getReadinessLabel(score: number): string {
  if (score >= 8) return '💪 High Energy';
  if (score >= 6) return '👍 Good';
  if (score >= 4) return '😐 Moderate';
  if (score >= 2) return '😴 Fatigued';
  return '🛑 Very Low';
}

/**
 * Gets the color associated with a readiness score for UI
 */
export function getReadinessColor(score: number): string {
  if (score >= 8) return '#28a745'; // green
  if (score >= 6) return '#5cb85c'; // light green
  if (score >= 4) return '#f0ad4e'; // orange
  if (score >= 2) return '#d9534f'; // red
  return '#c9302c'; // dark red
}

