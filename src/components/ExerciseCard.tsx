import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';
import { useThemedStyles } from '../theme/useThemedStyles';
import { spacing, typography, FONTS } from '../theme/colors';
import { estimate1RM, getRepBasedPercent } from '../utils/1rm';
import {
  getExercise1RM,
  saveExercise1RM,
  getSetLog,
  saveSetLog,
  append1RMHistory,
} from '../storage/logs';
import {
  Exercise,
  isTrackableFor1RM,
  isTimeBased,
  hasSetReps,
  parseNumericReps,
  parseIntensityPercent,
} from '../types/program';

interface Props {
  exercise: Exercise;
  blockName: string;
  blockIndex: number;
  exerciseIndex: number;
  mesoId: string;
  weekNum: number;
  dayNum: number;
  oneRM?: number;
}

const ExerciseCard: React.FC<Props> = ({
  exercise,
  blockName,
  blockIndex,
  exerciseIndex,
  mesoId,
  weekNum,
  dayNum,
  oneRM: initialOneRM,
}) => {
  const numSets = exercise.sets ?? 0;
  const [weightVals, setWeightVals] = useState<string[]>(Array(numSets).fill(''));
  const [repVals, setRepVals] = useState<string[]>(Array(numSets).fill(''));
  const [avg1RM, setAvg1RM] = useState<number | null>(initialOneRM ?? null);
  const [restTime, setRestTime] = useState<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      // Load existing 1RM if not provided via props
      if (!initialOneRM) {
        const baseline = await getExercise1RM(exercise.name);
        if (baseline) setAvg1RM(baseline);
      }

      const newWeights = [...weightVals];
      const newReps = [...repVals];

      for (let i = 0; i < numSets; i++) {
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

  useEffect(() => {
    if (initialOneRM) {
      setAvg1RM(initialOneRM);
    }
  }, [initialOneRM]);

  const saveUpdated1RM = async () => {
    // Only update 1RM for exercises tracked with 1RM mode
    if (!isTrackableFor1RM(exercise)) return;

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
          text2: `${exercise.name} 1RM updated to ${Math.round(maxEstimate)} lbs`,
          position: 'top',
        });
      }
      const rounded = Math.round(maxEstimate);
      setAvg1RM(rounded);
      await saveExercise1RM(exercise.name, rounded);
      await append1RMHistory(exercise.name, rounded);
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

  const getSuggestedWeight = (): string | null => {
    if (!avg1RM) return null;

    // Try to parse intensity percentage from the exercise
    const intensityPercent = parseIntensityPercent(exercise.intensity);
    if (intensityPercent) {
      const weight = Math.round(avg1RM * intensityPercent);
      return `${weight} lbs (${Math.round(intensityPercent * 100)}% 1RM)`;
    }

    // Fallback to rep-based percentage
    const numericReps = parseNumericReps(exercise.reps);
    if (numericReps) {
      const percent = getRepBasedPercent(numericReps);
      const weight = Math.round(avg1RM * percent);
      return `${weight} lbs (${Math.round(percent * 100)}% 1RM)`;
    }

    return null;
  };

  // Format the exercise details line
  const getDetailsLine = (): string => {
    if (isTimeBased(exercise)) {
      return `Duration: ${exercise.duration}`;
    }

    const parts: string[] = [];
    if (exercise.sets) parts.push(`${exercise.sets} sets`);
    if (exercise.reps !== undefined) parts.push(`${exercise.reps} reps`);
    if (exercise.rest) parts.push(`Rest: ${exercise.rest}s`);

    return parts.join(' × ');
  };

  // Should we show set logging inputs?
  const showSetLogging = isTrackableFor1RM(exercise) || (hasSetReps(exercise) && exercise.trackingMode === 'volume');

  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      card: {
        marginBottom: spacing.base,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: spacing.sm,
        backgroundColor: theme.card,
      },
      title: {
        fontSize: typography.fontSize.base,
        fontWeight: FONTS.semibold,
        marginBottom: spacing.xxs,
        color: theme.textPrimary,
      },
      details: {
        fontSize: typography.fontSize.body,
        color: theme.textPrimary,
        marginBottom: spacing.xxs,
      },
      intensity: {
        fontSize: typography.fontSize.sm,
        color: theme.textSecondary,
        marginBottom: 2,
      },
      tempo: {
        fontSize: typography.fontSize.sm,
        color: theme.textSecondary,
        marginBottom: 2,
      },
      notes: {
        fontSize: typography.fontSize.sm,
        fontStyle: 'italic',
        color: theme.textMuted,
        marginBottom: spacing.xs,
      },
      suggestion: {
        fontSize: typography.fontSize.body,
        fontStyle: 'italic',
        marginBottom: spacing.xs,
        color: theme.info,
      },
      setsContainer: {
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: theme.borderLight,
      },
      setRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
      },
      setLabel: {
        width: 60,
        fontSize: typography.fontSize.body,
        color: theme.textPrimary,
      },
      input: {
        flex: 1,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: spacing.xs,
        padding: spacing.xs,
        marginHorizontal: spacing.xxs,
        color: theme.textPrimary,
      },
      restRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
      },
      restText: {
        marginLeft: spacing.md,
        fontSize: typography.fontSize.body,
        fontWeight: FONTS.medium,
        color: theme.textPrimary,
      },
    })
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{exercise.name}</Text>
      <Text style={styles.details}>{getDetailsLine()}</Text>

      {/* Intensity if specified */}
      {exercise.intensity && (
        <Text style={styles.intensity}>Intensity: {exercise.intensity}</Text>
      )}

      {/* Tempo if specified */}
      {exercise.tempo && (
        <Text style={styles.tempo}>Tempo: {exercise.tempo}</Text>
      )}

      {/* Notes if specified */}
      {exercise.notes && (
        <Text style={styles.notes}>📝 {exercise.notes}</Text>
      )}

      {/* Suggested weight for 1RM-tracked exercises */}
      {isTrackableFor1RM(exercise) && (
        avg1RM ? (
          <Text style={styles.suggestion}>
            Suggested: {getSuggestedWeight()}
          </Text>
        ) : (
          <Text style={styles.suggestion}>Log sets to see suggested weight</Text>
        )
      )}

      {/* Set logging inputs */}
      {showSetLogging && numSets > 0 && (
        <View style={styles.setsContainer}>
          {Array.from({ length: numSets }).map((_, setIdx) => (
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
        </View>
      )}

      {/* Rest timer */}
      <View style={styles.restRow}>
        <Button
          title="Start Rest"
          onPress={() => {
            const restSeconds = exercise.rest ?? 60;
            setRestTime(restSeconds);
          }}
        />
        {restTime !== null && (
          <Text style={styles.restText}>⏱ Rest: {restTime}s</Text>
        )}
      </View>
    </View>
  );
};

export default ExerciseCard;
