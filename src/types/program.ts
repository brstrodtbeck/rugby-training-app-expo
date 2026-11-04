/**
 * Type definitions for the rugby training program JSON schema
 */

/** Tracking modes for exercises */
export type TrackingMode = '1RM' | 'volume' | 'time' | 'distance' | 'maxReps';

/** Group types for blocks */
export type GroupType = 'superset' | 'circuit' | 'complex' | 'block';

/** Exercise categories for progression scaling */
export type ExerciseCategory = 'compound' | 'assistance' | 'isolation';

/** A single exercise within a block */
export interface Exercise {
  name: string;
  trackingMode: TrackingMode;
  
  // Volume-based fields (used when trackingMode is 'volume', '1RM', or 'distance')
  sets?: number;
  reps?: number | string; // Can be number (8) or string ("30m", "15s")
  distance?: string; // Prescribed distance for distance-based exercises (e.g., "50m", "100 yards") - read-only
  
  // Time-based fields (used when trackingMode is 'time')
  duration?: string; // e.g., "16 min", "20 min"
  
  // Common fields
  rest?: number; // Rest time in seconds
  intensity?: string; // e.g., "70% 1RM", "90–95% HRmax"
  notes?: string;
  tempo?: string; // e.g., "3-0-X"
  substitutions?: string[];
  
  // Grouping identifier for flattening logic
  groupId?: string; // e.g., "block-4-supersetA-ex1"
  
  // Instruction/definition fields for mobility and cardio exercises
  instruction?: string; // Short description of how to perform the movement
  definition?: string;  // Brief definition or purpose of the exercise
  
  // Progression and categorization fields
  exerciseCategory?: ExerciseCategory; // compound, assistance, isolation
  minIncrement?: number; // Minimum weight increment in lbs (based on equipment)
  targetRPE?: number; // Target RPE for this exercise (1-10)
  
  // Flow group fields (for warm-up/cool-down flows)
  isFlowGroup?: boolean;
  flowGroupType?: 'mobility' | 'recovery' | 'restorative';
  warmUpGroup?: FlowGroup;
  exercisesGroup?: FlowGroup;
  coolDownGroup?: FlowGroup;
  flowSteps?: FlowStep[];
  trainerNotes?: string;
  
  // Protection flag: if true, this exercise will NOT be expanded by expandFlowExercisesInBlocks
  // Use this to protect manually configured exercises from being changed
  skipExpansion?: boolean;
  
  // Protection flag: if true, this exercise will skip ALL transformations in the pipeline
  // Use this to completely lock an exercise's structure from any automatic modifications
  lockStructure?: boolean;
  
  // Display flag: if true, circuit exercises with checkboxes will show in Set Round sections
  // instead of the inline checkbox section (allows sequential tracking with other exercises)
  showInSetRounds?: boolean;
}

/** A group within a flow (warm-up, main exercises, cool-down) */
export interface FlowGroup {
  name: string;
  duration?: string;
  description?: string;
  exercises: FlowExercise[];
}

/** A single exercise within a flow group */
export interface FlowExercise {
  name: string;
  duration?: string;
  reps?: string;
  sets?: number;
  cue?: string;
  description?: string;
  detailedInstructions?: string[];
}

/** A step in a flow sequence */
export interface FlowStep {
  name: string;
  duration?: string;
  reps?: string;
  cue?: string;
  detailedInstructions?: string[];
}

/** A block of exercises within a training day */
export interface Block {
  name: string;
  exercises: Exercise[];
  
  // Circuit/Superset/Complex fields
  rounds?: number;
  restBetweenRounds?: number;
  /** 
   * Explicit group type for rendering:
   * - 'superset': paired exercises with shared rest (strength+plyo, push/pull, core+lift)
   * - 'circuit': multi-exercise conditioning or density blocks
   * - 'complex': sequential barbell movements (Olympic lift clusters)
   * - 'block': normal individual exercises (default)
   */
  groupType?: GroupType;
  
