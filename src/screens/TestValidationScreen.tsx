import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  seedTestData,
  clearTestData,
  validateProgressionLogic,
  getTestScenarioSummary,
  getTestDataBreakdown,
  getEnhancedAnalysisReport,
  TEST_EXERCISES,
} from '../utils/testProgressionData';
import { getRecentHistory } from '../utils/progressionLogic';
import ExerciseHistoryModal from '../components/ExerciseHistoryModal';

type Props = NativeStackScreenProps<RootStackParamList, 'TestValidation'>;

interface ValidationResult {
  scenario: string;
  passed: boolean;
  details: string;
}

export default function TestValidationScreen({ navigation }: Props): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeded, setIsSeeded] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[] | null>(null);
  const [allPassed, setAllPassed] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownText, setBreakdownText] = useState('');

  const scenarios = getTestScenarioSummary();

  const handleSeedData = async () => {
    setIsLoading(true);
    try {
      const result = await seedTestData();
      if (result.success) {
        setIsSeeded(true);
        Alert.alert('Success', result.message);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to seed test data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearData = async () => {
    Alert.alert(
      'Clear Test Data',
      'This will remove all test progression data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const result = await clearTestData();
              if (result.success) {
                setIsSeeded(false);
                setValidationResults(null);
                Alert.alert('Cleared', result.message);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to clear test data');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleValidate = async () => {
    setIsLoading(true);
    try {
      const result = await validateProgressionLogic();
      setValidationResults(result.results);
      setAllPassed(result.passed);
    } catch (error) {
      Alert.alert('Error', 'Validation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const openHistory = (exerciseName: string) => {
    setSelectedExercise(exerciseName);
    setShowHistoryModal(true);
  };

  const handleShowBreakdown = () => {
    const breakdown = getTestDataBreakdown();
    setBreakdownText(breakdown);
    setShowBreakdown(true);
  };

  const handleShowEnhancedAnalysis = () => {
    const report = getEnhancedAnalysisReport();
    setBreakdownText(report);
    setShowBreakdown(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🧪 Progression Test Block</Text>
          <Text style={styles.subtitle}>28-Day Validation Scenarios</Text>
        </View>

        {/* Test Exercises */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Exercises</Text>
          
          <TouchableOpacity
            style={styles.exerciseCard}
            onPress={() => openHistory(TEST_EXERCISES.BACK_SQUAT.name)}
          >
            <View style={[styles.badge, { backgroundColor: '#1976d215' }]}>
              <Text style={[styles.badgeText, { color: '#1976d2' }]}>1RM</Text>
            </View>
            <Text style={styles.exerciseName}>{TEST_EXERCISES.BACK_SQUAT.name}</Text>
            <Text style={styles.exerciseDetails}>5×5 @ 75% TM • Hybrid Progression</Text>
            <Text style={styles.historyLink}>📊 View History →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exerciseCard}
            onPress={() => openHistory(TEST_EXERCISES.DUMBBELL_ROW.name)}
          >
            <View style={[styles.badge, { backgroundColor: '#7b1fa215' }]}>
              <Text style={[styles.badgeText, { color: '#7b1fa2' }]}>Rule of 3</Text>
            </View>
            <Text style={styles.exerciseName}>{TEST_EXERCISES.DUMBBELL_ROW.name}</Text>
            <Text style={styles.exerciseDetails}>3×10 @ RPE 7 • Volume Progression</Text>
            <Text style={styles.historyLink}>📊 View History →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exerciseCard}
            onPress={() => openHistory(TEST_EXERCISES.VO2_MAX.name)}
          >
            <View style={[styles.badge, { backgroundColor: '#00796b15' }]}>
              <Text style={[styles.badgeText, { color: '#00796b' }]}>Cardio</Text>
            </View>
            <Text style={styles.exerciseName}>{TEST_EXERCISES.VO2_MAX.name}</Text>
            <Text style={styles.exerciseDetails}>4×4 min • History Only</Text>
            <Text style={styles.historyLink}>📊 View History →</Text>
          </TouchableOpacity>
        </View>

        {/* Test Scenarios */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Week-by-Week Scenarios</Text>
          
          {scenarios.map((scenario) => (
            <View key={scenario.week} style={styles.scenarioCard}>
              <View style={styles.scenarioHeader}>
                <Text style={styles.weekBadge}>Week {scenario.week}</Text>
                <Text style={styles.scenarioTitle}>{scenario.scenario}</Text>
              </View>
              <View style={styles.expectedList}>
                {scenario.expected.map((item, idx) => (
                  <Text key={idx} style={styles.expectedItem}>{item}</Text>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Validation Results */}
        {validationResults && (
          <View style={styles.section}>
            <View style={styles.resultsHeader}>
              <Text style={styles.sectionTitle}>Validation Results</Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: allPassed ? '#4caf5020' : '#f4433620' }
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  { color: allPassed ? '#4caf50' : '#f44336' }
                ]}>
                  {allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'}
                </Text>
              </View>
            </View>

            {validationResults.map((result, idx) => (
              <View
                key={idx}
                style={[
                  styles.resultCard,
                  { borderLeftColor: result.passed ? '#4caf50' : '#f44336' }
                ]}
              >
                <View style={styles.resultHeader}>
                  <Text style={styles.resultIcon}>
                    {result.passed ? '✅' : '❌'}
                  </Text>
                  <Text style={styles.resultScenario}>{result.scenario}</Text>
                </View>
                <Text style={styles.resultDetails}>{result.details}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.seedButton]}
            onPress={handleSeedData}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>
                {isSeeded ? '🔄 Re-Seed Test Data' : '📥 Seed 28-Day Test Data'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.validateButton]}
            onPress={handleValidate}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>🔍 Run Validation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.breakdownButton]}
            onPress={handleShowBreakdown}
          >
            <Text style={styles.buttonText}>📋 View Data Breakdown</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.enhancedButton]}
            onPress={handleShowEnhancedAnalysis}
          >
            <Text style={styles.buttonText}>📊 Enhanced Analysis (Charts & Flags)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={handleClearData}
            disabled={isLoading}
          >
            <Text style={[styles.buttonText, { color: '#f44336' }]}>
              🗑️ Clear Test Data
            </Text>
          </TouchableOpacity>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Progression Logic Legend</Text>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#1976d2' }]} />
            <Text style={styles.legendText}>1RM Tracked: Hybrid progression (TM adjustment)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#7b1fa2' }]} />
            <Text style={styles.legendText}>Rule of 3: 3 successes or +3 extra reps</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#00796b' }]} />
            <Text style={styles.legendText}>Cardio/Mobility: History only, no progression</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#4caf50' }]} />
            <Text style={styles.legendText}>🟢 Green: Ready to progress (3+ successes)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ff9800' }]} />
            <Text style={styles.legendText}>🟡 Yellow: Building streak (1-2 successes)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#f44336' }]} />
            <Text style={styles.legendText}>🔴 Red: Needs work (0 successes)</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* History Modal */}
      <ExerciseHistoryModal
        visible={showHistoryModal}
        exerciseName={selectedExercise}
        onClose={() => setShowHistoryModal(false)}
      />

      {/* Breakdown Modal */}
      <Modal
        visible={showBreakdown}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBreakdown(false)}
      >
        <SafeAreaView style={styles.breakdownModal}>
          <View style={styles.breakdownHeader}>
            <Text style={styles.breakdownTitle}>📋 Test Data Breakdown</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowBreakdown(false)}
            >
              <Text style={styles.closeButtonText}>✕ Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.breakdownContent} horizontal={false}>
            <Text style={styles.breakdownText}>{breakdownText}</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 12,
  },
  exerciseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  exerciseDetails: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  historyLink: {
    fontSize: 13,
    color: '#1976d2',
    fontWeight: '500',
    marginTop: 8,
  },
  scenarioCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  scenarioHeader: {
    marginBottom: 12,
  },
  weekBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1976d2',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  scenarioTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  expectedList: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: 12,
  },
  expectedItem: {
    fontSize: 13,
    color: '#444',
    lineHeight: 20,
    marginBottom: 4,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  resultScenario: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
    flex: 1,
  },
  resultDetails: {
    fontSize: 12,
    color: '#666',
    marginLeft: 24,
  },
  actions: {
    padding: 16,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  seedButton: {
    backgroundColor: '#1976d2',
  },
  validateButton: {
    backgroundColor: '#7b1fa2',
  },
  breakdownButton: {
    backgroundColor: '#00796b',
  },
  enhancedButton: {
    backgroundColor: '#ff6f00',
  },
  clearButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  breakdownModal: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  breakdownContent: {
    flex: 1,
    padding: 16,
  },
  breakdownText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#00ff00',
    lineHeight: 16,
  },
  legend: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
});

