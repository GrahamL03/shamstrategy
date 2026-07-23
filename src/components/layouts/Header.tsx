import React, { useState, useEffect } from 'react';
import { useEventStore } from '../../store';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { 
  Shield, 
  Wifi, 
  Search, 
  Minus, 
  Square, 
  Copy, 
  X 
} from 'lucide-react';

export const Header: React.FC = () => {
  const systemStatus = useEventStore((state) => state.systemStatus);
  const teamNumber = useEventStore((state) => state.teamNumber);
  const teamName = useEventStore((state) => state.teamName);
  const eventName = useEventStore((state) => state.eventName);
  const teamLogo = useEventStore((state) => state.teamLogo); // 👈 Retrieve team logo

  const [isMaximized, setIsMaximized] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  );

  const appWindow = getCurrentWindow();

  // Sync window maximize state
  useEffect(() => {
    const updateMaximizeState = async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    };

    updateMaximizeState();

    const unlisten = appWindow.onResized(() => {
      updateMaximizeState();
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, [appWindow]);

  const handleHeaderMouseDown = async (e: React.MouseEvent<HTMLElement>) => {
    if (e.button !== 0) return;

    if (e.detail === 2) {
      await appWindow.toggleMaximize();
      setIsMaximized(await appWindow.isMaximized());
    } else {
      await appWindow.startDragging();
    }
  };

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await appWindow.minimize();
  };

  const handleToggleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await appWindow.close();
  };

  const connectionActive = 
    (systemStatus as any)?.isConnected ?? 
    (systemStatus as any)?.isOnline ?? 
    isOnline;

  return (
    <header 
      onMouseDown={handleHeaderMouseDown}
      className="relative h-10 bg-card border-b border-border-subtle flex items-center justify-between px-3 select-none cursor-default"
    >
      {/* Left Region */}
      <div className="flex items-center gap-3 pointer-events-none">
        {/* Dynamic Logo or Shield Fallback */}
        {teamLogo ? (
          <div className="flex items-center gap-1.5 bg-brand/10 border border-brand/20 px-1.5 py-0.5 rounded h-6">
            <img 
              src={teamLogo} 
              alt="Team Logo" 
              className="h-4 w-auto object-contain max-w-[24px]" 
            />
            <span className="text-xs font-bold text-brand font-mono">{teamNumber}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-brand/10 border border-brand/20 px-2 py-0.5 rounded">
            <Shield className="w-3.5 h-3.5 text-brand" />
            <span className="text-xs font-bold text-brand font-mono">{teamNumber}</span>
          </div>
        )}

        {/* Display Event Name in header */}
        <span className="text-xs font-mono text-txt-muted bg-canvas px-2 py-0.5 rounded border border-border-subtle max-w-[200px] truncate">
          {eventName || 'No Active Event'}
        </span>

        <div className="flex items-center gap-1.5 text-[11px] font-mono text-txt-muted">
          <span 
            className={`w-2 h-2 rounded-full ${
              connectionActive 
                ? 'bg-status-success animate-pulse' 
                : 'bg-status-critical'
            }`} 
          />
          <Wifi className="w-3 h-3 text-txt-muted" />
          <span>{connectionActive ? 'Connected' : 'Offline'}</span>
        </div>
      </div>

      {/* Center Region (True-centered via absolute positioning) */}
      <div className="absolute left-1/2 -translate-x-1/2 text-xs font-mono text-txt-muted pointer-events-none truncate max-w-[35%] text-center">
        ShamStrategy • {teamNumber} {teamName}
      </div>

      {/* Right Region */}
      <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
        <button 
          className="flex items-center gap-2 bg-canvas hover:bg-card-hover border border-border-subtle px-2 py-1 rounded text-xs text-txt-muted transition-colors cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-[10px]">Search</span>
          <kbd className="text-[9px] bg-card px-1 rounded border border-border-subtle font-mono">Ctrl+K</kbd>
        </button>

        <div className="flex items-center ml-1 border-l border-border-subtle pl-1">
          <button
            onClick={handleMinimize}
            className="p-1.5 text-txt-muted hover:text-txt-main hover:bg-card-hover rounded transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          
          <button
            onClick={handleToggleMaximize}
            className="p-1.5 text-txt-muted hover:text-txt-main hover:bg-card-hover rounded transition-colors cursor-pointer"
            title={isMaximized ? "Restore Down" : "Maximize"}
          >
            {isMaximized ? (
              <Copy className="w-3 h-3 rotate-180" />
            ) : (
              <Square className="w-3 h-3" />
            )}
          </button>

          <button
            onClick={handleClose}
            className="p-1.5 text-txt-muted hover:text-white hover:bg-status-critical rounded transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};