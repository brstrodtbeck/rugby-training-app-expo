// utils/oneRMUpdater.ts
import { setOneRM, getOneRM } from './oneRMStore';

// Epley formula for estimated 1RM
function estimateOneRM(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30));
}

// Update 1RM based on best set in a session
export async function updateOneRMFromSession(exerciseName: string, sets: { weight: number; reps: number }[]) {
  if (!sets || sets.length === 0) return;

  // Find best set (highest estimated 1RM)
  let bestEstimate = 0;
  sets.forEach(set => {
    const est = estimateOneRM(set.weight, set.reps);
    if (est > bestEstimate) bestEstimate = est;
  });

  // Compare with stored 1RM
  const currentStored = await getOneRM(exerciseName);
  const newOneRM = currentStored ? Math.max(currentStored, bestEstimate) : bestEstimate;

  // Save updated 1RM
  await setOneRM(exerciseName, newOneRM);
  console.log(`✅ Updated 1RM for ${exerciseName}: ${newOneRM}kg`);
}