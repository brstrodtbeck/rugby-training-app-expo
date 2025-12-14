import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  BackHandler,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ThemeMockups'>;

const { width } = Dimensions.get('window');

// ============================================
// COLOR PALETTES
// ============================================
const PALETTES = {
  dominionBold: {
    name: 'Dominion Bold',
    subtitle: 'Epic & Commanding',
    primary: '#B22222',      // Crimson red
    secondary: '#FFD700',    // Gold
    background: '#1C1C1C',   // Charcoal black
    accent: '#FFFFFF',       // White
    textOnPrimary: '#FFFFFF',
    textOnBackground: '#FFFFFF',
    cardBackground: '#2A2A2A',
  },
  ironSteel: {
    name: 'Iron & Steel',
    subtitle: 'Minimalist Strength',
    primary: '#2F4F4F',      // Gunmetal gray
    secondary: '#1E90FF',    // Electric blue
    background: '#F5F5F5',   // Off-white
    accent: '#000000',       // Black
    textOnPrimary: '#FFFFFF',
    textOnBackground: '#000000',
    cardBackground: '#FFFFFF',
  },
  overlordInferno: {
    name: 'Overlord Inferno',
    subtitle: 'Playful + Powerful',
    primary: '#FF4500',      // Fiery orange
    secondary: '#4B0082',    // Deep purple
    background: '#2E2E2E',   // Dark slate
    accent: '#C0C0C0',       // Silver
    textOnPrimary: '#FFFFFF',
    textOnBackground: '#FFFFFF',
    cardBackground: '#3D3D3D',
  },
  adaptiveProgression: {
    name: 'Adaptive Progression',
    subtitle: 'Trainer-Friendly',
    primary: '#228B22',      // Emerald green
    secondary: '#000080',    // Navy blue
    background: '#E0E0E0',   // Light gray
    accent: '#111111',       // Black
    textOnPrimary: '#FFFFFF',
    textOnBackground: '#111111',
    cardBackground: '#FFFFFF',
  },
};

type PaletteKey = 'dominionBold' | 'ironSteel' | 'overlordInferno' | 'adaptiveProgression';
type Palette = typeof PALETTES[PaletteKey];

