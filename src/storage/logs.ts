import AsyncStorage from '@react-native-async-storage/async-storage';

export const getExercise1RM = async (exerciseName: string): Promise<number | null> => {
  // Try new format first: "1RM:ExerciseName" → {value: number, date: string}
  const newFormatKey = `1RM:${exerciseName}`;
  const newFormatRaw = await AsyncStorage.getItem(newFormatKey);
  if (newFormatRaw) {
    try {
      const parsed = JSON.parse(newFormatRaw);
      if (typeof parsed?.value === 'number') {
        return parsed.value;
      }
    } catch {
      // Not JSON, might be a plain number string (fallback)
      const num = parseFloat(newFormatRaw);
      if (!isNaN(num)) return num;
    }
  }
  
  // Fallback to old format: "ExerciseName-1RM" → "number"
  const oldFormatKey = `${exerciseName}-1RM`;
  const oldFormatRaw = await AsyncStorage.getItem(oldFormatKey);
  if (oldFormatRaw) {
    const num = parseFloat(oldFormatRaw);
    if (!isNaN(num)) {
      // Migrate to new format for future consistency
      await AsyncStorage.setItem(
        newFormatKey,
        JSON.stringify({ value: num, date: new Date().toISOString(), migrated: true })
      );
      return num;
    }
  }
  
  return null;
};

export const saveExercise1RM = async (exerciseName: string, oneRM: number): Promise<void> => {
  const newFormatKey = `1RM:${exerciseName}`;
  const legacyKey = `${exerciseName}-1RM`;
  const payload = { value: oneRM, date: new Date().toISOString() };
  await AsyncStorage.setItem(newFormatKey, JSON.stringify(payload));
  await AsyncStorage.setItem(legacyKey, String(oneRM)); // Legacy format for backward compatibility
};

export const getSetLog = async (
  mesoId: string,
  weekNum: number,
  dayNum: number,
  setIdx: number
): Promise<{ weight: string; reps: string } | null> => {
  const key = `${mesoId}-week${weekNum}-day${dayNum}-set${setIdx}`;
  const saved = await AsyncStorage.getItem(key);
  return saved ? JSON.parse(saved) : null;
};

export const saveSetLog = async (
  mesoId: string,
  weekNum: number,
  dayNum: number,
  setIdx: number,
  weight: string,
  reps: string
): Promise<void> => {
  const key = `${mesoId}-week${weekNum}-day${dayNum}-set${setIdx}`;
  await AsyncStorage.setItem(key, JSON.stringify({ weight, reps }));
};

// ✅ NEW: Append a 1RM history entry
export const append1RMHistory = async (exerciseName: string, new1RM: number): Promise<void> => {
  const key = `1rmHistory-${exerciseName}`;
  const existing = await AsyncStorage.getItem(key);
  const history = existing ? JSON.parse(existing) : [];

  history.push({
    date: new Date().toISOString(),
    value: new1RM,
  });

  await AsyncStorage.setItem(key, JSON.stringify(history));
};

// ✅ NEW: Retrieve 1RM history for an exercise
export const get1RMHistory = async (
  exerciseName: string
): Promise<{ date: string; value: number }[]> => {
  const key = `1rmHistory-${exerciseName}`;
  const stored = await AsyncStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
};