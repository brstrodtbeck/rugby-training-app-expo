import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTheme } from '../theme/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

interface ProgramOption {
  id: string;
  title: string;
  description: string;
  duration: string;
  focus: string[];
  difficulty: string;
  sessionsPerWeek: string;
  highlights: string[];
}

const PROGRAM_OPTIONS: ProgramOption[] = [
  {
    id: 'rugby',
    title: 'Rugby Season Prep',
    description: 'Comprehensive 16-week rugby-specific training program with seasonal periodization. Designed for rugby players preparing for competitive season.',
    duration: '16 weeks',
    focus: ['Strength', 'Power', 'Conditioning', 'Mobility', 'Recovery'],
    difficulty: 'Intermediate to Advanced',
    sessionsPerWeek: '4-5',
    highlights: [
      'Progressive strength development across 5 mesocycles',
      'Rugby-specific movement patterns and conditioning',
      'Periodized approach: Foundation → Strength → Power → Conditioning → Peak',
      'Integrated recovery and mobility sessions',
      '1RM-based progression with readiness adjustments',
    ],
  },
  {
    id: 'fitness',
    title: '20-Week Foundation Program',
    description: 'Comprehensive training program progressing from foundation strength to peak performance. Perfect for athletes building a complete strength and conditioning base.',
    duration: '20 weeks',
    focus: ['Foundation Strength', 'Power Development', 'Conditioning', 'Athletic Performance'],
    difficulty: 'Intermediate',
    sessionsPerWeek: '4-5',
    highlights: [
      '5 progressive mesocycles: Foundation → Strength → Power → Conditioning → Peak',
      'Structured periodization with deload weeks',
      '1RM-based progression with training max calculations',
      'Integrated mobility and recovery protocols',
      'Comprehensive exercise library with detailed instructions',
    ],
  },
  {
    id: 'simple',
    title: 'Simple Weight Training',
    description: 'Straightforward strength training program focused on fundamental movements. Ideal for beginners or those seeking a simple, effective routine.',
    duration: '12 weeks',
    focus: ['Basic Strength', 'Muscle Building', 'Movement Quality'],
    difficulty: 'Beginner to Intermediate',
    sessionsPerWeek: '3-4',
    highlights: [
      'Focus on fundamental compound movements',
      'Progressive overload with clear progression rules',
      'Flexible scheduling (3-4 sessions per week)',
      'Beginner-friendly with detailed form cues',
      'Volume-based and 1RM progression options',
    ],
  },
  {
    id: 'hypertrophy',
    title: 'Hypertrophy Month',
    description: '4-week focused hypertrophy program emphasizing muscle growth through volume and progressive overload. Perfect for a dedicated muscle-building block.',
    duration: '4 weeks',
    focus: ['Muscle Growth', 'Volume Training', 'Hypertrophy'],
    difficulty: 'Intermediate',
    sessionsPerWeek: '3',
    highlights: [
      'High-volume training for muscle growth',
      'Superset and circuit training for efficiency',
      'Activation and mobility work integrated',
      '3-day per week schedule (Monday, Wednesday, Friday)',
      'Progressive overload with readiness adjustments',
    ],
  },
];

const ONBOARDING_COMPLETE_KEY = 'onboardingComplete';

