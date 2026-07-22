import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  LineChart,
  Edit3,
  FileText,
  ListOrdered,
  Bot,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { useEventStore } from '../../store';
import { AppTab } from '../../types';

interface NavigationItem {
  id: AppTab;
  label: string;
  icon: React.ElementType;
  shortcut: string;
}

const NAV_ITEMS: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard & Telemetry', icon: LayoutDashboard, shortcut: 'Alt+1' },
  { id: 'directory', label: 'Team Directory & Pit Data', icon: Users, shortcut: 'Alt+2' },
  { id: 'schedule', label: 'Match Schedule', icon: Calendar, shortcut: 'Alt+3' },
  { id: 'predictor', label: 'Match Predictor', icon: LineChart, shortcut: 'Alt+4' },
  { id: 'whiteboard', label: 'Alliance Whiteboard', icon: Edit3, shortcut: 'Alt+5' },
  { id: 'cheatsheet', label: 'Strategy Cheat-Sheet', icon: FileText, shortcut: 'Alt+6' },
  { id: 'picklist', label: 'Playoff Picklist', icon: ListOrdered, shortcut: 'Alt+7' },
  { id: 'ai_assistant', label: 'AI Strategy Assistant', icon: Bot, shortcut: 'Alt+8' },
  { id: 'sync_hub', label: 'USB Data Sync Hub', icon: RefreshCw, shortcut: 'Alt+9' },
  { id: 'settings', label: 'System Settings', icon: Settings, shortcut: 'Alt+0' },
];

export const Sidebar: React.FC = () => {
  const activeTab = useEventStore((state) => state.activeTab);
  const setActiveTab = useEventStore((state) => state.setActiveTab);

  // Keyboard navigation Alt+1 to Alt+0
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        const keyTabMap: Record<string, AppTab> = {
          Digit1: 'dashboard',
          Digit2: 'directory',
          Digit3: 'schedule',
          Digit4: 'predictor',
          Digit5: 'whiteboard',
          Digit6: 'cheatsheet',
          Digit7: 'picklist',
          Digit8: 'ai_assistant',
          Digit9: 'sync_hub',
          Digit0: 'settings',
        };

        const targetTab = keyTabMap[e.code];
        if (targetTab) {
          e.preventDefault();
          setActiveTab(targetTab);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  return (
    <aside className="w-14 border-r border-border-subtle bg-card flex flex-col items-center py-2 gap-1.5 select-none z-10">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <div key={item.id} className="relative group">
            <button
              onClick={() => setActiveTab(item.id)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                isActive
                  ? 'bg-brand text-txt-main shadow-md font-semibold'
                  : 'text-txt-muted hover:bg-card-hover hover:text-txt-main'
              }`}
            >
              <Icon className="w-5 h-5" />
            </button>

            {/* Tooltip */}
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:flex items-center gap-2 px-2.5 py-1.5 bg-card text-txt-main border border-border-subtle rounded-md shadow-xl text-xs whitespace-nowrap z-50 pointer-events-none">
              <span className="font-medium">{item.label}</span>
              <kbd className="tabular-nums font-mono text-[9px] px-1 py-0.5 rounded bg-canvas border border-border-subtle text-txt-muted">
                {item.shortcut}
              </kbd>
            </div>
          </div>
        );
      })}
    </aside>
  );
};