  // Legacy field for backwards compatibility
  blockType?: 'circuit' | 'superset' | 'standard';
  
  /**
   * Controls autoscroll behavior for set completion:
   * - true (default): Sequential - scroll to next exercise after each set completion
   * - false: Non-sequential - only scroll to next exercise when all sets of current exercise are complete
   */
  sequentialSets?: boolean;
}

/**
 * Determines the block type based on explicit groupType or inferred properties
 */
export function getBlockType(block: Block): 'circuit' | 'superset' | 'complex' | 'standard' {
  // Use explicit groupType if provided
  if (block.groupType) {
    if (block.groupType === 'block') return 'standard';
    return block.groupType;
  }
  
  // Legacy blockType support
  if (block.blockType) return block.blockType;
  
  // If has rounds > 1, it's a circuit
  if (block.rounds && block.rounds > 1) return 'circuit';
  
  // Check name patterns for automatic detection
  const lowerName = block.name.toLowerCase();
  
  // Complex detection (Olympic lifts, barbell clusters)
  if (lowerName.includes('complex') || lowerName.includes('olympic')) return 'complex';
  
  // Circuit detection
  if (lowerName.includes('circuit') || lowerName.includes('conditioning circuit')) return 'circuit';
  
  // Superset detection
  if (lowerName.includes('superset') || lowerName.includes('super set')) return 'superset';
  if (lowerName.includes('contrast') || lowerName.includes('density')) return 'superset';
  
  // If multiple exercises with sets=1, likely a superset or circuit
  if (block.exercises.length > 1 && block.exercises.every(e => e.sets === 1)) {
    return 'superset';
  }
  
  return 'standard';
}

/** Represents a renderable item - either a single exercise or a grouped block */
export interface RenderableItem {
  type: 'exercise' | 'circuit' | 'superset' | 'complex';
  id: string;
  blockName: string;
  blockIndex: number;
  
  // For single exercise
  exercise?: FlattenedExercise;
  exerciseIndex?: number;
  
  // For grouped items (circuit/superset/complex)
  exercises?: FlattenedExercise[];
  exerciseIndices?: number[];
  rounds?: number;
  restBetweenRounds?: number;
}

/** A single training day within a microcycle */
export interface TrainingDay {
  day: number; // 1-7
  title: string;
  durationMinutes: number;
  blocks: Block[];
}

/** Weekly intensity/volume progression */
export interface WeekProgression {
  intensity: string;
  volume: string;
}

/** Exercise-level adjustments for a specific week */
export interface ExerciseAdjustment {
  intensity?: string;
  sets?: number;
  reps?: number | string;
  rest?: number;
  duration?: string;
  targetRPE?: number;
  notes?: string;
}

/** Block-level adjustments for a specific week */
export interface BlockAdjustment {
  rounds?: number;
  restBetweenRounds?: number;
}

/** Day-level adjustments */
export interface DayAdjustment {
  exercises?: Record<string, ExerciseAdjustment>;
  blocks?: Record<string, BlockAdjustment>;
}

/** Weekly adjustments configuration */
export interface WeeklyAdjustment {
  deload?: boolean;
  taper?: boolean;
  setReduction?: number;
  [dayKey: string]: DayAdjustment | boolean | number | undefined;
}

/** A mesocycle (training block) */
export interface Mesocycle {
  id: string;
  title: string;
  weeks: number[];
  phaseFocus: string;
  progression: { [key: string]: WeekProgression | undefined };
  microcycle: TrainingDay[];
  weeklyAdjustments?: Record<string, WeeklyAdjustment>;
}

/** The macrocycle (overall program structure) */
export interface Macrocycle {
  lengthWeeks: number;
  mesocycles: Mesocycle[];
}

/** Schema definition for exercise fields */
export interface SchemaDefinition {
  exerciseFields: {
    required: string[];
    trackingModes: Partial<Record<TrackingMode, string[]>>;
  };
}

