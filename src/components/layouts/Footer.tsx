import React from 'react';
import { Database, Activity, PieChart } from 'lucide-react';
import { useEventStore } from '../../store';

export const Footer: React.FC = () => {
  const systemStatus = useEventStore((state) => state.systemStatus);

  return (
    <footer className="h-7 border-t border-border-subtle bg-card flex items-center justify-between px-3 text-[11px] text-txt-muted select-none">
      {/* Left Group */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Database
            className={`w-3 h-3 ${
              systemStatus.sqliteWalActive ? 'text-status-success' : 'text-status-warning'
            }`}
          />
          <span>SQLite Engine:</span>
          <span className="tabular-nums font-mono font-medium text-txt-main">
            {systemStatus.sqliteWalActive ? 'WAL Active' : 'Rollback Mode'}
          </span>
        </div>

        <div className="h-3 w-px bg-border-subtle" />

        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-brand" />
          <span>Match Progress:</span>
          <span className="tabular-nums font-mono font-medium text-txt-main">
            Match {systemStatus.totalMatchesLoaded} / {systemStatus.totalMatchesExpected}
          </span>
        </div>
      </div>

      {/* Right Group */}
      <div className="flex items-center gap-2">
        <PieChart className="w-3 h-3 text-brand-secondary" />
        <span>Scouted Coverage:</span>
        <div className="w-20 h-1.5 bg-canvas rounded-full overflow-hidden border border-border-subtle">
          <div
            className="h-full bg-brand transition-all duration-300"
            style={{ width: `${Math.min(100, systemStatus.dataCompletenessPercentage)}%` }}
          />
        </div>
        <span className="tabular-nums font-mono font-bold text-txt-main">
          {systemStatus.dataCompletenessPercentage}%
        </span>
      </div>
    </footer>
  );
};