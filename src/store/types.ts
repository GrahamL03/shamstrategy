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

export type ThemePreset = AppTheme;

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

  // Section 1: Team & Event Profile Configuration
  teamNumber: string;
  teamName: string;
  eventName: string;
  tbaApiKey: string;
  teamLogo: string | null;

  // System Diagnostics
  systemStatus: SystemStatus;

  // Global Lists
  teams: TeamPitData[];
  schedule: ScheduleMatch[];

  // Navigation Actions
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

  // Section 1 Profile Setters
  setTeamNumber: (teamNumber: string) => void;
  setTeamName: (teamName: string) => void;
  setEventName: (eventName: string) => void;
  setTbaApiKey: (tbaApiKey: string) => void;
  setTeamLogo: (teamLogo: string | null) => void;
}

// ============================================================================
// 2. SCOUT DATA STORE (`useScoutStore`)
// ============================================================================

export interface ScoutState {
  standRecords: StandScoutRecord[];
  pitRecords: Record<number, TeamPitData>;
  scoutUsers: ScoutUser[];
  shiftAssignments: ShiftAssignment[];
  conflicts: ConflictRecord[];
  syncLogs: SyncLogEntry[];

  addStandRecord: (record: StandScoutRecord) => void;
  bulkAddStandRecords: (records: StandScoutRecord[]) => void;
  upsertPitRecord: (record: TeamPitData) => void;
  setScoutUsers: (users: ScoutUser[]) => void;
  addScoutUser: (user: string | Omit<ScoutUser, 'id'>) => void;
  toggleScoutActive: (id: string) => void;
  setShiftAssignments: (shifts: ShiftAssignment[]) => void;
  updateShiftAssignment: (shift: ShiftAssignment) => void;
  addConflict: (conflict: ConflictRecord) => void;
  resolveConflict: (conflictId: string, chosenRecord?: StandScoutRecord) => void;
  addSyncLog: (log: SyncLogEntry) => void;
}

// ============================================================================
// 3. PREDICTOR & STRATEGY STORE (`usePredictorStore`)
// ============================================================================

export interface PredictorState {
  redAllianceTeams: [number, number, number];
  blueAllianceTeams: [number, number, number];
  modelWeights: ModelWeights;
  simulatedRobotStates: Record<number, SimulatedRobotState>;
  activePrediction: MatchPredictionResult | null;

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
  groups: PicklistGroup[];
  activeGroupId: string | null;
  dnpTeamNumbers: number[];
  globalWeights: PicklistWeights;

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
  provider: 'ollama' | 'llamacpp';
  model: string;
  isProcessing: boolean;

  setProvider: (provider: 'ollama' | 'llamacpp') => void;
  setModel: (model: string) => void;
  setIsProcessing: (isProcessing: boolean) => void;
}