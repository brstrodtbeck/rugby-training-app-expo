/**
 * Core Roulette - Shuffle Logic
 * Filters and shuffles exercises based on user selection
 */

import {
  Exercise,
  UserSelection,
  ExperienceLevel,
  Category,
  exercises,
} from '../data/sixPackShuffleExercises';

/**
 * Get shuffled workout with one exercise from each category
 * Filters exercises based on user level and equipment selection
 */
export function getShuffledWorkout(user: UserSelection): Exercise[] {
  // Filter exercises based on level and equipment
  const pool = exercises.filter(ex => {
    // Level matching: exercise must match user level OR be accessible
    // Advanced users can do intermediate/beginner exercises
    // Intermediate users can do beginner exercises
    // Beginner users can only do beginner exercises
    let levelMatch = false;
    if (user.level === 'advanced') {
      levelMatch = true; // Advanced can do all levels
    } else if (user.level === 'intermediate') {
      levelMatch = ex.level === 'beginner' || ex.level === 'intermediate';
    } else {
      levelMatch = ex.level === 'beginner';
    }

    // Equipment matching
    let equipmentMatch = false;
    const hasOnlyNone = user.equipment.length === 1 && user.equipment.includes('none');
    const hasOtherEquipment = user.equipment.some(eq => eq !== 'none');
    
    if (hasOnlyNone) {
      // If user selected ONLY "none", only show bodyweight exercises
      equipmentMatch = ex.equipment.includes('none');
    } else if (hasOtherEquipment) {
      // If user selected other equipment (with or without "none"), show exercises that match selected equipment OR bodyweight
      equipmentMatch = ex.equipment.some(eq => 
        user.equipment.includes(eq) || eq === 'none'
      );
    } else {
      // Fallback: no equipment selected (shouldn't happen, but handle gracefully)
      equipmentMatch = ex.equipment.includes('none');
    }

    return levelMatch && equipmentMatch;
  });

  // Ensure we have exercises in each category
  const categories: Category[] = ['upperAbs', 'lowerAbs', 'obliques', 'posterior', 'stability', 'finisher'];
  const workout: Exercise[] = [];

  categories.forEach(cat => {
    const options = pool.filter(ex => ex.category === cat);
    if (options.length > 0) {
      // Randomly select one exercise from this category
      const randomIndex = Math.floor(Math.random() * options.length);
      workout.push(options[randomIndex]);
    }
  });

  // If we couldn't fill all categories, return what we have
  // (This shouldn't happen with the current exercise database, but handle gracefully)
  return workout;
}

/**
 * Check if a workout can be generated with the given user selection
 */
export function canGenerateWorkout(user: UserSelection): boolean {
  const workout = getShuffledWorkout(user);
  return workout.length === 6; // Need all 6 categories
}

/**
 * Get available equipment options based on user level
 * (Some equipment might not be available for beginners)
 */
export function getAvailableEquipment(level: ExperienceLevel): string[] {
  // All equipment is available at all levels
  // But we can filter based on exercises available
  const allEquipment: string[] = ['none', 'dumbbells', 'bands', 'bench', 'ball', 'pullup', 'cable'];
  return allEquipment;
}
