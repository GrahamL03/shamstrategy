/**
 * ShamStrategy - Central Type Definitions Engine
 * Application: ShamStrategy (Node E Desktop App)
 * Team: FRC 5907 CC Shambots
 *
 * Single Source of Truth for Database Schemas, Zustand Stores, and Data Ingestion Contracts.
 */

// ============================================================================
// 1. SYSTEM & NAVIGATION TYPES
// ============================================================================

export type AppTab =
  | 'dashboard'     // Tab 1: Alt + 1
  | 'directory'     // Tab 2: Alt + 2
  | 'schedule'      // Tab 3: Alt + 3
  | 'predictor'     // Tab 4: Alt + 4
  | 'whiteboard'    // Tab 5: Alt + 5
  | 'cheatsheet'    // Tab 6: Alt + 6
  | 'picklist'      // Tab 7: Alt + 7
  | 'ai_assistant'  // Tab 8: Alt + 8
  | 'sync_hub'      // Tab 9: Alt + 9
  | 'settings';     // Tab 10: Alt + 0

export type AppTheme =
  | 'shambasic'
  | 'autonomous'
  | 'teleop'
  | 'endgame'
  | 'queuing'
  | 'blue_alliance'
  | 'red_alliance'
  | 'einstein';

export interface SystemStatus {
  sqliteWalActive: boolean;
  databaseSizeBytes: number;
  usbConnected: boolean;
  usbPath: string | null;
  activeEventKey: string;
  dataCompletenessPercentage: number;
  totalMatchesLoaded: number;
  totalMatchesExpected: number;
}

// ============================================================================
// 2. PIT SCOUTING & TEAM DIRECTORY TYPES (Node C Ingestion)
// ============================================================================

export type DrivetrainType = 'Swerve' | 'Tank' | 'Mecanum' | 'Other';
export type SwerveMotorType = 'Kraken' | 'Falcon' | 'NEO' | 'CIM' | 'Other';
export type SwerveRatio = 'L1' | 'L2' | 'L3' | 'L4' | 'Custom';
export type IntakeSource = 'Ground' | 'Coral Station' | 'Both' | 'None';
export type AlgaeRemovalMethod = 'Active Claw' | 'Rollers' | 'Popper' | 'None';
export type CoralHeightLimit = 'L1' | 'L2' | 'L3' | 'L4';
export type AlgaeTargetLimit = 'Processor' | 'Net' | 'Both' | 'Neither';
export type ClimberCapability = 'Park Only' | 'Shallow Cage' | 'Deep Cage';
export type ClimbMechanismType = 'Winch' | 'Elevator' | 'Pneumatic' | 'Arm' | 'None';
export type StartingPosition = 'Left' | 'Center' | 'Right' | 'Multiple';

export interface TeamPitData {
  teamNumber: number;
  teamName: string;
  drivetrainType: DrivetrainType;
  swerveMotor: SwerveMotorType;
  gearRatio: SwerveRatio;
  weightLbs: number;
  frameWidthInches: number;
  frameLengthInches: number;
  coralIntake: IntakeSource;
  algaeRemoval: AlgaeRemovalMethod;
  maxCoralHeight: CoralHeightLimit;
  maxAlgaeTarget: AlgaeTargetLimit;
  climberCapability: ClimberCapability;
  climbMechanism: ClimbMechanismType;
  preferredAutonStart: StartingPosition;
  bestAutonDescription: string;
  pitNotes: string;
  primaryPhotoPath?: string;
  additionalPhotoPaths: string[];
  lastUpdated: string; // ISO Timestamp
}

export interface QualitativeTag {
  id: string;
  teamNumber: number;
  matchNumber?: number;
  tag: string; // e.g., "#FastIntake", "#FragileArm", "#BrownoutProne"
  createdAt: string;
}

// ============================================================================
// 3. MATCH SCOUTING & PERFORMANCE TYPES (Node A Ingestion)
// ============================================================================

export type AllianceColor = 'Red' | 'Blue';
export type DriverStationSlot = 1 | 2 | 3;
export type HumanPlayerPreference = 'Coral Station Ground' | 'Direct Feed' | 'Both' | 'Neither';
export type ClimbResult = 'None' | 'Parked' | 'Shallow Cage Climb' | 'Deep Cage Climb';
export type ClimbSpeed = 'N/A' | 'Fast [<5s]' | 'Medium [5–10s]' | 'Slow [>10s]' | 'Failed';
export type HardwareStatus = 'No' | 'Minor Lag' | 'Completely Dead';

export interface StandScoutRecord {
  id?: number; // Auto-assigned by SQLite
  matchNumber: number;
  teamNumber: number;
  scoutName: string;
  alliance: AllianceColor;
  slot: DriverStationSlot;
  noShow: boolean;

  // Autonomous Phase (15 Seconds)
  autoTaxi: boolean;
  autoCoralL1: number;
  autoCoralL2: number;
  autoCoralL3: number;
  autoCoralL4: number;
  autoAlgaeRemoved: number;
  autoAlgaeProcessor: number;
  autoAlgaeNet: number;
  autoMisses: number;

