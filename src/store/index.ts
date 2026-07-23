import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { EventState, ScoutState, AIState } from './types';
import { ScoutUser } from '../types'; // 👈 Add this line

// ============================================================================
// 1. EVENT & NAVIGATION STORE (`useEventStore`)
// ============================================================================
export const useEventStore = create<EventState>()(
  persist(
    (set) => ({
      activeTab: 'dashboard',
      activeTheme: 'shambasic',
      activeEventKey: '2026mifor',
      selectedTeamNumber: null,
      selectedMatchNumber: null,
      systemStatus: {
        sqliteWalActive: true,
        databaseSizeBytes: 10485760,
        usbConnected: true,
        usbPath: '/media/usb0',
        activeEventKey: '2026mifor',
        dataCompletenessPercentage: 84,
        totalMatchesLoaded: 42,
        totalMatchesExpected: 60,
      },
      teams: [],
      schedule: [],

      // Section 1 Profile Defaults
      teamNumber: '5907',
      teamName: 'CC Shambots',
      eventName: 'FRC District Milford Event',
      tbaApiKey: '',
      teamLogo: null,

      // Standard Actions
      setActiveTab: (tab) => set({ activeTab: tab }),
      setActiveTheme: (theme) => set({ activeTheme: theme }),
      setActiveEventKey: (eventKey) => set({ activeEventKey: eventKey }),
      setSelectedTeamNumber: (teamNumber) => set({ selectedTeamNumber: teamNumber }),
      setSelectedMatchNumber: (matchNumber) => set({ selectedMatchNumber: matchNumber }),
      updateSystemStatus: (status) =>
        set((state) => ({ systemStatus: { ...state.systemStatus, ...status } })),
      setTeams: (teams) => set({ teams }),
      setSchedule: (schedule) => set({ schedule }),
      updateScheduleMatchStatus: (matchNumber, status, scoutedSlots) =>
        set((state) => ({
          schedule: state.schedule.map((m) =>
            m.matchNumber === matchNumber
              ? {
                ...m,
                status,
                scoutedSlots: scoutedSlots ? { ...m.scoutedSlots, ...scoutedSlots } : m.scoutedSlots,
              }
              : m
          ),
        })),

      // Section 1 Setters
      setTeamNumber: (teamNumber) => set({ teamNumber }),
      setTeamName: (teamName) => set({ teamName }),
      setEventName: (eventName) => set({ eventName }),
      setTbaApiKey: (tbaApiKey) => set({ tbaApiKey }),
      setTeamLogo: (teamLogo) => set({ teamLogo }),
    }),
    {
      name: 'shamstrategy-event-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeTheme: state.activeTheme,
        activeEventKey: state.activeEventKey,
        teamNumber: state.teamNumber,
        teamName: state.teamName,
        eventName: state.eventName,
        tbaApiKey: state.tbaApiKey,
        teamLogo: state.teamLogo,
      }),
    }
  )
);

// ============================================================================
// 2. SCOUT DATA STORE (`useScoutStore`)
// ============================================================================
export const useScoutStore = create<ScoutState>()(
  persist(
    (set) => ({
      standRecords: [],
      pitRecords: {},
      scoutUsers: [],
      shiftAssignments: [],
      conflicts: [],
      syncLogs: [],

      addStandRecord: (record) =>
        set((state) => ({ standRecords: [...state.standRecords, record] })),
      bulkAddStandRecords: (records) =>
        set((state) => ({ standRecords: [...state.standRecords, ...records] })),
      upsertPitRecord: (record) =>
        set((state) => ({
          pitRecords: { ...state.pitRecords, [record.teamNumber]: record },
        })),
      setScoutUsers: (users) => set({ scoutUsers: users }),
      addScoutUser: (userPayload) =>
        set((state) => {
          // If it's a string, use it directly. If it's an object, extract name/active with fallbacks.
          const { name = '', active = true, ...rest } =
            typeof userPayload === 'string' ? { name: userPayload } : userPayload;

          const newUser: ScoutUser = {
            id: Date.now().toString(),
            name,
            active,
            ...rest,
          } as ScoutUser;

          return { scoutUsers: [...state.scoutUsers, newUser] };
        }),
      toggleScoutActive: (id) =>
        set((state) => ({
          scoutUsers: state.scoutUsers.map((u) =>
            u.id === id ? { ...u, active: !u.active } : u
          ),
        })),
      setShiftAssignments: (shifts) => set({ shiftAssignments: shifts }),
      updateShiftAssignment: (shift) =>
        set((state) => ({
          shiftAssignments: state.shiftAssignments.map((s) =>
            s.matchNumber === shift.matchNumber ? shift : s
          ),
        })),
      addConflict: (conflict) =>
        set((state) => ({ conflicts: [...state.conflicts, conflict] })),
      resolveConflict: (conflictId) =>
        set((state) => ({
          conflicts: state.conflicts.filter((c) => c.id !== conflictId),
        })),
      addSyncLog: (log) =>
        set((state) => ({ syncLogs: [log, ...state.syncLogs] })),
    }),
    {
      name: 'shamstrategy-scout-data',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ============================================================================
// 3. LOCAL AI ENGINE STORE (`useAIStore`)
// ============================================================================
export const useAIStore = create<AIState>((set) => ({
  provider: 'ollama',
  model: 'llama3:8b-instruct-q4_K_M',
  isProcessing: false,

  setProvider: (provider) => set({ provider }),
  setModel: (model) => set({ model }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
}));