-- ============================================================================
-- ShamStrategy Node E - Database Schema DDL
-- Team: FRC 5907 CC Shambots
-- ============================================================================

CREATE TABLE IF NOT EXISTS scout_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scoutCode TEXT NOT NULL UNIQUE,
  assignedSlot TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,
  totalScoutedMatches INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
  teamNumber INTEGER PRIMARY KEY,
  teamName TEXT NOT NULL,
  drivetrainType TEXT,
  swerveMotorType TEXT,
  robotWeightLbs REAL,
  frameWidthInches REAL,
  frameLengthInches REAL,
  intakeTypes TEXT,
  maxCoralCapacity INTEGER DEFAULT 0,
  maxAlgaeCapacity INTEGER DEFAULT 0,
  climberType TEXT,
  canClimbShallow INTEGER DEFAULT 0,
  canClimbDeep INTEGER DEFAULT 0,
  autonStartPositions TEXT,
  pitNotes TEXT,
  photoPaths TEXT,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stand_scout_records (
  id TEXT PRIMARY KEY,
  matchNumber INTEGER NOT NULL,
  teamNumber INTEGER NOT NULL,
  scoutId TEXT NOT NULL,
  scoutSlot TEXT NOT NULL,
  
  -- Auto Phase
  autoTaxi INTEGER DEFAULT 0,
  autoCoralL1 INTEGER DEFAULT 0,
  autoCoralL2 INTEGER DEFAULT 0,
  autoCoralL3 INTEGER DEFAULT 0,
  autoCoralL4 INTEGER DEFAULT 0,
  autoAlgaeRemoved INTEGER DEFAULT 0,
  autoAlgaeScoredNet INTEGER DEFAULT 0,
  autoAlgaeScoredProcessor INTEGER DEFAULT 0,

  -- TeleOp Phase
  teleopCoralL1 INTEGER DEFAULT 0,
  teleopCoralL2 INTEGER DEFAULT 0,
  teleopCoralL3 INTEGER DEFAULT 0,
  teleopCoralL4 INTEGER DEFAULT 0,
  teleopAlgaeRemoved INTEGER DEFAULT 0,
  teleopAlgaeScoredNet INTEGER DEFAULT 0,
  teleopAlgaeScoredProcessor INTEGER DEFAULT 0,
  defenseRating INTEGER DEFAULT 0,

  -- Endgame Phase
  bargeParked INTEGER DEFAULT 0,
  shallowClimb INTEGER DEFAULT 0,
  deepClimb INTEGER DEFAULT 0,
  climbFailed INTEGER DEFAULT 0,

  -- Post-Match
  foulsCommitted INTEGER DEFAULT 0,
  driverSkillRating INTEGER DEFAULT 0,
  diedOrTipped INTEGER DEFAULT 0,
  notes TEXT,
  rawPayload TEXT,

  timestamp TEXT NOT NULL,
  FOREIGN KEY (scoutId) REFERENCES scout_users(id) ON DELETE SET NULL,
  FOREIGN KEY (teamNumber) REFERENCES teams(teamNumber) ON DELETE CASCADE,
  UNIQUE(matchNumber, teamNumber, scoutId)
);

CREATE TABLE IF NOT EXISTS qualitative_tags (
  id TEXT PRIMARY KEY,
  teamNumber INTEGER NOT NULL,
  tag TEXT NOT NULL,
  createdByName TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (teamNumber) REFERENCES teams(teamNumber) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schedule_matches (
  matchNumber INTEGER PRIMARY KEY,
  eventKey TEXT NOT NULL,
  red1 INTEGER NOT NULL,
  red2 INTEGER NOT NULL,
  red3 INTEGER NOT NULL,
  blue1 INTEGER NOT NULL,
  blue2 INTEGER NOT NULL,
  blue3 INTEGER NOT NULL,
  redScore INTEGER,
  blueScore INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled',
  scoutedSlots TEXT
);

CREATE TABLE IF NOT EXISTS shift_assignments (
  id TEXT PRIMARY KEY,
  scoutId TEXT NOT NULL,
  assignedSlot TEXT NOT NULL,
  startMatch INTEGER NOT NULL,
  endMatch INTEGER NOT NULL,
  FOREIGN KEY (scoutId) REFERENCES scout_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS picklist_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  weightsJson TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS picklist_items (
  id TEXT PRIMARY KEY,
  groupId TEXT NOT NULL,
  teamNumber INTEGER NOT NULL,
  rankOrder INTEGER NOT NULL,
  isDnp INTEGER NOT NULL DEFAULT 0,
  dnpReason TEXT,
  isPicked INTEGER NOT NULL DEFAULT 0,
  pickedByAlliance TEXT,
  notes TEXT,
  FOREIGN KEY (groupId) REFERENCES picklist_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (teamNumber) REFERENCES teams(teamNumber) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  recordsImported INTEGER NOT NULL,
  conflictsDetected INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conflicts (
  id TEXT PRIMARY KEY,
  matchNumber INTEGER NOT NULL,
  teamNumber INTEGER NOT NULL,
  slot TEXT NOT NULL,
  recordA TEXT NOT NULL,
  recordB TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stand_scout_match_team ON stand_scout_records(matchNumber, teamNumber);
CREATE INDEX IF NOT EXISTS idx_qualitative_tags_team ON qualitative_tags(teamNumber);
CREATE INDEX IF NOT EXISTS idx_picklist_items_group_rank ON picklist_items(groupId, rankOrder);
CREATE INDEX IF NOT EXISTS idx_conflicts_match_team ON conflicts(matchNumber, teamNumber);