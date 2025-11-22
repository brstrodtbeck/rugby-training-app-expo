import React from 'react';
import { View } from 'react-native';
import ExerciseCard from './ExerciseCard';

interface Exercise {
  name: string;
  sets: number;
  reps: number;
  rest: number | string;
}

interface Props {
  session: {
    exercises: Exercise[];
  };
  mesoId: string;
  weekNum: number;
  dayNum: number;
}

const WorkoutDay: React.FC<Props> = ({ session, mesoId, weekNum, dayNum }) => {
  return (
    <View>
      {session.exercises.map((exercise, idx) => (
        <ExerciseCard
          key={idx}
          exercise={exercise}
          mesoId={mesoId}
          weekNum={weekNum}
          dayNum={dayNum}
        />
      ))}
    </View>
  );
};

export default WorkoutDay;