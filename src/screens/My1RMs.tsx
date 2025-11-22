import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, Button } from 'react-native';
import { getExercise1RM } from '../storage/logs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute } from '@react-navigation/native';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'My1RMs'>;
type RouteProp = NativeStackScreenProps<RootStackParamList, 'My1RMs'>['route'];

interface OneRMEntry {
  name: string;
  value: number;
}

const My1RMs: React.FC = () => {
  const [oneRMs, setOneRMs] = useState<OneRMEntry[]>([]);
  const [exerciseNames] = useState<string[]>([
    'Back Squat',
    'Front Squat',
    'Bench Press',
    'Deadlift',
    'Overhead Press',
    'Power Clean',
    'Snatch',
    'Pull-Up',
    'Barbell Row',
    'Romanian Deadlift',
  ]);

const route = useRoute<RouteProp>();

const handleCalculate = async () => {
  const w = parseFloat(weight);
  const r = parseInt(reps, 10);
  if (!w || !r) return;

  const oneRM = estimate1RM(w, r);

  // Save latest 1RM
  await AsyncStorage.setItem(
    `1RM:${selectedExercise}`,
    JSON.stringify({ value: oneRM, date: new Date().toISOString() })
  );

  // Append to history
  const rawHistory = await AsyncStorage.getItem(`1RMHistory:${selectedExercise}`);
  const history = rawHistory ? JSON.parse(rawHistory) : [];
  const newEntry = { value: oneRM, date: new Date().toLocaleString() };
  const updatedHistory = [newEntry, ...history];
  await AsyncStorage.setItem(`1RMHistory:${selectedExercise}`, JSON.stringify(updatedHistory));

  // Update local state so FlatList refreshes
  setOneRMs((prev) => {
    const updated = prev.filter((entry) => entry.name !== selectedExercise);
    return [...updated, { name: selectedExercise, value: oneRM }];
  });

  // Session-aware callback
  if (route.params?.onUpdate1RM) {
    route.params.onUpdate1RM(selectedExercise, oneRM);
}

  setWeight('');
  setReps('');
};

  const [selectedExercise, setSelectedExercise] = useState<string>(exerciseNames[0]);
  const [weight, setWeight] = useState<string>('');
  const [reps, setReps] = useState<string>('');
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    const load1RMs = async () => {
      const results: OneRMEntry[] = [];
      for (const name of exerciseNames) {
        const value = await getExercise1RM(name);
        if (value) {
          results.push({ name, value });
        }
      }
      setOneRMs(results);
    };
    load1RMs();
  }, [exerciseNames]);

  // Epley formula
  function estimate1RM(weight: number, reps: number): number {
    return Math.round(weight * (1 + reps / 30));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My 1RMs</Text>
      <Text style={styles.subtitle}>
        Tap “View History” to see your 1RM progress over time.
      </Text>

      {/* Dropdown Picker */}
      <Picker
        selectedValue={selectedExercise}
        onValueChange={(itemValue) => setSelectedExercise(itemValue)}
        style={styles.picker}
      >
        {exerciseNames.map((name) => (
          <Picker.Item key={name} label={name} value={name} />
        ))}
      </Picker>

      {/* Inputs */}
      <TextInput
        style={styles.input}
        placeholder="Weight lifted"
        keyboardType="numeric"
        value={weight}
        onChangeText={setWeight}
      />
      <TextInput
        style={styles.input}
        placeholder="Reps performed"
        keyboardType="numeric"
        value={reps}
        onChangeText={setReps}
      />

      <Button title="Calculate 1RM" onPress={handleCalculate} />

      {/* Display stored 1RMs */}
      <FlatList
        data={oneRMs}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View>
              <Text style={styles.exercise}>{item.name}</Text>
              <Text style={styles.value}>{item.value} lbs</Text>
            </View>
            <TouchableOpacity
              style={styles.button}
              onPress={() =>
                navigation.navigate('1RMHistory', { exerciseName: item.name })
              }
            >
              <Text style={styles.buttonText}>View History</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 12 },
  picker: { marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginBottom: 12,
    borderRadius: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  exercise: { fontSize: 16, fontWeight: '600' },
  value: { fontSize: 14, color: '#555' },
  button: {
    backgroundColor: '#0a84ff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});

export default My1RMs;