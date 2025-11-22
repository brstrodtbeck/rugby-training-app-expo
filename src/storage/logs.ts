import AsyncStorage from '@react-native-async-storage/async-storage';

export const getExercise1RM = async (exerciseName: string): Promise<number | null> => {
  const saved = await AsyncStorage.getItem(`${exerciseName}-1RM`);
  return saved ? Number(saved) : null;
};

export const saveExercise1RM = async (exerciseName: string, oneRM: number): Promise<void> => {
  await AsyncStorage.setItem(`${exerciseName}-1RM`, String(oneRM));
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