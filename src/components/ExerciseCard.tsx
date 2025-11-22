import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';
import {
  estimate1RM,
  calculateAverage1RM,
} from '../utils/1rm';
import {
  getExercise1RM,
  saveExercise1RM,
  getSetLog,
  saveSetLog,
  append1RMHistory,
} from '../storage/logs';

interface Exercise {
  name: string;
  sets: number;
  reps: number;
  rest: number | string;
}

interface Props {
  exercise: Exercise;
  mesoId: string;
  weekNum: number;
  dayNum: number;
}

const ExerciseCard: React.FC<Props> = ({ exercise, mesoId, weekNum, dayNum }) => {
  const [weightVals, setWeightVals] = useState<string[]>(Array(exercise.sets).fill(''));
  const [repVals, setRepVals] = useState<string[]>(Array(exercise.sets).fill(''));
  const [avg1RM, setAvg1RM] = useState<number | null>(null);
  const [restTime, setRestTime] = useState<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const baseline = await getExercise1RM(exercise.name);
      if (baseline) setAvg1RM(baseline);

      const newWeights = [...weightVals];
      const newReps = [...repVals];

      for (let i = 0; i < exercise.sets; i++) {
        const saved = await getSetLog(mesoId, weekNum, dayNum, i);
        if (saved) {
          newWeights[i] = saved.weight;
          newReps[i] = saved.reps;
        }
      }

      setWeightVals(newWeights);
      setRepVals(newReps);
    };

    loadData();
  }, []);

  const saveUpdated1RM = async () => {
    const estimates = weightVals.map((w, i) => {
      const weight = parseFloat(w);
      const reps = parseInt(repVals[i]);
      if (!isNaN(weight) && !isNaN(reps) && reps > 0) {
        return estimate1RM(weight, reps);
      }
      return null;
    }).filter((e): e is number => e !== null);

    if (estimates.length === 0) return;

    const maxEstimate = Math.max(...estimates);
    const avgEstimate = estimates.reduce((a, b) => a + b, 0) / estimates.length;

    if (avg1RM === null || maxEstimate > avg1RM) {
      if (maxEstimate !== avg1RM) {
        Toast.show({
          type: 'success',
          text1: '🎉 New PR!',
          text2: `${exercise.name} 1RM updated to ${maxEstimate} lbs`,
          position: 'top',
        });
      }
      setAvg1RM(maxEstimate);
      await saveExercise1RM(exercise.name, maxEstimate);
      await append1RMHistory(exercise.name, maxEstimate);
      return;
    }

    const threshold = 0.9 * avg1RM;
    const allBelow = estimates.every(e => e < threshold);

    if (allBelow) {
      const newAvg = Math.round(avgEstimate);
      setAvg1RM(newAvg);
      await saveExercise1RM(exercise.name, newAvg);
      await append1RMHistory(exercise.name, newAvg);
    }
  };

  const getSuggestedWeight = () => {
    if (!avg1RM || !exercise.reps) return null;

    const repPercentMap: Record<number, number> = {
      3: 0.9,
      4: 0.85,
      5: 0.8,
      6: 0.75,
      8: 0.7,
      10: 0.65,
    };

    const percent = repPercentMap[exercise.reps] ?? 0.7;
    return Math.round(avg1RM * percent);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {exercise.name} — {exercise.sets} sets × {exercise.reps} (Rest: {exercise.rest})
      </Text>

      {avg1RM ? (
        <Text style={styles.suggestion}>
          Suggested weight: {getSuggestedWeight()} lbs ({Math.round((getSuggestedWeight()! / avg1RM) * 100)}% of 1RM)
        </Text>
      ) : (
        <Text style={styles.suggestion}>Log sets to see suggested weight</Text>
      )}

      {Array.from({ length: exercise.sets }).map((_, setIdx) => (
        <View key={setIdx} style={styles.setRow}>
          <Text style={styles.setLabel}>Set {setIdx + 1}</Text>
          <TextInput
            style={styles.input}
            placeholder="Weight"
            keyboardType="numeric"
            value={weightVals[setIdx]}
            onChangeText={(val) => {
              const updated = [...weightVals];
              updated[setIdx] = val;
              setWeightVals(updated);
              saveSetLog(mesoId, weekNum, dayNum, setIdx, val, repVals[setIdx]);
              saveUpdated1RM();
            }}
          />
          <TextInput
            style={styles.input}
            placeholder="Reps"
            keyboardType="numeric"
            value={repVals[setIdx]}
            onChangeText={(val) => {
              const updated = [...repVals];
              updated[setIdx] = val;
              setRepVals(updated);
              saveSetLog(mesoId, weekNum, dayNum, setIdx, weightVals[setIdx], val);
              saveUpdated1RM();
            }}
          />
        </View>
      ))}

      <View style={styles.restRow}>
        <Button
          title="Start Rest"
          onPress={() => {
            const parsed = typeof exercise.rest === 'string' ? parseInt(exercise.rest) : exercise.rest;
            if (!isNaN(parsed)) setRestTime(parsed);
          }}
        />
        {restTime !== null && (
          <Text style={styles.restText}>⏱ Rest: {restTime}s</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  suggestion: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 6,
    color: '#0a84ff',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  setLabel: {
    width: 60,
    fontSize: 14,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 6,
    marginHorizontal: 4,
  },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  restText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ExerciseCard;