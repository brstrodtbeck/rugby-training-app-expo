import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { getExercise1RM } from '../storage/logs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute } from '@react-navigation/native';
import { THEME } from '../theme/colors';

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
    'Barbell Hip Thrust',
  ]);

  const route = useRoute<RouteProp>();
  const [selectedExercise, setSelectedExercise] = useState<string>(exerciseNames[0]);
  const [manual1RM, setManual1RM] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [reps, setReps] = useState<string>('');
  const [calculated1RM, setCalculated1RM] = useState<number | null>(null);
  const navigation = useNavigation<NavigationProp>();

  const handleSave = async (value: number) => {
    if (!value || value <= 0) return;

    // Save latest 1RM
    await AsyncStorage.setItem(
      `1RM:${selectedExercise}`,
      JSON.stringify({ value, date: new Date().toISOString() })
    );

    // Append to history
    const rawHistory = await AsyncStorage.getItem(`1RMHistory:${selectedExercise}`);
    const history = rawHistory ? JSON.parse(rawHistory) : [];
    const newEntry = { value, date: new Date().toLocaleString() };
    const updatedHistory = [newEntry, ...history];
    await AsyncStorage.setItem(`1RMHistory:${selectedExercise}`, JSON.stringify(updatedHistory));

    // Update local state so FlatList refreshes
    setOneRMs((prev) => {
      const updated = prev.filter((entry) => entry.name !== selectedExercise);
      return [...updated, { name: selectedExercise, value }];
    });

    // Session-aware callback
    if (route.params?.onUpdate1RM) {
      route.params.onUpdate1RM(selectedExercise, value);
    }

    // Reset form
    setManual1RM('');
    setWeight('');
    setReps('');
    setCalculated1RM(null);
  };

  const handleCalculate = () => {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (!w || !r || w <= 0 || r <= 0) {
      setCalculated1RM(null);
      return;
    }

    const oneRM = estimate1RM(w, r);
    setCalculated1RM(oneRM);
  };

  // Get the value to save (either manual entry or calculated)
  const getValueToSave = (): number | null => {
    if (manual1RM && Number(manual1RM) > 0) {
      return Number(manual1RM);
    }
    if (calculated1RM) {
      return calculated1RM;
    }
    return null;
  };

  const valueToSave = getValueToSave();

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>My 1RMs</Text>
        <Text style={styles.subtitle}>
          Enter your 1RM manually or calculate it from weight and reps.
        </Text>

        {/* Dropdown Picker */}
        <Picker
          selectedValue={selectedExercise}
          onValueChange={(itemValue) => {
            setSelectedExercise(itemValue);
            setManual1RM('');
            setWeight('');
            setReps('');
            setCalculated1RM(null);
          }}
          style={styles.picker}
        >
          {exerciseNames.map((name) => (
            <Picker.Item key={name} label={name} value={name} />
          ))}
        </Picker>

        {/* Combined Input Section */}
        <View style={styles.inputSection}>
          <Text style={styles.sectionLabel}>Set Your 1RM</Text>
          
          {/* Manual Entry */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputGroupLabel}>Enter directly:</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 1RM (lbs)"
              placeholderTextColor={THEME.textMuted}
              keyboardType="numeric"
              value={manual1RM}
              onChangeText={(text) => {
                setManual1RM(text);
                // Clear calculated if manual entry is used
                if (text) {
                  setCalculated1RM(null);
                }
              }}
            />
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Calculator */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputGroupLabel}>Calculate from weight and reps:</Text>
            <TextInput
              style={styles.input}
              placeholder="Weight lifted (lbs)"
              placeholderTextColor={THEME.textMuted}
              keyboardType="numeric"
              value={weight}
              onChangeText={(text) => {
                setWeight(text);
                setCalculated1RM(null);
                // Clear manual if calculator is used
                if (text) {
                  setManual1RM('');
                }
              }}
            />
            <TextInput
              style={styles.input}
              placeholder="Reps performed"
              placeholderTextColor={THEME.textMuted}
              keyboardType="numeric"
              value={reps}
              onChangeText={(text) => {
                setReps(text);
                setCalculated1RM(null);
                // Clear manual if calculator is used
                if (text) {
                  setManual1RM('');
                }
              }}
            />
            <TouchableOpacity 
              style={[styles.calculateButton, (!weight || !reps) && styles.calculateButtonDisabled]} 
              onPress={handleCalculate}
              disabled={!weight || !reps}
            >
              <Text style={styles.calculateButtonText}>Calculate 1RM</Text>
            </TouchableOpacity>
            
            {calculated1RM && (
              <View style={styles.resultContainer}>
                <Text style={styles.resultLabel}>Estimated 1RM:</Text>
                <Text style={styles.resultValue}>{calculated1RM} lbs</Text>
              </View>
            )}
          </View>

          {/* Save Button */}
          {valueToSave && (
            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={() => handleSave(valueToSave)}
            >
              <Text style={styles.saveButtonText}>
                Save {valueToSave} lbs for {selectedExercise}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Display stored 1RMs */}
        <Text style={styles.sectionTitle}>Your 1RMs</Text>
        {oneRMs.length === 0 ? (
          <Text style={styles.emptyText}>No 1RMs saved yet. Enter or calculate one above.</Text>
        ) : (
          <View style={styles.listContainer}>
            {oneRMs.map((item) => (
              <View key={item.name} style={styles.row}>
                <View style={styles.rowContent}>
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
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: THEME.background 
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  title: { 
    fontSize: 24, 
    fontWeight: '700', 
    marginBottom: 4, 
    color: THEME.primary 
  },
  subtitle: { 
    fontSize: 14, 
    color: THEME.textMuted, 
    marginBottom: 20 
  },
  picker: { 
    marginBottom: 16, 
    backgroundColor: THEME.card,
    borderRadius: 8,
  },
  inputSection: {
    marginBottom: 24,
    backgroundColor: THEME.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.primary,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputGroupLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textSecondary,
    marginBottom: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textMuted,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.card,
    padding: 14,
    marginBottom: 12,
    borderRadius: 8,
    fontSize: 16,
    color: THEME.textPrimary,
  },
  calculateButton: {
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  calculateButtonDisabled: {
    backgroundColor: THEME.border,
    opacity: 0.6,
  },
  calculateButtonText: {
    color: THEME.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  resultContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: THEME.primaryFaded,
    borderRadius: 8,
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.primary,
  },
  saveButton: {
    backgroundColor: THEME.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: THEME.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginTop: 8,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: THEME.textMuted,
    textAlign: 'center',
    paddingVertical: 24,
    fontStyle: 'italic',
  },
  listContainer: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    backgroundColor: THEME.card,
    borderRadius: 8,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  rowContent: {
    flex: 1,
  },
  exercise: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  value: { 
    fontSize: 14, 
    color: THEME.primary, 
    fontWeight: '500' 
  },
  button: {
    backgroundColor: THEME.secondary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginLeft: 12,
  },
  buttonText: { 
    color: THEME.textOnSecondary, 
    fontWeight: '600',
    fontSize: 13,
  },
});

export default My1RMs;