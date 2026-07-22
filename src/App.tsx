import React, { useEffect, useState } from 'react';
import { AppShell } from './components/layouts/AppShell';
import { useEventStore } from './store';
import { initDb } from './lib/db.ts';
import { Loader2, AlertCircle } from 'lucide-react';

// Placeholder view wrappers for active tabs
// (These can be replaced with full view components as they are built)
const DashboardView = () => <div className="p-4 bg-card rounded-lg border border-border-subtle text-txt-main">Dashboard & Telemetry View</div>;
const DirectoryView = () => <div className="p-4 bg-card rounded-lg border border-border-subtle text-txt-main">Team Directory & Pit Data View</div>;
const ScheduleView = () => <div className="p-4 bg-card rounded-lg border border-border-subtle text-txt-main">Match Schedule View</div>;
const PredictorView = () => <div className="p-4 bg-card rounded-lg border border-border-subtle text-txt-main">Match Predictor View</div>;
const WhiteboardView = () => <div className="p-4 bg-card rounded-lg border border-border-subtle text-txt-main">Alliance Whiteboard View</div>;
const CheatsheetView = () => <div className="p-4 bg-card rounded-lg border border-border-subtle text-txt-main">Strategy Cheat-Sheet View</div>;
const PicklistView = () => <div className="p-4 bg-card rounded-lg border border-border-subtle text-txt-main">Playoff Picklist View</div>;
const AiAssistantView = () => <div className="p-4 bg-card rounded-lg border border-border-subtle text-txt-main">AI Strategy Assistant ("Frank") View</div>;
const SyncHubView = () => <div className="p-4 bg-card rounded-lg border border-border-subtle text-txt-main">USB Data Sync Hub View</div>;
const SettingsView = () => <div className="p-4 bg-card rounded-lg border border-border-subtle text-txt-main">System Settings View</div>;

export const App: React.FC = () => {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const activeTab = useEventStore((state) => state.activeTab);

  // Initialize SQLite Database on app boot
  useEffect(() => {
    let isMounted = true;

    async function setupDatabase() {
      try {
        await initDb();
        if (isMounted) setDbReady(true);
      } catch (err) {
        console.error('Failed to initialize SQLite database:', err);
        if (isMounted) {
          // If in Tauri and it actually failed:
          setDbError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    setupDatabase();

    return () => {
      isMounted = false;
    };
  }, []);

  // Database loading splash screen
  if (!dbReady && !dbError) {
    return (
      <div className="h-screen w-screen bg-canvas text-txt-main flex flex-col items-center justify-center gap-3 font-sans select-none">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
        <p className="text-xs font-mono text-txt-muted">Initializing ShamStrategy Node E Database (WAL)...</p>
      </div>
    );
  }

  // Database boot failure splash screen
  if (dbError) {
    return (
      <div className="h-screen w-screen bg-canvas text-txt-main flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-12 h-12 rounded-full bg-status-critical/10 text-status-critical flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-sm font-bold tracking-tight mb-1">Database Initialization Failed</h2>
        <p className="text-xs font-mono text-txt-muted max-w-md bg-card p-3 rounded border border-border-subtle text-left mb-4">
          {dbError}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 bg-brand text-txt-main rounded text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  // Tab View Dispatcher based on activeTab state from Zustand store
  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'directory':
        return <DirectoryView />;
      case 'schedule':
        return <ScheduleView />;
      case 'predictor':
        return <PredictorView />;
      case 'whiteboard':
        return <WhiteboardView />;
      case 'cheatsheet':
        return <CheatsheetView />;
      case 'picklist':
        return <PicklistView />;
      case 'ai_assistant':
        return <AiAssistantView />;
      case 'sync_hub':
        return <SyncHubView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return <AppShell>{renderActiveView()}</AppShell>;
};

export default App;