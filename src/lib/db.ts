import Database from '@tauri-apps/plugin-sql';
import { appDataDir, join } from '@tauri-apps/api/path';

let dbInstance: Database | null = null;

export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export async function initDb(): Promise<Database | null> {
  if (!isTauriEnvironment()) {
    console.warn('Running outside Tauri environment. SQLite initialization skipped.');
    return null;
  }

  if (!dbInstance) {
    // 1. Load database & run initial schema migration
    dbInstance = await Database.load('sqlite:shamstrategy.db');

    // 2. Set runtime connection PRAGMAs AFTER migrations complete
    await dbInstance.execute('PRAGMA foreign_keys = ON;');
    await dbInstance.execute('PRAGMA journal_mode = WAL;');
  }

  return dbInstance;
}

export async function getDb(): Promise<Database | null> {
  return initDb();
}

// ============================================================================
// SECTION 3 HELPER FUNCTIONS
// ============================================================================

/**
 * Creates an instant SQLite snapshot backup using native SQLite `VACUUM INTO`
 */
export async function createDatabaseSnapshot(): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotName = `shamstrategy_backup_${timestamp}.db`;

    // Get the standard app data directory path to ensure target exists
    const appDir = await appDataDir();
    const targetPath = await join(appDir, snapshotName);

    // VACUUM INTO creates a live, non-blocking backup copy of the database
    await db.execute(`VACUUM INTO '${targetPath.replace(/'/g, "''")}';`);
    return targetPath;
  } catch (err) {
    console.error('Failed to generate snapshot:', err);
    return null;
  }
}

/**
 * Deletes match and scouting data strictly associated with an active event key
 */
export async function clearEventData(eventKey: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    // Execute parameter-bound queries across your tables
    await db.execute('DELETE FROM stand_scout_records WHERE event_key = $1;', [eventKey]);
    await db.execute('DELETE FROM pit_scout_records WHERE event_key = $1;', [eventKey]);
    await db.execute('DELETE FROM schedule_matches WHERE event_key = $1;', [eventKey]);
    return true;
  } catch (err) {
    console.error('Failed to clear event data:', err);
    return false;
  }
}

/**
 * Nuclear wipe option: Drops tables or deletes all data records
 */
export async function wipeDatabase(): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    // Clear table contents while retaining schema structural integrity
    await db.execute('DELETE FROM stand_scout_records;');
    await db.execute('DELETE FROM pit_scout_records;');
    await db.execute('DELETE FROM schedule_matches;');
    await db.execute('VACUUM;'); // Shrink DB size back to minimum
    return true;
  } catch (err) {
    console.error('Failed to wipe database:', err);
    return false;
  }
}