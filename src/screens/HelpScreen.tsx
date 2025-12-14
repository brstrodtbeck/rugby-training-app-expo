import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { THEME } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Help'>;

interface HelpSection {
  id: string;
  title: string;
  icon: string;
  content: React.ReactElement;
  searchableText: string; // All text content for searching
}

export default function HelpScreen({ navigation }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  // Auto-expand sections when searching (moved after sections definition)

  const sections: HelpSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: '🚀',
      searchableText: 'getting started first steps set 1RM values exercises squat bench deadlift training program workout session update 1RMs',
      content: (
        <View style={styles.sectionContent}>
          <Text style={styles.paragraph}>
            Welcome to RepMaster! This app helps you track your workouts and automatically progress your weights using intelligent algorithms.
          </Text>
          
          <Text style={styles.subheading}>First Steps:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>1. Set your 1RM values for key exercises (squat, bench, deadlift, etc.)</Text>
            <Text style={styles.bullet}>2. Choose a training program that fits your goals</Text>
            <Text style={styles.bullet}>3. Start your first workout session</Text>
          </View>

          <Text style={styles.paragraph}>
            Don't worry about getting everything perfect—you can update your 1RMs anytime, and the app will adjust automatically.
          </Text>
        </View>
      ),
    },
    {
      id: 'progression',
      title: 'How Progression Works',
      icon: '📈',
      searchableText: 'progression main lifts hybrid 1RM system squats deadlifts bench press percentages weights log workouts estimate 1RM working weights volume exercises rule of 3 assistance consecutive successful sessions increase weight 2.5-5% extra reps last set quality gates form',
      content: (
        <View style={styles.sectionContent}>
          <Text style={styles.paragraph}>
            RepMaster uses two intelligent progression systems:
          </Text>

          <Text style={styles.subheading}>Main Lifts (Hybrid 1RM System):</Text>
          <Text style={styles.paragraph}>
            For exercises like squats, deadlifts, and bench press:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Weights are calculated as percentages of your 1RM</Text>
            <Text style={styles.bullet}>• When you log workouts, the app automatically estimates your new 1RM</Text>
            <Text style={styles.bullet}>• As your 1RM increases, working weights progress automatically</Text>
            <Text style={styles.bullet}>• No manual adjustments needed!</Text>
          </View>

          <Text style={styles.subheading}>Volume Exercises (Rule of 3):</Text>
          <Text style={styles.paragraph}>
            For assistance and volume-based exercises:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Complete 3 consecutive successful sessions at the same weight</Text>
            <Text style={styles.bullet}>• The app automatically suggests increasing weight by 2.5-5%</Text>
            <Text style={styles.bullet}>• Or hit 3+ extra reps on your last set for immediate progression</Text>
            <Text style={styles.bullet}>• Quality gates ensure proper form before progression</Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>💡 Tip:</Text>
            <Text style={styles.tipText}>
              The app tracks your progress automatically. Just log your workouts accurately, and the progression happens on its own!
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: 'readiness',
      title: 'Readiness Scores',
      icon: '💪',
      searchableText: 'readiness scores rate feel scale 1-10 adjust workout intelligently high energy 8-10 weight increases 2-5% extra set moderate 4-7 standard workout low energy 1-3 recovery mode weight reduced 5-10% one less set overtraining skip readiness defaults moderate 5',
      content: (
        <View style={styles.sectionContent}>
          <Text style={styles.paragraph}>
            Before each workout, you'll rate how you feel on a scale of 1-10. The app uses this to adjust your workout intelligently.
          </Text>

          <Text style={styles.subheading}>How It Works:</Text>
          
          <View style={styles.readinessCard}>
            <Text style={styles.readinessTitle}>8-10 (High Energy) ⚡</Text>
            <Text style={styles.readinessDesc}>
              Feeling great! Weight increases by 2-5%, and you may get an extra set to maximize gains.
            </Text>
          </View>

          <View style={styles.readinessCard}>
            <Text style={styles.readinessTitle}>4-7 (Moderate) ▲</Text>
            <Text style={styles.readinessDesc}>
              Standard workout as programmed. No adjustments—just follow the plan.
            </Text>
          </View>

          <View style={styles.readinessCard}>
            <Text style={styles.readinessTitle}>1-3 (Low Energy) ◇</Text>
            <Text style={styles.readinessDesc}>
              Recovery mode: Weight reduced by 5-10%, one less set. Protects you from overtraining when you're tired or stressed.
            </Text>
          </View>

          <Text style={styles.paragraph}>
            You can skip the readiness check—the app defaults to moderate (5).
          </Text>
        </View>
      ),
    },
    {
      id: 'logging-workouts',
      title: 'Logging Your Workout',
      icon: '📝',
      searchableText: 'logging workouts log exercise suggested weight progress readiness enter actual weight lifted sets reps RPE rate perceived exertion rest timer start rest countdown rest periods completing exercises check off progress saved',
      content: (
        <View style={styles.sectionContent}>
          <Text style={styles.paragraph}>
            Logging your workouts is simple and helps the app learn your progress:
          </Text>

          <Text style={styles.subheading}>For Each Exercise:</Text>
          <View style={styles.numberedList}>
            <View style={styles.numberedItem}>
              <Text style={styles.number}>1</Text>
              <Text style={styles.numberedText}>
                Review the suggested weight (based on your progress and readiness)
              </Text>
            </View>
            <View style={styles.numberedItem}>
              <Text style={styles.number}>2</Text>
              <Text style={styles.numberedText}>
                Enter the actual weight you lifted for each set
              </Text>
            </View>
            <View style={styles.numberedItem}>
              <Text style={styles.number}>3</Text>
              <Text style={styles.numberedText}>
                Enter the reps you completed
              </Text>
            </View>
            <View style={styles.numberedItem}>
              <Text style={styles.number}>4</Text>
              <Text style={styles.numberedText}>
                Optionally enter RPE (Rate of Perceived Exertion) - how hard it felt
              </Text>
            </View>
          </View>

          <Text style={styles.subheading}>Rest Timer:</Text>
          <Text style={styles.paragraph}>
            Tap "Start Rest" between sets. The timer counts down automatically to help you maintain proper rest periods.
          </Text>

          <Text style={styles.subheading}>Completing Exercises:</Text>
          <Text style={styles.paragraph}>
            Check off each exercise as you finish. Your progress is automatically saved.
          </Text>
        </View>
      ),
    },
    {
      id: 'swap-push',
      title: 'Swap & Push Sessions',
      icon: '📅',
      searchableText: 'swap push sessions swap button swap sessions tomorrow workout today recovery session tap swap home screen replace today session workout program equipment available change things push workouts missed days automatically detects missed sessions reschedule forward program aligned home screen progress tracking',
      content: (
        <View style={styles.sectionContent}>
          <Text style={styles.paragraph}>
            Life happens! The app includes features to keep your program flexible:
          </Text>

          <Text style={styles.subheading}>Swap Sessions:</Text>
          <Text style={styles.paragraph}>
            Want to do tomorrow's workout today? Or switch to a recovery session? Tap "Swap" on the home screen to replace today's session with any workout from your program. Perfect for when equipment isn't available or you want to change things up.
          </Text>

          <Text style={styles.subheading}>Push Workouts:</Text>
          <Text style={styles.paragraph}>
            Missed a few days? No problem! The app automatically detects missed sessions. Tap "Push Workouts" to reschedule everything forward, keeping your program perfectly aligned. No more being "off" after missing a day!
          </Text>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>💡 Tip:</Text>
            <Text style={styles.tipText}>
              Both features are available from the home screen. Your progress tracking continues seamlessly regardless of which sessions you do.
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: 'understanding-ui',
      title: 'Understanding the Interface',
      icon: '🎨',
      searchableText: 'interface home screen view today workout schedule calendar access completed sessions swap push sessions session screen review suggested weights blue log sets reps weights exercise rest timer tap exercise names history progression suggestions rule of 3 indicators green ready progress 3/3 successes 3 reps yellow building streak 1-2/3 successes red starting fresh 0 successes',
      content: (
        <View style={styles.sectionContent}>
          <Text style={styles.subheading}>Home Screen:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• View today's workout at the top</Text>
            <Text style={styles.bullet}>• See your schedule on the calendar</Text>
            <Text style={styles.bullet}>• Access completed sessions</Text>
            <Text style={styles.bullet}>• Swap or push sessions as needed</Text>
          </View>

          <Text style={styles.subheading}>Session Screen:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Review suggested weights (shown in blue)</Text>
            <Text style={styles.bullet}>• Log sets, reps, and weights for each exercise</Text>
            <Text style={styles.bullet}>• Use rest timer between sets</Text>
            <Text style={styles.bullet}>• Tap exercise names to see history</Text>
            <Text style={styles.bullet}>• View progression suggestions (Rule of 3 indicators)</Text>
          </View>

          <Text style={styles.subheading}>Progression Indicators:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>🟢 Green = Ready to progress (3/3 successes or +3 reps)</Text>
            <Text style={styles.bullet}>🟡 Yellow = Building streak (1-2/3 successes)</Text>
            <Text style={styles.bullet}>🔴 Red = Starting fresh (0 successes)</Text>
          </View>
        </View>
      ),
    },
    {
      id: 'tips-tricks',
      title: 'Tips & Best Practices',
      icon: '✨',
      searchableText: 'tips best practices consistency key complete sessions regularly log accurately learns data better suggestions trust system rule of 3 prevents rushing progression quality gates proper form guide honest readiness rate readiness accurately low scores protect overtraining high scores push ready form first prioritize proper form weight form breaks reduce weight quality gates safe progression updating 1RMs my 1RMs home screen update maximum values automatically recalculate suggested weights future sessions',
      content: (
        <View style={styles.sectionContent}>
          <Text style={styles.subheading}>For Best Results:</Text>
          
          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>📊 Consistency is Key</Text>
            <Text style={styles.tipText}>
              Complete sessions regularly and log accurately. The app learns from your data to provide better suggestions.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>✅ Trust the System</Text>
            <Text style={styles.tipText}>
              The Rule of 3 prevents rushing progression. Quality gates ensure proper form. Let the app guide you.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>💯 Be Honest with Readiness</Text>
            <Text style={styles.tipText}>
              Rate your readiness accurately. Low scores protect you from overtraining. High scores let you push when ready.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>🏋️ Form First</Text>
            <Text style={styles.tipText}>
              Always prioritize proper form over weight. If form breaks down, reduce weight. Quality gates ensure safe progression.
            </Text>
          </View>

          <Text style={styles.subheading}>Updating Your 1RMs:</Text>
          <Text style={styles.paragraph}>
            Go to "My 1RMs" from the home screen to update your maximum values. The app will automatically recalculate suggested weights for future sessions.
          </Text>
        </View>
      ),
    },
  ];

  // Filter sections based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) {
      return sections;
    }
    
    const query = searchQuery.toLowerCase();
    return sections.filter(section => {
      return (
        section.title.toLowerCase().includes(query) ||
        section.searchableText.toLowerCase().includes(query)
      );
    });
  }, [searchQuery]);

  // Auto-expand sections when searching - expand all matching sections
  // When search is cleared, collapse all sections
  useEffect(() => {
    if (searchQuery.trim()) {
      // When searching, we'll show all matching sections expanded
      // This is handled in the render logic below
    } else {
      // Clear expanded section when search is cleared
      setExpandedSection(null);
    }
  }, [searchQuery]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Help & Instructions</Text>
          <Text style={styles.headerSubtitle}>
            Learn how to get the most out of RepMaster
          </Text>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search help topics... (e.g., swap, push, readiness)"
            placeholderTextColor={THEME.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.trim() && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {searchQuery.trim() && filteredSections.length === 0 && (
          <View style={styles.noResultsContainer}>
            <Text style={styles.noResultsText}>No results found for "{searchQuery}"</Text>
            <Text style={styles.noResultsSubtext}>Try different keywords or check spelling</Text>
          </View>
        )}

        {filteredSections.map((section) => (
          <View key={section.id} style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection(section.id)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionHeaderLeft}>
                <Text style={styles.sectionIcon}>{section.icon}</Text>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              <Text style={styles.expandIcon}>
                {expandedSection === section.id ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {(expandedSection === section.id || (searchQuery.trim() && filteredSections.some(s => s.id === section.id))) && (
              <View style={styles.expandedContent}>
                {section.content}
              </View>
            )}
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Need more help? Check your exercise history to understand progression decisions, or review the session summary after workouts.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: THEME.primary,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: THEME.textSecondary,
    lineHeight: 22,
  },
  searchContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  searchInput: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: THEME.textPrimary,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingRight: 40,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  clearButtonText: {
    fontSize: 18,
    color: THEME.textMuted,
    fontWeight: '600',
  },
  noResultsContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: THEME.card,
    borderRadius: 12,
    marginBottom: 16,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: THEME.textMuted,
  },
  section: {
    marginBottom: 12,
    backgroundColor: THEME.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.borderLight,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: THEME.card,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.textPrimary,
    flex: 1,
  },
  expandIcon: {
    fontSize: 14,
    color: THEME.textMuted,
    fontWeight: '700',
  },
  expandedContent: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: THEME.borderLight,
  },
  sectionContent: {
    paddingTop: 12,
  },
  paragraph: {
    fontSize: 15,
    color: THEME.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  subheading: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginTop: 8,
    marginBottom: 12,
  },
  bulletList: {
    marginBottom: 16,
    marginLeft: 8,
  },
  bullet: {
    fontSize: 15,
    color: THEME.textSecondary,
    lineHeight: 24,
    marginBottom: 8,
  },
  numberedList: {
    marginBottom: 16,
  },
  numberedItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  number: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.primary,
    marginRight: 12,
    minWidth: 24,
    textAlign: 'center',
    backgroundColor: THEME.primary + '20',
    borderRadius: 12,
    width: 24,
    height: 24,
    lineHeight: 24,
  },
  numberedText: {
    fontSize: 15,
    color: THEME.textSecondary,
    lineHeight: 22,
    flex: 1,
  },
  tipBox: {
    backgroundColor: THEME.secondary + '15',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.secondary + '30',
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 20,
  },
  readinessCard: {
    backgroundColor: THEME.card,
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.borderLight,
  },
  readinessTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 6,
  },
  readinessDesc: {
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 20,
  },
  footer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: THEME.card + '80',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.borderLight,
  },
  footerText: {
    fontSize: 14,
    color: THEME.textMuted,
    lineHeight: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

