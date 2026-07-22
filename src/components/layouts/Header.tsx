import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Search, Minus, Square, X, Usb, ShieldCheck } from 'lucide-react';
import { useEventStore } from '../../store';

interface HeaderProps {
  onOpenCommandPalette: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenCommandPalette }) => {
  const activeEventKey = useEventStore((state) => state.activeEventKey);
  const systemStatus = useEventStore((state) => state.systemStatus);

  const appWindow = getCurrentWindow();

  return (
    <header className="h-10 border-b border-border-subtle bg-card flex items-center justify-between px-3 select-none text-xs text-txt-main">
      {/* Left Group */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 font-bold tracking-tight">
          <div className="w-5 h-5 rounded bg-brand text-txt-main flex items-center justify-center text-[10px] font-extrabold shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold tabular-nums text-sm tracking-wider">5907</span>
        </div>

        <div className="h-3.5 w-px bg-border-subtle" />

        {/* Active Event Key */}
        <span className="tabular-nums font-mono px-2 py-0.5 rounded bg-card-hover text-txt-muted border border-border-subtle text-[11px]">
          {activeEventKey || systemStatus.activeEventKey || '2026mifor'}
        </span>

        {/* USB Status Indicator */}
        <div className="flex items-center gap-1.5 text-[11px] px-1.5 py-0.5 rounded bg-card-hover border border-border-subtle">
          <Usb
            className={`w-3.5 h-3.5 ${
              systemStatus.usbConnected ? 'text-status-success' : 'text-status-critical'
            }`}
          />
          <span className="tabular-nums font-medium">
            {systemStatus.usbConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
        </div>
      </div>

      {/* Center Drag Region */}
      <div
        data-tauri-drag-region
        className="flex-1 h-full cursor-grab active:cursor-grabbing flex items-center justify-center text-[11px] text-txt-muted font-mono"
      >
        <span>ShamStrategy Node E • FRC 5907 CC Shambots</span>
      </div>

      {/* Right Group */}
      <div className="flex items-center gap-2">
        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-2.5 py-1 rounded bg-card-hover hover:border-brand text-txt-muted hover:text-txt-main border border-border-subtle transition-all"
        >
          <Search className="w-3 h-3 text-brand" />
          <span className="text-[11px]">Search</span>
          <kbd className="tabular-nums font-mono text-[9px] bg-canvas border border-border-subtle px-1 rounded text-txt-muted">
            Ctrl+K
          </kbd>
        </button>

        <div className="h-3.5 w-px bg-border-subtle" />

        {/* Native Window Controls */}
        <div className="flex items-center -mr-1">
          <button
            onClick={() => appWindow.minimize()}
            className="p-1.5 hover:bg-card-hover text-txt-muted hover:text-txt-main rounded transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => appWindow.toggleMaximize()}
            className="p-1.5 hover:bg-card-hover text-txt-muted hover:text-txt-main rounded transition-colors"
            title="Maximize"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={() => appWindow.close()}
            className="p-1.5 hover:bg-status-critical hover:text-txt-main text-txt-muted rounded transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};