/** App implementation configuration */
export interface AppImplementation {
  autoCalcLoads: string;
  rpeGuardrails: string;
  qualityChecks: {
    plyo?: string;
    substitutions: Record<string, string[]>;
  };
  tempoFormats: string;
  restDefaults: Record<string, number>;
  trackingModes: Partial<Record<TrackingMode, string>>;
}

/** Root program structure */
export interface RugbyProgram {
  id: string;
  title: string;
  description: string;
  trainingMaxNote: string;
  version: string;
  schema: SchemaDefinition;
  macrocycle: Macrocycle;
  appImplementation: AppImplementation;
}

// ============================================
// Helper types for UI consumption
// ============================================

/** Flattened exercise with context for display */
export interface FlattenedExercise extends Exercise {
  blockName: string;
  blockIndex: number;
  exerciseIndex: number;
}

/** Session with flattened exercises for UI consumption */
export interface FlattenedSession {
  mesoId: string;
  weekNumber: number;
  dayNumber: number;
  title: string;
  durationMinutes: number;
  blocks: Block[];
  allExercises: FlattenedExercise[];
}

// ============================================
// Utility functions
// ============================================

/**
 * Checks if an exercise should be tracked for 1RM calculations
 */
export function isTrackableFor1RM(exercise: Exercise): boolean {
  return exercise.trackingMode === '1RM';
}

/**
 * Checks if an exercise has sets/reps (vs time-based)
 */
export function hasSetReps(exercise: Exercise): boolean {
  return exercise.trackingMode !== 'time' && 
         exercise.sets !== undefined && 
         exercise.reps !== undefined;
}

/**
 * Checks if an exercise is time-based
 */
export function isTimeBased(exercise: Exercise): boolean {
  return exercise.trackingMode === 'time';
}

/**
 * Checks if an exercise is distance-based
 */
export function isDistanceBased(exercise: Exercise): boolean {
  return exercise.trackingMode === 'distance';
}

/**
 * Checks if an exercise is a bodyweight exercise (no weight tracking)
 * Uses both weight capability check AND name patterns for safety
 * 
 * Note: This function should be used in conjunction with shouldShowSetLogging() 
 * in SessionScreen for the most accurate detection. The name pattern check here
 * provides a safety net for exercises that might not be caught by weight capability alone.
 */