// ============================================
// WORKOUT CARD MOCKUP
// ============================================
const WorkoutCardMockup: React.FC<{ palette: Palette }> = ({ palette }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.card, { backgroundColor: palette.cardBackground }]}>
      {/* Exercise Title */}
      <View style={styles.cardHeader}>
        <Text style={[styles.exerciseTitle, { color: palette.primary }]}>
          Back Squat
        </Text>
        <View style={[styles.progressionBadge, { backgroundColor: palette.secondary + '20' }]}>
          <Text style={[styles.progressionBadgeText, { color: palette.secondary }]}>
            ▲ Rule of 3
          </Text>
        </View>
      </View>

      {/* Exercise Details */}
      <View style={styles.detailsRow}>
        <Text style={[styles.detailText, { color: palette.textOnBackground }]}>
          5 × 5 @ 185 lbs
        </Text>
        <Text style={[styles.detailSubtext, { color: palette.accent + '99' }]}>
          RPE 7-8 • Rest 2-3 min
        </Text>
      </View>

      {/* Suggested Weight Box */}
      <View style={[styles.suggestionBox, { backgroundColor: palette.primary + '15', borderLeftColor: palette.primary }]}>
        <Text style={[styles.suggestionTitle, { color: palette.primary }]}>
          💪 Suggested: 185 lbs
        </Text>
        <Text style={[styles.suggestionDetail, { color: palette.textOnBackground + 'CC' }]}>
          Based on TM (205 lbs) • ~90% of 1RM
        </Text>
      </View>

      {/* Progression Indicator */}
      <View style={[styles.progressionRow, { borderTopColor: palette.accent + '20' }]}>
        <View style={styles.streakIndicator}>
          <Text style={[styles.streakLabel, { color: palette.textOnBackground + '99' }]}>
            Streak:
          </Text>
          <View style={styles.streakDots}>
            <View style={[styles.streakDot, { backgroundColor: palette.secondary }]} />
            <View style={[styles.streakDot, { backgroundColor: palette.secondary }]} />
            <View style={[styles.streakDotEmpty, { borderColor: palette.secondary }]} />
          </View>
        </View>
        <Text style={[styles.progressionHint, { color: palette.secondary }]}>
          1 more session to progress
        </Text>
      </View>

      {/* Expand Button */}
      <TouchableOpacity 
        style={[styles.expandButton, { borderColor: palette.accent + '30' }]}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={[styles.expandButtonText, { color: palette.primary }]}>
          {expanded ? '▲ Hide Details' : '▼ Show Instructions'}
        </Text>
      </TouchableOpacity>

      {/* Expanded Content */}
      {expanded && (
        <View style={[styles.expandedContent, { backgroundColor: palette.background + '50' }]}>
          <Text style={[styles.expandedTitle, { color: palette.primary }]}>
            📋 Execution Cues
          </Text>
          <Text style={[styles.expandedText, { color: palette.textOnBackground + 'DD' }]}>
            • Feet shoulder-width, toes slightly out{'\n'}
            • Brace core, take breath at top{'\n'}
            • Break at hips and knees together{'\n'}
            • Knees track over toes, chest up{'\n'}
            • Drive through full foot to stand
          </Text>
          <Text style={[styles.trainerNote, { color: palette.secondary }]}>
            💡 Trainer Note: Focus on controlled descent (3 sec). If form breaks, reduce weight.
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.completeButton, { backgroundColor: palette.primary }]}>
          <Text style={[styles.completeButtonText, { color: palette.textOnPrimary }]}>
            ✓ Mark Complete
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.historyButton, { borderColor: palette.secondary }]}>
          <Text style={[styles.historyButtonText, { color: palette.secondary }]}>
            📊 History
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ============================================
// SESSION SUMMARY MOCKUP
// ============================================
const SessionSummaryMockup: React.FC<{ palette: Palette }> = ({ palette }) => {
  const [analysisExpanded, setAnalysisExpanded] = useState(false);

  return (
    <View style={[styles.summaryContainer, { backgroundColor: palette.cardBackground }]}>
      {/* Header Bar */}
      <View style={[styles.summaryHeader, { backgroundColor: palette.primary }]}>
        <Text style={[styles.summaryHeaderTitle, { color: palette.textOnPrimary }]}>
          Session Complete
        </Text>
        <Text style={[styles.summaryHeaderSubtitle, { color: palette.textOnPrimary + 'CC' }]}>
          Lower Body • Week 2 Day 1
        </Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: palette.primary }]}>5/5</Text>
          <Text style={[styles.statLabel, { color: palette.textOnBackground + '99' }]}>Exercises</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: palette.secondary }]}>72 min</Text>
          <Text style={[styles.statLabel, { color: palette.textOnBackground + '99' }]}>Duration</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: palette.primary }]}>12,450</Text>
          <Text style={[styles.statLabel, { color: palette.textOnBackground + '99' }]}>Volume (lbs)</Text>
        </View>
      </View>

      {/* Readiness Gauge */}
      <View style={styles.readinessSection}>
        <Text style={[styles.sectionTitle, { color: palette.textOnBackground }]}>
          Readiness Score
        </Text>
        <View style={styles.gaugeContainer}>
          <View style={[styles.gaugeTrack, { backgroundColor: palette.accent + '20' }]}>
            <View style={[styles.gaugeFill, { backgroundColor: palette.secondary, width: '70%' }]} />
          </View>
          <Text style={[styles.gaugeValue, { color: palette.secondary }]}>7/10</Text>
        </View>
        <Text style={[styles.gaugeHint, { color: palette.textOnBackground + '80' }]}>
          Moderate readiness • Standard loads applied
        </Text>
      </View>

      {/* Progression Timeline */}
      <View style={styles.progressionSection}>
        <Text style={[styles.sectionTitle, { color: palette.textOnBackground }]}>
          Progression Events
        </Text>
        <View style={styles.timelineContainer}>
          <View style={styles.timelineItem}>
            <View style={[styles.timelineIcon, { backgroundColor: palette.secondary + '20' }]}>
              <Text style={[styles.timelineIconText, { color: palette.secondary }]}>▲</Text>
            </View>
            <View style={styles.timelineContent}>
              <Text style={[styles.timelineTitle, { color: palette.textOnBackground }]}>Back Squat</Text>
              <Text style={[styles.timelineDetail, { color: palette.secondary }]}>Rule of 3 met → +5 lbs next session</Text>
            </View>
          </View>
          <View style={styles.timelineItem}>
            <View style={[styles.timelineIcon, { backgroundColor: palette.primary + '20' }]}>
              <Text style={[styles.timelineIconText, { color: palette.primary }]}>⚡</Text>
            </View>
            <View style={styles.timelineContent}>
              <Text style={[styles.timelineTitle, { color: palette.textOnBackground }]}>Romanian Deadlift</Text>
              <Text style={[styles.timelineDetail, { color: palette.primary }]}>Fallback triggered → +3 reps achieved</Text>
            </View>
          </View>
          <View style={styles.timelineItem}>
            <View style={[styles.timelineIcon, { backgroundColor: palette.accent + '20' }]}>
              <Text style={[styles.timelineIconText, { color: palette.accent }]}>⚠️</Text>
            </View>
            <View style={styles.timelineContent}>
              <Text style={[styles.timelineTitle, { color: palette.textOnBackground }]}>Leg Press</Text>
              <Text style={[styles.timelineDetail, { color: palette.textOnBackground + '99' }]}>Safeguard active → Load held steady</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Collapsible Analysis */}
      <TouchableOpacity 
        style={[styles.analysisHeader, { borderColor: palette.accent + '30' }]}
        onPress={() => setAnalysisExpanded(!analysisExpanded)}
      >
        <Text style={[styles.analysisHeaderText, { color: palette.primary }]}>
          📈 Detailed Analysis
        </Text>
        <Text style={[styles.analysisToggle, { color: palette.secondary }]}>
          {analysisExpanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>
      
      {analysisExpanded && (
        <View style={[styles.analysisContent, { backgroundColor: palette.background + '30' }]}>
          <View style={styles.analysisRow}>
            <Text style={[styles.analysisLabel, { color: palette.textOnBackground + '99' }]}>Readiness MA3:</Text>
            <Text style={[styles.analysisValue, { color: palette.textOnBackground }]}>6.7</Text>
          </View>
          <View style={styles.analysisRow}>
            <Text style={[styles.analysisLabel, { color: palette.textOnBackground + '99' }]}>Quality Pass Rate:</Text>
            <Text style={[styles.analysisValue, { color: palette.secondary }]}>80%</Text>
          </View>
          <View style={styles.analysisRow}>
            <Text style={[styles.analysisLabel, { color: palette.textOnBackground + '99' }]}>Consecutive Successes:</Text>
            <Text style={[styles.analysisValue, { color: palette.primary }]}>3 (Back Squat)</Text>
          </View>
          <Text style={[styles.analysisNote, { color: palette.textOnBackground + '80' }]}>
            Overall session quality: Strong. Consider increasing intensity next week if readiness stays above 7.
          </Text>
        </View>
      )}

      {/* Legend */}
      <View style={[styles.legend, { borderTopColor: palette.accent + '20' }]}>
        <Text style={[styles.legendTitle, { color: palette.textOnBackground + '99' }]}>Legend:</Text>
        <View style={styles.legendRow}>
          <Text style={[styles.legendItem, { color: palette.secondary }]}>▲ Rule of 3</Text>
          <Text style={[styles.legendItem, { color: palette.primary }]}>⚡ Fallback</Text>
          <Text style={[styles.legendItem, { color: palette.accent }]}>▼ Reduction</Text>
        </View>
        <View style={styles.legendRow}>
          <Text style={[styles.legendItem, { color: palette.textOnBackground + '80' }]}>◇ Deload</Text>
          <Text style={[styles.legendItem, { color: palette.textOnBackground + '99' }]}>⚠️ Safeguard</Text>
        </View>
      </View>
    </View>
  );
};

