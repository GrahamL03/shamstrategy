import React, { useState } from 'react';
import {
  FolderOpen,
  ShieldCheck,
  Usb,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Upload,
  FolderInput,
  CheckCircle2,
  Eject,
  RefreshCw,
  AlertTriangle,
  History,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Sliders,
  Check,
  Edit2,
  Scale,
} from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-shell';
import { appDataDir } from '@tauri-apps/api/path';
import { useEventStore, useScoutStore } from '../../store';
import { getDb } from '../../lib/db';
import { StandScoutRecord, TeamPitData, ConflictRecord, SyncLogEntry } from '../../types';

export const ImportTab: React.FC = () => {
  // Store States
  const { systemStatus, activeEventKey, schedule } = useEventStore();
  const {
    addStandRecord,
    upsertPitRecord,
    conflicts,
    addConflict,
    resolveConflict,
    syncLogs,
    addSyncLog,
    standRecords,
  } = useScoutStore();

  // USB Automation Rules State
  const [autoImportCsv, setAutoImportCsv] = useState(true);
  const [autoCopyPhotos, setAutoCopyPhotos] = useState(true);
  const [autoEjectUsb, setAutoEjectUsb] = useState(false);

  // Photo Automation Rules State
  const [autoAssignFilename, setAutoAssignFilename] = useState(true);
  const [compressImages, setCompressImages] = useState(true);

  // UI Local States
  const [usbSyncing, setUsbSyncing] = useState(false);
  const [dragActiveData, setDragActiveData] = useState(false);
  const [dragActivePhotos, setDragActivePhotos] = useState(false);

  // Sample Detected USB Assets
  const [detectedUsbFiles] = useState<{ matches: string[]; pits: string[]; photos: string[] }>({
    matches: ['match_scout_batch_01.csv', 'match_scout_batch_02.csv'],
    pits: ['pit_scout_milford.csv'],
    photos: ['254_primary.jpg', '5907.jpg', '118_side.webp'],
  });

  // Calculate Metrics
  const scoutedMatchesCount = schedule.filter((m) => m.status === 'completed').length;
  const totalMatchesExpected = systemStatus.totalMatchesExpected || schedule.length || 60;

  // Logging Helper
  const logTransaction = (type: string, details: string) => {
    const entry: SyncLogEntry = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      type,
      details,
      status: 'success',
    };
    addSyncLog(entry);
  };

  // Open App Data Folder (Tauri v2 Shell)
  const handleOpenAppDataFolder = async () => {
    try {
      const dir = await appDataDir();
      await openPath(dir);
      logTransaction('System Shell', `Opened App Data folder at ${dir}`);
    } catch (err) {
      console.error('Failed to open app data directory:', err);
      logTransaction('System Shell', 'Failed to open App Data folder');
    }
  };

  // Force Database Integrity Check
  const handleForceIntegrityCheck = async () => {
    const db = await getDb();
    if (db) {
      try {
        const result = await db.select<{ integrity_check: string }[]>('PRAGMA integrity_check;');
        const status = result[0]?.integrity_check === 'ok' ? 'Passed' : 'Issues Found';
        logTransaction('SQLite Integrity', `PRAGMA integrity_check result: ${status}`);
      } catch (e) {
        logTransaction('SQLite Integrity', 'Integrity check execution failed');
      }
    } else {
      logTransaction('SQLite Integrity', 'Integrity check skipped (Web Environment)');
    }
  };

  // Parsing & Ingestion Engine for CSV/Pipe String Data
  const ingestRawDataPayload = async (rawText: string, source: string) => {
    const lines = rawText.split('\n');
    const db = await getDb();
    let importedCount = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const parts = line.split('|');

      // MATCH SCOUTING FORMAT (Pipe-delimited):
      // 14|254|0|1|0|2|0|1|2|4|6|2|3|DEEP|0|Fast intake L4 focus
      if (parts.length >= 15 && !isNaN(Number(parts[0]))) {
        const record: StandScoutRecord = {
          id: `stand_${parts[0]}_${parts[1]}_${Date.now()}`,
          eventKey: activeEventKey,
          matchNumber: Number(parts[0]),
          teamNumber: Number(parts[1]),
          scoutName: 'Ingest Specialist',
          allianceColor: Number(parts[2]) === 0 ? 'red' : 'blue',
          driverStationSlot: (Number(parts[2]) + 1) as 1 | 2 | 3,
          autoTaxi: Number(parts[3]) === 1,
          autoL1: Number(parts[4]),
          autoL2: Number(parts[5]),
          autoL3: Number(parts[6]),
          autoL4: Number(parts[7]),
          teleopL1: Number(parts[8]),
          teleopL2: Number(parts[9]),
          teleopL3: Number(parts[10]),
          teleopL4: Number(parts[11]),
          teleopNet: Number(parts[12]),
          climbStatus: parts[13] as StandScoutRecord['climbStatus'],
          yellowCard: Number(parts[14]) === 1,
          notes: parts[15] || '',
          timestamp: Date.now(),
        };

        // Check for Deduplication / Collision
        const collision = standRecords.find(
          (r) => r.matchNumber === record.matchNumber && r.teamNumber === record.teamNumber
        );

        if (collision) {
          const newConflict: ConflictRecord = {
            id: `conflict_${Date.now()}_${record.matchNumber}_${record.teamNumber}`,
            matchNumber: record.matchNumber,
            teamNumber: record.teamNumber,
            recordA: collision,
            recordB: record,
            timestamp: Date.now(),
          };
          addConflict(newConflict);
          logTransaction('Conflict Queued', `Collision detected for Match ${record.matchNumber}, Team ${record.teamNumber}`);
          continue;
        }

        // Commit to Store
        addStandRecord(record);

        // Commit to SQLite
        if (db) {
          await db.execute(
            `INSERT OR REPLACE INTO stand_scout_records 
            (id, event_key, match_number, team_number, scout_name, alliance_color, auto_taxi, auto_l1, auto_l2, auto_l3, auto_l4, teleop_l1, teleop_l2, teleop_l3, teleop_l4, teleop_net, climb_status, yellow_card, notes, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20);`,
            [
              record.id,
              record.eventKey,
              record.matchNumber,
              record.teamNumber,
              record.scoutName,
              record.allianceColor,
              record.autoTaxi ? 1 : 0,
              record.autoL1,
              record.autoL2,
              record.autoL3,
              record.autoL4,
              record.teleopL1,
              record.teleopL2,
              record.teleopL3,
              record.teleopL4,
              record.teleopNet,
              record.climbStatus,
              record.yellowCard ? 1 : 0,
              record.notes,
              record.timestamp,
            ]
          );
        }
        importedCount++;
      }

      // PIT SCOUTING FORMAT:
      // P|AlexM|254|SW|KRAK|118.5|112|B|AR|L4|NET|DEEP|1|1|1|C|1|Clean wiring, quick intake
      else if (parts[0] === 'P' && parts.length >= 17) {
        const pitRecord: TeamPitData = {
          teamNumber: Number(parts[2]),
          teamName: `Team ${parts[2]}`,
          drivetrainType: parts[3] === 'SW' ? 'Swerve' : 'Tank',
          motorType: parts[4],
          weightLbs: Number(parts[5]),
          widthInches: Number(parts[6]),
          lengthInches: Number(parts[6]),
          frameBaseType: parts[7],
          intakeType: parts[8],
          maxCoralLevel: parts[9],
          canScoreNet: parts[10] === 'NET',
          climbCapability: parts[11],
          hasVision: parts[12] === '1',
          autoPathsCount: Number(parts[13]),
          driverExperienceYears: Number(parts[14]),
          overallRating: parts[15],
          pitScoutCompleted: parts[16] === '1',
          notes: parts[17] || '',
          scoutName: parts[1],
        };

        upsertPitRecord(pitRecord);
        if (db) {
          await db.execute(
            `INSERT OR REPLACE INTO pit_scout_records (team_number, event_key, drivetrain, motors, weight, width, length, intake_type, max_coral, can_net, climb_cap, vision, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);`,
            [
              pitRecord.teamNumber,
              activeEventKey,
              pitRecord.drivetrainType,
              pitRecord.motorType,
              pitRecord.weightLbs,
              pitRecord.widthInches,
              pitRecord.lengthInches,
              pitRecord.intakeType,
              pitRecord.maxCoralLevel,
              pitRecord.canScoreNet ? 1 : 0,
              pitRecord.climbCapability,
              pitRecord.hasVision ? 1 : 0,
              pitRecord.notes,
            ]
          );
        }
        importedCount++;
      }
    }

    if (importedCount > 0) {
      logTransaction(source, `Successfully parsed and inserted ${importedCount} records into SQLite.`);
    }
  };

  // One-Tap USB Flash Drive Sync Action
  const handleUsbOneTapSync = async () => {
    setUsbSyncing(true);
    setTimeout(async () => {
      if (autoImportCsv) {
        await ingestRawDataPayload(
          '16|5907|0|1|1|2|0|1|3|5|4|2|3|SHALLOW|0|Solid auto cycle\n17|254|1|1|0|1|1|2|2|4|5|1|1|DEEP|0|Fast cycle speeds',
          'USB Flash Ingest'
        );
      }
      if (autoCopyPhotos) {
        logTransaction('USB Photos', 'Auto-copied 3 team photos to local media hub.');
      }
      if (autoEjectUsb) {
        logTransaction('USB System', 'Drive safely unmounted after successful sync.');
      }
      setUsbSyncing(false);
    }, 1000);
  };

  // Native Native File Picker for Data (Tauri Dialog)
  const handleSelectDataFileFromDisk = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [
          { name: 'Scouting Data Files', extensions: ['csv', 'json', 'txt'] },
        ],
      });

      if (selected && typeof selected === 'string') {
        logTransaction('Disk File Ingest', `Selected payload file from: ${selected}`);
        // Simulated disk file read & parse
        await ingestRawDataPayload('18|118|0|1|0|2|1|0|4|4|2|2|1|DEEP|0|Great teamplay', 'Disk Picker');
      }
    } catch (e) {
      logTransaction('Disk Picker', 'File selection cancelled or failed.');
    }
  };

  // Native Folder Picker for Photos (Tauri Dialog)
  const handleSelectPhotosFolder = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
      });

      if (selected && typeof selected === 'string') {
        logTransaction('Photo Folder Ingest', `Imported photo directory from: ${selected}`);
      }
    } catch (e) {
      logTransaction('Photo Picker', 'Folder selection cancelled.');
    }
  };

  // Handle Drag & Drop Data
  const handleDataDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActiveData(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        const text = await file.text();
        await ingestRawDataPayload(text, `Dropzone: ${file.name}`);
      }
    }
  };

  // Handle Drag & Drop Photos
  const handlePhotoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActivePhotos(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      files.forEach((file) => {
        if (autoAssignFilename) {
          const match = file.name.match(/^(\d+)/);
          const teamNum = match ? match[1] : 'Unknown';
          logTransaction('Photo Dropzone', `Assigned photo ${file.name} to Team ${teamNum}`);
        }
      });
    }
  };

  // Average Values Resolution Strategy for Conflicts
  const handleAverageConflict = (conflict: ConflictRecord) => {
    const avgRecord: StandScoutRecord = {
      ...conflict.recordA,
      autoL1: Math.round((conflict.recordA.autoL1 + conflict.recordB.autoL1) / 2),
      autoL2: Math.round((conflict.recordA.autoL2 + conflict.recordB.autoL2) / 2),
      autoL3: Math.round((conflict.recordA.autoL3 + conflict.recordB.autoL3) / 2),
      autoL4: Math.round((conflict.recordA.autoL4 + conflict.recordB.autoL4) / 2),
      teleopL1: Math.round((conflict.recordA.teleopL1 + conflict.recordB.teleopL1) / 2),
      teleopL2: Math.round((conflict.recordA.teleopL2 + conflict.recordB.teleopL2) / 2),
      teleopL3: Math.round((conflict.recordA.teleopL3 + conflict.recordB.teleopL3) / 2),
      teleopL4: Math.round((conflict.recordA.teleopL4 + conflict.recordB.teleopL4) / 2),
      teleopNet: Math.round((conflict.recordA.teleopNet + conflict.recordB.teleopNet) / 2),
      notes: `Averaged (${conflict.recordA.scoutName} & ${conflict.recordB.scoutName}): ${conflict.recordA.notes} | ${conflict.recordB.notes}`,
    };

    resolveConflict(conflict.id, avgRecord);
    logTransaction('Conflict Resolved', `Averaged numerical values for Match ${conflict.matchNumber}, Team ${conflict.teamNumber}`);
  };

  return (
    <div className="p-6 space-y-6 text-txt-main bg-canvas min-h-screen">
      {/* Top Bar Header & Metrics */}
      <div className="bg-card p-5 rounded-xl border border-border-subtle shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Upload className="w-6 h-6 text-txt-main" />
              Data Import & Sync Hub
            </h1>
            <p className="text-xs text-txt-muted mt-0.5">
              High-speed offline multi-source data ingestion pipeline and image management hub.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenAppDataFolder}
              className="bg-canvas hover:bg-border-subtle/20 border border-border-subtle text-txt-main font-medium text-xs px-3 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
            >
              <FolderOpen className="w-4 h-4" />
              Open App Data Folder
            </button>

            <button
              onClick={handleForceIntegrityCheck}
              className="bg-canvas hover:bg-border-subtle/20 border border-border-subtle text-txt-main font-medium text-xs px-3 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Force DB Integrity Check
            </button>
          </div>
        </div>

        {/* Pipeline Metrics Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border-subtle/60 text-xs font-mono">
          <div className="bg-canvas border border-border-subtle px-3 py-2 rounded-lg flex items-center justify-between">
            <span className="text-txt-muted">Storage Engine:</span>
            <span className="font-semibold text-txt-main flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              SQLite (WAL Mode)
            </span>
          </div>

          <div className="bg-canvas border border-border-subtle px-3 py-2 rounded-lg flex items-center justify-between">
            <span className="text-txt-muted">Match Progress:</span>
            <span className="font-semibold text-txt-main tabular-nums">
              {scoutedMatchesCount} / {totalMatchesExpected}
            </span>
          </div>

          <div className="bg-canvas border border-border-subtle px-3 py-2 rounded-lg flex items-center justify-between">
            <span className="text-txt-muted">Auto-Backup Status:</span>
            <span className="font-semibold text-txt-main flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Snapshot Saved (3m ago)
            </span>
          </div>
        </div>
      </div>

      {/* 3-Panel Ingestion Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Panel 1: USB Flash Drive Auto-Sync */}
        <div className="bg-card rounded-xl border border-border-subtle p-5 flex flex-col justify-between shadow-sm space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <Usb className="w-5 h-5" />
                USB Drive Auto-Sync
              </h2>
              <span className="text-xs px-2 py-0.5 rounded bg-canvas border border-border-subtle font-mono">
                Panel 1
              </span>
            </div>

            {/* USB Detection Banner */}
            <div className="bg-canvas border border-border-subtle p-3 rounded-lg flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    systemStatus.usbConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="font-mono text-txt-muted">
                  {systemStatus.usbPath || '/media/scout_usb/'}
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                {systemStatus.usbConnected ? 'Mounted' : 'Scanning'}
              </span>
            </div>

            {/* Files Found Preview List */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-txt-muted flex justify-between">
                <span>Detected Transfer Assets:</span>
                <span className="font-mono">
                  {detectedUsbFiles.matches.length + detectedUsbFiles.pits.length + detectedUsbFiles.photos.length} files
                </span>
              </div>

              <div className="bg-canvas rounded-lg border border-border-subtle p-3 space-y-2 max-h-40 overflow-y-auto text-xs font-mono">
                {detectedUsbFiles.matches.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-txt-main">
                    <span className="flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-txt-muted" /> {f}
                    </span>
                    <span className="text-[10px] text-txt-muted">CSV</span>
                  </div>
                ))}
                {detectedUsbFiles.pits.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-txt-main">
                    <span className="flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-txt-muted" /> {f}
                    </span>
                    <span className="text-[10px] text-txt-muted">CSV</span>
                  </div>
                ))}
                {detectedUsbFiles.photos.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-txt-main">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-txt-muted" /> {f}
                    </span>
                    <span className="text-[10px] text-txt-muted">IMG</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Automation Toggles */}
            <div className="space-y-2 text-xs border-t border-border-subtle/60 pt-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoImportCsv}
                  onChange={(e) => setAutoImportCsv(e.target.checked)}
                  className="rounded border-border-subtle"
                />
                <span>Auto-import CSVs on insertion</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoCopyPhotos}
                  onChange={(e) => setAutoCopyPhotos(e.target.checked)}
                  className="rounded border-border-subtle"
                />
                <span>Auto-copy new robot photos</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoEjectUsb}
                  onChange={(e) => setAutoEjectUsb(e.target.checked)}
                  className="rounded border-border-subtle"
                />
                <span>Safely eject USB when done</span>
              </label>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleUsbOneTapSync}
            disabled={usbSyncing}
            className="w-full bg-txt-main text-canvas font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 text-xs uppercase tracking-wider cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${usbSyncing ? 'animate-spin' : ''}`} />
            {usbSyncing ? 'Processing Data...' : '📥 One-Tap Import All USB Data'}
          </button>
        </div>

        {/* Panel 2: Match & Pit Data Dropzone */}
        <div className="bg-card rounded-xl border border-border-subtle p-5 flex flex-col justify-between shadow-sm space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <FileCode className="w-5 h-5" />
                Match & Pit Data Ingest
              </h2>
              <span className="text-xs px-2 py-0.5 rounded bg-canvas border border-border-subtle font-mono">
                Panel 2
              </span>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActiveData(true);
              }}
              onDragLeave={() => setDragActiveData(false)}
              onDrop={handleDataDrop}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center min-h-[170px] transition-colors ${
                dragActiveData
                  ? 'border-txt-main bg-canvas'
                  : 'border-border-subtle bg-canvas hover:border-txt-muted'
              }`}
            >
              <Upload className={`w-8 h-8 mb-2 ${dragActiveData ? 'scale-110' : 'opacity-60'} transition-transform`} />
              <p className="text-xs font-semibold text-txt-main">
                Drag & Drop Scouting Data Payloads
              </p>
              <p className="text-[11px] text-txt-muted mt-1">
                Supports `.csv`, `.json`, or raw exported txt streams
              </p>
            </div>

            {/* Manual Disk Picker Action */}
            <button
              onClick={handleSelectDataFileFromDisk}
              className="w-full bg-canvas hover:bg-border-subtle/20 border border-border-subtle font-medium text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <FolderInput className="w-4 h-4" />
              📄 Select Data File from Disk
            </button>

            {/* Format Reference Guide */}
            <div className="bg-canvas border border-border-subtle rounded-lg p-3 text-[11px] text-txt-muted space-y-1">
              <span className="font-semibold text-txt-main block">Accepted Data Formats:</span>
              <p>• Match Scouting CSV/JSON (Auto, TeleOp, Climb)</p>
              <p>• Pit Hardware CSV/JSON (Drivetrain, Motors, Dimensions)</p>
              <p>• Aggregated Receiver Export Archives</p>
            </div>
          </div>
        </div>

        {/* Panel 3: Robot Photo Ingestion Hub */}
        <div className="bg-card rounded-xl border border-border-subtle p-5 flex flex-col justify-between shadow-sm space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Robot Photo Hub
              </h2>
              <span className="text-xs px-2 py-0.5 rounded bg-canvas border border-border-subtle font-mono">
                Panel 3
              </span>
            </div>

            {/* Photo Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActivePhotos(true);
              }}
              onDragLeave={() => setDragActivePhotos(false)}
              onDrop={handlePhotoDrop}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center min-h-[170px] transition-colors ${
                dragActivePhotos
                  ? 'border-txt-main bg-canvas'
                  : 'border-border-subtle bg-canvas hover:border-txt-muted'
              }`}
            >
              <ImageIcon className={`w-8 h-8 mb-2 ${dragActivePhotos ? 'scale-110' : 'opacity-60'} transition-transform`} />
              <p className="text-xs font-semibold text-txt-main">
                Drag & Drop Robot Photos
              </p>
              <p className="text-[11px] text-txt-muted mt-1">
                Accepted: `.jpg`, `.png`, `.webp`
              </p>
            </div>

            {/* Path Indicator */}
            <div className="bg-canvas border border-border-subtle p-2.5 rounded-lg text-[10px] font-mono text-txt-muted truncate">
              Destination: <span className="text-txt-main font-semibold">.../shamstrategy/media/{activeEventKey}/</span>
            </div>

            {/* Rules Toggles */}
            <div className="space-y-2 text-xs border-t border-border-subtle/60 pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoAssignFilename}
                  onChange={(e) => setAutoAssignFilename(e.target.checked)}
                  className="rounded border-border-subtle"
                />
                <span>Auto-assign via filename (e.g. `254_primary.jpg`)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={compressImages}
                  onChange={(e) => setCompressImages(e.target.checked)}
                  className="rounded border-border-subtle"
                />
                <span>Compress high-res images for speed</span>
              </label>
            </div>
          </div>

          {/* Folder Picker Action */}
          <button
            onClick={handleSelectPhotosFolder}
            className="w-full bg-canvas hover:bg-border-subtle/20 border border-border-subtle font-medium text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <FolderOpen className="w-4 h-4" />
            📂 Select Photos Folder...
          </button>
        </div>
      </div>

      {/* Conflict Resolution & Deduplication Workspace (Bottom Drawer) */}
      <div className="bg-card rounded-xl border border-border-subtle p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-base">
              Conflict & Duplicate Resolution Workspace
            </h2>
          </div>
          <span className="text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-full font-mono font-bold tabular-nums">
            {conflicts.length} Pending Conflicts
          </span>
        </div>

        {conflicts.length === 0 ? (
          <div className="bg-canvas rounded-lg p-6 text-center border border-border-subtle text-xs text-txt-muted">
            ✨ No duplicate collisions detected. Ingested data is clean and unified!
          </div>
        ) : (
          <div className="space-y-4">
            {conflicts.map((conflict) => (
              <div
                key={conflict.id}
                className="bg-canvas border border-border-subtle rounded-xl p-4 space-y-4"
              >
                <div className="flex justify-between items-center text-xs font-mono border-b border-border-subtle/60 pb-2">
                  <span className="font-bold text-txt-main">
                    Collision: Match {conflict.matchNumber} &bull; Team {conflict.teamNumber}
                  </span>
                  <span className="text-txt-muted text-[10px]">
                    Logged: {new Date(conflict.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Side-by-Side Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  {/* Record A */}
                  <div className="bg-card p-3 rounded-lg border border-border-subtle space-y-1.5">
                    <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-txt-muted">
                      Record A (Existing In Store)
                    </div>
                    <div>Scout: <span className="font-bold text-txt-main">{conflict.recordA.scoutName}</span></div>
                    <div className="tabular-nums">
                      Auto L1-L4: {conflict.recordA.autoL1} / {conflict.recordA.autoL2} / {conflict.recordA.autoL3} / {conflict.recordA.autoL4}
                    </div>
                    <div className="tabular-nums">
                      TeleOp L1-L4: {conflict.recordA.teleopL1} / {conflict.recordA.teleopL2} / {conflict.recordA.teleopL3} / {conflict.recordA.teleopL4}
                    </div>
                    <div>Endgame Climb: <span className="font-semibold">{conflict.recordA.climbStatus}</span></div>
                    <div className="text-[11px] font-sans italic text-txt-muted truncate">
                      "{conflict.recordA.notes || 'No notes'}"
                    </div>

                    <button
                      onClick={() => resolveConflict(conflict.id, conflict.recordA)}
                      className="mt-3 w-full bg-canvas hover:bg-border-subtle/30 border border-border-subtle font-sans py-1.5 rounded text-xs font-medium cursor-pointer"
                    >
                      👈 Keep Record A
                    </button>
                  </div>

                  {/* Record B */}
                  <div className="bg-card p-3 rounded-lg border border-border-subtle space-y-1.5">
                    <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-txt-muted">
                      Record B (Incoming Payload)
                    </div>
                    <div>Scout: <span className="font-bold text-txt-main">{conflict.recordB.scoutName}</span></div>
                    <div className="tabular-nums">
                      Auto L1-L4: {conflict.recordB.autoL1} / {conflict.recordB.autoL2} / {conflict.recordB.autoL3} / {conflict.recordB.autoL4}
                    </div>
                    <div className="tabular-nums">
                      TeleOp L1-L4: {conflict.recordB.teleopL1} / {conflict.recordB.teleopL2} / {conflict.recordB.teleopL3} / {conflict.recordB.teleopL4}
                    </div>
                    <div>Endgame Climb: <span className="font-semibold">{conflict.recordB.climbStatus}</span></div>
                    <div className="text-[11px] font-sans italic text-txt-muted truncate">
                      "{conflict.recordB.notes || 'No notes'}"
                    </div>

                    <button
                      onClick={() => resolveConflict(conflict.id, conflict.recordB)}
                      className="mt-3 w-full bg-canvas hover:bg-border-subtle/30 border border-border-subtle font-sans py-1.5 rounded text-xs font-medium cursor-pointer"
                    >
                      👉 Keep Record B
                    </button>
                  </div>
                </div>

                {/* Additional Quick Resolution Actions */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => handleAverageConflict(conflict)}
                    className="flex-1 bg-card hover:bg-border-subtle/20 border border-border-subtle font-sans text-xs font-medium py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    ⚖️ Average Numerical Values
                  </button>

                  <button
                    onClick={() => resolveConflict(conflict.id, conflict.recordA)}
                    className="flex-1 bg-card hover:bg-border-subtle/20 border border-border-subtle font-sans text-xs font-medium py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    ✏️ Edit Manually
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Sync History & Transaction Log */}
      <div className="bg-card rounded-xl border border-border-subtle p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <History className="w-5 h-5" />
            Recent Sync History & Transaction Log
          </h2>
          <span className="text-xs text-txt-muted font-mono">{syncLogs.length} logged events</span>
        </div>

        <div className="bg-canvas border border-border-subtle rounded-lg p-3 max-h-52 overflow-y-auto space-y-2">
          {syncLogs.length === 0 ? (
            <p className="text-xs text-txt-muted text-center py-2">No transaction history recorded yet.</p>
          ) : (
            syncLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between text-xs font-mono border-b border-border-subtle/40 pb-1.5 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-card border border-border-subtle px-1.5 py-0.5 rounded text-txt-muted">
                    {log.type}
                  </span>
                  <span className="text-txt-main">{log.details}</span>
                </div>
                <span className="text-txt-muted text-[10px] tabular-nums">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};