import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, Alert, TouchableOpacity, Modal, FlatList, ScrollView, Dimensions, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { THEME } from '../theme/colors';

// Import all programs
import rugbyData from '../data/rugbyProgram.json';
import fitnessData from '../data/FitnessProgram.json';
import simpleWeightData from '../data/simpleweightProgram.json';
import testProgramData from '../data/TestProgram.json';
import hypertrophyData from '../data/HypertrophyMonth.json';
import recoveryWorkoutsData from '../data/recoveryWorkouts.json';

import { RugbyProgram, generateSessionId, parseSessionId, TrainingDay } from '../types/program';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_WIDTH = SCREEN_WIDTH / 7;

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// Program registry with all available programs
interface ProgramInfo {
  id: string;
  title: string;
  description: string;
  weeks: number;
  data: RugbyProgram;
}

const PROGRAMS: ProgramInfo[] = [
  {
    id: 'rugby',
    title: 'Rugby Season Prep',
    description: '16-week rugby-specific training',
    weeks: 16,
    data: rugbyData as unknown as RugbyProgram,
  },
  {
    id: 'fitness',
    title: '20-Week Foundation to Peak',
    description: 'Strength → Power → Conditioning',
    weeks: 20,
    data: fitnessData as unknown as RugbyProgram,
  },
  {
    id: 'simple',
    title: '12-Week Strength Program',
    description: 'Progressive strength development',
    weeks: 12,
    data: simpleWeightData as unknown as RugbyProgram,
  },
  {
    id: 'test',
    title: '🧪 Test Block – Progression Validation',
    description: '4-week test for Rule of 3, readiness safeguards',
    weeks: 4,
    data: testProgramData as unknown as RugbyProgram,
  },
  {
    id: 'hypertrophy',
    title: 'Hypertrophy Month',
    description: '4-week muscle building with power & mobility',
    weeks: 4,
    data: hypertrophyData as unknown as RugbyProgram,
  },
];

const STORAGE_KEY_PROGRAM = 'selectedProgramId';

// ---- Date-only helpers (no timezones) ----
function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d); // local date at midnight
}

function addDaysYMD(ymd: string, days: number): string {
  const dt = parseYMD(ymd);
  dt.setDate(dt.getDate() + days);
  return formatYMD(dt);
}

