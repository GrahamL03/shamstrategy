-- ============================================================================
-- ShamStrategy Node E - Database Schema DDL
-- Team: FRC 5907 CC Shambots
-- Database: shamstrategy.db (SQLite)
-- Note: Do NOT include PRAGMA statements in this file.
-- ============================================================================

-- 1. SCOUT USERS (Roster & Activity Tracking)
CREATE TABLE IF NOT EXISTS scout_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scoutCode TEXT NOT NULL UNIQUE,
  assignedSlot TEXT, -- e.g. 'Red 1', 'Blue 3'
  isActive INTEGER NOT NULL DEFAULT 1,
  totalScoutedMatches INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);

-- 2. TEAMS (Pit Scouting Specs & Aggregates)
CREATE TABLE IF NOT EXISTS teams (
  teamNumber INTEGER PRIMARY KEY,
  teamName TEXT NOT NULL,
  drivetrainType TEXT, -- 'Swerve', 'Tank', etc.
  swerveMotorType TEXT,
  robotWeightLbs REAL,
  frameWidthInches REAL,
  frameLengthInches REAL,
  intakeTypes TEXT, -- JSON array string
  maxCoralCapacity INTEGER DEFAULT 0,
  maxAlgaeCapacity INTEGER DEFAULT 0,
  climberType TEXT,
  canClimbShallow INTEGER DEFAULT 0,
  canClimbDeep INTEGER DEFAULT 0,
  autonStartPositions TEXT, -- JSON array string
  pitNotes TEXT,
  photoPaths TEXT, -- JSON array string of photo paths
  updatedAt TEXT NOT NULL
);

-- 3. STAND SCOUT RECORDS (Match Scouting Payload)
CREATE TABLE IF NOT EXISTS stand_scout_records (
  id TEXT PRIMARY KEY,
  matchNumber INTEGER NOT NULL,
  teamNumber INTEGER NOT NULL,
  scoutId TEXT NOT NULL,
  scoutSlot TEXT NOT NULL, -- 'Red 1', 'Red 2', 'Red 3', 'Blue 1', 'Blue 2', 'Blue 3'
  
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
  defenseRating INTEGER DEFAULT 0, -- 1 to 5 scale

  -- Endgame Phase
  bargeParked INTEGER DEFAULT 0,
  shallowClimb INTEGER DEFAULT 0,
  deepClimb INTEGER DEFAULT 0,
  climbFailed INTEGER DEFAULT 0,

  -- Post-Match / Subjective
  foulsCommitted INTEGER DEFAULT 0,
  driverSkillRating INTEGER DEFAULT 0, -- 1 to 5 scale
  diedOrTipped INTEGER DEFAULT 0,
  notes TEXT,
  rawPayload TEXT, -- Raw JSON backup

  timestamp TEXT NOT NULL,
  FOREIGN KEY (scoutId) REFERENCES scout_users(id) ON DELETE SET NULL,
  FOREIGN KEY (teamNumber) REFERENCES teams(teamNumber) ON DELETE CASCADE,
  
  -- Prevent duplicate entries from the same scout for the same team in a match
  UNIQUE(matchNumber, teamNumber, scoutId)
);

-- 4. QUALITATIVE TAGS (Quick Strategy Tags)
CREATE TABLE IF NOT EXISTS qualitative_tags (
  id TEXT PRIMARY KEY,
  teamNumber INTEGER NOT NULL,
  tag TEXT NOT NULL, -- e.g. 'Tipper', 'Fast Intake', 'Defense Beast'
  createdByName TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (teamNumber) REFERENCES teams(teamNumber) ON DELETE CASCADE
);

-- 5. SCHEDULE MATCHES (Event Schedule & Status)
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
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed'
  scoutedSlots TEXT -- JSON object string tracking slot scout statuses
);

-- 6. SHIFT ASSIGNMENTS (Scout Slot Rotation)
CREATE TABLE IF NOT EXISTS shift_assignments (
  id TEXT PRIMARY KEY,
  scoutId TEXT NOT NULL,
  assignedSlot TEXT NOT NULL,
  startMatch INTEGER NOT NULL,
  endMatch INTEGER NOT NULL,
  FOREIGN KEY (scoutId) REFERENCES scout_users(id) ON DELETE CASCADE
);

-- 7. PICKLIST GROUPS (Alliance Selection Tiers)
CREATE TABLE IF NOT EXISTS picklist_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  weightsJson TEXT NOT NULL, -- JSON weights object
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- 8. PICKLIST ITEMS (Ranked Teams per Group)
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

-- 9. SYNC LOGS & AUDIT TRAILS
CREATE TABLE IF NOT EXISTS sync_logs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL, -- 'USB', 'QR', 'CSV', 'Manual'
  recordsImported INTEGER NOT NULL,
  conflictsDetected INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL, -- 'success', 'partial', 'failed'
  timestamp TEXT NOT NULL
);

-- 10. CONFLICT RECORDS (For Tab 9 Data Resolution)
CREATE TABLE IF NOT EXISTS conflicts (
  id TEXT PRIMARY KEY,
  matchNumber INTEGER NOT NULL,
  teamNumber INTEGER NOT NULL,
  slot TEXT NOT NULL,
  recordA TEXT NOT NULL, -- JSON string of StandScoutRecord A
  recordB TEXT NOT NULL, -- JSON string of StandScoutRecord B
  createdAt TEXT NOT NULL
);

-- ============================================================================
-- QUERY OPTIMIZATION INDEXES
-- ============================================================================

-- Fast lookup for team performance across matches
CREATE INDEX IF NOT EXISTS idx_stand_scout_match_team 
ON stand_scout_records(matchNumber, teamNumber);

-- Fast lookup for qualitative tags per team
CREATE INDEX IF NOT EXISTS idx_qualitative_tags_team 
ON qualitative_tags(teamNumber);

-- Fast lookup for picklist items in active group
CREATE INDEX IF NOT EXISTS idx_picklist_items_group_rank 
ON picklist_items(groupId, rankOrder);

-- Fast lookup for pending conflicts
CREATE INDEX IF NOT EXISTS idx_conflicts_match_team 
ON conflicts(matchNumber, teamNumber);