export function isBodyweightExercise(exercise: Exercise): boolean {
  // Check: Name patterns - common bodyweight exercise keywords
  const nameLower = exercise.name.toLowerCase();
  const bodyweightKeywords = [
    'bodyweight',
    'body weight',
    'band',
    'banded',
    'band-assisted',
    'assisted',
    'unassisted',
    'bodyweight squat',
    'push-up',
    'pushup',
    'pull-up',
    'pullup',
    'chin-up',
    'chinup',
    'dip',
    'plank',
    'dead bug',
    'bird dog',
    'glute bridge',
    'hip bridge',
    'mountain climber',
    'burpee',
    'jump',
    'lunge',
    'step-up',
    'calf raise',
    'leg raise',
    'crunch',
    'sit-up',
    'sit up', // Also match "Sit Up" with space (e.g., "Sprinter Sit Up")
    'hollow hold',
    'side plank',
    'wall sit',
    'pistol squat',
    'shrimp squat',
    'handstand',
    'muscle-up',
    'l-sit',
    'dragon flag',
    'human flag',
    'front lever',
    'back lever',
    'planche',
    'stir the pot',
    'stir',
    'glute ham', // Glute Ham Raise (bodyweight on GHD machine)
    'slider', // Slider exercises are bodyweight (e.g., Slider Ham Curl)
    'high knee', // High knee movements are bodyweight (e.g., Low Hurdle Lateral High Knee)
    'ab roll', // Ab roll exercises are bodyweight (e.g., Ab Roll Out)
    'roll out', // Roll out exercises are bodyweight (e.g., Ab Roll Out)
    'v-up', // V-up exercises are bodyweight
    'v up', // V-up with space (e.g., V-Up)
    'step up', // Step up exercises are bodyweight (e.g., Rapid Lateral Step Up)
    'ham curl', // Ham curl exercises are bodyweight (e.g., Physio Ball Ham Curls)
    'physio ball', // Physio ball exercises are bodyweight (e.g., Physio Ball SL Curl)
    'sl curl', // Single leg curl exercises are bodyweight (e.g., Physio Ball SL Curl)
    'wall shuffle', // Wall shuffle exercises are bodyweight (e.g., MB Wall Shuffle)
  ];
  
  // Activation movement patterns
  const activationKeywords = [
    'activation',
    'warm-up',
    'warmup',
    'mobility',
    'stretch',
    'hinge', // Hip hinge patterns are typically bodyweight mobility/stretch movements
    'adductor', // Adductor stretches are bodyweight mobility exercises
    'circles', // Hip circles and similar circular mobility patterns are bodyweight exercises
    'breathing',
    'reset',
    'band pull-apart',
    'band pull apart',
    'banded lateral walk',
    'tall-to-short jump',
    'empty barbell', // This one is tricky - it's bodyweight but uses equipment
    'pvc', // PVC pipe exercises are unweighted warm-up movements
  ];
  
  const matchesBodyweightPattern = bodyweightKeywords.some(keyword => nameLower.includes(keyword));
  const matchesActivationPattern = activationKeywords.some(keyword => nameLower.includes(keyword));
  
  // Return true if EITHER pattern matches (both checks for safety)
  return matchesBodyweightPattern || matchesActivationPattern;
}

/**
 * Parses numeric reps from a reps field that might be a string
 * Returns the numeric value or null if it's a distance/time string
 * Handles comma-separated reps (e.g., "5,5,5,3") by using the first value
 */
export function parseNumericReps(reps: number | string | undefined): number | null {
  if (reps === undefined) return null;
  if (typeof reps === 'number') return reps;

  const str = String(reps).trim();
  if (!str) return null;

  // Try to parse as single number first (e.g., "8" -> 8)
  const parsed = parseInt(str, 10);
  if (!isNaN(parsed) && String(parsed) === str) {
    return parsed;
  }

  // Handle comma-separated reps (e.g., "5,5,5,3") - use first value for intensity/percentage
  if (str.includes(',')) {
    const first = str.split(',')[0]?.trim();
    if (first) {
      const firstParsed = parseInt(first, 10);
      if (!isNaN(firstParsed) && firstParsed > 0) {
        return firstParsed;
      }
    }
  }

  return null; // It's a distance/time string like "30m" or "15s"
}

/**
 * Parses intensity percentage from intensity string
 * e.g., "70% 1RM" -> 0.70, "80-85% 1RM" -> 0.825 (average)
 * "70% TM" -> 0.63 (percent of Training Max; TM = 90% of 1RM, so 70% TM = 0.70 * 0.9)
 */
export function parseIntensityPercent(intensity: string | undefined): number | null {
  if (!intensity) return null;

  const isTrainingMax = /\bTM\b/i.test(intensity);

  // Match patterns like "70% 1RM", "80-85% 1RM", "70–75% 1RM", "70-75% TM"
  const rangeMatch = intensity.match(/(\d+(?:\.\d+)?)[–-](\d+(?:\.\d+)?)\s*%/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    let percent = (low + high) / 2 / 100;
    if (isTrainingMax) percent *= 0.9;
    return percent;
  }

  const singleMatch = intensity.match(/(\d+(?:\.\d+)?)\s*%/);
  if (singleMatch) {
    let percent = parseFloat(singleMatch[1]) / 100;
    if (isTrainingMax) percent *= 0.9;
    return percent;
  }

  return null;
}

