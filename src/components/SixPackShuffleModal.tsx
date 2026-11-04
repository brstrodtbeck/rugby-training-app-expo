import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { THEME } from '../theme/colors';
import IntervalTimer from './IntervalTimer';
import { triggerHaptic } from '../utils/haptics';
import {
  ExperienceLevel,
  EquipmentOption,
  Exercise,
  UserSelection,
  getWorkoutConfig,
  getCategoryLabel,
  getEquipmentLabel,
} from '../data/sixPackShuffleExercises';
import { getShuffledWorkout } from '../utils/sixPackShuffle';

interface SixPackShuffleModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SixPackShuffleModal({
  visible,
  onClose,
}: SixPackShuffleModalProps): React.ReactElement {
  const [level, setLevel] = useState<ExperienceLevel>('beginner');
  const [equipment, setEquipment] = useState<EquipmentOption[]>(['none']);
  const [workout, setWorkout] = useState<Exercise[]>([]);
  const [completedSets, setCompletedSets] = useState<Record<number, Set<number>>>({});
  const [expandedInstructions, setExpandedInstructions] = useState<Record<number, boolean>>({});
  const [restTimers, setRestTimers] = useState<Record<string, { remaining: number; isRunning: boolean; isPaused: boolean }>>({});
  const [workoutMode, setWorkoutMode] = useState<'setup' | 'active'>('setup');
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState<number | null>(null);
  const intervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Generate workout when modal opens or selections change
  useEffect(() => {
    if (visible) {
      const userSelection: UserSelection = { level, equipment };
      const newWorkout = getShuffledWorkout(userSelection);
      setWorkout(newWorkout);
      // Reset completion tracking, expanded instructions, timers, and workout mode
      setCompletedSets({});
      setExpandedInstructions({});
      setRestTimers({});
      setWorkoutMode('setup');
      setCurrentExerciseIndex(null);
      // Cleanup all timers
      intervalsRef.current.forEach(id => clearInterval(id));
      intervalsRef.current.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, level, equipment]);

  const generateWorkout = () => {
    const userSelection: UserSelection = { level, equipment };
    const newWorkout = getShuffledWorkout(userSelection);
    setWorkout(newWorkout);
    // Reset completion tracking, expanded instructions, timers, and workout mode
    setCompletedSets({});
    setExpandedInstructions({});
    setRestTimers({});
    setWorkoutMode('setup');
    setCurrentExerciseIndex(null);
    // Cleanup all timers
    intervalsRef.current.forEach(id => clearInterval(id));
    intervalsRef.current.clear();
  };

  const toggleInstructions = (exerciseIndex: number) => {
    setExpandedInstructions(prev => ({
      ...prev,
      [exerciseIndex]: !prev[exerciseIndex],
    }));
  };

  const hasInstructions = (exercise: Exercise): boolean => {
    return !!(exercise.instruction || (exercise.formCues && exercise.formCues.length > 0));
  };

  const toggleEquipment = (eq: EquipmentOption) => {
    if (eq === 'none') {
      // If toggling "none", clear all other equipment
      setEquipment(['none']);
    } else {
      // If toggling other equipment, remove "none" from the array
      // (The filter logic will still show bodyweight exercises when other equipment is selected)
      setEquipment(prev => {
        const filtered = prev.filter(e => e !== 'none');
        if (filtered.includes(eq)) {
          // Remove the equipment
          const newFiltered = filtered.filter(e => e !== eq);
          // If no equipment left, return to just "none"
          return newFiltered.length > 0 ? newFiltered : ['none'];
        } else {
          // Add the equipment
          return [...filtered, eq];
        }
      });
    }
  };

  const toggleSetCompletion = (exerciseIndex: number, setIndex: number) => {
    const wasCompleted = isSetCompleted(exerciseIndex, setIndex);
    const restTimerKey = `${exerciseIndex}-${setIndex}-rest`;
    
    setCompletedSets(prev => {
      const newState = { ...prev };
      if (!newState[exerciseIndex]) {
        newState[exerciseIndex] = new Set<number>();
      }
      const set = new Set(newState[exerciseIndex]);
      if (set.has(setIndex)) {
        set.delete(setIndex);
        // Stop rest timer if set is unmarked
        stopRestTimer(restTimerKey);
      } else {
        set.add(setIndex);
        triggerHaptic.success();
      }
      newState[exerciseIndex] = set;
      return newState;
    });

    // If set was just completed and workout is active, check if exercise is done
    if (!wasCompleted && workoutMode === 'active') {
      // Use setTimeout to check after state update
      setTimeout(() => {
        if (areAllSetsCompleted(exerciseIndex, config.sets)) {
          handleExerciseComplete(exerciseIndex);
        }
      }, 100);
    }
  };

  const isSetCompleted = (exerciseIndex: number, setIndex: number): boolean => {
    return completedSets[exerciseIndex]?.has(setIndex) || false;
  };

  const areAllSetsCompleted = (exerciseIndex: number, sets: number): boolean => {
    const completed = completedSets[exerciseIndex];
    if (!completed || completed.size < sets) return false;
    for (let i = 0; i < sets; i++) {
      if (!completed.has(i)) return false;
    }
    return true;
  };

  const config = getWorkoutConfig(level);
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return secs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${mins}m`;
    }
    return `${secs}s`;
  };

  // Rest Timer Functions
  const startRestTimer = (exerciseIndex: number, setIndex: number, duration: number) => {
    triggerHaptic.light();
    const key = `${exerciseIndex}-${setIndex}-rest`;
    
    // Clear existing timer if any
    const existing = intervalsRef.current.get(key);
    if (existing) {
      clearInterval(existing);
      intervalsRef.current.delete(key);
    }

    setRestTimers(prev => ({ ...prev, [key]: { remaining: duration, isRunning: true, isPaused: false } }));

    const id = setInterval(() => {
      setRestTimers(prev => {
        const current = prev[key];
        if (!current || current.isPaused) return prev;
        
        if (current.remaining <= 1) {
          clearInterval(id);
          intervalsRef.current.delete(key);
          triggerHaptic.success();
          const { [key]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [key]: { ...current, remaining: current.remaining - 1 } };
      });
    }, 1000);

    intervalsRef.current.set(key, id);
  };

  const toggleRestTimer = (key: string) => {
    setRestTimers(prev => {
      const current = prev[key];
      if (!current) return prev;
      return {
        ...prev,
        [key]: { ...current, isPaused: !current.isPaused },
      };
    });
  };

  const stopRestTimer = (key: string) => {
    const timerId = intervalsRef.current.get(key);
    if (timerId) {
      clearInterval(timerId);
      intervalsRef.current.delete(key);
    }
    setRestTimers(prev => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      intervalsRef.current.forEach(id => clearInterval(id));
      intervalsRef.current.clear();
    };
  }, []);

  // Workout Sequencing Functions
  const startWorkout = () => {
    setWorkoutMode('active');
    setCurrentExerciseIndex(0);
  };

  const getNextExerciseIndex = (): number | null => {
    if (workout.length === 0) return null;
    for (let i = 0; i < workout.length; i++) {
      if (!areAllSetsCompleted(i, config.sets)) {
        return i;
      }
    }
    return null; // All exercises completed
  };

  const handleExerciseComplete = (exerciseIndex: number) => {
    const nextIndex = getNextExerciseIndex();
    if (nextIndex !== null && nextIndex > exerciseIndex) {
      setCurrentExerciseIndex(nextIndex);
    } else if (nextIndex === null) {
      // All exercises completed
      setCurrentExerciseIndex(null);
    }
  };

  const isWorkoutComplete = (): boolean => {
    return workout.every((_, index) => areAllSetsCompleted(index, config.sets));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>💪 Core Roulette</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
            {/* Experience Level Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Experience Level</Text>
              <View style={styles.levelButtons}>
                {(['beginner', 'intermediate', 'advanced'] as ExperienceLevel[]).map(lvl => (
                  <TouchableOpacity
                    key={lvl}
                    style={[
                      styles.levelButton,
                      level === lvl && styles.levelButtonActive,
                    ]}
                    onPress={() => setLevel(lvl)}
                  >
                    <Text
                      style={[
                        styles.levelButtonText,
                        level === lvl && styles.levelButtonTextActive,
                      ]}
                    >
                      {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Equipment Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Available Equipment</Text>
              <View style={styles.equipmentGrid}>
                {(['none', 'dumbbells', 'bands', 'bench', 'ball', 'pullup', 'cable'] as EquipmentOption[]).map(eq => (
                  <TouchableOpacity
                    key={eq}
                    style={[
                      styles.equipmentChip,
                      equipment.includes(eq) && styles.equipmentChipActive,
                    ]}
                    onPress={() => toggleEquipment(eq)}
                  >
                    <Text
                      style={[
                        styles.equipmentChipText,
                        equipment.includes(eq) && styles.equipmentChipTextActive,
                      ]}
                    >
                      {getEquipmentLabel(eq)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Workout Display */}
            {workout.length > 0 && (
              <View style={styles.section}>
                <View style={styles.workoutHeader}>
                  <Text style={styles.workoutTitle}>Your Workout</Text>
                  {workoutMode === 'setup' && (
                    <TouchableOpacity
                      style={styles.shuffleButton}
                      onPress={generateWorkout}
                    >
                      <Text style={styles.shuffleButtonText}>🔄 Shuffle</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Progress Indicator (Active Mode) */}
                {workoutMode === 'active' && (
                  <View style={styles.progressIndicator}>
                    <Text style={styles.progressText}>
                      Exercise {currentExerciseIndex !== null ? currentExerciseIndex + 1 : workout.length} of {workout.length}
                    </Text>
                    {isWorkoutComplete() && (
                      <Text style={styles.completeText}>🎉 Workout Complete!</Text>
                    )}
                  </View>
                )}

                <View style={styles.workoutInfo}>
                  <Text style={styles.workoutInfoText}>
                    {config.sets} sets • {config.reps} reps • {formatTime(config.time)} work • {formatTime(config.rest)} rest
                  </Text>
                </View>

                {/* Start Workout Button (Setup Mode) */}
                {workoutMode === 'setup' && (
                  <TouchableOpacity
                    style={styles.startWorkoutButton}
                    onPress={startWorkout}
                  >
                    <Text style={styles.startWorkoutButtonText}>▶ Start Workout</Text>
                  </TouchableOpacity>
                )}

                {workout.map((exercise, exerciseIndex) => {
                  const categoryLabel = getCategoryLabel(exercise.category);
                  const isCompleted = areAllSetsCompleted(exerciseIndex, config.sets);
                  const isCurrent = workoutMode === 'active' && currentExerciseIndex === exerciseIndex;
                  const isNext = workoutMode === 'active' && currentExerciseIndex !== null && currentExerciseIndex < exerciseIndex && !isCompleted;
                  const isTimeBased = exercise.type === 'time' || exercise.type === 'isometric';

                  return (
                    <View
                      key={`${exercise.name}-${exerciseIndex}`}
                      style={[
                        styles.exerciseCard,
                        isCompleted && styles.exerciseCardCompleted,
                        isCurrent && styles.exerciseCardCurrent,
                        isNext && styles.exerciseCardNext,
                      ]}
                    >
                      {/* Exercise Status Badges */}
                      <View style={styles.exerciseStatusRow}>
                        {isCurrent && (
                          <View style={styles.currentBadge}>
                            <Text style={styles.currentBadgeText}>CURRENT</Text>
                          </View>
                        )}
                        {isNext && (
                          <View style={styles.nextBadge}>
                            <Text style={styles.nextBadgeText}>NEXT</Text>
                          </View>
                        )}
                        {isCompleted && (
                          <View style={styles.completedBadge}>
                            <Text style={styles.completedBadgeText}>✓ COMPLETE</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.exerciseHeader}>
                        <View style={styles.exerciseHeaderLeft}>
                          <Text style={styles.exerciseName}>{exercise.name}</Text>
                          <View style={styles.categoryBadge}>
                            <Text style={styles.categoryBadgeText}>{categoryLabel}</Text>
                          </View>
                        </View>
                        {isCompleted && (
                          <Text style={styles.completedIcon}>✅</Text>
                        )}
                      </View>

                      <View style={styles.exerciseDetails}>
                        <Text style={styles.exerciseType}>
                          {exercise.type === 'reps' && `${config.sets} × ${config.reps} reps`}
                          {exercise.type === 'time' && `${config.sets} × ${formatTime(config.time)}`}
                          {exercise.type === 'isometric' && `Hold for ${formatTime(config.time)}`}
                        </Text>
                        <Text style={styles.restText}>Rest: {formatTime(config.rest)}</Text>
                      </View>

                      {/* Instructions Toggle Button */}
                      {hasInstructions(exercise) && (
                        <TouchableOpacity
                          style={[
                            styles.instructionsButton,
                            expandedInstructions[exerciseIndex] && styles.instructionsButtonExpanded,
                          ]}
                          onPress={() => toggleInstructions(exerciseIndex)}
                        >
                          <Text
                            style={[
                              styles.instructionsButtonText,
                              expandedInstructions[exerciseIndex] && styles.instructionsButtonTextExpanded,
                            ]}
                          >
                            {expandedInstructions[exerciseIndex] ? '▼ Hide Instructions' : '▶ Show Instructions'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Expanded Instructions Section */}
                      {expandedInstructions[exerciseIndex] && hasInstructions(exercise) && (
                        <View style={styles.instructionsContainer}>
                          {/* Form Cues */}
                          {exercise.formCues && exercise.formCues.length > 0 && (
                            <View style={styles.formCuesSection}>
                              <Text style={styles.formCuesTitle}>💡 Form Cues</Text>
                              {exercise.formCues.map((cue, cueIndex) => (
                                <Text key={cueIndex} style={styles.formCueItem}>
                                  • {cue}
                                </Text>
                              ))}
                            </View>
                          )}

                          {/* Step-by-step Instructions */}
                          {exercise.instruction && (
                            <View style={styles.instructionSection}>
                              <Text style={styles.instructionTitle}>📋 Instructions</Text>
                              <Text style={styles.instructionText}>{exercise.instruction}</Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Interval Timer for Time-Based/Isometric Exercises */}
                      {isTimeBased && (
                        <IntervalTimer
                          totalSets={config.sets}
                          workDuration={config.time}
                          restDuration={config.rest}
                          exerciseName={exercise.name}
                          instruction={exercise.instruction}
                          workLabel={exercise.type === 'isometric' ? 'Hold' : 'Go'}
                          restLabel="REST"
                          onComplete={() => {
                            // Mark all sets as complete
                            const allSets = new Set([...Array(config.sets)].map((_, i) => i));
                            setCompletedSets(prev => ({ ...prev, [exerciseIndex]: allSets }));
                            if (workoutMode === 'active') {
                              handleExerciseComplete(exerciseIndex);
                            }
                          }}
                          onSetComplete={(setNum) => {
                            // Mark individual set as complete
                            setCompletedSets(prev => {
                              const newState = { ...prev };
                              if (!newState[exerciseIndex]) {
                                newState[exerciseIndex] = new Set<number>();
                              }
                              newState[exerciseIndex].add(setNum - 1); // setNum is 1-indexed
                              return newState;
                            });
                          }}
                        />
                      )}

                      {/* Set Checkboxes (for reps-based exercises) */}
                      {!isTimeBased && (
                        <View style={styles.setsContainer}>
                          {[...Array(config.sets)].map((_, setIndex) => {
                            const isSetDone = isSetCompleted(exerciseIndex, setIndex);
                            const restTimerKey = `${exerciseIndex}-${setIndex}-rest`;
                            const restTimer = restTimers[restTimerKey];
                            
                            return (
                              <View key={setIndex}>
                                <TouchableOpacity
                                  style={[
                                    styles.setCheckbox,
                                    isSetDone && styles.setCheckboxCompleted,
                                  ]}
                                  onPress={() => toggleSetCompletion(exerciseIndex, setIndex)}
                                >
                                  <Text
                                    style={[
                                      styles.setCheckboxText,
                                      isSetDone && styles.setCheckboxTextCompleted,
                                    ]}
                                  >
                                    {isSetDone ? '✓' : '○'} Set {setIndex + 1}
                                  </Text>
                                </TouchableOpacity>

                                {/* Rest Timer (after set completion) */}
                                {isSetDone && !restTimer && (
                                  <TouchableOpacity
                                    style={styles.restTimerButton}
                                    onPress={() => startRestTimer(exerciseIndex, setIndex, config.rest)}
                                  >
                                    <Text style={styles.restTimerButtonText}>
                                      ⏱ Start {formatTime(config.rest)} Rest Timer
                                    </Text>
                                  </TouchableOpacity>
                                )}

                                {restTimer && (
                                  <View style={styles.restTimerContainer}>
                                    <Text style={styles.restTimerText}>
                                      ⏱ Rest: {formatTime(restTimer.remaining)}
                                    </Text>
                                    <View style={styles.restTimerControls}>
                                      <TouchableOpacity
                                        style={styles.restTimerControlButton}
                                        onPress={() => toggleRestTimer(restTimerKey)}
                                      >
                                        <Text style={styles.restTimerControlText}>
                                          {restTimer.isPaused ? '▶ Resume' : '⏸ Pause'}
                                        </Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={styles.restTimerControlButton}
                                        onPress={() => stopRestTimer(restTimerKey)}
                                      >
                                        <Text style={styles.restTimerControlText}>⏹ Stop</Text>
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Empty State */}
            {workout.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  No exercises available with current selection.
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  Try selecting different equipment or level.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            {workoutMode === 'active' && (
              <TouchableOpacity
                style={styles.backToSetupButton}
                onPress={() => {
                  setWorkoutMode('setup');
                  setCurrentExerciseIndex(null);
                }}
              >
                <Text style={styles.backToSetupButtonText}>← Back to Setup</Text>
              </TouchableOpacity>
            )}
            {isWorkoutComplete() && workoutMode === 'active' && (
              <TouchableOpacity
                style={styles.completeWorkoutButton}
                onPress={() => {
                  setWorkoutMode('setup');
                  setCurrentExerciseIndex(null);
                }}
              >
                <Text style={styles.completeWorkoutButtonText}>🎉 Complete Workout</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.closeFooterButton} onPress={onClose}>
              <Text style={styles.closeFooterButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: THEME.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.primary,
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.backgroundDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: THEME.textSecondary,
  },
  scrollView: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 12,
  },
  levelButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  levelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: THEME.backgroundDark,
    borderWidth: 2,
    borderColor: THEME.border,
    alignItems: 'center',
  },
  levelButtonActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  levelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  levelButtonTextActive: {
    color: THEME.textOnPrimary,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  equipmentChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: THEME.backgroundDark,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  equipmentChipActive: {
    backgroundColor: THEME.secondary,
    borderColor: THEME.secondary,
  },
  equipmentChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.textSecondary,
  },
  equipmentChipTextActive: {
    color: THEME.textOnSecondary,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.primary,
  },
  shuffleButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: THEME.secondary,
  },
  shuffleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textOnSecondary,
  },
  workoutInfo: {
    backgroundColor: THEME.primaryFaded,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  workoutInfoText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.primary,
    textAlign: 'center',
  },
  startWorkoutButton: {
    marginTop: 12,
    marginBottom: 16,
    paddingVertical: 16,
    backgroundColor: THEME.primary,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  startWorkoutButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textOnPrimary,
  },
  progressIndicator: {
    backgroundColor: THEME.secondaryFaded,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.secondary,
  },
  completeText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.primary,
    marginTop: 4,
  },
  exerciseCard: {
    backgroundColor: THEME.backgroundLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  exerciseCardCompleted: {
    backgroundColor: THEME.primaryFaded,
    borderColor: THEME.primary,
    opacity: 0.7,
  },
  exerciseCardCurrent: {
    borderWidth: 2,
    borderColor: THEME.primary,
    backgroundColor: THEME.primaryFaded + '40',
  },
  exerciseCardNext: {
    borderColor: THEME.secondary,
  },
  exerciseStatusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  currentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: THEME.primary,
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textOnPrimary,
    textTransform: 'uppercase',
  },
  nextBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: THEME.secondaryFaded,
    borderWidth: 1,
    borderColor: THEME.secondary,
  },
  nextBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.secondary,
    textTransform: 'uppercase',
  },
  completedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#4caf50' + '20',
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  completedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4caf50',
    textTransform: 'uppercase',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  exerciseHeaderLeft: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 6,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: THEME.secondaryFaded,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.secondary,
    textTransform: 'uppercase',
  },
  completedIcon: {
    fontSize: 20,
  },
  exerciseDetails: {
    marginBottom: 12,
  },
  exerciseType: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  restText: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  instructionsButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: THEME.primaryFaded,
    borderWidth: 1,
    borderColor: THEME.primaryLight,
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 8,
  },
  instructionsButtonExpanded: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  instructionsButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.primary,
  },
  instructionsButtonTextExpanded: {
    color: THEME.textOnPrimary,
  },
  instructionsContainer: {
    marginTop: 8,
    marginBottom: 12,
    padding: 12,
    backgroundColor: THEME.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.borderLight,
  },
  formCuesSection: {
    marginBottom: 12,
  },
  formCuesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.secondary,
    marginBottom: 8,
  },
  formCueItem: {
    fontSize: 13,
    color: THEME.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  instructionSection: {
    marginTop: 8,
  },
  instructionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 13,
    color: THEME.textSecondary,
    lineHeight: 20,
  },
  setsContainer: {
    gap: 8,
  },
  setCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: THEME.background,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  setCheckboxCompleted: {
    backgroundColor: THEME.primaryFaded,
    borderColor: THEME.primary,
  },
  setCheckboxText: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.textPrimary,
  },
  setCheckboxTextCompleted: {
    color: THEME.primary,
    fontWeight: '600',
  },
  restTimerButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: THEME.secondary,
    borderRadius: 8,
    alignItems: 'center',
  },
  restTimerButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textOnSecondary,
  },
  restTimerContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: THEME.secondaryFaded,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.secondary,
  },
  restTimerText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.secondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  restTimerControls: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  restTimerControlButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: THEME.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  restTimerControlText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: THEME.textMuted,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    gap: 12,
  },
  backToSetupButton: {
    paddingVertical: 12,
    backgroundColor: THEME.backgroundDark,
    borderRadius: 10,
    alignItems: 'center',
  },
  backToSetupButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  completeWorkoutButton: {
    paddingVertical: 14,
    backgroundColor: '#4caf50',
    borderRadius: 10,
    alignItems: 'center',
  },
  completeWorkoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  closeFooterButton: {
    paddingVertical: 14,
    backgroundColor: THEME.primary,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeFooterButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textOnPrimary,
  },
});
