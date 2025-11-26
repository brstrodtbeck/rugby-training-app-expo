import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getAllOneRMs, setOneRM } from '../utils/oneRMStore';
import { TrainingSession } from '../types';
import rugbyProgram from '../data/rugbyProgram.json';

type Props = NativeStackScreenProps<RootStackParamList, 'OneRMInput'>;

// ✅ Define the main lifts we care about
const MAIN_LIFTS = [
  'Squat',
  'Back Squat',
  'Front Squat',
  'Bench Press',
  'Overhead Press',
  'Push Press',
  'Deadlift',
  'Romanian Deadlift',
  'Power Clean',
  'Barbell Row',
];

export default function OneRMInputScreen({ navigation, route }: Props) {
  const [oneRMs, setOneRMsState] = useState<Record<string, number>>({});
  const [exerciseList, setExerciseList] = useState<string[]>([]);

  useEffect(() => {
    const loadOneRMs = async () => {
      const stored = await getAllOneRMs();
      setOneRMsState(stored);
    };

    let names: string[] = [];

    // ✅ Case 1: If a session is passed via route, use its exercises
    if (route.params?.session) {
      const session: TrainingSession = route.params.session;
      names = session.exercises
        .map((ex) => ex.name)
        .filter((name) => MAIN_LIFTS.includes(name));
    } else {
      // ✅ Case 2: Otherwise, traverse rugbyProgram.json
      if (rugbyProgram?.macrocycle?.mesocycles) {
        rugbyProgram.macrocycle.mesocycles.forEach((meso: any) => {
          meso.microcycle.forEach((day: any) => {
            day.exercises.forEach((ex: any) => {
              if (MAIN_LIFTS.includes(ex.name) && !names.includes(ex.name)) {
                names.push(ex.name);
              }
            });
          });
        });
      }
    }

    // ✅ Sort alphabetically
    names.sort((a, b) => a.localeCompare(b));

    setExerciseList(names);
    loadOneRMs();
  }, [route.params]);

  const handleSave = async (exercise: string, value: string) => {
    const num = Number(value);
    if (!isNaN(num) && num > 0) {
      await setOneRM(exercise, num);
      const updated = { ...oneRMs, [exercise]: num };
      setOneRMsState(updated);
      console.log(`✅ Saved 1RM for ${exercise}: ${num}lbs`);
    }
  };

  const renderExercise = ({ item }: { item: string }) => (
    <View style={styles.row}>
      <Text style={styles.label}>{item}</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="Enter 1RM"
        defaultValue={oneRMs[item]?.toString() ?? ''}
        onEndEditing={(e) => handleSave(item, e.nativeEvent.text)}
      />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>🏋️ Enter Your 1RMs</Text>
      <Text style={styles.helperText}>
        Input your tested or estimated 1RM for each main lift. These values will be used to calculate suggested loads.
      </Text>

      {exerciseList.length === 0 ? (
        <Text>No main lifts found in program.</Text>
      ) : (
        <FlatList
          data={exerciseList}
          keyExtractor={(item) => item}
          renderItem={renderExercise}
          scrollEnabled={false}
        />
      )}

      <TouchableOpacity
        style={styles.saveButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.saveText}>✅ Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  helperText: { fontSize: 14, color: '#555', marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: { flex: 1, fontSize: 16, fontWeight: '500' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    marginLeft: 8,
  },
  saveButton: {
    marginTop: 20,
    paddingVertical: 12,
    backgroundColor: '#28a745',
    borderRadius: 8,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700' },
});