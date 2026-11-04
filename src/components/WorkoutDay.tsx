import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ExerciseCard from './ExerciseCard';
import { useThemedStyles } from '../theme/useThemedStyles';
import { spacing, typography, FONTS } from '../theme/colors';
import { Block } from '../types/program';

interface Props {
  blocks: Block[];
  mesoId: string;
  weekNum: number;
  dayNum: number;
  oneRMMap?: Record<string, number>;
}

const WorkoutDay: React.FC<Props> = ({ blocks, mesoId, weekNum, dayNum, oneRMMap = {} }) => {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      blockContainer: {
        marginBottom: spacing.base,
      },
      blockHeader: {
        backgroundColor: theme.backgroundLight,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: spacing.xs,
        marginBottom: spacing.md,
      },
      blockTitle: {
        fontSize: typography.fontSize.body,
        fontWeight: FONTS.semibold,
        color: theme.textPrimary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      },
      blockMeta: {
        fontSize: typography.fontSize.xs,
        color: theme.textSecondary,
        marginTop: 2,
      },
    })
  );

  return (
    <View>
      {blocks.map((block, blockIndex) => (
        <View key={blockIndex} style={styles.blockContainer}>
          {/* Block header */}
          <View style={styles.blockHeader}>
            <Text style={styles.blockTitle}>{block.name}</Text>
            {block.rounds && (
              <Text style={styles.blockMeta}>
                {block.rounds} rounds • {block.restBetweenRounds}s rest between rounds
              </Text>
            )}
          </View>

          {/* Exercises in block */}
          {block.exercises.map((exercise, exerciseIndex) => (
            <ExerciseCard
              key={exerciseIndex}
              exercise={exercise}
              blockName={block.name}
              blockIndex={blockIndex}
              exerciseIndex={exerciseIndex}
              mesoId={mesoId}
              weekNum={weekNum}
              dayNum={dayNum}
              oneRM={oneRMMap[exercise.name]}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

export default WorkoutDay;