/**
 * Parses sets and reps from a reps string (e.g., "2 × 10 per side" -> sets: 2, reps: "10 per side")
 * Returns { sets: number | undefined, reps: string | undefined, isTimeBased: boolean }
 */
function parseSetsAndReps(repsString: string | undefined): { sets?: number; reps?: string; isTimeBased: boolean } {
  if (!repsString) return { isTimeBased: false };

  // FIRST: Check for "×" or "x" pattern: "2 × 10 per side" or "2 x 30 sec each side"
  // If sets pattern exists, it's ALWAYS volume-based (even if reps contain time units)
  const setRepsMatch = repsString.match(/^(\d+)\s*[×x]\s*(.+)$/i);
  if (setRepsMatch) {
    const sets = parseInt(setRepsMatch[1], 10);
    const reps = setRepsMatch[2].trim();
    return { sets, reps, isTimeBased: false }; // Always volume-based when sets pattern exists
  }

  // SECOND: Check if reps string contains time units (sec, min, seconds, minutes)
  // Only check this if NO sets pattern was found
  const isTimeBased = /(sec|min|second|minute)/i.test(repsString);
  if (isTimeBased) {
    return { reps: repsString, isTimeBased: true };
  }

  // THIRD: If no sets pattern and no time units, check if it's a number (volume-based)
  const isNumber = /^\d+/.test(repsString);
  if (isNumber) {
    return { reps: repsString, isTimeBased: false };
  }

  // Otherwise, return as-is (assume volume-based)
  return { reps: repsString, isTimeBased: false };
}

/**
 * Converts FlowStep[] into Exercise[] for tracking
 */
export function convertFlowStepsToExercises(flowSteps: FlowStep[], parentExercise: Exercise): Exercise[] {
  return flowSteps.map((step): Exercise => {
    const exercise: Exercise = {
      name: step.name,
      trackingMode: 'volume', // Set by logic below; default for type satisfaction
    };

    // Parse sets and reps from reps string
    const { sets, reps, isTimeBased } = parseSetsAndReps(step.reps);

    // Determine tracking mode based on parsed data
    // Priority: If sets pattern exists, it's volume-based (even if reps contain time units)
    if (sets !== undefined) {
      // Volume-based exercise with sets
      exercise.trackingMode = 'volume';
      exercise.sets = sets;
      if (reps) {
        exercise.reps = reps;
      }
      // Don't include duration for volume-based exercises
    } else if (isTimeBased || (!reps && step.duration)) {
      // Time-based exercise (reps with time units, or only duration, no sets)
      exercise.trackingMode = 'time';
      exercise.sets = 1;
      if (step.duration) {
        exercise.duration = step.duration;
      }
      // Include reps if it contains time info (e.g., "90 seconds")
      if (reps && isTimeBased) {
        exercise.reps = reps;
      }
    } else if (reps) {
      // Volume-based exercise (has reps but no sets pattern, no time units)
      exercise.trackingMode = 'volume';
      exercise.sets = 1; // Default to 1 set if not specified
      exercise.reps = reps;
    } else {
      // Default to time-based if only duration
      exercise.trackingMode = 'time';
      exercise.sets = 1;
      if (step.duration) {
        exercise.duration = step.duration;
      }
    }

    // Preserve cue and detailedInstructions
    if (step.cue) {
      exercise.notes = step.cue;
    }

    if (step.detailedInstructions && step.detailedInstructions.length > 0) {
      exercise.instruction = step.detailedInstructions.join('\n');
    }

    // Inherit relevant properties from parent
    if (parentExercise.flowGroupType) {
      exercise.flowGroupType = parentExercise.flowGroupType;
    }

    return exercise;
  });
}

/**
 * Converts FlowGroup.exercises (FlowExercise[]) into Exercise[]
 */
