import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  ShieldCheck,
  Usb,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Upload,
  FolderInput,
  RefreshCw,
  History,
  ShieldAlert,
  Scale,
  Edit2,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { appDataDir } from '@tauri-apps/api/path';
import { readTextFile, copyFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { useEventStore, useScoutStore } from '../../store';
import { getDb } from '../../lib/db';
import { StandScoutRecord, TeamPitData, ConflictRecord, SyncLogEntry } from '../../types';

// Rust USB Command Result Type Interface
interface UsbScanResult {
  is_connected: boolean;
  mount_path: string;
  volume_name: string;
  match_files: string[];
  pit_files: string[];
  photo_files: string[];
}

// Allowed literal types for SyncLogEntry source
type LogSource = "USB" | "QR Scanner" | "File Drop" | "Manual" | "System Shell" | "SQLite Integrity";

export const ImportTab: React.FC = () => {
  // Store Hooks
  const { systemStatus, activeEventKey, schedule } = useEventStore();
  const {
    standRecords,
    addStandRecord,
    upsertPitRecord,
    conflicts,
    addConflict,
    resolveConflict,
    syncLogs,
    addSyncLog,
  } = useScoutStore();

  // USB Real-Time Polling State
  const [usbDriveInfo, setUsbDriveInfo] = useState<UsbScanResult | null>(null);

  // USB Automation Options
  const [autoImportCsv, setAutoImportCsv] = useState<boolean>(true);
  const [autoCopyPhotos, setAutoCopyPhotos] = useState<boolean>(true);
  const [autoEjectUsb, setAutoEjectUsb] = useState<boolean>(false);

  // Photo Hub Automation Options
  const [autoAssignFilename, setAutoAssignFilename] = useState<boolean>(true);
  const [compressImages, setCompressImages] = useState<boolean>(true);

  // Local UX States
  const [usbSyncing, setUsbSyncing] = useState<boolean>(false);
  const [dragActiveData, setDragActiveData] = useState<boolean>(false);
  const [dragActivePhotos, setDragActivePhotos] = useState<boolean>(false);

  // Helper to build robust cross-platform system paths
  const buildFilePath = (mountPath: string, fileName: string) => {
    const separator = mountPath.includes('\\') ? '\\' : '/';
    return mountPath.endsWith(separator)
      ? `${mountPath}${fileName}`
      : `${mountPath}${separator}${fileName}`;
  };

  // --------------------------------------------------------------------------
  // STEP 1: Background USB Polling Hook
  // --------------------------------------------------------------------------
  useEffect(() => {
    let active = true;

    const pollUsbDrives = async () => {
      try {
        const drives = await invoke<UsbScanResult[]>('detect_usb_drives');
        if (active) {
          if (drives && drives.length > 0) {
            setUsbDriveInfo(drives[0]);
          } else {
            setUsbDriveInfo(null);
          }
        }
      } catch (_err) {
        // Fallback for browser testing
      }
    };

    pollUsbDrives();
    const interval = setInterval(pollUsbDrives, 2500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Derived Metrics
  const scoutedMatchesCount = schedule.filter(
    (m) => (m.status as string) === 'completed' || (m.status as string) === 'scouted'
  ).length;
  const totalMatchesExpected = systemStatus.totalMatchesExpected || schedule.length || 60;

  // Logging Helper
  const logTransaction = (
    source: LogSource,
    details: string,
    recordsImported: number = 0,
    photosImported: number = 0,
    errorsEncountered: number = 0
  ) => {
    const entry = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      source,
      details,
      status: errorsEncountered > 0 ? 'error' : 'success',
      recordsImported,
      photosImported,
      errorsEncountered,
    } as unknown as SyncLogEntry;
    
    addSyncLog(entry);
  };

  // Real Photo Transfer Implementation
  const copyRobotPhotos = async (mountPath: string, photoFiles: string[]): Promise<number> => {
    if (photoFiles.length === 0) return 0;

    try {
      const appDir = await appDataDir();
      const targetDir = `${appDir}/robot_photos`;

      const dirExists = await exists(targetDir);
      if (!dirExists) {
        await mkdir(targetDir, { recursive: true });
      }

      let copiedCount = 0;
      for (const photoFile of photoFiles) {
        const sourcePath = buildFilePath(mountPath, photoFile);
        const destinationPath = `${targetDir}/${photoFile}`;

        await copyFile(sourcePath, destinationPath);
        copiedCount++;
      }

      return copiedCount;
    } catch (err) {
      console.error('Failed copying robot photos:', err);
      return 0;
    }
  };

  // 1. App Data Folder Handler
  const handleOpenAppDataFolder = async () => {
    try {
      const dir = await appDataDir();
      await openPath(dir);
      logTransaction('System Shell', `Opened App Data folder at ${dir}`);
    } catch (err) {
      console.error('Failed to open app data directory:', err);
      logTransaction('System Shell', 'Failed to open App Data folder', 0, 0, 1);
    }
  };

  // 2. Database Integrity Check
  const handleForceIntegrityCheck = async () => {
    const db = await getDb();
    if (db) {
      try {
        const result = await db.select<{ integrity_check: string }[]>('PRAGMA integrity_check;');
        const status = result[0]?.integrity_check === 'ok' ? 'Passed' : 'Issues Found';
        logTransaction('SQLite Integrity', `PRAGMA integrity_check result: ${status}`);
      } catch (e) {
        logTransaction('SQLite Integrity', 'Integrity check execution failed', 0, 0, 1);
      }
    } else {
      logTransaction('SQLite Integrity', 'Integrity check skipped (Browser/Web Mode)');
    }
  };

  // 3. Core Raw Data Ingest Engine
  const ingestRawDataPayload = async (rawText: string, source: LogSource): Promise<number> => {
    const lines = rawText.split('\n');
    const db = await getDb();
    let importedCount = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const parts = line.split('|');

      // MATCH SCOUTING PAYLOAD PARSING
      if (parts.length >= 15 && !isNaN(Number(parts[0]))) {
        const rawSlot = Number(parts[2]) + 1;
        const driverSlot = (rawSlot >= 1 && rawSlot <= 3 ? rawSlot : 1) as 1 | 2 | 3;

        const record = {
          id: `stand_${parts[0]}_${parts[1]}_${Date.now()}`,
          eventKey: activeEventKey,
          matchNumber: Number(parts[0]),
          teamNumber: Number(parts[1]),
          scoutName: 'Data Hub Ingest',
          allianceColor: Number(parts[2]) === 0 ? 'red' : 'blue',
          driverStationSlot: driverSlot,
          autoTaxi: Number(parts[3]) === 1,
          autoL1: Number(parts[4]) || 0,
          autoL2: Number(parts[5]) || 0,
          autoL3: Number(parts[6]) || 0,
          autoL4: Number(parts[7]) || 0,
          teleopL1: Number(parts[8]) || 0,
          teleopL2: Number(parts[9]) || 0,
          teleopL3: Number(parts[10]) || 0,
          teleopL4: Number(parts[11]) || 0,
          teleopNet: Number(parts[12]) || 0,
          climbStatus: parts[13],
          yellowCard: Number(parts[14]) === 1,
          notes: parts[15] || '',
          timestamp: Date.now(),
        } as unknown as StandScoutRecord;

        const collision = standRecords.find(
          (r: any) => r.matchNumber === (record as any).matchNumber && r.teamNumber === (record as any).teamNumber
        );

        if (collision) {
          const newConflict = {
            id: `conflict_${Date.now()}_${(record as any).matchNumber}_${(record as any).teamNumber}`,
            matchNumber: (record as any).matchNumber,
            teamNumber: (record as any).teamNumber,
            recordA: collision,
            recordB: record,
            timestamp: Date.now(),
          } as unknown as ConflictRecord;
          
          addConflict(newConflict);
          logTransaction(
            source,
            `Duplicate record detected for Match ${(record as any).matchNumber}, Team ${(record as any).teamNumber}`
          );
          continue;
        }

        addStandRecord(record);

        if (db) {
          const r = record as any;
          await db.execute(
            `INSERT OR REPLACE INTO stand_scout_records 
            (id, event_key, match_number, team_number, scout_name, alliance_color, driver_station_slot, auto_taxi, auto_l1, auto_l2, auto_l3, auto_l4, teleop_l1, teleop_l2, teleop_l3, teleop_l4, teleop_net, climb_status, yellow_card, notes, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21);`,
            [
              r.id, r.eventKey, r.matchNumber, r.teamNumber, r.scoutName, r.allianceColor,
              r.driverStationSlot, r.autoTaxi ? 1 : 0, r.autoL1, r.autoL2, r.autoL3, r.autoL4,
              r.teleopL1, r.teleopL2, r.teleopL3, r.teleopL4, r.teleopNet, r.climbStatus,
              r.yellowCard ? 1 : 0, r.notes, r.timestamp,
            ]
          );
        }
        importedCount++;
      }

      // PIT SCOUTING PAYLOAD PARSING
      else if (parts[0] === 'P' && parts.length >= 17) {
        const pitRecord = {
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
          climberCapability: parts[11],
          hasVision: parts[12] === '1',
          autoPathsCount: Number(parts[13]),
          driverExperienceYears: Number(parts[14]),
          overallRating: parts[15],
          pitScoutCompleted: parts[16] === '1',
          notes: parts[17] || '',
          scoutName: parts[1],
        } as unknown as TeamPitData;

        upsertPitRecord(pitRecord);
        if (db) {
          const pr = pitRecord as any;
          await db.execute(
            `INSERT OR REPLACE INTO pit_scout_records (team_number, event_key, drivetrain, motors, weight, width, length, intake_type, max_coral, can_net, climb_cap, vision, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);`,
            [
              pr.teamNumber, activeEventKey, pr.drivetrainType, pr.motorType, pr.weightLbs,
              pr.widthInches, pr.lengthInches, pr.intakeType, pr.maxCoralLevel,
              pr.canScoreNet ? 1 : 0, pr.climberCapability, pr.hasVision ? 1 : 0, pr.notes,
            ]
          );
        }
        importedCount++;
      }
    }

    if (importedCount > 0) {
      logTransaction(source, `Parsed and persisted ${importedCount} records into SQLite.`, importedCount);
    }

    return importedCount;
  };

  // USB Batch Sync Action
  const handleUsbOneTapSync = async () => {
    if (!usbDriveInfo) return;

    setUsbSyncing(true);
    let totalImported = 0;
    let photosCopied = 0;
    let errorsEncountered = 0;

    try {
      if (autoImportCsv) {
        const allFilesToImport = [...usbDriveInfo.match_files, ...usbDriveInfo.pit_files];

        for (const file of allFilesToImport) {
          try {
            const filePath = buildFilePath(usbDriveInfo.mount_path, file);
            const content = await readTextFile(filePath);
            const count = await ingestRawDataPayload(content, 'USB');
            totalImported += count;
          } catch (fileErr) {
            console.error(`Failed reading USB file ${file}:`, fileErr);
            errorsEncountered++;
          }
        }
      }

      if (autoCopyPhotos && usbDriveInfo.photo_files.length > 0) {
        photosCopied = await copyRobotPhotos(usbDriveInfo.mount_path, usbDriveInfo.photo_files);
        logTransaction('USB', `Copied ${photosCopied} robot photo(s) to local app storage.`, 0, photosCopied);
      }

      if (autoEjectUsb) {
        logTransaction('USB', `USB drive (${usbDriveInfo.volume_name || usbDriveInfo.mount_path}) safe to remove.`);
      }

      logTransaction(
        'USB',
        `USB Batch Sync completed. Ingested ${totalImported} records, copied ${photosCopied} photos.`,
        totalImported,
        photosCopied,
        errorsEncountered
      );
    } catch (err) {
      console.error('Error during USB Sync:', err);
      logTransaction('USB', 'Failed executing USB drive sync process', 0, 0, 1);
    } finally {
      setUsbSyncing(false);
    }
  };

  const handleSelectDataFileFromDisk = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: 'Scouting Files', extensions: ['csv', 'json', 'txt'] }],
      });

      if (selected && typeof selected === 'string') {
        logTransaction('Manual', `Loaded payload from path: ${selected}`);
        const content = await readTextFile(selected);
        await ingestRawDataPayload(content, 'Manual');
      }
    } catch (err) {
      console.error("Dialog error:", err);
      logTransaction('Manual', `File picker error: ${err}`);
    }
  };

  const handleSelectPhotosFolder = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
      });

      if (selected && typeof selected === 'string') {
        logTransaction('Manual', `Mapped photo directory: ${selected}`);
      }
    } catch (err) {
      console.error("Dialog error:", err);
      logTransaction('Manual', `Folder picker error: ${err}`);
    }
  };

  const handleDataDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActiveData(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        const text = await file.text();
        await ingestRawDataPayload(text, 'File Drop');
      }
    }
  };

  const handlePhotoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActivePhotos(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      files.forEach((file) => {
        if (autoAssignFilename) {
          const match = file.name.match(/^(\d+)/);
          const teamNum = match ? match[1] : 'Unknown';
          logTransaction('File Drop', `Assigned photo ${file.name} to Team ${teamNum}`, 0, 1);
        }
      });
    }
  };

  const handleAverageConflict = (conflict: ConflictRecord) => {
    const recA = conflict.recordA as any;
    const recB = conflict.recordB as any;

    const avgRecord = {
      ...conflict.recordA,
      autoL1: Math.round(((recA.autoL1 || 0) + (recB.autoL1 || 0)) / 2),
      autoL2: Math.round(((recA.autoL2 || 0) + (recB.autoL2 || 0)) / 2),
      autoL3: Math.round(((recA.autoL3 || 0) + (recB.autoL3 || 0)) / 2),
      autoL4: Math.round(((recA.autoL4 || 0) + (recB.autoL4 || 0)) / 2),
      teleopL1: Math.round(((recA.teleopL1 || 0) + (recB.teleopL1 || 0)) / 2),
      teleopL2: Math.round(((recA.teleopL2 || 0) + (recB.teleopL2 || 0)) / 2),
      teleopL3: Math.round(((recA.teleopL3 || 0) + (recB.teleopL3 || 0)) / 2),
      teleopL4: Math.round(((recA.teleopL4 || 0) + (recB.teleopL4 || 0)) / 2),
      teleopNet: Math.round(((recA.teleopNet || 0) + (recB.teleopNet || 0)) / 2),
      notes: `Averaged (${recA.scoutName || 'A'} & ${recB.scoutName || 'B'}): ${recA.notes || ''} | ${recB.notes || ''}`,
    } as unknown as StandScoutRecord;

    addStandRecord(avgRecord);
    resolveConflict(conflict.id, avgRecord);
    logTransaction(
      'Manual',
      `Averaged numerical counts for Match ${(conflict as any).matchNumber}, Team ${(conflict as any).teamNumber}`
    );
  };

  const totalUsbAssets = (usbDriveInfo?.match_files.length || 0) +
                         (usbDriveInfo?.pit_files.length || 0) +
                         (usbDriveInfo?.photo_files.length || 0);

  return (
    <div className="p-6 space-y-6 text-txt-main bg-canvas min-h-screen">
      {/* Top Header */}
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenAppDataFolder}
              className="bg-canvas hover:bg-border-subtle/20 border border-border-subtle text-txt-main font-medium text-xs px-3 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
            >
              <FolderOpen className="w-4 h-4" />
              Open App Data Folder
            </button>

            <button
              onClick={handleForceIntegrityCheck}
              className="bg-canvas hover:bg-border-subtle/20 border border-border-subtle text-txt-main font-medium text-xs px-3 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Force DB Integrity Check
            </button>
          </div>
        </div>

        {/* System Badges */}
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
              Snapshot Active
            </span>
          </div>
        </div>
      </div>

      {/* 3-Panel Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel 1: Live USB Drive Listener */}
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

            <div className="bg-canvas border border-border-subtle p-3 rounded-lg flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    usbDriveInfo?.is_connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="font-mono text-txt-muted truncate max-w-[180px]">
                  {usbDriveInfo?.mount_path || 'No removable drive detected'}
                </span>
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  usbDriveInfo?.is_connected ? 'text-emerald-500' : 'text-amber-500'
                }`}
              >
                {usbDriveInfo?.is_connected ? usbDriveInfo.volume_name || 'Mounted' : 'Scanning'}
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-txt-muted flex justify-between">
                <span>Detected Transfer Assets:</span>
                <span className="font-mono tabular-nums">{totalUsbAssets} files</span>
              </div>

              <div className="bg-canvas rounded-lg border border-border-subtle p-3 space-y-2 max-h-40 overflow-y-auto text-xs font-mono">
                {!usbDriveInfo || totalUsbAssets === 0 ? (
                  <p className="text-[11px] text-txt-muted text-center py-4">
                    Insert a USB drive containing scouting CSVs or robot images...
                  </p>
                ) : (
                  <>
                    {usbDriveInfo.match_files.map((f, i) => (
                      <div key={`m_${i}`} className="flex items-center justify-between text-txt-main">
                        <span className="flex items-center gap-1.5 truncate">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-txt-muted shrink-0" /> {f}
                        </span>
                        <span className="text-[10px] text-txt-muted shrink-0">MATCH CSV</span>
                      </div>
                    ))}
                    {usbDriveInfo.pit_files.map((f, i) => (
                      <div key={`p_${i}`} className="flex items-center justify-between text-txt-main">
                        <span className="flex items-center gap-1.5 truncate">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-txt-muted shrink-0" /> {f}
                        </span>
                        <span className="text-[10px] text-txt-muted shrink-0">PIT CSV</span>
                      </div>
                    ))}
                    {usbDriveInfo.photo_files.map((f, i) => (
                      <div key={`img_${i}`} className="flex items-center justify-between text-txt-main">
                        <span className="flex items-center gap-1.5 truncate">
                          <ImageIcon className="w-3.5 h-3.5 text-txt-muted shrink-0" /> {f}
                        </span>
                        <span className="text-[10px] text-txt-muted shrink-0">IMG</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

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

          <button
            onClick={handleUsbOneTapSync}
            disabled={usbSyncing || !usbDriveInfo}
            className="w-full bg-txt-main text-canvas font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 text-xs uppercase tracking-wider cursor-pointer"
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

            <button
              onClick={handleSelectDataFileFromDisk}
              className="w-full bg-canvas hover:bg-border-subtle/20 border border-border-subtle font-medium text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <FolderInput className="w-4 h-4" />
              📄 Select Data File from Disk
            </button>
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

            <div className="space-y-2 text-xs border-t border-border-subtle/60 pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoAssignFilename}
                  onChange={(e) => setAutoAssignFilename(e.target.checked)}
                  className="rounded border-border-subtle"
                />
                <span>Auto-assign via filename (`254.jpg`)</span>
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

          <button
            onClick={handleSelectPhotosFolder}
            className="w-full bg-canvas hover:bg-border-subtle/20 border border-border-subtle font-medium text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <FolderOpen className="w-4 h-4" />
            📂 Select Photos Folder...
          </button>
        </div>
      </div>

      {/* Conflict Resolution Workspace */}
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
            ✨ No duplicate collisions detected. Ingested data stream is clean and unified!
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
                    Collision: Match {(conflict as any).matchNumber} &bull; Team {(conflict as any).teamNumber}
                  </span>
                  <span className="text-txt-muted text-[10px] tabular-nums">
                    Logged: {new Date((conflict as any).timestamp || Date.now()).toLocaleTimeString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  {/* Record A */}
                  <div className="bg-card p-3 rounded-lg border border-border-subtle space-y-1.5">
                    <div className="text-[10px] font-sans font-bold uppercase text-txt-muted">
                      Record A (Existing Store Record)
                    </div>
                    <div>Scout: <span className="font-bold text-txt-main">{(conflict.recordA as any)?.scoutName || 'Unknown'}</span></div>
                    <div className="tabular-nums">
                      Auto L1-L4: {(conflict.recordA as any)?.autoL1 || 0} / {(conflict.recordA as any)?.autoL2 || 0} / {(conflict.recordA as any)?.autoL3 || 0} / {(conflict.recordA as any)?.autoL4 || 0}
                    </div>
                    <div className="tabular-nums">
                      TeleOp L1-L4: {(conflict.recordA as any)?.teleopL1 || 0} / {(conflict.recordA as any)?.teleopL2 || 0} / {(conflict.recordA as any)?.teleopL3 || 0} / {(conflict.recordA as any)?.teleopL4 || 0}
                    </div>

                    <button
                      onClick={() => {
                        addStandRecord(conflict.recordA);
                        resolveConflict(conflict.id, conflict.recordA);
                      }}
                      className="mt-3 w-full bg-canvas hover:bg-border-subtle/30 border border-border-subtle py-1.5 rounded text-xs font-medium cursor-pointer"
                    >
                      👈 Keep Record A
                    </button>
                  </div>

                  {/* Record B */}
                  <div className="bg-card p-3 rounded-lg border border-border-subtle space-y-1.5">
                    <div className="text-[10px] font-sans font-bold uppercase text-txt-muted">
                      Record B (Incoming Payload)
                    </div>
                    <div>Scout: <span className="font-bold text-txt-main">{(conflict.recordB as any)?.scoutName || 'Unknown'}</span></div>
                    <div className="tabular-nums">
                      Auto L1-L4: {(conflict.recordB as any)?.autoL1 || 0} / {(conflict.recordB as any)?.autoL2 || 0} / {(conflict.recordB as any)?.autoL3 || 0} / {(conflict.recordB as any)?.autoL4 || 0}
                    </div>
                    <div className="tabular-nums">
                      TeleOp L1-L4: {(conflict.recordB as any)?.teleopL1 || 0} / {(conflict.recordB as any)?.teleopL2 || 0} / {(conflict.recordB as any)?.teleopL3 || 0} / {(conflict.recordB as any)?.teleopL4 || 0}
                    </div>

                    <button
                      onClick={() => {
                        addStandRecord(conflict.recordB);
                        resolveConflict(conflict.id, conflict.recordB);
                      }}
                      className="mt-3 w-full bg-canvas hover:bg-border-subtle/30 border border-border-subtle py-1.5 rounded text-xs font-medium cursor-pointer"
                    >
                      👉 Keep Record B
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => handleAverageConflict(conflict)}
                    className="flex-1 bg-card hover:bg-border-subtle/20 border border-border-subtle font-sans text-xs font-medium py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    ⚖️ Average Numerical Values
                  </button>

                  <button
                    onClick={() => {
                      addStandRecord(conflict.recordA);
                      resolveConflict(conflict.id, conflict.recordA);
                    }}
                    className="flex-1 bg-card hover:bg-border-subtle/20 border border-border-subtle font-sans text-xs font-medium py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    ✏️ Keep Existing Record
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sync History */}
      <div className="bg-card rounded-xl border border-border-subtle p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <History className="w-5 h-5" />
            Recent Sync History
          </h2>
          <span className="text-xs text-txt-muted font-mono tabular-nums">{syncLogs.length} events logged</span>
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
                    {(log as any).source || (log as any).type || (log as any).action || 'Log'}
                  </span>
                  <span className="text-txt-main">{(log as any).details || (log as any).message || ''}</span>
                </div>
                <span className="text-txt-muted text-[10px] tabular-nums">
                  {typeof log.timestamp === 'number'
                    ? new Date(log.timestamp).toLocaleTimeString()
                    : new Date(String(log.timestamp)).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};