  // TeleOp Phase (2 Minutes 15 Seconds)
  teleopCoralL1: number;
  teleopCoralL2: number;
  teleopCoralL3: number;
  teleopCoralL4: number;
  teleopAlgaeRemoved: number;
  teleopAlgaeProcessor: number;
  teleopAlgaeNet: number;
  hpSourcePreference: HumanPlayerPreference;
  facedDefense: boolean;
  playedDefense: boolean;
  defenseRating: number; // 1 to 5 scale

  // Endgame Phase
  bargeResult: ClimbResult;
  climbSpeed: ClimbSpeed;
  climbedWithPartner: boolean;

  // Post-Match Assessment
  driverSkillRating: number; // 1 to 5 scale
  mechanicalFailure: HardwareStatus;
  tippedOver: boolean;
  yellowCard: boolean;
  redCard: boolean;
  foulCount: number;
  quickTags: string[];
  freeTextNotes: string;
  
  // Metadata
  rawPipePayload?: string;
  scoutedAt: string; // ISO Timestamp
}

export interface MatchAnomaly {
  id: string;
  matchNumber: number;
  teamNumber: number;
  type: 'Brownout' | 'Tipped' | 'Zero Scores' | 'Card Incurred' | 'Scout Variance';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

// ============================================================================
// 4. MATCH OPERATIONS & SCOUT SHIFT SCHEDULER
// ============================================================================

export type MatchStatus = 'Upcoming' | 'In Progress' | 'Scouted' | 'Missing Data';

export interface ScheduleMatch {
  matchNumber: number;
  red1: number;
  red2: number;
  red3: number;
  blue1: number;
  blue2: number;
  blue3: number;
  redScore?: number;
  blueScore?: number;
  status: MatchStatus;
  scoutedSlots: {
    red1: boolean;
    red2: boolean;
    red3: boolean;
    blue1: boolean;
    blue2: boolean;
    blue3: boolean;
  };
}

export interface ScoutUser {
  id: string;
  name: string;
  active: boolean;
  totalScouted: number;
}

export interface ShiftAssignment {
  matchNumber: number;
  red1Scout: string;
  red2Scout: string;
  red3Scout: string;
  blue1Scout: string;
  blue2Scout: string;
  blue3Scout: string;
}

// ============================================================================
// 5. MATCH PREDICTOR & ALLIANCE SIMULATION
// ============================================================================

export interface ModelWeights {
  autoWeight: number;      // 0.0 to 1.0
  teleopWeight: number;    // 0.0 to 1.0
  defenseWeight: number;   // 0.0 to 1.0
  endgameWeight: number;   // 0.0 to 1.0
  consistencyWeight: number; // 0.0 to 1.0
}

export interface SimulatedRobotState {
  teamNumber: number;
  assignedRole: 'L4 Specialist' | 'Mid-Reef' | 'Algae Cleaner' | 'Dedicated Defense' | 'Feeder';
  targetDefenseOpponent?: number;
  simulatedHardwareFailure: boolean;
  simulatedClimbFailure: boolean;
}

export interface MatchPredictionResult {
  redProjectedScore: number;
  redConfidenceMargin: number;
  blueProjectedScore: number;
  blueConfidenceMargin: number;
  redWinProbability: number; // 0 to 100
  blueWinProbability: number; // 0 to 100
  coopertitionProjected: boolean;
  synergyWarnings: string[];
  bottleneckWarnings: string[];
}

// ============================================================================
// 6. PLAYOFF PICKLIST & DRAFT ROOM
// ============================================================================

export interface PicklistWeights {
  teleopCycles: number;
  autoPoints: number;
  driverRating: number;
  climbReliability: number;
  defenseImpact: number;
}

export interface PicklistItem {
  teamNumber: number;
  customRank: number;
  tier: number;
  picked: boolean;
  pickedByAlliance?: string;
  dnp: boolean;
  dnpReason?: string;
  notes?: string;
}

export interface PicklistGroup {
  id: string;
  name: string; // e.g. "1st Pick Captains", "2nd Pick Defense/Feeders"
  weights: PicklistWeights;
  items: PicklistItem[];
}

// ============================================================================
// 7. LOCAL AI ("FRANK") & PROMPT STRUCTURES
// ============================================================================

export type LLMBackend = 'Ollama' | 'Llama.cpp' | 'RuleEngineFallback';

export interface AISettings {
  backend: LLMBackend;
  modelName: string; // e.g., "llama3:8b-instruct-q4_K_M"
  gpuAcceleration: boolean;
  contextLimitTokens: number;
  apiEndpoint: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'frank';
  text: string;
  timestamp: string;
  dataSourcesReferenced?: string[];
  latencyMs?: number;
  tokensPerSecond?: number;
}

// ============================================================================
// 8. DATA SYNC & CONFLICT RESOLUTION
// ============================================================================

export interface ConflictRecord {
  id: string;
  matchNumber: number;
  teamNumber: number;
  slot: string;
  recordA: StandScoutRecord;
  recordB: StandScoutRecord;
  createdAt: string;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  source: 'USB' | 'QR Scanner' | 'File Drop' | 'Manual';
  recordsImported: number;
  photosImported: number;
  errorsEncountered: number;
  details: string;
}