export function convertFlowGroupToExercises(flowGroup: FlowGroup, parentExercise: Exercise): Exercise[] {
  return flowGroup.exercises.map((flowEx): Exercise => {
    const exercise: Exercise = {
      name: flowEx.name,
      trackingMode: 'time', // Flow exercises are typically time-based
      sets: flowEx.sets ?? 1,
    };

    // Set duration if provided
    if (flowEx.duration) {
      exercise.duration = flowEx.duration;
    }

    // Set reps if provided
    if (flowEx.reps) {
      exercise.reps = flowEx.reps;
    }

    // Preserve cue and description
    if (flowEx.cue) {
      exercise.notes = flowEx.cue;
    }

    if (flowEx.description) {
      exercise.definition = flowEx.description;
    }

    if (flowEx.detailedInstructions && flowEx.detailedInstructions.length > 0) {
      exercise.instruction = flowEx.detailedInstructions.join('\n');
    }

    // Inherit relevant properties from parent
    if (parentExercise.flowGroupType) {
      exercise.flowGroupType = parentExercise.flowGroupType;
    }

    return exercise;
  });
}

/**
 * Expands exercises with flowSteps or flow groups into individual trackable exercises
 *
 * Option A: When warmUpGroup, exercisesGroup, or coolDownGroup exist, use them as the
 * source of truth (expand in order: warmUp → exercises → coolDown). Ignore flowSteps.
 * Otherwise, expand flowSteps if present.
 *
 * Protection rules:
 * - Skips expansion if exercise has skipExpansion: true flag
 * - Skips ALL transformations if exercise has lockStructure: true flag
 */
export function expandFlowExercisesInBlocks(blocks: Block[]): Block[] {
  return blocks.map(block => {
    const expandedExercises: Exercise[] = [];

    block.exercises.forEach(exercise => {
      if (exercise.lockStructure === true || exercise.skipExpansion === true) {
        expandedExercises.push(exercise);
        return;
      }

      const hasFlowGroups =
        (exercise.warmUpGroup?.exercises?.length ?? 0) > 0 ||
        (exercise.exercisesGroup?.exercises?.length ?? 0) > 0 ||
        (exercise.coolDownGroup?.exercises?.length ?? 0) > 0;

      if (hasFlowGroups) {
        const expanded: Exercise[] = [];
        if (exercise.warmUpGroup?.exercises?.length) {
          expanded.push(...convertFlowGroupToExercises(exercise.warmUpGroup, exercise));
        }
        if (exercise.exercisesGroup?.exercises?.length) {
          expanded.push(...convertFlowGroupToExercises(exercise.exercisesGroup, exercise));
        }
        if (exercise.coolDownGroup?.exercises?.length) {
          expanded.push(...convertFlowGroupToExercises(exercise.coolDownGroup, exercise));
        }
        expandedExercises.push(...expanded);
      } else if (exercise.flowSteps && exercise.flowSteps.length > 0) {
        expandedExercises.push(...convertFlowStepsToExercises(exercise.flowSteps, exercise));
      } else {
        expandedExercises.push(exercise);
      }
    });

    return {
      ...block,
      exercises: expandedExercises,
    };
  });
}

/**
 * Flattens blocks into a single exercise array for UI consumption
 */
export function flattenExercises(blocks: Block[]): FlattenedExercise[] {
  const result: FlattenedExercise[] = [];
  
  blocks.forEach((block, blockIndex) => {
    block.exercises.forEach((exercise, exerciseIndex) => {
      result.push({
        ...exercise,
        blockName: block.name,
        blockIndex,
        exerciseIndex,
      });
    });
  });
  
  return result;
}

/**
 * Creates renderable items from blocks, grouping circuits, supersets, complexes, and warm-up/cool-down sequences
 */
