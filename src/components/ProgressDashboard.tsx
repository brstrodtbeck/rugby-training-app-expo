import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import { calculateProgressStats, ProgressStats, calculateWeeklyStats, WeeklyStats } from '../utils/progressCalculations';
import { parseSessionId } from '../types/program';

interface ProgressDashboardProps {
  completedSessions: { id: string; date: string }[];
  startDateYMD: string | null;
  totalWeeks: number;
  programOffset: number;
  selectedProgramId: string;
  programData?: any;
}

const ProgressDashboard = memo(function ProgressDashboard({
  completedSessions,
  startDateYMD,
  totalWeeks,
  programOffset,
  selectedProgramId,
  programData,
}: ProgressDashboardProps) {
  const { theme } = useTheme();
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Get mesocycles array - handle both schema formats
  const getMesocycles = useCallback((): any[] => {
    if (!programData) return [];
    // Check if macrocycle.mesocycles exists and is an array of objects (not strings)
    const macrocycleMesocycles = programData.macrocycle?.mesocycles;
    if (macrocycleMesocycles && Array.isArray(macrocycleMesocycles) && macrocycleMesocycles.length > 0) {
      // Check if first element is an object (standard format) or string (HypertrophyMonth format)
      if (typeof macrocycleMesocycles[0] === 'object' && macrocycleMesocycles[0] !== null) {
        return macrocycleMesocycles;
      }
    }
    // Alternative format: root-level mesocycles (HypertrophyMonth)
    if ((programData as any).mesocycles && Array.isArray((programData as any).mesocycles)) {
      return (programData as any).mesocycles;
    }
    return [];
  }, [programData]);

  // Get mesocycle color by mesoId
  const getMesocycleColor = useCallback((mesoId: string): string => {
    const id = mesoId.toLowerCase();
    if (id.includes('foundation') || id === 'm1' || id.includes('week1')) {
      return '#4A90E2'; // Blue for Foundation
    }
    if (id.includes('strength') || id === 'm2' || id.includes('week2')) {
      return '#E85A4F'; // Red/Orange for Strength
    }
    if (id.includes('power') || id === 'm3') {
      return '#F5A623'; // Yellow/Gold for Power
    }
    if (id.includes('conditioning') || id === 'm4') {
      return '#7ED321'; // Green for Conditioning
    }
    if (id.includes('peak') || id === 'm5') {
      return '#9013FE'; // Purple for Peak
    }
    return theme.secondary; // Default
  }, [theme]);

  // Calculate mesocycle progress
  const mesocycleProgress = useMemo(() => {
    if (!programData || !startDateYMD) return [];
    
    const mesocycles = getMesocycles();
    if (mesocycles.length === 0) return [];
    
    return mesocycles.map((meso: any) => {
      // Count total sessions in this mesocycle
      const trainingDays = meso.trainingDays || meso.microcycle || [];
      const totalDays = trainingDays.length;
      const totalWeeks = meso.weeks?.length || 0;
      const totalSessions = totalDays * totalWeeks;
      
      // Count completed sessions for this mesocycle
      // SessionId format: mesoId-weekIndex-dayNumber
      // weekIndex is 0-indexed within the mesocycle
      let completedCount = 0;
      completedSessions.forEach(session => {
        const parsed = parseSessionId(session.id);
        if (parsed && parsed.mesoId === meso.id) {
          // Verify weekIndex is valid for this mesocycle (0 to totalWeeks-1)
          if (parsed.weekIndex >= 0 && parsed.weekIndex < totalWeeks) {
            // Verify dayNumber is valid for this mesocycle (1 to totalDays)
            if (parsed.dayNumber >= 1 && parsed.dayNumber <= totalDays) {
              completedCount++;
            }
          }
        }
      });
      
      const progress = totalSessions > 0 ? (completedCount / totalSessions) * 100 : 0;
      const isComplete = progress >= 100;
      
      return {
        id: meso.id,
        title: meso.title || meso.id,
        progress: Math.round(progress),
        isComplete,
        completedCount,
        totalSessions,
      };
    });
  }, [programData, startDateYMD, completedSessions, getMesocycles]);
  
  // Memoize completedSessions array reference to prevent unnecessary recalculations
  const completedSessionsRef = useMemo(() => completedSessions, [
    completedSessions.length,
    completedSessions.map(s => s.id).join(',')
  ]);
  
  useEffect(() => {
    let cancelled = false;
    
    const loadStats = async () => {
      setIsLoading(true);
      const [calculated, weekly] = await Promise.all([
        calculateProgressStats(
          completedSessionsRef,
          startDateYMD,
          totalWeeks,
          programOffset
        ),
        calculateWeeklyStats(completedSessionsRef)
      ]);
      
      if (!cancelled) {
        setStats(calculated);
        setWeeklyStats(weekly);
        setIsLoading(false);
      }
    };
    
    loadStats();
    
    return () => {
      cancelled = true;
    };
  }, [completedSessionsRef, startDateYMD, totalWeeks, programOffset]);
  
  // Define styles BEFORE any early returns or usage
  const styles = useThemedStyles((theme) => StyleSheet.create({
    container: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: expanded ? 16 : 0,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.primary,
    },
    toggleButton: {
      padding: 4,
    },
    toggleText: {
      fontSize: 12,
      color: theme.secondary,
      fontWeight: '600',
    },
    progressSection: {
      marginBottom: 16,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    progressLabel: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    progressValue: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: '700',
    },
    progressBarContainer: {
      height: 8,
      backgroundColor: theme.backgroundLight,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: 4,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 8,
    },
    statCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: theme.backgroundLight,
      borderRadius: 10,
      padding: 12,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 11,
      color: theme.textMuted,
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    weekInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
    },
    weekText: {
      fontSize: 13,
      color: theme.textSecondary,
      marginLeft: 8,
    },
    mesocycleProgressSection: {
      marginTop: 20,
      marginBottom: 16,
    },
    mesocycleSectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 12,
    },
    mesocycleBarContainer: {
      marginBottom: 12,
    },
    mesocycleBarLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 6,
    },
    mesocycleBarWrapper: {
      height: 10,
      borderRadius: 5,
      overflow: 'hidden',
      position: 'relative',
    },
    mesocycleBarBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 5,
    },
    mesocycleBarFill: {
      height: '100%',
      borderRadius: 5,
    },
    mesocycleBarComplete: {
      // Solid fill for complete mesocycles
    },
    mesocycleBarIncomplete: {
      // Outlined border for incomplete mesocycles
      borderWidth: 2,
      backgroundColor: 'transparent',
    },
    mesocycleProgressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    mesocycleProgressText: {
      fontSize: 11,
      fontWeight: '600',
    },
    mesocycleCompleteIcon: {
      fontSize: 12,
      marginLeft: 4,
    },
  }));
  
  if (!startDateYMD) return null;
  
  // Show loading state
  if (isLoading && !stats) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>📊 Progress</Text>
        <Text style={[styles.weekText, { marginTop: 8 }]}>Loading...</Text>
      </View>
    );
  }
  
  if (!stats) return null;
  
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.title}>📊 Progress</Text>
        <Text style={styles.toggleText}>
          {expanded ? '▲ Hide' : '▼ Show'}
        </Text>
      </TouchableOpacity>
      
      {expanded && stats && (
        <>
          {/* Program Progress */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Program Progress</Text>
              <Text style={styles.progressValue}>
                {Math.round(stats.programProgress)}%
              </Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${Math.min(100, stats.programProgress)}%` },
                ]}
              />
            </View>
            <View style={styles.weekInfo}>
              <Text style={styles.weekText}>
                Week {stats.currentWeek} of {stats.totalWeeks}
              </Text>
            </View>
          </View>

          {/* Mesocycle Progress */}
          {mesocycleProgress.length > 0 && (
            <View style={styles.mesocycleProgressSection}>
              <Text style={styles.mesocycleSectionTitle}>Mesocycle Progress</Text>
              {mesocycleProgress.map((meso) => {
                const mesoColor = getMesocycleColor(meso.id);
                const isComplete = meso.isComplete;
                
                return (
                  <View key={meso.id} style={styles.mesocycleBarContainer}>
                    <Text style={styles.mesocycleBarLabel}>{meso.title}</Text>
                    <View style={styles.mesocycleBarWrapper}>
                      {isComplete ? (
                        // Complete: Solid fill
                        <View
                          style={[
                            styles.mesocycleBarFill,
                            styles.mesocycleBarComplete,
                            {
                              width: '100%',
                              backgroundColor: mesoColor,
                            },
                          ]}
                        />
                      ) : (
                        // Incomplete: Outlined with progress fill
                        <>
                          <View
                            style={[
                              styles.mesocycleBarBackground,
                              styles.mesocycleBarIncomplete,
                              {
                                borderColor: mesoColor,
                              },
                            ]}
                          />
                          {meso.progress > 0 && (
                            <View
                              style={[
                                styles.mesocycleBarFill,
                                {
                                  width: `${meso.progress}%`,
                                  backgroundColor: mesoColor + '40', // Semi-transparent fill
                                },
                              ]}
                            />
                          )}
                        </>
                      )}
                    </View>
                    <View style={styles.mesocycleProgressRow}>
                      <Text style={[styles.mesocycleProgressText, { color: isComplete ? mesoColor : theme.textSecondary }]}>
                        {isComplete ? (
                          <Text>
                            100% Complete <Text style={styles.mesocycleCompleteIcon}>✓</Text>
                          </Text>
                        ) : meso.progress > 0 ? (
                          `${meso.progress}% (${meso.completedCount}/${meso.totalSessions})`
                        ) : (
                          'Not Started'
                        )}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          
          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalSessionsCompleted}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.streakDays}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{Math.round(stats.completionRate)}%</Text>
              <Text style={styles.statLabel}>Complete</Text>
            </View>
            
            {stats.averageSessionDuration > 0 && (
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.averageSessionDuration}</Text>
                <Text style={styles.statLabel}>Avg Min</Text>
              </View>
            )}
            
            {weeklyStats && (
              <>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{weeklyStats.thisWeek}</Text>
                  <Text style={styles.statLabel}>This Week</Text>
                </View>
                
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{weeklyStats.thisMonth}</Text>
                  <Text style={styles.statLabel}>This Month</Text>
                </View>
              </>
            )}
          </View>
        </>
      )}
    </View>
  );
});

export default ProgressDashboard;

