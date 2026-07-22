import { create } from 'zustand';
import { EventState } from './types';

export const useEventStore = create<EventState>((set) => ({
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
}));