export default function OnboardingScreen({ navigation }: Props) {
  const [step, setStep] = useState<'1rm' | 'program'>('1rm');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();
  
  const styles = useThemedStyles((theme) => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    stepContainer: {
      flex: 1,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: theme.textSecondary,
      marginBottom: 32,
      textAlign: 'center',
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.borderLight,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 12,
    },
    cardDescription: {
      fontSize: 15,
      color: theme.textSecondary,
      lineHeight: 22,
      marginBottom: 16,
    },
    cardNote: {
      fontSize: 14,
      color: theme.textMuted,
      fontStyle: 'italic',
      marginBottom: 24,
      lineHeight: 20,
    },
    buttonGroup: {
      gap: 12,
    },
    button: {
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButton: {
      backgroundColor: theme.primary,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    primaryButtonText: {
      color: theme.textOnPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    secondaryButton: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    secondaryButtonText: {
      color: theme.textSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
    programCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 2,
      borderColor: theme.borderLight,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    programCardSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '08',
    },
    programHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    programTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.textPrimary,
      flex: 1,
    },
    selectedBadge: {
      backgroundColor: theme.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    selectedBadgeText: {
      color: theme.textOnPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    programDescription: {
      fontSize: 15,
      color: theme.textSecondary,
      lineHeight: 22,
      marginBottom: 16,
    },
    programDetails: {
      marginBottom: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    detailLabel: {
      fontSize: 14,
      color: theme.textMuted,
      fontWeight: '500',
    },
    detailValue: {
      fontSize: 14,
      color: theme.textPrimary,
      fontWeight: '600',
    },
    focusSection: {
      marginBottom: 16,
    },
    focusTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 8,
    },
    focusTags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    focusTag: {
      backgroundColor: theme.secondary + '20',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    focusTagText: {
      fontSize: 13,
      color: theme.secondary,
      fontWeight: '600',
    },
    highlightsSection: {
      marginTop: 8,
    },
    highlightsTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 12,
    },
    highlightItem: {
      flexDirection: 'row',
      marginBottom: 8,
      alignItems: 'flex-start',
    },
    highlightBullet: {
      fontSize: 16,
      color: theme.primary,
      marginRight: 8,
      fontWeight: '700',
    },
    highlightText: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
      flex: 1,
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.background + 'E6',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 16,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    helpLink: {
      marginTop: 24,
      padding: 16,
      backgroundColor: theme.secondary + '15',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.secondary + '30',
      alignItems: 'center',
    },
    helpLinkText: {
      fontSize: 15,
      color: theme.secondary,
      fontWeight: '600',
    },
  }));

  const handleSkip1RM = async () => {
    setStep('program');
  };

  const handleGoTo1RM = () => {
    navigation.navigate('My1RMs', { 
      isOnboarding: true,
      onContinue: () => {
        setStep('program');
      }
    });
  };

  const handleSelectProgram = async (programId: string) => {
    setSelectedProgramId(programId);
    setIsLoading(true);
    
    try {
      // Save program selection
      await AsyncStorage.setItem('selectedProgramId', programId);
      
      // Reset program offset to ensure clean start
      await AsyncStorage.setItem('programOffset', '0');
      
      // Mark onboarding as complete
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      
      // Navigate to home
      navigation.replace('Home');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {step === '1rm' ? (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Welcome to Progressive Overlord</Text>
            <Text style={styles.subtitle}>
              Let's get you set up for success
            </Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Step 1: Set Your 1RMs</Text>
              <Text style={styles.cardDescription}>
                Enter your one-rep max (1RM) values for key exercises to get personalized weight suggestions. You can enter them manually or calculate from weight × reps.
              </Text>
              <Text style={styles.cardNote}>
                💡 Tip: You can skip this step and set 1RMs later, but having them set up will give you better workout suggestions.
              </Text>

              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleGoTo1RM}
                >
                  <Text style={styles.primaryButtonText}>Set My 1RMs</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleSkip1RM}
                >
                  <Text style={styles.secondaryButtonText}>Skip for Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Choose Your Training Program</Text>
            <Text style={styles.subtitle}>
              Select the program that best fits your goals
            </Text>

            {PROGRAM_OPTIONS.map((program) => (
              <TouchableOpacity
                key={program.id}
                style={[
                  styles.programCard,
                  selectedProgramId === program.id && styles.programCardSelected,
                ]}
                onPress={() => handleSelectProgram(program.id)}
                disabled={isLoading}
              >
                <View style={styles.programHeader}>
                  <Text style={styles.programTitle}>{program.title}</Text>
                  {selectedProgramId === program.id && (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>✓ Selected</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.programDescription}>{program.description}</Text>

                <View style={styles.programDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Duration:</Text>
                    <Text style={styles.detailValue}>{program.duration}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Sessions/Week:</Text>
                    <Text style={styles.detailValue}>{program.sessionsPerWeek}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Difficulty:</Text>
                    <Text style={styles.detailValue}>{program.difficulty}</Text>
                  </View>
                </View>

                <View style={styles.focusSection}>
                  <Text style={styles.focusTitle}>Focus Areas:</Text>
                  <View style={styles.focusTags}>
                    {program.focus.map((area, idx) => (
                      <View key={idx} style={styles.focusTag}>
                        <Text style={styles.focusTagText}>{area}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.highlightsSection}>
                  <Text style={styles.highlightsTitle}>Key Highlights:</Text>
                  {program.highlights.map((highlight, idx) => (
                    <View key={idx} style={styles.highlightItem}>
                      <Text style={styles.highlightBullet}>•</Text>
                      <Text style={styles.highlightText}>{highlight}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            ))}

            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.loadingText}>Setting up your program...</Text>
              </View>
            )}
          </View>
        )}

        {/* Help Link */}
        <TouchableOpacity
          style={styles.helpLink}
          onPress={() => navigation.navigate('Help')}
        >
          <Text style={styles.helpLinkText}>📖 View Help & Instructions</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

