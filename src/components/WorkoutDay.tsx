import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ExerciseCard from './ExerciseCard';
import {
  Block,
  FlattenedExercise,
  flattenExercises,
} from '../types/program';

interface Props {
  blocks: Block[];
  mesoId: string;
  weekNum: number;
  dayNum: number;
  oneRMMap?: Record<string, number>;
}

const WorkoutDay: React.FC<Props> = ({ blocks, mesoId, weekNum, dayNum, oneRMMap = {} }) => {
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

const styles = StyleSheet.create({
  blockContainer: {
    marginBottom: 16,
  },
  blockHeader: {
    backgroundColor: '#f0f4f8',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a5568',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  blockMeta: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
});

export default WorkoutDay;
