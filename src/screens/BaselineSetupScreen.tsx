import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { saveExercise1RM } from '../storage/logs';
import { estimate1RM } from '../utils/1rm';
import { THEME } from '../theme/colors';
import { validateWeightInput, validateRepsInput, validate1RMInput, isValidWeight, isValidReps, isValid1RM } from '../utils/inputValidation';

type Props = NativeStackScreenProps<RootStackParamList, 'BaselineSetup'>;

const BaselineSetup: React.FC<Props> = ({ route, navigation }) => {
  const [exerciseName, setExerciseName] = useState('');
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
    if (!isValid1RM(String(value)) || value <= 0) {
      Alert.alert('Invalid Value', 'Please enter a valid 1RM value greater than 0.');
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
    // Validate inputs before calculation
    if (!isValidWeight(weight) || !isValidReps(reps)) {
      Alert.alert(
        'Invalid Input',
        'Please enter valid numbers:\n• Weight must be greater than 0\n• Reps must be a positive whole number',
        [{ text: 'OK' }]
      );
      setResult(null);
      return;
    }

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
        placeholderTextColor={THEME.textMuted}
        value={exerciseName}
        onChangeText={setExerciseName}
      />

      {mode === null && (
        <View style={styles.modeButtons}>
          <TouchableOpacity style={styles.button} onPress={() => setMode('enter')}>
            <Text style={styles.buttonText}>Enter Known 1RM</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonSecondary} onPress={() => setMode('calculate')}>
            <Text style={styles.buttonSecondaryText}>Estimate 1RM from Weight × Reps</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'enter' && (
        <View style={styles.section}>
          <TextInput
            style={styles.input}
            placeholder="Enter your known 1RM (lbs)"
            placeholderTextColor={THEME.textMuted}
            keyboardType="numeric"
            value={oneRM}
            onChangeText={(text) => {
              const validated = validate1RMInput(text);
              setOneRM(validated);
            }}
          />
          <TouchableOpacity style={styles.button} onPress={() => handleSave(Number(oneRM))}>
            <Text style={styles.buttonText}>Save 1RM</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'calculate' && (
        <View style={styles.section}>
          <TextInput
            style={styles.input}
            placeholder="Weight lifted (lbs)"
            placeholderTextColor={THEME.textMuted}
            keyboardType="numeric"
            value={weight}
            onChangeText={(text) => {
              const validated = validateWeightInput(text);
              setWeight(validated);
            }}
          />
          <TextInput
            style={styles.input}
            placeholder="Reps completed"
            placeholderTextColor={THEME.textMuted}
            keyboardType="numeric"
            value={reps}
            onChangeText={(text) => {
              const validated = validateRepsInput(text);
              setReps(validated);
            }}
          />
          <TouchableOpacity style={styles.button} onPress={handleCalculate}>
            <Text style={styles.buttonText}>Estimate 1RM</Text>
          </TouchableOpacity>
          {result && (
            <>
              <Text style={styles.result}>Estimated 1RM: {Math.round(result)} lbs</Text>
              <TouchableOpacity style={styles.buttonSuccess} onPress={() => handleSave(result)}>
                <Text style={styles.buttonText}>Save This 1RM</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: THEME.background },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 16, color: THEME.primary },
  input: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    backgroundColor: THEME.card,
    fontSize: 16,
    color: THEME.textPrimary,
  },
  modeButtons: {
    marginTop: 12,
    gap: 12,
  },
  section: {
    marginTop: 16,
  },
  button: {
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: THEME.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonSecondary: {
    backgroundColor: THEME.card,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: THEME.secondary,
  },
  buttonSecondaryText: {
    color: THEME.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSuccess: {
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  result: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.primary,
    textAlign: 'center',
    padding: 16,
    backgroundColor: THEME.primaryFaded,
    borderRadius: 8,
  },
});

export default BaselineSetup;