export function createRenderableItems(blocks: Block[]): RenderableItem[] {
  const items: RenderableItem[] = [];
  let globalExerciseIndex = 0;
  
  blocks.forEach((block, blockIndex) => {
    const blockType = getBlockType(block);
    const blockNameLower = block.name.toLowerCase();
    const isWarmupCooldownBlock = blockNameLower.includes('warm') || 
                                   blockNameLower.includes('cool') || 
                                   blockNameLower.includes('cooldown') ||
                                   blockNameLower.includes('activation') ||
                                   blockNameLower.includes('mobility') ||
                                   blockNameLower.includes('stretching') ||
                                   blockNameLower.includes('breathing') ||
                                   blockNameLower.includes('recovery') ||
                                   blockNameLower === 'raise' ||
                                   blockNameLower === 'activate' ||
                                   blockNameLower === 'mobilize' ||
                                   blockNameLower === 'potentiate';
    
    // Group warm-up/cool-down blocks as sequences (like circuits) so exercises are done one after another
    if (isWarmupCooldownBlock && block.exercises.length > 1) {
      // Group all exercises in warm-up/cool-down block together as a sequence
      const groupedExercises: FlattenedExercise[] = [];
      const exerciseIndices: number[] = [];
      
      block.exercises.forEach((exercise, localIndex) => {
        groupedExercises.push({
          ...exercise,
          blockName: block.name,
          blockIndex,
          exerciseIndex: localIndex,
        });
        exerciseIndices.push(globalExerciseIndex);
        globalExerciseIndex++;
      });
      
      items.push({
        type: 'circuit', // Use circuit type for warm-up sequences
        id: `${blockIndex}-warmup-sequence`,
        blockName: block.name,
        blockIndex,
        exercises: groupedExercises,
        exerciseIndices,
        rounds: 1, // Single round for warm-up sequences
        restBetweenRounds: 0,
      });
    } else if (blockType === 'circuit' || blockType === 'superset' || blockType === 'complex') {
      // Group all exercises in this block together
      const groupedExercises: FlattenedExercise[] = [];
      const exerciseIndices: number[] = [];
      
      block.exercises.forEach((exercise, localIndex) => {
        groupedExercises.push({
          ...exercise,
          blockName: block.name,
          blockIndex,
          exerciseIndex: localIndex,
        });
        exerciseIndices.push(globalExerciseIndex);
        globalExerciseIndex++;
      });
      
      items.push({
        type: blockType,
        id: `${blockIndex}-group`,
        blockName: block.name,
        blockIndex,
        exercises: groupedExercises,
        exerciseIndices,
        rounds: block.rounds,
        restBetweenRounds: block.restBetweenRounds,
      });
    } else {
      // Add each exercise as individual item
      block.exercises.forEach((exercise, localIndex) => {
        items.push({
          type: 'exercise',
          id: `${blockIndex}-${localIndex}`,
          blockName: block.name,
          blockIndex,
          exercise: {
            ...exercise,
            blockName: block.name,
            blockIndex,
            exerciseIndex: localIndex,
          },
          exerciseIndex: globalExerciseIndex,
        });
        globalExerciseIndex++;
      });
    }
  });
  
  return items;
}

/**
 * Generates a session ID from mesocycle, week, and day
 */
export function generateSessionId(mesoId: string, weekIndex: number, dayNumber: number): string {
  return `${mesoId}-week${weekIndex}-day-${dayNumber}`;
}

/**
 * Parses a session ID to extract mesocycle, week, and day
 * Supports various mesocycle ID formats (m1, m2, p1, p2, test, etc.)
 */
export function parseSessionId(sessionId: string): { mesoId: string; weekIndex: number; dayNumber: number } | null {
  // Match any alphanumeric mesocycle ID followed by -week{n}-day-{n}
  // Supports both short IDs (m1, p1) and longer IDs (test, foundation)
  const match = sessionId.match(/^([a-zA-Z][a-zA-Z0-9]*)-week(\d+)-day-(\d+)$/);
  if (!match) return null;
  
  return {
    mesoId: match[1],
    weekIndex: parseInt(match[2], 10),
    dayNumber: parseInt(match[3], 10),
  };
}

