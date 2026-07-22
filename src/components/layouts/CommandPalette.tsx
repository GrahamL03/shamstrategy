import React, { useState } from 'react';
import { Search, Navigation, Shield, Database, FileSpreadsheet, Settings } from 'lucide-react';
import { useEventStore } from '../../store';
import { AppTab } from '../../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ActionItem {
  id: string;
  type: 'tab' | 'team' | 'system';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tabTarget?: AppTab;
  teamNumber?: number;
  execute?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const setActiveTab = useEventStore((state) => state.setActiveTab);
  const setSelectedTeamNumber = useEventStore((state) => state.setSelectedTeamNumber);
  const teams = useEventStore((state) => state.teams);

  if (!isOpen) return null;

  const searchLower = query.toLowerCase();

  const rawTabActions: ActionItem[] = [
    { id: 'nav-dashboard', type: 'tab', label: 'Jump to Dashboard & Telemetry', icon: Navigation, tabTarget: 'dashboard' },
    { id: 'nav-directory', type: 'tab', label: 'Jump to Team Directory & Pit Data', icon: Navigation, tabTarget: 'directory' },
    { id: 'nav-schedule', type: 'tab', label: 'Jump to Match Schedule', icon: Navigation, tabTarget: 'schedule' },
    { id: 'nav-predictor', type: 'tab', label: 'Jump to Match Predictor', icon: Navigation, tabTarget: 'predictor' },
    { id: 'nav-whiteboard', type: 'tab', label: 'Jump to Alliance Whiteboard', icon: Navigation, tabTarget: 'whiteboard' },
    { id: 'nav-cheatsheet', type: 'tab', label: 'Jump to Strategy Cheat-Sheet', icon: Navigation, tabTarget: 'cheatsheet' },
    { id: 'nav-picklist', type: 'tab', label: 'Jump to Playoff Picklist', icon: Navigation, tabTarget: 'picklist' },
    { id: 'nav-ai_assistant', type: 'tab', label: 'Jump to AI Strategy Assistant', icon: Navigation, tabTarget: 'ai_assistant' },
    { id: 'nav-sync_hub', type: 'tab', label: 'Jump to USB Data Sync Hub', icon: Navigation, tabTarget: 'sync_hub' },
    { id: 'nav-settings', type: 'tab', label: 'Jump to System Settings', icon: Navigation, tabTarget: 'settings' },
  ];

  const tabActions = rawTabActions.filter((item) =>
    item.label.toLowerCase().includes(searchLower)
  );

  const teamActions: ActionItem[] = teams
    .filter(
      (team) =>
        team.teamNumber.toString().includes(searchLower) ||
        team.teamName.toLowerCase().includes(searchLower)
    )
    .slice(0, 5)
    .map((team) => ({
      id: `team-${team.teamNumber}`,
      type: 'team',
      label: `Team ${team.teamNumber} - ${team.teamName}`,
      icon: Shield,
      teamNumber: team.teamNumber,
    }));

  const rawSystemActions: ActionItem[] = [
    {
      id: 'sys-snapshot',
      type: 'system',
      label: 'Trigger Database Snapshot (WAL Commit)',
      icon: Database,
      execute: () => console.log('Database snapshot triggered.'),
    },
    {
      id: 'sys-export',
      type: 'system',
      label: 'Export Strategy Cheat-Sheet',
      icon: FileSpreadsheet,
      execute: () => setActiveTab('cheatsheet'),
    },
    {
      id: 'sys-settings',
      type: 'system',
      label: 'Open Application Settings',
      icon: Settings,
      execute: () => setActiveTab('settings'),
    },
  ];

  const systemActions = rawSystemActions.filter((item) =>
    item.label.toLowerCase().includes(searchLower)
  );

  const filteredItems = [...tabActions, ...teamActions, ...systemActions];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
      e.preventDefault();
      executeAction(filteredItems[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const executeAction = (item: ActionItem) => {
    if (item.type === 'tab' && item.tabTarget) {
      setActiveTab(item.tabTarget);
    } else if (item.type === 'team' && item.teamNumber) {
      setSelectedTeamNumber(item.teamNumber);
      setActiveTab('directory');
    } else if (item.type === 'system' && item.execute) {
      item.execute();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-canvas/80 backdrop-blur-sm z-50 flex items-start justify-center pt-20 p-4">
      <div
        className="bg-card text-txt-main border border-border-subtle w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center px-3 border-b border-border-subtle bg-card-hover/40">
          <Search className="w-4 h-4 text-brand mr-2 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command, search teams, or jump to tab..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full h-11 bg-transparent border-none text-xs outline-none placeholder:text-txt-muted text-txt-main"
          />
          <kbd className="tabular-nums font-mono text-[9px] px-1.5 py-0.5 rounded bg-canvas border border-border-subtle text-txt-muted">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="p-4 text-center text-xs text-txt-muted">
              No results found for &quot;{query}&quot;
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={() => executeAction(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-brand text-txt-main font-medium shadow-sm'
                      : 'hover:bg-card-hover text-txt-muted hover:text-txt-main'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 tabular-nums">{item.label}</span>
                  {isSelected && (
                    <span className="tabular-nums font-mono text-[9px] opacity-80">
                      ↵ Enter
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};  