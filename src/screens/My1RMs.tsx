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
  Alert,
} from 'react-native';
import { getExercise1RM } from '../storage/logs';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTheme } from '../theme/ThemeContext';
import { triggerHaptic } from '../utils/haptics';
import { analytics } from '../utils/analytics';
import Toast from 'react-native-toast-message';
import { validateWeightInput, validateRepsInput, validate1RMInput, isValidWeight, isValidReps, isValid1RM } from '../utils/inputValidation';

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
  const isOnboarding = route.params?.isOnboarding ?? false;
  const { theme } = useTheme();
  
  const styles = useThemedStyles((theme) => StyleSheet.create({
    container: { 
      flex: 1, 
      backgroundColor: theme.background 
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
      color: theme.primary 
    },
    subtitle: { 
      fontSize: 14, 
      color: theme.textMuted, 
      marginBottom: 20 
    },
    picker: { 
      marginBottom: 16, 
      backgroundColor: theme.card,
      borderRadius: 8,
    },
    inputSection: {
      marginBottom: 24,
      backgroundColor: theme.card,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionLabel: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.primary,
      marginBottom: 16,
    },
    inputGroup: {
      marginBottom: 16,
    },
    inputGroupLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
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
      backgroundColor: theme.border,
    },
    dividerText: {
      marginHorizontal: 12,
      fontSize: 12,
      fontWeight: '600',
      color: theme.textMuted,
      textTransform: 'uppercase',
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 14,
      marginBottom: 12,
      borderRadius: 8,
      fontSize: 16,
      color: theme.textPrimary,
    },
    calculateButton: {
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 4,
    },
    calculateButtonDisabled: {
      backgroundColor: theme.border,
      opacity: 0.6,
    },
    calculateButtonText: {
      color: theme.textOnPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    resultContainer: {
      marginTop: 16,
      padding: 16,
      backgroundColor: theme.primaryFaded,
      borderRadius: 8,
      alignItems: 'center',
    },
    resultLabel: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    resultValue: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.primary,
    },
    saveButton: {
      backgroundColor: theme.primary,
      paddingVertical: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 16,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    saveButtonText: {
      color: theme.textOnPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.textPrimary,
      marginTop: 8,
      marginBottom: 12,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textMuted,
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
      backgroundColor: theme.card,
      borderRadius: 8,
      shadowColor: theme.shadow,
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
      color: theme.textPrimary,
      marginBottom: 4,
    },
    value: { 
      fontSize: 14, 
      color: theme.primary, 
      fontWeight: '500' 
    },
    button: {
      backgroundColor: theme.secondary,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 6,
      marginLeft: 12,
    },
    buttonText: { 
      color: theme.textOnSecondary, 
      fontWeight: '600',
      fontSize: 13,
    },
    onboardingActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 24,
      marginBottom: 16,
    },
    primaryActionButton: {
      flex: 1,
      backgroundColor: theme.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    primaryActionButtonText: {
      color: theme.textOnPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    secondaryActionButton: {
      flex: 1,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    secondaryActionButtonText: {
      color: theme.textSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
  }));

  const handleSave = async (value: number) => {
    if (!value || value <= 0) {
      Alert.alert('Invalid Value', 'Please enter a valid 1RM value greater than 0.');
      return;
    }

    // Haptic feedback for saving 1RM
    triggerHaptic.success();

    try {
      // Save latest 1RM
      await AsyncStorage.setItem(
        `1RM:${selectedExercise}`,
        JSON.stringify({ value, date: new Date().toISOString() })
      );

      // Append to history
      const rawHistory = await AsyncStorage.getItem(`1RMHistory:${selectedExercise}`);
      const history = rawHistory ? JSON.parse(rawHistory) : [];
      // Use ISO string for reliable date parsing across platforms
      const newEntry = { value, date: new Date().toISOString() };
      const updatedHistory = [newEntry, ...history];
      await AsyncStorage.setItem(`1RMHistory:${selectedExercise}`, JSON.stringify(updatedHistory));

      // Update local state so FlatList refreshes
      setOneRMs((prev) => {
        const updated = prev.filter((entry) => entry.name !== selectedExercise);
        return [...updated, { name: selectedExercise, value }];
      });

      // Track 1RM entry
      const method = manual1RM && Number(manual1RM) > 0 ? 'manual' : 'calculated';
      analytics.oneRMEntered(selectedExercise, value, method).catch(() => {
        // Silently fail - analytics is optional
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

      // Success toast
      Toast.show({
        type: 'success',
        text1: '✅ 1RM Saved',
        text2: `${selectedExercise}: ${value} lbs`,
        position: 'top',
        visibilityTime: 2000,
      });
    } catch (error) {
      if (__DEV__) {
        console.error('Error saving 1RM:', error);
      }
      Alert.alert('Error', 'Failed to save 1RM. Please try again.');
    }
  };

  const handleCalculate = () => {
    // Validate inputs before calculation
    if (!isValidWeight(weight) || !isValidReps(reps)) {
      Alert.alert(
        'Invalid Input',
        'Please enter valid numbers:\n• Weight must be greater than 0\n• Reps must be a positive whole number',
        [{ text: 'OK' }]
      );
      setCalculated1RM(null);
      return;
    }

    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (!w || !r || w <= 0 || r <= 0) {
      setCalculated1RM(null);
      return;
    }

    // Haptic feedback for calculation
    triggerHaptic.selection();

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

  // Reload 1RMs when screen comes into focus (in case user saved from another screen)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
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
    });

    return unsubscribe;
  }, [navigation, exerciseNames]);

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
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              value={manual1RM}
              onChangeText={(text) => {
                const validated = validate1RMInput(text);
                setManual1RM(validated);
                // Clear calculated if manual entry is used
                if (validated) {
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
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              value={weight}
              onChangeText={(text) => {
                const validated = validateWeightInput(text);
                setWeight(validated);
                setCalculated1RM(null);
                // Clear manual if calculator is used
                if (validated) {
                  setManual1RM('');
                }
              }}
            />
            <TextInput
              style={styles.input}
              placeholder="Reps performed"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              value={reps}
              onChangeText={(text) => {
                const validated = validateRepsInput(text);
                setReps(validated);
                setCalculated1RM(null);
                // Clear manual if calculator is used
                if (validated) {
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
              accessibilityLabel={`Save ${valueToSave} pounds for ${selectedExercise}`}
              accessibilityRole="button"
              accessibilityHint="Saves the one rep max value for this exercise"
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

        {/* Onboarding Navigation Buttons */}
        {isOnboarding && (
          <View style={styles.onboardingActions}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryActionButton]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.secondaryActionButtonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.primaryActionButton]}
              onPress={() => {
                if (route.params?.onContinue) {
                  route.params.onContinue();
                }
                navigation.goBack();
              }}
            >
              <Text style={styles.primaryActionButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default My1RMs;