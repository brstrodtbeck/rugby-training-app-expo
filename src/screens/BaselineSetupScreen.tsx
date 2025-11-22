import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { saveExercise1RM } from '../storage/logs';
import { estimate1RM } from '../utils/1rm';

type Props = NativeStackScreenProps<RootStackParamList, 'BaselineSetup'>;

const BaselineSetup: React.FC<Props> = ({ route, navigation }) => {
  const defaultExercise = route.params?.exerciseName ?? '';
  const [exerciseName, setExerciseName] = useState(defaultExercise);
  const [mode, setMode] = useState<'enter' | 'calculate' | null>(null);
  const [oneRM, setOneRM] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [result, setResult] = useState<number | null>(null);

  const handleSave = async (value: number) => {
    if (!exerciseName) {
      Alert.alert('Missing exercise name', 'Please enter the exercise name.');
      return;
    }
    await saveExercise1RM(exerciseName, value);
    Alert.alert('Saved', `1RM for ${exerciseName} saved as ${Math.round(value)} lbs`);
    setOneRM('');
    setWeight('');
    setReps('');
    setResult(null);
    setMode(null);
    setExerciseName('');
  };

  const handleCalculate = () => {
    const w = Number(weight);
    const r = Number(reps);
    const est = estimate1RM(w, r);
    if (est) {
      setResult(est);
    } else {
      Alert.alert('Invalid input', 'Please enter valid numbers for weight and reps.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Set Your Baseline 1RM</Text>

      <TextInput
        style={styles.input}
        placeholder="Exercise name (e.g. Back Squat)"
        value={exerciseName}
        onChangeText={setExerciseName}
      />

      {mode === null && (
        <View style={styles.modeButtons}>
          <Button title="Enter Known 1RM" onPress={() => setMode('enter')} />
          <View style={{ height: 10 }} />
          <Button title="Estimate 1RM from Weight × Reps" onPress={() => setMode('calculate')} />
        </View>
      )}

      {mode === 'enter' && (
        <View style={styles.section}>
          <TextInput
            style={styles.input}
            placeholder="Enter your known 1RM (lbs)"
            keyboardType="numeric"
            value={oneRM}
            onChangeText={setOneRM}
          />
          <Button title="Save 1RM" onPress={() => handleSave(Number(oneRM))} />
        </View>
      )}

      {mode === 'calculate' && (
        <View style={styles.section}>
          <TextInput
            style={styles.input}
            placeholder="Weight lifted (lbs)"
            keyboardType="numeric"
            value={weight}
            onChangeText={setWeight}
          />
          <TextInput
            style={styles.input}
            placeholder="Reps completed"
            keyboardType="numeric"
            value={reps}
            onChangeText={setReps}
          />
          <Button title="Estimate 1RM" onPress={handleCalculate} />
          {result && (
            <>
              <Text style={styles.result}>Estimated 1RM: {Math.round(result)} lbs</Text>
              <Button title="Save This 1RM" onPress={() => handleSave(result)} />
            </>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  modeButtons: {
    marginTop: 12,
  },
  section: {
    marginTop: 16,
  },
  result: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#0a84ff',
  },
});

export default BaselineSetup;