// ============================================
// PALETTE SHOWCASE
// ============================================
const PaletteShowcase: React.FC<{ paletteKey: PaletteKey; onSelectTheme?: (key: PaletteKey) => void; isSelected?: boolean }> = ({ paletteKey, onSelectTheme, isSelected }) => {
  const palette = PALETTES[paletteKey];
  const [showCard, setShowCard] = useState(true);

  return (
    <View style={[styles.showcase, { backgroundColor: palette.background }]}>
      {/* Palette Header */}
      <View style={styles.paletteHeader}>
        <View style={styles.paletteHeaderTop}>
          <View style={styles.paletteHeaderLeft}>
            <Text style={[styles.paletteName, { color: palette.primary }]}>
              {palette.name}
            </Text>
            <Text style={[styles.paletteSubtitle, { color: palette.textOnBackground + '99' }]}>
              {palette.subtitle}
            </Text>
          </View>
          {isSelected && (
            <View style={[styles.selectedBadge, { backgroundColor: palette.primary + '20', borderColor: palette.primary }]}>
              <Text style={[styles.selectedBadgeText, { color: palette.primary }]}>✓ Active</Text>
            </View>
          )}
        </View>
        {onSelectTheme && (
          <TouchableOpacity
            style={[styles.selectThemeButton, { backgroundColor: palette.primary, borderColor: palette.primary }]}
            onPress={() => onSelectTheme(paletteKey)}
          >
            <Text style={[styles.selectThemeButtonText, { color: palette.textOnPrimary }]}>
              {isSelected ? '✓ Selected' : 'Select Theme'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Color Swatches */}
      <View style={styles.swatchRow}>
        <View style={styles.swatch}>
          <View style={[styles.swatchColor, { backgroundColor: palette.primary }]} />
          <Text style={[styles.swatchLabel, { color: palette.textOnBackground + '80' }]}>Primary</Text>
        </View>
        <View style={styles.swatch}>
          <View style={[styles.swatchColor, { backgroundColor: palette.secondary }]} />
          <Text style={[styles.swatchLabel, { color: palette.textOnBackground + '80' }]}>Secondary</Text>
        </View>
        <View style={styles.swatch}>
          <View style={[styles.swatchColor, { backgroundColor: palette.background, borderWidth: 1, borderColor: palette.accent + '40' }]} />
          <Text style={[styles.swatchLabel, { color: palette.textOnBackground + '80' }]}>Background</Text>
        </View>
        <View style={styles.swatch}>
          <View style={[styles.swatchColor, { backgroundColor: palette.accent }]} />
          <Text style={[styles.swatchLabel, { color: palette.textOnBackground + '80' }]}>Accent</Text>
        </View>
      </View>

      {/* Toggle Buttons */}
      <View style={styles.toggleRow}>
        <TouchableOpacity 
          style={[
            styles.toggleButton, 
            showCard && { backgroundColor: palette.primary },
            !showCard && { borderColor: palette.primary, borderWidth: 1 }
          ]}
          onPress={() => setShowCard(true)}
        >
          <Text style={[styles.toggleText, { color: showCard ? palette.textOnPrimary : palette.primary }]}>
            Workout Card
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.toggleButton, 
            !showCard && { backgroundColor: palette.primary },
            showCard && { borderColor: palette.primary, borderWidth: 1 }
          ]}
          onPress={() => setShowCard(false)}
        >
          <Text style={[styles.toggleText, { color: !showCard ? palette.textOnPrimary : palette.primary }]}>
            Session Summary
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mockup Content */}
      {showCard ? (
        <WorkoutCardMockup palette={palette} />
      ) : (
        <SessionSummaryMockup palette={palette} />
      )}
    </View>
  );
};