function daysBetweenYMD(startYMD: string, endYMD: string): number {
  const start = parseYMD(startYMD);
  const end = parseYMD(endYMD);
  const msPerDay = 1000 * 60 * 60 * 24;
  // Round to handle DST transitions robustly
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

// Get session type color
function getSessionTypeColor(sessionTitle: string): string {
  const lower = sessionTitle.toLowerCase();
  if (lower.includes('strength') || lower.includes('squat') || lower.includes('deadlift') || lower.includes('press')) {
    return THEME.error; // Red for strength
  }
  if (lower.includes('recovery') || lower.includes('mobility') || lower.includes('yoga') || lower.includes('foam')) {
    return THEME.primary; // Green for recovery
  }
  if (lower.includes('conditioning') || lower.includes('cardio') || lower.includes('interval') || lower.includes('circuit')) {
    return THEME.secondary; // Blue for conditioning
  }
  return THEME.textMuted; // Default gray
}

// Get readiness badge
function getReadinessBadge(readiness: number | null): { emoji: string; color: string } {
  if (!readiness) return { emoji: '◇', color: THEME.textMuted };
  if (readiness >= 8) return { emoji: '⚡', color: THEME.readinessHigh };
  if (readiness <= 3) return { emoji: '◇', color: THEME.readinessLow };
  return { emoji: '▲', color: THEME.readinessMedium };
}

export default function HomeScreen({ navigation }: Props) {
  const [startDateYMD, setStartDateYMD] = useState<string | null>(null);
  const [completedSessions, setCompletedSessions] = useState<{ id: string; date: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(new Date());
  const [selectedProgramId, setSelectedProgramId] = useState<string>('rugby');
  const [showProgramPicker, setShowProgramPicker] = useState(false);
  const [todaySessionExpanded, setTodaySessionExpanded] = useState(false);
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapSearchQuery, setSwapSearchQuery] = useState('');
  const [swapFilterType, setSwapFilterType] = useState<string | null>(null);
  const [swappedSessions, setSwappedSessions] = useState<Record<string, { originalSessionId: string; swappedSessionId: string; date: string }>>({});
  const [showPushModal, setShowPushModal] = useState(false);
  const [programOffset, setProgramOffset] = useState<number>(0);
  const [pendingPushDate, setPendingPushDate] = useState<string | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryModalDate, setRecoveryModalDate] = useState<string | null>(null);

  // Get the current program data based on selection
  const currentProgram = PROGRAMS.find(p => p.id === selectedProgramId) || PROGRAMS[0];
  const programData = currentProgram.data;

  // Load selected program from storage
  useEffect(() => {
    const loadProgram = async () => {
      const storedProgram = await AsyncStorage.getItem(STORAGE_KEY_PROGRAM);
      if (storedProgram && PROGRAMS.some(p => p.id === storedProgram)) {
        setSelectedProgramId(storedProgram);
      }
    };
    loadProgram();
  }, []);

  // Load startDate and program offset
  useEffect(() => {
    const loadStartDate = async () => {
      const stored = await AsyncStorage.getItem('startDateYMD');
      if (stored) {
        setStartDateYMD(stored);
      }
      
      // Load program offset (for pushed workouts)
      const storedOffset = await AsyncStorage.getItem('programOffset');
      if (storedOffset) {
        setProgramOffset(parseInt(storedOffset, 10) || 0);
      }
    };
    loadStartDate();
  }, []);

  // Load readiness score
  useEffect(() => {
    const loadReadiness = async () => {
      const stored = await AsyncStorage.getItem('todayReadinessScore');
      if (stored) {
        setReadinessScore(parseInt(stored, 10));
      }
    };
    loadReadiness();
  }, []);

  // Handle program selection
  const handleProgramSelect = useCallback(async (programId: string) => {
    if (programId === selectedProgramId) {
      setShowProgramPicker(false);
      return;
    }

    Alert.alert(
      'Change Program',
      'Switching programs will reset your start date and completed sessions. Continue?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setShowProgramPicker(false) },
        {
          text: 'Switch Program',
          style: 'destructive',
          onPress: async () => {
            // Save new program selection
            await AsyncStorage.setItem(STORAGE_KEY_PROGRAM, programId);
            // Clear progress data
            await AsyncStorage.removeItem('startDateYMD');
            await AsyncStorage.removeItem('completedSessions');
            // Update state
            setSelectedProgramId(programId);
            setStartDateYMD(null);
            setCompletedSessions([]);
            setSelectedDate(null);
            setShowProgramPicker(false);
            console.log('📋 Switched to program:', programId);
          },
        },
      ]
    );
  }, [selectedProgramId]);

  // Load completed sessions whenever screen is focused, cleaning invalid entries
  useEffect(() => {
    const loadCompletedSessions = async () => {
      try {
        const stored = await AsyncStorage.getItem('completedSessions');
        if (stored) {
          const parsed = JSON.parse(stored);
          const cleaned = parsed.filter((s: any) => s.id && typeof s.id === 'string');
          if (cleaned.length !== parsed.length) {
            await AsyncStorage.setItem('completedSessions', JSON.stringify(cleaned));
          }
          setCompletedSessions(cleaned);
        } else {
          setCompletedSessions([]);
        }
      } catch (error) {
        console.error('Error loading completed sessions:', error);
      }
    };

    const unsubscribe = navigation.addListener('focus', loadCompletedSessions);
    return unsubscribe;
  }, [navigation]);

  // Convert sessionId to calendar date (YYYY-MM-DD) using date-only math
  function getDateFromSessionId(sessionId?: string, startYMD?: string): string {
    if (!sessionId || !startYMD) return '';
    const parsed = parseSessionId(sessionId);
    if (!parsed) return '';
    // weekIndex is 0-indexed within mesocycle, dayNumber is 1-indexed
    // We need to find which program week this corresponds to
    const mesocycles = getMesocycles();
    const meso = mesocycles.find(m => m.id === parsed.mesoId);
    if (!meso || !meso.weeks || !Array.isArray(meso.weeks)) return '';
    const programWeek = meso.weeks[parsed.weekIndex]; // This is the 1-indexed program week
    if (!programWeek) return '';
    const offsetDays = (programWeek - 1) * 7 + (parsed.dayNumber - 1);
    return addDaysYMD(startYMD, offsetDays);
  }

  // Get mesocycles array - handle both schema formats
  const getMesocycles = (): any[] => {
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
  };

  // Helper: find the correct mesocycle for a given program week (1-indexed)
  const getMesocycleForWeek = (programWeek: number): { mesoId: string; weekInMeso: number } | null => {
    const mesocycles = getMesocycles();
    for (const meso of mesocycles) {
      // Guard against undefined or non-array weeks
      if (!meso.weeks || !Array.isArray(meso.weeks)) {
        console.error('Mesocycle missing weeks array:', meso.id);
        continue;
      }
      if (meso.weeks.includes(programWeek)) {
        // weekInMeso is 0-indexed within the mesocycle
        const weekInMeso = meso.weeks.indexOf(programWeek);
        return { mesoId: meso.id, weekInMeso };
      }
    }
    return null;
  };

  // Calculate today's session (checking for swaps first)
  const todaySession = useMemo(() => {
    if (!startDateYMD) return null;
    
    const todayYMD = formatYMD(new Date());
    
    // Check if there's a swapped session for today
    const swap = swappedSessions[todayYMD];
    let sessionIdToUse: string | null = null;
    
    if (swap) {
      // Use swapped session
      sessionIdToUse = swap.swappedSessionId;
    } else {
      // Calculate original session (accounting for program offset)
      const offsetDays = daysBetweenYMD(startDateYMD, todayYMD) - programOffset;
      
      if (offsetDays < 0) return null; // Before program start
      
      const programWeek = Math.floor(offsetDays / 7) + 1;
      const dayNumber = (offsetDays % 7) + 1;
      
      // Get total weeks - use program info or macrocycle
      const totalWeeks = currentProgram.weeks || programData.macrocycle?.lengthWeeks || (programData as any).macrocycle?.lengthWeeks || 4;
      if (programWeek > totalWeeks) return null; // Beyond program
      
      const mesoInfo = getMesocycleForWeek(programWeek);
      if (!mesoInfo) {
        console.error('Could not find mesocycle for week:', programWeek, 'Available mesocycles:', getMesocycles().map((m: any) => ({ id: m.id, weeks: m.weeks })));
        return null;
      }
      
      sessionIdToUse = generateSessionId(mesoInfo.mesoId, mesoInfo.weekInMeso, dayNumber);
    }
    
    if (!sessionIdToUse) return null;
    
    // Parse session ID to get session details
    const parsed = parseSessionId(sessionIdToUse);
    if (!parsed) {
      console.error('Failed to parse session ID:', sessionIdToUse);
      return null;
    }
    
    const mesocycles = getMesocycles();
    const meso = mesocycles.find((m: any) => m.id === parsed.mesoId);
    if (!meso) {
      console.error('Mesocycle not found for swapped session:', parsed.mesoId);
      return null;
    }
    
    const trainingDays = (meso as any).trainingDays || (meso as any).microcycle || [];
    const day = trainingDays.find((d: any) => (d.day === parsed.dayNumber || d.dayNumber === parsed.dayNumber));
    if (!day) {
      console.error('Day not found in mesocycle:', parsed.dayNumber, 'Available days:', trainingDays.map((d: any) => d.day || d.dayNumber));
      return null;
    }
    
    return {
      sessionId: sessionIdToUse,
      title: day.title || `Day ${parsed.dayNumber}`,
      durationMinutes: day.durationMinutes || 60,
      blocks: day.blocks || [],
      date: todayYMD,
      isSwapped: !!swap,
      originalSessionId: swap?.originalSessionId,
    };
  }, [startDateYMD, programData, currentProgram, swappedSessions, programOffset]);

  // Get completion percentage for a session
  const getCompletionPercentage = (sessionId: string): number => {
    const session = completedSessions.find(s => s.id === sessionId);
    if (!session) return 0;
    // For now, return 100% if completed. Can be enhanced to track partial completion
    return 100;
  };

  // Handle day press → compute sessionId based on date-only offset
  const handleDayPress = (day: { dateString: string }) => {
    setSelectedDate(day.dateString);

    if (!startDateYMD) {
      Alert.alert(
        'Set Start Date',
        'Please pick a start date for your program before selecting a workout day.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Pick Start Date', onPress: handleOpenPicker },
        ]
      );
      return;
    }

    const offsetDays = daysBetweenYMD(startDateYMD, day.dateString) - programOffset;
    
    // Check if it's before the start date
    if (offsetDays < 0) {
      Alert.alert(
        'Before Program Start',
        'This date is before your program start date. Please select a date on or after your start date.'
      );
      return;
    }

    // Calculate program week (1-indexed) and day within week (1-7)
    const programWeek = Math.floor(offsetDays / 7) + 1;
    const dayNumber = (offsetDays % 7) + 1;

    // Check if we're within the program length
    const totalWeeks = programData.macrocycle?.lengthWeeks || (programData as any).macrocycle?.lengthWeeks || 4;
    if (programWeek > totalWeeks) {
      Alert.alert(
        'Beyond Program',
        `Week ${programWeek} is beyond the ${totalWeeks}-week program. Consider restarting or extending.`
      );
      return;
    }

    // Find the correct mesocycle
    const mesoInfo = getMesocycleForWeek(programWeek);
    if (!mesoInfo) {
      console.error('Could not find mesocycle for week:', programWeek);
      // Show recovery workout options instead of error
      setShowRecoveryModal(true);
      setRecoveryModalDate(day.dateString);
      return;
    }

    // Check if day exists in the mesocycle
    const mesocycles = getMesocycles();
    const meso = mesocycles.find(m => m.id === mesoInfo.mesoId);
    if (!meso) {
      setShowRecoveryModal(true);
      setRecoveryModalDate(day.dateString);
      return;
    }

    const trainingDays = (meso as any).trainingDays || (meso as any).microcycle;
    const dayExists = trainingDays?.some((d: any) => (d.day === dayNumber || d.dayNumber === dayNumber));
    
    if (!dayExists) {
      // No session scheduled for this day - show recovery options
      setShowRecoveryModal(true);
      setRecoveryModalDate(day.dateString);
      return;
    }

    // Generate session ID using the utility function
    const sessionId = generateSessionId(mesoInfo.mesoId, mesoInfo.weekInMeso, dayNumber);

    console.log('➡️ Navigating to session:', sessionId, {
      programWeek,
      dayNumber,
      mesoId: mesoInfo.mesoId,
      weekInMeso: mesoInfo.weekInMeso,
    });
    navigation.navigate('Session', { sessionId });
  };

  // Initialize picker date when opening
  const handleOpenPicker = () => {
    // Set picker date to existing start date, or current date if not set
    const initialDate = startDateYMD ? parseYMD(startDateYMD) : new Date();
    setPickerDate(initialDate);
    setShowPicker(true);
  };

  // Handle date picker value change (iOS spinner updates)
  const handleDateChange = (event: any, date?: Date) => {
    // Update picker date state as user changes it
    if (date) {
      setPickerDate(date);
    }
    
    // On Android, save immediately when date is set
    if (Platform.OS === 'android') {
      if (event.type === 'set' && date) {
        // Check if we're pushing workouts
        if (pendingPushDate !== null) {
          const targetYMD = formatYMD(date);
          executePushWorkouts(targetYMD);
          setPendingPushDate(null);
        } else {
          saveStartDate(date);
        }
        setShowPicker(false);
      } else if (event.type === 'dismissed') {
        setPendingPushDate(null); // Clear pending push if cancelled
        setShowPicker(false);
      }
    }
    // On iOS, we wait for "Done" button to save
  };

  // Save the start date
  const saveStartDate = async (date: Date) => {
    const ymd = formatYMD(date);
    setStartDateYMD(ymd);
    await AsyncStorage.setItem('startDateYMD', ymd);
    console.log('📅 Start date set (YMD):', ymd);
  };

  // Handle Done button (iOS)
  const handleDatePickerDone = async () => {
    // Check if we're pushing workouts to this date
    if (pendingPushDate !== null) {
      const targetYMD = formatYMD(pickerDate);
      await executePushWorkouts(targetYMD);
      setPendingPushDate(null);
      setShowPicker(false);
    } else {
      // Save whatever date is currently in the picker
      await saveStartDate(pickerDate);
      setShowPicker(false);
    }
  };

  // Handle start session
  const handleStartSession = () => {
    if (!todaySession) return;
    navigation.navigate('Session', { sessionId: todaySession.sessionId });
  };

  // Handle reschedule
  const handleReschedule = () => {
    Alert.alert('Reschedule', 'Select a new date for this session', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Select Date', onPress: () => {
        // For now, just open calendar. Can be enhanced with drag-and-drop
        setShowPicker(true);
      }},
    ]);
  };

  // Get missed/incomplete sessions
  const getMissedSessions = useMemo(() => {
    if (!startDateYMD) return [];
    
    const todayYMD = formatYMD(new Date());
    const missed: Array<{ sessionId: string; date: string; title: string; shouldHaveBeen: string }> = [];
    
    // Get all sessions from start date to today
    const totalWeeks = currentProgram.weeks || programData.macrocycle?.lengthWeeks || 4;
    const mesocycles = getMesocycles();
    
    // Iterate through all program weeks
    for (let programWeek = 1; programWeek <= totalWeeks; programWeek++) {
      const mesoInfo = getMesocycleForWeek(programWeek);
      if (!mesoInfo) continue;
      
      const meso = mesocycles.find((m: any) => m.id === mesoInfo.mesoId);
      if (!meso) continue;
      
      const trainingDays = (meso as any).trainingDays || (meso as any).microcycle || [];
      
      // Iterate through each training day in the microcycle
      trainingDays.forEach((day: any, dayIndex: number) => {
        const dayNumber = day.day || day.dayNumber || (dayIndex + 1);
        
        // Generate session ID using weekInMeso (0-indexed) and dayNumber
        const sessionId = generateSessionId(mesoInfo.mesoId, mesoInfo.weekInMeso, dayNumber);
        
        // Calculate when this session should have occurred
        // dayNumber represents the day within the microcycle (1, 2, 3, etc.)
        // We need to map this to actual calendar days
        // For now, assume dayNumber corresponds to day of week (1=Monday, 2=Tuesday, etc.)
        // But it might be the sequential day in the microcycle
        // Use the same logic as getDateFromSessionId: (programWeek - 1) * 7 + (dayNumber - 1)
        const offsetDays = (programWeek - 1) * 7 + (dayNumber - 1) - programOffset;
        const shouldHaveBeen = addDaysYMD(startDateYMD, offsetDays);
        
        // Check if it's in the past and not completed
        if (shouldHaveBeen < todayYMD) {
          const isCompleted = completedSessions.some(s => s.id === sessionId);
          if (!isCompleted) {
            missed.push({
              sessionId,
              date: shouldHaveBeen,
              title: day.title || `Week ${programWeek} Day ${dayNumber}`,
              shouldHaveBeen,
            });
          }
        }
      });
    }
    
    return missed.sort((a, b) => a.shouldHaveBeen.localeCompare(b.shouldHaveBeen));
  }, [startDateYMD, programOffset, completedSessions, programData, currentProgram]);

  // Handle push workouts
  const handlePushWorkouts = () => {
    const missed = getMissedSessions;
    if (missed.length === 0) {
      Alert.alert('No Missed Workouts', 'All workouts are up to date!');
      return;
    }
    setShowPushModal(true);
  };

  // Execute push workouts
  const executePushWorkouts = async (targetDate: string) => {
    const missed = getMissedSessions;
    if (missed.length === 0) return;
    
    const todayYMD = formatYMD(new Date());
    const targetYMD = targetDate || todayYMD;
    
    // Calculate how many days to push forward
    // Find the earliest missed session date
    const earliestMissed = missed[0].shouldHaveBeen;
    const daysToPush = daysBetweenYMD(earliestMissed, targetYMD);
    
    if (daysToPush < 0) {
      Alert.alert('Invalid Date', 'Target date must be on or after the earliest missed workout.');
      return;
    }
    
    // Update program offset
    const newOffset = programOffset + daysToPush;
    setProgramOffset(newOffset);
    await AsyncStorage.setItem('programOffset', String(newOffset));
    
    Alert.alert(
      'Workouts Pushed!',
      `${missed.length} missed workout(s) have been rescheduled. The program will continue from the new position.`,
      [{ text: 'OK' }]
    );
    
    setShowPushModal(false);
  };

  // Load swapped sessions and readiness score from storage
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load swapped sessions
        const stored = await AsyncStorage.getItem('swappedSessions');
        if (stored) {
          setSwappedSessions(JSON.parse(stored));
        }
        
        // Load readiness score if available
        const todayYMD = formatYMD(new Date());
        const readinessKey = `readiness:${todayYMD}`;
        const storedReadiness = await AsyncStorage.getItem(readinessKey);
        if (storedReadiness) {
          const parsed = JSON.parse(storedReadiness);
          if (parsed.score) {
            setReadinessScore(parsed.score);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadData();
  }, []);

  // Get session type helper (must be defined before useMemo that uses it)
  const getSessionType = useCallback((title: string): string => {
    const lower = title.toLowerCase();
    if (lower.includes('recovery') || lower.includes('mobility') || lower.includes('yoga') || lower.includes('foam')) {
      return 'Recovery';
    }
    if (lower.includes('conditioning') || lower.includes('cardio') || lower.includes('interval')) {
      return 'Conditioning';
    }
    return 'Strength';
  }, []);

  // Get all available sessions from the current program
  const getAllAvailableSessions = useMemo(() => {
    const sessions: Array<{
      sessionId: string;
      title: string;
      durationMinutes: number;
      mesoId: string;
      weekInMeso: number;
      dayNumber: number;
      sessionType: string;
    }> = [];

    const mesocycles = getMesocycles();
    mesocycles.forEach((meso: any) => {
      const trainingDays = meso.trainingDays || meso.microcycle || [];
      trainingDays.forEach((day: any, dayIdx: number) => {
        const dayNumber = day.day || day.dayNumber || (dayIdx + 1);
        // Generate session IDs for all weeks in this mesocycle
        if (meso.weeks && Array.isArray(meso.weeks)) {
          meso.weeks.forEach((week: number) => {
            const weekInMeso = meso.weeks.indexOf(week);
            const sessionId = generateSessionId(meso.id, weekInMeso, dayNumber);
            const sessionType = getSessionType(day.title || `Day ${dayNumber}`);
            sessions.push({
              sessionId,
              title: day.title || `Day ${dayNumber}`,
              durationMinutes: day.durationMinutes || 60,
              mesoId: meso.id,
              weekInMeso,
              dayNumber,
              sessionType,
            });
          });
        }
      });
    });

    return sessions;
  }, [programData, selectedProgramId, getSessionType]);


  // Get suggested sessions based on readiness
  const getSuggestedSessions = useMemo(() => {
    if (readinessScore === null) return [];
    
    const allSessions = getAllAvailableSessions;
    if (readinessScore <= 4) {
      // Low readiness - suggest Recovery
      return allSessions.filter(s => s.sessionType === 'Recovery').slice(0, 3);
    } else if (readinessScore >= 8) {
      // High readiness - suggest Strength or Conditioning
      return allSessions.filter(s => s.sessionType === 'Strength' || s.sessionType === 'Conditioning').slice(0, 3);
    } else {
      // Moderate readiness - suggest moderate intensity
      return allSessions.filter(s => s.sessionType !== 'Recovery').slice(0, 3);
    }
  }, [readinessScore, getAllAvailableSessions]);

  // Filter sessions for swap modal
  const getFilteredSessions = useMemo(() => {
    let filtered = getAllAvailableSessions;

    // Filter by type
    if (swapFilterType) {
      filtered = filtered.filter(s => s.sessionType === swapFilterType);
    }

    // Filter by search query
    if (swapSearchQuery.trim()) {
      const query = swapSearchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.title.toLowerCase().includes(query) ||
        s.sessionType.toLowerCase().includes(query)
      );
    }

    // Exclude current session
    if (todaySession) {
      filtered = filtered.filter(s => s.sessionId !== todaySession.sessionId);
    }

    return filtered;
  }, [getAllAvailableSessions, swapFilterType, swapSearchQuery, todaySession]);

  // Handle swap session
  const handleSwap = () => {
    setShowSwapModal(true);
  };

  // Confirm and execute swap
  const confirmSwap = async (newSessionId: string, newSessionTitle: string) => {
    if (!todaySession) return;

    Alert.alert(
      'Confirm Swap',
      `Replace "${todaySession.title}" with "${newSessionTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Swap',
          onPress: async () => {
            try {
              const todayYMD = formatYMD(new Date());
              const swapData = {
                originalSessionId: todaySession.sessionId,
                swappedSessionId: newSessionId,
                date: todayYMD,
              };

              // Save swap to storage
              const updated = { ...swappedSessions, [todayYMD]: swapData };
              setSwappedSessions(updated);
              await AsyncStorage.setItem('swappedSessions', JSON.stringify(updated));

              // Log swap for analytics
              const swapHistory = await AsyncStorage.getItem('swapHistory') || '[]';
              const history = JSON.parse(swapHistory);
              history.push({
                ...swapData,
                timestamp: new Date().toISOString(),
              });
              await AsyncStorage.setItem('swapHistory', JSON.stringify(history));

              setShowSwapModal(false);
              setSwapSearchQuery('');
              setSwapFilterType(null);
              Alert.alert('Swapped!', `Session swapped successfully. Use "Undo Swap" to revert.`);
            } catch (error) {
              console.error('Error swapping session:', error);
              Alert.alert('Error', 'Failed to swap session. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Undo swap
  const handleUndoSwap = async () => {
    if (!todaySession) return;
    const todayYMD = formatYMD(new Date());
    const swap = swappedSessions[todayYMD];

    if (!swap) {
      Alert.alert('No Swap', 'No swap found for today to undo.');
      return;
    }

    Alert.alert(
      'Undo Swap',
      'Revert to original session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo',
          onPress: async () => {
            try {
              const updated = { ...swappedSessions };
              delete updated[todayYMD];
              setSwappedSessions(updated);
              await AsyncStorage.setItem('swappedSessions', JSON.stringify(updated));
              Alert.alert('Undone!', 'Session reverted to original.');
            } catch (error) {
              console.error('Error undoing swap:', error);
              Alert.alert('Error', 'Failed to undo swap. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Generate weekly calendar dates
  const getWeeklyDates = (): string[] => {
    const today = new Date();
    const dates: string[] = [];
    // Get Monday of current week
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(formatYMD(date));
    }
    return dates;
  };

  const weeklyDates = getWeeklyDates();

  // Get session for a specific date
  const getSessionForDate = (dateYMD: string): { sessionId: string; title: string } | null => {
    if (!startDateYMD) return null;
    const offsetDays = daysBetweenYMD(startDateYMD, dateYMD) - programOffset;
    if (offsetDays < 0) return null;
    
    const programWeek = Math.floor(offsetDays / 7) + 1;
    const dayNumber = (offsetDays % 7) + 1;
    const totalWeeks = currentProgram.weeks || programData.macrocycle?.lengthWeeks || (programData as any).macrocycle?.lengthWeeks || 4;
    if (programWeek > totalWeeks) return null;
    
    const mesoInfo = getMesocycleForWeek(programWeek);
    if (!mesoInfo) return null;
    
    const sessionId = generateSessionId(mesoInfo.mesoId, mesoInfo.weekInMeso, dayNumber);
    const mesocycles = getMesocycles();
    const meso = mesocycles.find((m: any) => m.id === mesoInfo.mesoId);
    if (!meso) return null;
    
    // Handle both microcycle and trainingDays formats
    const trainingDays = (meso as any).trainingDays || (meso as any).microcycle || [];
    // Handle both day and dayNumber properties
    const day = trainingDays.find((d: any) => (d.day === dayNumber || d.dayNumber === dayNumber));
    if (!day) return null;
    
    return {
      sessionId,
      title: day.title || `Day ${dayNumber}`,
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Current Program Selector - Top Item */}
        <TouchableOpacity 
          style={styles.programSelector} 
          onPress={() => setShowProgramPicker(true)}
        >
          <View style={styles.programSelectorContent}>
            <Text style={styles.programSelectorLabel}>Current Program</Text>
            <Text style={styles.programSelectorTitle}>{currentProgram.title}</Text>
            <Text style={styles.programSelectorMeta}>
              {currentProgram.weeks} weeks • Tap to change
            </Text>
          </View>
          <Text style={styles.programSelectorArrow}>▼</Text>
        </TouchableOpacity>

        {/* Program Picker Modal */}
        <Modal
          visible={showProgramPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowProgramPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Training Program</Text>
              <FlatList
                data={PROGRAMS}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.programOption,
                      item.id === selectedProgramId && styles.programOptionSelected,
                    ]}
                    onPress={() => handleProgramSelect(item.id)}
                  >
                    <Text style={[
                      styles.programOptionTitle,
                      item.id === selectedProgramId && styles.programOptionTitleSelected,
                    ]}>
                      {item.title}
                    </Text>
                    <Text style={styles.programOptionDesc}>{item.description}</Text>
                    <Text style={styles.programOptionWeeks}>{item.weeks} weeks</Text>
                    {item.id === selectedProgramId && (
                      <Text style={styles.programOptionCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowProgramPicker(false)}
              >
                <Text style={styles.modalCloseButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Today's Session Card */}
        {todaySession && (
          <View style={styles.todayCard}>
            <View style={styles.todayCardHeader}>
              <View style={styles.todayCardTitleContainer}>
                <Text style={styles.todayCardLabel}>Today's Session</Text>
                <Text style={styles.todayCardTitle} numberOfLines={2} ellipsizeMode="tail">
                  {todaySession.title}
                </Text>
              </View>
              <View style={[styles.sessionTypeBadge, { backgroundColor: getSessionTypeColor(todaySession.title) + '20' }]}>
                <Text style={[styles.sessionTypeText, { color: getSessionTypeColor(todaySession.title) }]}>
                  {todaySession.title.includes('Recovery') || todaySession.title.includes('Mobility') ? 'Recovery' :
                   todaySession.title.includes('Conditioning') || todaySession.title.includes('Cardio') ? 'Conditioning' :
                   'Strength'}
                </Text>
              </View>
            </View>

            <View style={styles.todayCardDetails}>
              <View style={styles.todayCardDetailItem}>
                <Text style={styles.todayCardDetailLabel}>Duration</Text>
                <Text style={styles.todayCardDetailValue}>{todaySession.durationMinutes} min</Text>
              </View>
              {readinessScore !== null && (
                <View style={styles.todayCardDetailItem}>
                  <Text style={styles.todayCardDetailLabel}>Readiness</Text>
                  <Text style={[styles.todayCardDetailValue, { color: getReadinessBadge(readinessScore).color }]}>
                    {readinessScore}/10
                  </Text>
                </View>
              )}
            </View>

            {/* Collapsible Instructions */}
            {todaySessionExpanded && todaySession.blocks && (
              <View style={styles.todayCardInstructions}>
                <Text style={styles.instructionsTitle}>Session Overview</Text>
                {todaySession.blocks.slice(0, 3).map((block: any, idx: number) => (
                  <Text key={idx} style={styles.instructionItem}>
                    • {block.name}
                  </Text>
                ))}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.todayCardActions}>
              <TouchableOpacity style={styles.startButton} onPress={handleStartSession}>
                <Text style={styles.startButtonText}>▶ Start Session</Text>
              </TouchableOpacity>
              <View style={styles.quickActions}>
                <TouchableOpacity 
                  style={styles.quickActionButton} 
                  onPress={handleReschedule}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickActionIcon}>📅</Text>
                  <Text style={styles.quickActionText}>Reschedule</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.quickActionButton} 
                  onPress={handleSwap}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickActionIcon}>🔄</Text>
                  <Text style={styles.quickActionText}>Swap</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.quickActionButton} 
                  onPress={handlePushWorkouts}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickActionIcon}>⏩</Text>
                  <Text style={styles.quickActionText}>Push</Text>
                </TouchableOpacity>
                {todaySession?.isSwapped && (
                  <TouchableOpacity 
                    style={[styles.quickActionButton, styles.quickActionButtonUndo]} 
                    onPress={handleUndoSwap}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickActionIcon}>↩️</Text>
                    <Text style={styles.quickActionText}>Undo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Expand Button */}
            <TouchableOpacity 
              style={styles.expandButton}
              onPress={() => setTodaySessionExpanded(!todaySessionExpanded)}
            >
              <Text style={styles.expandButtonText}>
                {todaySessionExpanded ? '▲ Hide Details' : '▼ Show Instructions'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pick Start Date Button */}
        <TouchableOpacity 
          style={styles.startDateButton}
          onPress={handleOpenPicker}
        >
          <Text style={styles.startDateButtonText}>
            {startDateYMD 
              ? `📅 Start Date: ${parseYMD(startDateYMD).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : '📅 Select Start Date'}
          </Text>
        </TouchableOpacity>

        {/* Weekly Calendar Strip */}
        <View style={styles.calendarSection}>
          <Text style={styles.calendarSectionTitle}>This Week</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.weeklyCalendar}
          >
            {weeklyDates.map((dateYMD) => {
              const session = getSessionForDate(dateYMD);
              const isToday = dateYMD === formatYMD(new Date());
              const isSelected = dateYMD === selectedDate;
              const completion = session ? getCompletionPercentage(session.sessionId) : 0;
              const date = parseYMD(dateYMD);
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
              const dayNumber = date.getDate();
              const sessionColor = session ? getSessionTypeColor(session.title) : THEME.textMuted;
              const badge = readinessScore !== null ? getReadinessBadge(readinessScore) : null;

              return (
                <TouchableOpacity
                  key={dateYMD}
                  style={[
                    styles.calendarDay,
                    isToday && styles.calendarDayToday,
                    isSelected && styles.calendarDaySelected,
                  ]}
                  onPress={() => handleDayPress({ dateString: dateYMD })}
                >
                  <Text style={[styles.calendarDayName, isToday && styles.calendarDayNameToday]}>
                    {dayName}
                  </Text>
                  <Text style={[styles.calendarDayNumber, isToday && styles.calendarDayNumberToday]}>
                    {dayNumber}
                  </Text>
                  {session && (
                    <>
                      <View style={[styles.sessionIndicator, { backgroundColor: sessionColor }]} />
                      {completion > 0 && (
                        <View style={styles.completionOverlay}>
                          <Text style={styles.completionText}>{completion}%</Text>
                        </View>
                      )}
                      {badge && (
                        <Text style={[styles.readinessBadge, { color: badge.color }]}>
                          {badge.emoji}
                        </Text>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Full Calendar (Collapsible) */}
        <View style={styles.fullCalendarSection}>
          <TouchableOpacity
            style={styles.calendarToggleButton}
            onPress={() => setCalendarExpanded(!calendarExpanded)}
          >
            <Text style={styles.calendarSectionTitle}>Full Calendar</Text>
            <Text style={styles.calendarToggleIcon}>
              {calendarExpanded ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          {calendarExpanded && (
            <Calendar
              markedDates={(() => {
                const marks: Record<string, any> = {};
                if (startDateYMD) {
                  completedSessions.forEach((s) => {
                    const date = getDateFromSessionId(s.id, startDateYMD);
                    if (date) {
                      marks[date] = {
                        marked: true,
                        dotColor: THEME.primary,
                        customStyles: {
                          container: { backgroundColor: THEME.primaryFaded },
                          text: { color: THEME.textPrimary },
                        },
                      };
                    }
                  });
                }
                if (selectedDate) {
                  marks[selectedDate] = {
                    ...marks[selectedDate],
                    selected: true,
                    selectedColor: THEME.secondary,
                  };
                }
                return marks;
              })()}
              markingType="custom"
              onDayPress={handleDayPress}
            />
          )}
        </View>

        {/* Date Picker Modal */}
        {Platform.OS === 'ios' && showPicker && (
          <Modal
            visible={showPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowPicker(false)}
          >
            <View style={styles.datePickerModalOverlay}>
              <View style={styles.datePickerModalContent}>
                <View style={styles.datePickerHeader}>
                  <Text style={styles.datePickerTitle}>Select Start Date</Text>
                  <TouchableOpacity
                    onPress={handleDatePickerDone}
                    style={styles.datePickerCloseButton}
                  >
                    <Text style={styles.datePickerCloseText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.datePickerContainer}>
                  <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    style={styles.datePicker}
                    textColor={THEME.textPrimary}
                    themeVariant="light"
                  />
                </View>
              </View>
            </View>
          </Modal>
        )}
        
        {/* Android Date Picker (shows as system dialog) */}
        {Platform.OS === 'android' && showPicker && (
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

        {/* Swap Session Modal */}
        <Modal
          visible={showSwapModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowSwapModal(false);
            setSwapSearchQuery('');
            setSwapFilterType(null);
          }}
        >
          <View style={styles.swapModalOverlay}>
            <View style={styles.swapModalContent}>
              {/* Header */}
              <View style={styles.swapModalHeader}>
                <Text style={styles.swapModalTitle}>Swap Session</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowSwapModal(false);
                    setSwapSearchQuery('');
                    setSwapFilterType(null);
                  }}
                  style={styles.swapModalCloseButton}
                >
                  <Text style={styles.swapModalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Suggested Sessions (if readiness score available) */}
              {readinessScore !== null && getSuggestedSessions.length > 0 && (
                <View style={styles.suggestedSection}>
                  <Text style={styles.suggestedTitle}>
                    💡 Suggested for Readiness {readinessScore}/10
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestedScroll}>
                    {getSuggestedSessions.map((session) => (
                      <TouchableOpacity
                        key={session.sessionId}
                        style={[styles.suggestedCard, { borderColor: getSessionTypeColor(session.title) }]}
                        onPress={() => confirmSwap(session.sessionId, session.title)}
                      >
                        <Text style={styles.suggestedCardTitle}>{session.title}</Text>
                        <Text style={styles.suggestedCardMeta}>
                          {session.durationMinutes} min • {session.sessionType}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Search and Filters */}
              <View style={styles.swapFilters}>
                <TextInput
                  style={styles.swapSearchInput}
                  placeholder="Search sessions..."
                  placeholderTextColor={THEME.textMuted}
                  value={swapSearchQuery}
                  onChangeText={setSwapSearchQuery}
                />
                <View style={styles.filterButtons}>
                  <TouchableOpacity
                    style={[styles.filterButton, swapFilterType === null && styles.filterButtonActive]}
                    onPress={() => setSwapFilterType(null)}
                  >
                    <Text style={[styles.filterButtonText, swapFilterType === null && styles.filterButtonTextActive]}>
                      All
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterButton, swapFilterType === 'Strength' && styles.filterButtonActive]}
                    onPress={() => setSwapFilterType('Strength')}
                  >
                    <Text style={[styles.filterButtonText, swapFilterType === 'Strength' && styles.filterButtonTextActive]}>
                      Strength
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterButton, swapFilterType === 'Conditioning' && styles.filterButtonActive]}
                    onPress={() => setSwapFilterType('Conditioning')}
                  >
                    <Text style={[styles.filterButtonText, swapFilterType === 'Conditioning' && styles.filterButtonTextActive]}>
                      Conditioning
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterButton, swapFilterType === 'Recovery' && styles.filterButtonActive]}
                    onPress={() => setSwapFilterType('Recovery')}
                  >
                    <Text style={[styles.filterButtonText, swapFilterType === 'Recovery' && styles.filterButtonTextActive]}>
                      Recovery
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Session List */}
              <FlatList
                data={getFilteredSessions}
                keyExtractor={(item) => item.sessionId}
                renderItem={({ item }) => {
                  const isSuggested = getSuggestedSessions.some(s => s.sessionId === item.sessionId);
                  return (
                    <TouchableOpacity
                      style={[styles.swapSessionCard, isSuggested && styles.swapSessionCardSuggested]}
                      onPress={() => confirmSwap(item.sessionId, item.title)}
                    >
                      <View style={styles.swapSessionCardHeader}>
                        <Text style={styles.swapSessionCardTitle}>{item.title}</Text>
                        <View style={[styles.swapSessionTypeBadge, { backgroundColor: getSessionTypeColor(item.title) + '20' }]}>
                          <Text style={[styles.swapSessionTypeText, { color: getSessionTypeColor(item.title) }]}>
                            {item.sessionType}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.swapSessionCardMeta}>
                        {item.durationMinutes} min
                      </Text>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.swapEmptyContainer}>
                    <Text style={styles.swapEmptyText}>No sessions found</Text>
                    <Text style={styles.swapEmptySubtext}>Try adjusting your filters or search</Text>
                  </View>
                }
                contentContainerStyle={styles.swapListContent}
              />
            </View>
          </View>
        </Modal>

        {/* Push Workouts Modal */}
        <Modal
          visible={showPushModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPushModal(false)}
        >
          <View style={styles.pushModalOverlay}>
            <View style={styles.pushModalContent}>
              {/* Header */}
              <View style={styles.pushModalHeader}>
                <Text style={styles.pushModalTitle}>Push Missed Workouts</Text>
                <TouchableOpacity
                  onPress={() => setShowPushModal(false)}
                  style={styles.pushModalCloseButton}
                >
                  <Text style={styles.pushModalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Info */}
              <View style={styles.pushModalInfo}>
                <Text style={styles.pushModalInfoText}>
                  Found {getMissedSessions.length} missed workout(s). Select a target date to push them forward.
                </Text>
              </View>

              {/* Missed Sessions List */}
              <FlatList
                data={getMissedSessions}
                keyExtractor={(item) => item.sessionId}
                renderItem={({ item }) => (
                  <View style={styles.pushSessionCard}>
                    <Text style={styles.pushSessionTitle}>{item.title}</Text>
                    <Text style={styles.pushSessionDate}>
                      Missed on: {new Date(item.shouldHaveBeen).toLocaleDateString()}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={
                  <View style={styles.pushEmptyContainer}>
                    <Text style={styles.pushEmptyText}>No missed workouts</Text>
                  </View>
                }
                contentContainerStyle={styles.pushListContent}
              />

              {/* Target Date Selection */}
              <View style={styles.pushDateSection}>
                <Text style={styles.pushDateLabel}>Push to date:</Text>
                <TouchableOpacity
                  style={styles.pushDateButton}
                  onPress={() => {
                    // Use today's date as default, or allow date picker
                    const todayYMD = formatYMD(new Date());
                    executePushWorkouts(todayYMD);
                  }}
                >
                  <Text style={styles.pushDateButtonText}>Push to Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pushDateButton, styles.pushDateButtonSecondary]}
                  onPress={() => {
                    // Close push modal and open date picker with push flag
                    setShowPushModal(false);
                    setPendingPushDate('pending'); // Flag that we want to push after date selection
                    setPickerDate(new Date()); // Initialize picker to today
                    setShowPicker(true);
                  }}
                >
                  <Text style={[styles.pushDateButtonText, styles.pushDateButtonTextSecondary]}>
                    Choose Custom Date
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Recovery Workout Selection Modal */}
        <Modal
          visible={showRecoveryModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowRecoveryModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>No Session Scheduled</Text>
                <Text style={styles.modalSubtitle}>
                  {recoveryModalDate ? `Choose a recovery workout for ${recoveryModalDate}` : 'Choose a recovery workout'}
                </Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowRecoveryModal(false)}
                >
                  <Text style={styles.modalCloseButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={recoveryWorkoutsData.recoveryWorkouts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.recoveryWorkoutCard}
                    onPress={() => {
                      // Create a recovery session ID and navigate
                      const recoverySessionId = `recovery:${item.id}:${recoveryModalDate || formatYMD(new Date())}`;
                      setShowRecoveryModal(false);
                      navigation.navigate('Session', { sessionId: recoverySessionId });
                    }}
                  >
                    <View style={styles.recoveryWorkoutHeader}>
                      <Text style={styles.recoveryWorkoutTitle}>{item.title}</Text>
                      <Text style={styles.recoveryWorkoutDuration}>{item.durationMinutes} min</Text>
                    </View>
                    <Text style={styles.recoveryWorkoutDescription}>{item.description}</Text>
                    <View style={styles.recoveryWorkoutMeta}>
                      <View style={styles.recoveryWorkoutBadge}>
                        <Text style={styles.recoveryWorkoutBadgeText}>{item.intensity}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.recoveryWorkoutList}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>
        </Modal>

        {/* Other Actions */}
        <View style={styles.otherActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('My1RMs')}
          >
            <Text style={styles.actionButtonText}>💪 Go to My 1RMs</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.actionButton,
              selectedProgramId !== 'test' && styles.actionButtonSecondary
            ]}
            onPress={() => navigation.navigate('TestValidation')}
          >
            <Text style={[
              styles.actionButtonText,
              selectedProgramId !== 'test' && styles.actionButtonTextSecondary
            ]}>
              🧪 {selectedProgramId === 'test' ? 'Open Progression Test Validation' : 'View Progression Test Tools'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButtonSecondary}
            onPress={() => navigation.navigate('ThemeMockups')}
          >
            <Text style={styles.actionButtonTextSecondary}>
              🎨 View Theme Mockups
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Bottom spacing for scroll */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  scrollContent: { padding: 20 },
  
  // Program Selector Styles
  programSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: THEME.primary,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  programSelectorContent: {
    flex: 1,
  },
  programSelectorLabel: {
    fontSize: 11,
    color: THEME.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
    fontWeight: '600',
  },
  programSelectorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.primary,
  },
  programSelectorMeta: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 2,
  },
  programSelectorArrow: {
    fontSize: 14,
    color: THEME.primary,
    marginLeft: 8,
    fontWeight: '700',
  },

  // Today's Session Card
  todayCard: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  todayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  todayCardTitleContainer: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  todayCardLabel: {
    fontSize: 11,
    color: THEME.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    fontWeight: '600',
  },
  todayCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.primary,
    flexShrink: 1,
  },
  sessionTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexShrink: 0,
  },
  sessionTypeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  todayCardDetails: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  todayCardDetailItem: {
    flex: 1,
  },
  todayCardDetailLabel: {
    fontSize: 12,
    color: THEME.textMuted,
    marginBottom: 2,
  },
  todayCardDetailValue: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  todayCardInstructions: {
    backgroundColor: THEME.backgroundLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  instructionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.primary,
    marginBottom: 8,
  },
  instructionItem: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginBottom: 4,
  },
  todayCardActions: {
    gap: 10,
  },
  startButton: {
    backgroundColor: THEME.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    color: THEME.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: THEME.card,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.borderLight,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minHeight: 56,
  },
  quickActionButtonUndo: {
    backgroundColor: THEME.primaryFaded,
    borderColor: THEME.primary + '40',
  },
  quickActionIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  quickActionText: {
    color: THEME.textPrimary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  expandButton: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: THEME.borderLight,
  },
  expandButtonText: {
    color: THEME.secondary,
    fontSize: 13,
    fontWeight: '600',
  },

  // Start Date Button
  startDateButton: {
    backgroundColor: THEME.card,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: THEME.secondary,
  },
  startDateButtonText: {
    color: THEME.secondary,
    fontSize: 15,
    fontWeight: '700',
  },

  // Date Picker Modal
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  datePickerModalContent: {
    backgroundColor: THEME.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    minHeight: 300,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.borderLight,
    marginBottom: 10,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.primary,
  },
  datePickerCloseButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  datePickerCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.secondary,
  },
  datePickerContainer: {
    width: '100%',
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.card,
  },
  datePicker: {
    width: '100%',
    height: 220,
  },

  // Calendar Section
  calendarSection: {
    marginBottom: 20,
  },
  calendarSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.primary,
    marginBottom: 12,
  },
  weeklyCalendar: {
    paddingVertical: 8,
  },
  calendarDay: {
    width: DAY_WIDTH - 8,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginHorizontal: 4,
    backgroundColor: THEME.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  calendarDayToday: {
    backgroundColor: THEME.primaryFaded,
    borderColor: THEME.primary,
    borderWidth: 2,
  },
  calendarDaySelected: {
    backgroundColor: THEME.secondaryFaded,
    borderColor: THEME.secondary,
  },
  calendarDayName: {
    fontSize: 11,
    color: THEME.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  calendarDayNameToday: {
    color: THEME.primary,
  },
  calendarDayNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 6,
  },
  calendarDayNumberToday: {
    color: THEME.primary,
  },
  sessionIndicator: {
    width: '80%',
    height: 3,
    borderRadius: 2,
    marginBottom: 4,
  },
  completionOverlay: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: THEME.primary,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  completionText: {
    fontSize: 9,
    color: THEME.textOnPrimary,
    fontWeight: '700',
  },
  readinessBadge: {
    fontSize: 14,
    marginTop: 2,
  },

  // Full Calendar
  fullCalendarSection: {
    marginBottom: 20,
  },
  calendarToggleButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  calendarToggleIcon: {
    fontSize: 16,
    color: THEME.secondary,
    fontWeight: '700',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: THEME.borderLight,
    position: 'relative',
  },
  modalSubtitle: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginTop: 4,
  },
  modalContent: {
    backgroundColor: THEME.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    color: THEME.primary,
  },
  programOption: {
    backgroundColor: THEME.backgroundLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  programOptionSelected: {
    backgroundColor: THEME.primaryFaded,
    borderColor: THEME.primary,
  },
  programOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  programOptionTitleSelected: {
    color: THEME.primary,
  },
  programOptionDesc: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginBottom: 4,
  },
  programOptionWeeks: {
    fontSize: 12,
    color: THEME.textMuted,
    fontWeight: '500',
  },
  programOptionCheck: {
    position: 'absolute',
    top: 16,
    right: 16,
    fontSize: 18,
    color: THEME.primary,
    fontWeight: '700',
  },
  modalCloseButton: {
    backgroundColor: THEME.backgroundDark,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textSecondary,
  },

  // Swap Modal Styles
  swapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  swapModalContent: {
    backgroundColor: THEME.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  swapModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  swapModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.primary,
  },
  swapModalCloseButton: {
    padding: 8,
  },
  swapModalCloseText: {
    fontSize: 24,
    color: THEME.textSecondary,
    fontWeight: '300',
  },
  suggestedSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  suggestedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.primary,
    marginBottom: 12,
  },
  suggestedScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  suggestedCard: {
    backgroundColor: THEME.card,
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 2,
    minWidth: 180,
  },
  suggestedCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  suggestedCardMeta: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  swapFilters: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  swapSearchInput: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: THEME.textPrimary,
    marginBottom: 12,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  filterButtonActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  filterButtonTextActive: {
    color: THEME.textOnPrimary,
  },
  swapListContent: {
    padding: 20,
    paddingTop: 0,
  },
  swapSessionCard: {
    backgroundColor: THEME.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  swapSessionCardSuggested: {
    borderWidth: 2,
    borderColor: THEME.primary,
  },
  swapSessionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  swapSessionCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  swapSessionTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  swapSessionTypeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  swapSessionCardMeta: {
    fontSize: 14,
    color: THEME.textSecondary,
  },
  swapEmptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  swapEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textSecondary,
    marginBottom: 8,
  },
  swapEmptySubtext: {
    fontSize: 14,
    color: THEME.textMuted,
  },

  // Push Workouts Modal Styles
  pushModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pushModalContent: {
    backgroundColor: THEME.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  pushModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  pushModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.primary,
  },
  pushModalCloseButton: {
    padding: 8,
  },
  pushModalCloseText: {
    fontSize: 24,
    color: THEME.textSecondary,
    fontWeight: '300',
  },
  pushModalInfo: {
    padding: 20,
    backgroundColor: THEME.primaryFaded,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  pushModalInfoText: {
    fontSize: 14,
    color: THEME.textPrimary,
    lineHeight: 20,
  },
  pushListContent: {
    padding: 20,
    paddingTop: 0,
    maxHeight: 300,
  },
  pushSessionCard: {
    backgroundColor: THEME.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  pushSessionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  pushSessionDate: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  pushEmptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  pushEmptyText: {
    fontSize: 16,
    color: THEME.textMuted,
  },
  pushDateSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  pushDateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 12,
  },
  pushDateButton: {
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  pushDateButtonSecondary: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  pushDateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textOnPrimary,
  },
  pushDateButtonTextSecondary: {
    color: THEME.textPrimary,
  },

  // Other Actions
  otherActions: {
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: THEME.secondary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: THEME.card,
    borderWidth: 2,
    borderColor: THEME.accentMuted,
  },
  actionButtonText: {
    color: THEME.textOnSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: THEME.textSecondary,
  },
  
  // Recovery Modal Styles
  recoveryWorkoutList: {
    padding: 16,
  },
  recoveryWorkoutCard: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.borderLight,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recoveryWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recoveryWorkoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
    flex: 1,
  },
  recoveryWorkoutDuration: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.primary,
  },
  recoveryWorkoutDescription: {
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  recoveryWorkoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recoveryWorkoutBadge: {
    backgroundColor: THEME.secondary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  recoveryWorkoutBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.secondary,
  },
});
