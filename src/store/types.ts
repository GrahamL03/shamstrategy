/**
 * ShamStrategy - Zustand Store Signatures
 * Application: ShamStrategy (Node E Desktop App)
 * Team: FRC 5907 CC Shambots
 *
 * Defines state models and actions for all Zustand global stores.
 */

import {
  AppTab,
  AppTheme,
  SystemStatus,
  TeamPitData,
  StandScoutRecord,
  ScheduleMatch,
  ShiftAssignment,
  ScoutUser,
  ModelWeights,
  SimulatedRobotState,
  MatchPredictionResult,
  PicklistGroup,
  PicklistItem,
  PicklistWeights,
  AISettings,
  ChatMessage,
  ConflictRecord,
  SyncLogEntry,
} from '../types';

// ============================================================================
// 1. EVENT & NAVIGATION STORE (`useEventStore`)
// ============================================================================

export interface EventState {
  // Navigation & Active Context
  activeTab: AppTab;
  activeTheme: AppTheme;
  activeEventKey: string;
  selectedTeamNumber: number | null;
  selectedMatchNumber: number | null;

  // System Diagnostics
  systemStatus: SystemStatus;

  // Global Lists
  teams: TeamPitData[];
  schedule: ScheduleMatch[];

  // Actions
  setActiveTab: (tab: AppTab) => void;
  setActiveTheme: (theme: AppTheme) => void;
  setActiveEventKey: (eventKey: string) => void;
  setSelectedTeamNumber: (teamNumber: number | null) => void;
  setSelectedMatchNumber: (matchNumber: number | null) => void;
  updateSystemStatus: (status: Partial<SystemStatus>) => void;
  setTeams: (teams: TeamPitData[]) => void;
  setSchedule: (schedule: ScheduleMatch[]) => void;
  updateScheduleMatchStatus: (
    matchNumber: number,
    status: ScheduleMatch['status'],
    scoutedSlots?: ScheduleMatch['scoutedSlots']
  ) => void;
}

// ============================================================================
// 2. SCOUT DATA STORE (`useScoutStore`)
// ============================================================================

export interface ScoutState {
  // Ingested Data
  standRecords: StandScoutRecord[];
  pitRecords: Record<number, TeamPitData>; // Indexed by teamNumber

  // Scout Management & Shift Operations
  scoutUsers: ScoutUser[];
  shiftAssignments: ShiftAssignment[];

  // Data Ingestion & Conflict Queue
  conflicts: ConflictRecord[];
  syncLogs: SyncLogEntry[];

  // Actions
  addStandRecord: (record: StandScoutRecord) => void;
  bulkAddStandRecords: (records: StandScoutRecord[]) => void;
  upsertPitRecord: (record: TeamPitData) => void;
  
  // Scout Shift Actions
  setScoutUsers: (users: ScoutUser[]) => void;
  addScoutUser: (name: string) => void;
  toggleScoutActive: (id: string) => void;
  setShiftAssignments: (shifts: ShiftAssignment[]) => void;
  updateShiftAssignment: (shift: ShiftAssignment) => void;

  // Conflict & Log Actions
  addConflict: (conflict: ConflictRecord) => void;
  resolveConflict: (conflictId: string, chosenRecord: StandScoutRecord) => void;
  addSyncLog: (log: SyncLogEntry) => void;
}

// ============================================================================
// 3. PREDICTOR & STRATEGY STORE (`usePredictorStore`)
// ============================================================================

export interface PredictorState {
  // Active Matchup Context
  redAllianceTeams: [number, number, number];
  blueAllianceTeams: [number, number, number];

  // Custom Weighting Sliders
  modelWeights: ModelWeights;

  // Scenario Sandbox Simulations
  simulatedRobotStates: Record<number, SimulatedRobotState>; // Indexed by teamNumber

  // Computed Output
  activePrediction: MatchPredictionResult | null;

  // Actions
  setRedAlliance: (teams: [number, number, number]) => void;
  setBlueAlliance: (teams: [number, number, number]) => void;
  setModelWeights: (weights: Partial<ModelWeights>) => void;
  updateSimulatedRobotState: (
    teamNumber: number,
    state: Partial<SimulatedRobotState>
  ) => void;
  resetSimulations: () => void;
  setPredictionResult: (result: MatchPredictionResult) => void;
}

// ============================================================================
// 4. PICKLIST STORE (`usePicklistStore`)
// ============================================================================

export interface PicklistState {
  // Groups and Custom Ranking Lists
  groups: PicklistGroup[];
  activeGroupId: string | null;

  // Global DNP Locks
  dnpTeamNumbers: number[];

  // Dynamic Draft Room Weights
  globalWeights: PicklistWeights;

  // Actions
  setGroups: (groups: PicklistGroup[]) => void;
  setActiveGroup: (groupId: string) => void;
  reorderPicklistItems: (groupId: string, items: PicklistItem[]) => void;
  toggleTeamPicked: (
    groupId: string,
    teamNumber: number,
    alliance?: string
  ) => void;
  toggleTeamDNP: (teamNumber: number, reason?: string) => void;
  updateGlobalWeights: (weights: Partial<PicklistWeights>) => void;
  createPicklistGroup: (name: string, weights: PicklistWeights) => void;
}

// ============================================================================
// 5. LOCAL AI ("FRANK") STORE (`useAIStore`)
// ============================================================================

export interface AIState {
  // Config & State
  settings: AISettings;
  isGenerating: boolean;
  connected: boolean;

  // Chat Log
  messages: ChatMessage[];

  // Actions
  updateSettings: (settings: Partial<AISettings>) => void;
  addMessage: (message: ChatMessage) => void;
  setIsGenerating: (generating: boolean) => void;
  setConnected: (connected: boolean) => void;
  clearChat: () => void;
}