// ============================================
// MAIN SCREEN
// ============================================
const ThemeMockups: React.FC<Props> = ({ navigation }) => {
  const [selectedPalette, setSelectedPalette] = useState<PaletteKey>('dominionBold');
  const { themeKey, setTheme, theme } = useTheme();

  React.useEffect(() => {
    console.log('[ThemeMockups] Screen mounted');
    console.log('[ThemeMockups] Current theme key:', themeKey);
    console.log('[ThemeMockups] Current theme colors:', {
      primary: theme.primary,
      background: theme.background,
      card: theme.card,
    });
  }, [themeKey, theme]);

  const handleSelectTheme = async (key: PaletteKey) => {
    console.log('[ThemeMockups] User selected theme:', key);
    // Show confirmation dialog first
    Alert.alert(
      'Select Theme',
      `You're about to select the "${PALETTES[key].name}" theme.\n\n⚠️ Theme changes will be applied when you restart the app.\n\nWould you like to continue?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => console.log('[ThemeMockups] User cancelled theme selection'),
        },
        {
          text: 'Select & Restart',
          onPress: async () => {
            try {
              console.log('[ThemeMockups] Calling setTheme with key:', key);
              await setTheme(key);
              console.log('[ThemeMockups] Theme set successfully');
              Alert.alert(
                'Theme Saved',
                `The "${PALETTES[key].name}" theme has been saved.\n\nTo see the changes, please restart the app.\n\nYou can continue using the app now and restart later, or restart now.`,
                [
                  {
                    text: 'Continue Using App',
                    style: 'cancel',
                  },
                  {
                    text: 'Restart Now',
                    style: 'destructive',
                    onPress: () => {
                      if (Platform.OS === 'android') {
                        BackHandler.exitApp();
                      } else {
                        // On iOS, we can't programmatically restart, so just show a message
                        Alert.alert(
                          'Restart Required',
                          'Please manually close and reopen the app to see the theme changes.',
                          [{ text: 'OK' }]
                        );
                      }
                    },
                  },
                ]
              );
            } catch (error) {
              console.error('[ThemeMockups] Error setting theme:', error);
              Alert.alert('Error', 'Failed to apply theme. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Screen Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>🎨 Theme Mockups</Text>
          <Text style={styles.headerSubtitle}>
            Compare color palettes for RepMaster
          </Text>
        </View>

        {/* Palette Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.paletteSelector}>
          {(Object.keys(PALETTES) as PaletteKey[]).map((key) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.paletteSelectorItem,
                selectedPalette === key && styles.paletteSelectorItemActive,
                { borderColor: PALETTES[key].primary }
              ]}
              onPress={() => setSelectedPalette(key)}
            >
              <View style={[styles.paletteSelectorDot, { backgroundColor: PALETTES[key].primary }]} />
              <Text style={[
                styles.paletteSelectorText,
                selectedPalette === key && { color: PALETTES[key].primary, fontWeight: '700' }
              ]}>
                {PALETTES[key].name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Selected Palette Showcase */}
        <PaletteShowcase 
          paletteKey={selectedPalette} 
          onSelectTheme={handleSelectTheme}
          isSelected={themeKey === selectedPalette}
        />

        {/* All Palettes Comparison */}
        <View style={styles.comparisonSection}>
          <Text style={styles.comparisonTitle}>📊 Side-by-Side Comparison</Text>
          <Text style={styles.comparisonSubtitle}>
            Scroll through all palettes to compare
          </Text>
          
          {(Object.keys(PALETTES) as PaletteKey[]).map((key) => (
            <View key={key} style={styles.comparisonCard}>
              <PaletteShowcase 
                paletteKey={key} 
                onSelectTheme={handleSelectTheme}
                isSelected={themeKey === key}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  headerTop: {
    width: '100%',
    flexDirection: 'row',
    marginBottom: 16,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#444',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },

  // Palette Selector
  paletteSelector: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  paletteSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#444',
    backgroundColor: '#2A2A2A',
  },
  paletteSelectorItemActive: {
    backgroundColor: '#3A3A3A',
    borderWidth: 2,
  },
  paletteSelectorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  paletteSelectorText: {
    fontSize: 13,
    color: '#CCC',
    fontWeight: '500',
  },

  // Showcase
  showcase: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  paletteHeader: {
    marginBottom: 12,
  },
  paletteHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  paletteHeaderLeft: {
    flex: 1,
  },
  paletteName: {
    fontSize: 22,
    fontWeight: '700',
  },
  paletteSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  selectedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    marginLeft: 12,
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  selectThemeButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    marginTop: 8,
  },
  selectThemeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Swatches
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  swatch: {
    alignItems: 'center',
  },
  swatchColor: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginBottom: 4,
  },
  swatchLabel: {
    fontSize: 10,
    fontWeight: '500',
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Workout Card
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  progressionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  detailsRow: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 16,
    fontWeight: '600',
  },
  detailSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  suggestionBox: {
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    marginBottom: 12,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  progressionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    marginBottom: 12,
  },
  streakIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakLabel: {
    fontSize: 12,
    marginRight: 8,
  },
  streakDots: {
    flexDirection: 'row',
    gap: 4,
  },
  streakDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  streakDotEmpty: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  progressionHint: {
    fontSize: 11,
    fontWeight: '500',
  },
  expandButton: {
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  expandButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  expandedContent: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  expandedTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  expandedText: {
    fontSize: 13,
    lineHeight: 20,
  },
  trainerNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  completeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Session Summary
  summaryContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  summaryHeader: {
    padding: 16,
  },
  summaryHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  summaryHeaderSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  readinessSection: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  gaugeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gaugeTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 4,
  },
  gaugeValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  gaugeHint: {
    fontSize: 11,
    marginTop: 6,
  },
  progressionSection: {
    padding: 16,
    paddingTop: 0,
  },
  timelineContainer: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineIconText: {
    fontSize: 14,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  timelineDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
  },
  analysisHeaderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  analysisToggle: {
    fontSize: 14,
  },
  analysisContent: {
    padding: 16,
    paddingTop: 0,
  },
  analysisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  analysisLabel: {
    fontSize: 13,
  },
  analysisValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  analysisNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 18,
  },
  legend: {
    padding: 16,
    borderTopWidth: 1,
  },
  legendTitle: {
    fontSize: 11,
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },
  legendItem: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Comparison Section
  comparisonSection: {
    padding: 16,
    paddingTop: 32,
  },
  comparisonTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  comparisonSubtitle: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  comparisonCard: {
    marginBottom: 32,
  },
});

export default ThemeMockups;

