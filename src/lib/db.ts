import Database from '@tauri-apps/plugin-sql';

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
    // 1. Load database & run migrations outside of PRAGMA calls
    dbInstance = await Database.load('sqlite:shamstrategy.db');
    
    // 2. Set runtime connection PRAGMAs after migrations complete
    await dbInstance.execute('PRAGMA foreign_keys = ON;');
    await dbInstance.execute('PRAGMA journal_mode = WAL;');
  }

  return dbInstance;
}

export async function getDb(): Promise<Database | null> {
  return initDb();
}