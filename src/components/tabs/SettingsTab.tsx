import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Building2, 
  Palette, 
  Database, 
  Cpu, 
  Upload, 
  Trash2, 
  Folder, 
  AlertTriangle, 
  CheckCircle2, 
  HardDrive, 
  Zap, 
  Activity, 
  Monitor, 
  Key, 
  Sparkles,
  FolderOpen
} from 'lucide-react';

import { appDataDir, join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-shell';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

import { useEventStore, useAIStore, useScoutStore } from '../../store';
import type { ThemePreset } from '../../store/types';
import * as DB from '../../lib/db';

const THEME_PRESETS: { id: ThemePreset; name: string; colors: { canvas: string; card: string; accent: string; alliance: string } }[] = [
  { id: 'shambasic', name: 'ShamBasic', colors: { canvas: '#0F172A', card: '#1E293B', accent: '#10B981', alliance: '#6366F1' } },
  { id: 'autonomous', name: 'Autonomous', colors: { canvas: '#030712', card: '#0F172A', accent: '#10B981', alliance: '#3B82F6' } },
  { id: 'teleop', name: 'TeleOp', colors: { canvas: '#0B0F19', card: '#161F33', accent: '#F59E0B', alliance: '#FBBF24' } },
  { id: 'endgame', name: 'Endgame', colors: { canvas: '#110A1F', card: '#211338', accent: '#8B5CF6', alliance: '#A78BFA' } },
  { id: 'queuing', name: 'Queuing', colors: { canvas: '#121212', card: '#1E1E1E', accent: '#6B7280', alliance: '#9CA3AF' } },
  { id: 'blue_alliance', name: 'Blue Alliance', colors: { canvas: '#0A1329', card: '#122045', accent: '#2563EB', alliance: '#3B82F6' } },
  { id: 'red_alliance', name: 'Red Alliance', colors: { canvas: '#2A0A0A', card: '#451212', accent: '#DC2626', alliance: '#EF4444' } },
  { id: 'einstein', name: 'Einstein Gold', colors: { canvas: '#1A1500', card: '#332B00', accent: '#EAB308', alliance: '#FACC15' } },
];

export const SettingsTab: React.FC = () => {
  // Store Subscriptions
  const { 
    teamNumber, setTeamNumber, 
    teamName, setTeamName, 
    activeEventKey, setActiveEventKey, 
    eventName, setEventName, 
    tbaApiKey, setTbaApiKey,
    teamLogo, setTeamLogo,
    activeTheme, setActiveTheme
  } = useEventStore();

  const aiStore = useAIStore();
  const provider = aiStore.provider;
  const setProvider = aiStore.setProvider;
  const model = aiStore.model;
  const setModel = aiStore.setModel;

  // Track component mounting state for asynchronous safe timer updates
  const isMounted = useRef<boolean>(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Local Component State
  const [eventKeyInput, setEventKeyInput] = useState<string>(activeEventKey);
  const [eventKeySaved, setEventKeySaved] = useState<boolean>(false);
  const [tbaTestStatus, setTbaTestStatus] = useState<string | null>(null);

  // Sync inputs with store state on load
  useEffect(() => {
    setEventKeyInput(activeEventKey);
  }, [activeEventKey]);

  // Section 3: Database & Snapshots State
  const [snapshotInterval, setSnapshotInterval] = useState<string>('15');
  const [retainedSnapshots, setRetainedSnapshots] = useState<string>('10');
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [activeDbPath, setActiveDbPath] = useState<string>('~/shamstrategy/data/shamstrategy.db');

  // Safely resolve real database path on Tauri environment
  useEffect(() => {
    async function resolvePath() {
      try {
        if (DB.isTauriEnvironment()) {
          const dir = await appDataDir();
          const dbFilePath = await join(dir, 'shamstrategy.db');
          if (isMounted.current) setActiveDbPath(dbFilePath);
        }
      } catch (e) {
        console.warn('Could not resolve Tauri app data directory:', e);
      }
    }
    resolvePath();
  }, []);

  // Automated Rolling Snapshots Background Timer
  useEffect(() => {
    const minutes = parseInt(snapshotInterval, 10);
    if (isNaN(minutes) || minutes <= 0) return;

    const intervalMs = minutes * 60 * 1000;
    const timer = setInterval(async () => {
      const path = await DB.createDatabaseSnapshot();
      if (path) {
        console.log(`[Auto-Snapshot] Created: ${path}`);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [snapshotInterval]);

  // Section 4: Hardware & Inputs State
  const [gpuAccel, setGpuAccel] = useState<string>('vulkan');
  const [usbPath, setUsbPath] = useState<string>('/media/scout_usb/');
  const [photoQuality, setPhotoQuality] = useState<string>('80');
  const [aiLatency, setAiLatency] = useState<number | null>(38);
  const [aiStatus, setAiStatus] = useState<'online' | 'offline' | 'checking'>('online');

  // Ping Local AI Engine (Ollama / Llama.cpp)
  useEffect(() => {
    let isSubscribed = true;
    
    const checkAiEngineHealth = async () => {
      if (provider !== 'ollama') return;
      
      const startTime = performance.now();
      try {
        const response = await fetch('http://localhost:11434/api/version', { method: 'GET' });
        if (response.ok && isSubscribed) {
          const latency = Math.round(performance.now() - startTime);
          setAiLatency(latency);
          setAiStatus('online');
        } else if (isSubscribed) {
          setAiStatus('offline');
        }
      } catch {
        if (isSubscribed) setAiStatus('offline');
      }
    };

    checkAiEngineHealth();
    const interval = setInterval(checkAiEngineHealth, 10000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [provider]);

  // Handlers
  const handleEventKeySave = () => {
    setActiveEventKey(eventKeyInput);
    setEventKeySaved(true);
    setTimeout(() => {
      if (isMounted.current) setEventKeySaved(false);
    }, 2000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<React.ChangeEvent<HTMLInputElement>['target']>) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTeamLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setTeamLogo(null);
  };

  const handleTestTBA = async () => {
    if (!tbaApiKey) {
      setTbaTestStatus('Key Missing ⚠️');
      setTimeout(() => {
        if (isMounted.current) setTbaTestStatus(null);
      }, 3000);
      return;
    }

    setTbaTestStatus('Testing...');

    try {
      const res = await fetch('https://www.thebluealliance.com/api/v3/status', {
        headers: {
          'X-TBA-Auth-Key': tbaApiKey,
        },
      });

      if (!isMounted.current) return;

      if (res.ok) {
        setTbaTestStatus('Connected 🟢 (200 OK)');
      } else if (res.status === 401) {
        setTbaTestStatus('Invalid Key 🔴 (401)');
      } else {
        setTbaTestStatus(`Error 🔴 (${res.status})`);
      }
    } catch {
      if (isMounted.current) setTbaTestStatus('Network Error 🔴');
    }

    setTimeout(() => {
      if (isMounted.current) setTbaTestStatus(null);
    }, 4000);
  };

  // Section 3 Functionalities
  const handleTriggerSnapshot = async () => {
    try {
      setSnapshotStatus('Creating snapshot...');
      const snapshotPath = await DB.createDatabaseSnapshot();
      
      if (!isMounted.current) return;

      if (snapshotPath) {
        setSnapshotStatus(`Snapshot backup saved: ${snapshotPath}`);
      } else {
        setSnapshotStatus('Snapshot skipped (Requires active Tauri environment).');
      }
    } catch (err) {
      console.error('Failed to create snapshot:', err);
      if (isMounted.current) setSnapshotStatus('Error creating database snapshot.');
    }

    setTimeout(() => {
      if (isMounted.current) setSnapshotStatus(null);
    }, 5000);
  };

  const handleOpenFolder = async () => {
    try {
      if (DB.isTauriEnvironment()) {
        const dir = await appDataDir();
        await open(dir);
      } else {
        alert(`Data Directory Path:\n${activeDbPath}`);
      }
    } catch (err) {
      console.error('Failed to open data folder via shell plugin:', err);
      alert(`Data Directory Path:\n${activeDbPath}`);
    }
  };

  const handleSelectUsbDir = async () => {
    try {
      if (DB.isTauriEnvironment()) {
        const selected = await openDialog({
          directory: true,
          multiple: false,
          title: 'Select USB Auto-Sync Directory',
        });
        if (selected && typeof selected === 'string') {
          setUsbPath(selected);
        }
      }
    } catch (err) {
      console.warn('Folder dialog prompt unavailable:', err);
    }
  };

  const handleClearData = async () => {
    try {
      if (activeEventKey) {
        await DB.clearEventData(activeEventKey);

        useScoutStore.setState((state) => ({
          standRecords: state.standRecords?.filter((r: any) => r.eventKey !== activeEventKey) || [],
        }));

        if (isMounted.current) {
          setSnapshotStatus(`Cleared data for event: ${activeEventKey}`);
          setTimeout(() => {
            if (isMounted.current) setSnapshotStatus(null);
          }, 3000);
        }
      }
    } catch (err) {
      console.error('Failed to clear event data:', err);
    }
    setShowClearConfirm(false);
  };

  const handleFactoryReset = async () => {
    try {
      await DB.wipeDatabase();
      localStorage.clear();
      window.location.reload();
    } catch (err) {
      console.error('Factory reset failed:', err);
    }
    setShowResetConfirm(false);
  };

  // Memoized Theme Lookup
  const activeColors = useMemo(() => {
    return THEME_PRESETS.find(t => t.id === activeTheme)?.colors || THEME_PRESETS[1].colors;
  }, [activeTheme]);

  return (
    <div className="p-6 bg-canvas text-txt-main min-h-screen flex flex-col gap-6 font-sans">
      
      {/* Workspace Top Bar Header */}
      <header className="bg-card border border-border-subtle rounded-xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-3">
          <div className="flex items-center gap-3">
            <Monitor className="w-5 h-5 text-accent" />
            <h1 className="text-base font-bold tracking-wide uppercase">App Configuration & Control Panel</h1>
          </div>
          <div className="flex items-center gap-4 text-xs text-txt-muted tabular-nums">
            <span>App Version: <strong className="text-txt-main">v2.4.0-release</strong></span>
            <span>•</span>
            <span>Tauri Core: <strong className="text-txt-main">v2.1</strong></span>
            <span>•</span>
            <span>Host: <strong className="text-txt-main">Local Windows/Linux</strong></span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs gap-3">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              System Status: <strong className="text-emerald-400">Local SQLite Active</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              GPU Acceleration: <strong className="text-emerald-400">Vulkan Active</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-txt-muted">Quick Theme:</span>
            <select 
              value={activeTheme} 
              onChange={(e) => setActiveTheme(e.target.value as ThemePreset)}
              className="bg-canvas border border-border-subtle rounded px-2 py-1 text-xs focus:outline-none focus:border-accent"
            >
              {THEME_PRESETS.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* 2x2 Modular Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* SECTION 1: TEAM PROFILE & EVENT CONFIGURATION */}
        <section className="bg-card border border-border-subtle rounded-xl p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
            <Building2 className="w-5 h-5 text-accent" />
            <h2 className="text-base font-bold uppercase tracking-wider">Section 1: Team Profile & Event Configuration</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-txt-muted mb-1">Team Number</label>
              <input 
                type="text" 
                value={teamNumber} 
                onChange={(e) => setTeamNumber(e.target.value)}
                className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-1.5 text-sm tabular-nums focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-txt-muted mb-1">Team Name</label>
              <input 
                type="text" 
                value={teamName} 
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <hr className="border-border-subtle my-1" />

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-txt-muted mb-1 flex justify-between">
                  <span>Active Event Key</span>
                  {eventKeySaved && <span className="text-emerald-400 font-mono text-[11px]">Saved 🟢</span>}
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={eventKeyInput} 
                    onChange={(e) => setEventKeyInput(e.target.value)}
                    className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-1.5 text-sm uppercase tabular-nums focus:outline-none focus:border-accent"
                  />
                  <button 
                    onClick={handleEventKeySave}
                    className="bg-accent text-white font-medium px-3 py-1.5 rounded-lg text-xs hover:opacity-90 shrink-0 cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-txt-muted mb-1">Event Name</label>
                <input 
                  type="text" 
                  value={eventName} 
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-txt-muted mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1"><Key className="w-3 h-3 text-accent" /> TBA API Key</span>
                {tbaTestStatus && <span className="text-emerald-400 text-[11px] font-mono">{tbaTestStatus}</span>}
              </label>
              <div className="flex gap-2">
                <input 
                  type="password" 
                  value={tbaApiKey} 
                  onChange={(e) => setTbaApiKey(e.target.value)}
                  className="flex-1 bg-canvas border border-border-subtle rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-accent"
                />
                <button 
                  onClick={handleTestTBA}
                  className="bg-canvas border border-border-subtle hover:border-accent px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Test ⚡
                </button>
              </div>
            </div>
          </div>

          <hr className="border-border-subtle my-1" />

          <div>
            <label className="block text-xs font-medium text-txt-muted mb-1">Team Logo Asset</label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-xs bg-canvas px-3 py-1.5 rounded-lg border border-border-subtle flex-1 truncate h-10">
                {teamLogo ? (
                  <>
                    <img src={teamLogo} alt="Logo preview" className="h-6 w-6 object-contain rounded shrink-0" />
                    <span className="truncate text-txt-main">Custom Logo Uploaded</span>
                  </>
                ) : (
                  <span className="text-txt-muted italic">No logo uploaded (Defaulting to Shield)</span>
                )}
              </div>
              <label className="cursor-pointer bg-canvas border border-border-subtle hover:border-accent px-3 py-2 rounded-lg flex items-center gap-1.5 text-xs font-medium h-10">
                <Upload className="w-3.5 h-3.5" /> Upload
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleLogoUpload}
                />
              </label>
              {teamLogo && (
                <button 
                  onClick={handleRemoveLogo}
                  title="Remove Logo"
                  className="bg-canvas border border-border-subtle hover:border-red-500/50 text-txt-muted hover:text-red-400 p-2 rounded-lg cursor-pointer h-10 flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 2: THEME ENGINE & DESIGN SYSTEM */}
        <section className="bg-card border border-border-subtle rounded-xl p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
            <Palette className="w-5 h-5 text-accent" />
            <h2 className="text-base font-bold uppercase tracking-wider">Section 2: Theme Engine & Design System</h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-txt-muted mb-1">Active Visual Theme Preset</label>
            <select 
              value={activeTheme} 
              onChange={(e) => setActiveTheme(e.target.value as ThemePreset)}
              className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            >
              {THEME_PRESETS.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-txt-muted">Color Swatch Token Live Preview</span>
            <div className="grid grid-cols-4 gap-2">
              <div className="p-2.5 bg-canvas rounded-lg border border-border-subtle flex flex-col items-center gap-1">
                <div className="w-7 h-7 rounded-full border border-border-subtle" style={{ backgroundColor: activeColors.canvas }} />
                <span className="text-[10px] text-txt-muted">Background</span>
                <span className="text-[9px] font-mono">{activeColors.canvas}</span>
              </div>
              <div className="p-2.5 bg-canvas rounded-lg border border-border-subtle flex flex-col items-center gap-1">
                <div className="w-7 h-7 rounded-full border border-border-subtle" style={{ backgroundColor: activeColors.card }} />
                <span className="text-[10px] text-txt-muted">Card Base</span>
                <span className="text-[9px] font-mono">{activeColors.card}</span>
              </div>
              <div className="p-2.5 bg-canvas rounded-lg border border-border-subtle flex flex-col items-center gap-1">
                <div className="w-7 h-7 rounded-full border border-border-subtle" style={{ backgroundColor: activeColors.accent }} />
                <span className="text-[10px] text-txt-muted">Primary Accent</span>
                <span className="text-[9px] font-mono">{activeColors.accent}</span>
              </div>
              <div className="p-2.5 bg-canvas rounded-lg border border-border-subtle flex flex-col items-center gap-1">
                <div className="w-7 h-7 rounded-full border border-border-subtle" style={{ backgroundColor: activeColors.alliance }} />
                <span className="text-[10px] text-txt-muted">Alliance Color</span>
                <span className="text-[9px] font-mono">{activeColors.alliance}</span>
              </div>
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-txt-muted mb-2">Quick Preset Buttons</span>
            <div className="flex flex-wrap gap-2">
              {THEME_PRESETS.slice(0, 8).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTheme(t.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                    activeTheme === t.id 
                      ? 'border-accent bg-accent/10 text-accent' 
                      : 'border-border-subtle bg-canvas hover:border-accent/50'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: DATABASE & FILE STORAGE MANAGEMENT */}
        <section className="bg-card border border-border-subtle rounded-xl p-5 flex flex-col justify-between gap-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2 border-b border-border-subtle pb-3 mb-3">
              <Database className="w-5 h-5 text-accent" />
              <h2 className="text-base font-bold uppercase tracking-wider">Section 3: Database & File Storage</h2>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="p-2.5 bg-canvas rounded-lg border border-border-subtle">
                <span className="text-xs text-txt-muted block">Database Mode</span>
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> WAL Mode Active 🟢
                </span>
              </div>
              <div className="p-2.5 bg-canvas rounded-lg border border-border-subtle">
                <span className="text-xs text-txt-muted block">Database Size</span>
                <span className="text-xs font-semibold tabular-nums mt-1 block">12.8 MB (80 Matches)</span>
              </div>
            </div>

            <div className="mb-4">
              <span className="text-[11px] text-txt-muted block mb-0.5">Active File Path:</span>
              <code className="text-[11px] bg-canvas px-2 py-1 rounded border border-border-subtle block truncate font-mono text-txt-main">
                {activeDbPath}
              </code>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-txt-muted mb-1">Auto-Snapshot Interval</label>
                <select 
                  value={snapshotInterval} 
                  onChange={(e) => setSnapshotInterval(e.target.value)}
                  className="w-full bg-canvas border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent"
                >
                  <option value="5">Every 5 Minutes</option>
                  <option value="15">Every 15 Minutes</option>
                  <option value="30">Every 30 Minutes</option>
                  <option value="60">Every Hour</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-txt-muted mb-1">Rolling Snapshots Retained</label>
                <select 
                  value={retainedSnapshots} 
                  onChange={(e) => setRetainedSnapshots(e.target.value)}
                  className="w-full bg-canvas border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent"
                >
                  <option value="5">5 Snapshots</option>
                  <option value="10">10 Snapshots</option>
                  <option value="20">20 Snapshots</option>
                </select>
              </div>
            </div>

            {snapshotStatus && (
              <div className="p-2 mb-3 bg-emerald-950/40 border border-emerald-500/30 rounded text-xs text-emerald-300 flex items-center gap-2 truncate">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="truncate">{snapshotStatus}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button 
                onClick={handleTriggerSnapshot}
                className="flex-1 bg-canvas hover:bg-border-subtle/20 border border-border-subtle text-txt-main font-medium py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <HardDrive className="w-3.5 h-3.5 text-accent" />
                Create Snapshot Now
              </button>
              <button 
                onClick={handleOpenFolder}
                className="bg-canvas hover:bg-border-subtle/20 border border-border-subtle text-txt-muted hover:text-txt-main px-3 py-2 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
              >
                <Folder className="w-3.5 h-3.5" /> Data Folder
              </button>
            </div>

            <div className="pt-2 border-t border-border-subtle/50">
              <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider block mb-1.5">Danger Zone</span>
              {!showClearConfirm && !showResetConfirm ? (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowClearConfirm(true)}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-medium py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Clear Event Data
                  </button>
                  <button 
                    onClick={() => setShowResetConfirm(true)}
                    className="flex-1 bg-red-900/20 hover:bg-red-900/40 text-red-300 border border-red-600/40 font-medium py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    💣 Factory Reset
                  </button>
                </div>
              ) : showClearConfirm ? (
                <div className="p-2.5 bg-red-950/40 border border-red-500/40 rounded-lg flex flex-col gap-2">
                  <span className="text-xs text-red-300 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    Clear all match scouting records for event key: {activeEventKey}?
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleClearData}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-1 rounded text-xs cursor-pointer"
                    >
                      Confirm Clear
                    </button>
                    <button 
                      onClick={() => setShowClearConfirm(false)}
                      className="flex-1 bg-canvas border border-border-subtle text-txt-muted py-1 rounded text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-red-950/40 border border-red-500/40 rounded-lg flex flex-col gap-2">
                  <span className="text-xs text-red-300 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    Factory reset will wipe local database and settings completely!
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleFactoryReset}
                      className="flex-1 bg-red-700 hover:bg-red-800 text-white font-bold py-1 rounded text-xs cursor-pointer"
                    >
                      Wipe Everything
                    </button>
                    <button 
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 bg-canvas border border-border-subtle text-txt-muted py-1 rounded text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 4: HARDWARE & SYSTEM PERFORMANCE */}
        <section className="bg-card border border-border-subtle rounded-xl p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
            <Cpu className="w-5 h-5 text-accent" />
            <h2 className="text-base font-bold uppercase tracking-wider">Section 4: Hardware & System Performance</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1 text-accent">
                <Sparkles className="w-3.5 h-3.5" /> Local AI Engine ("Frank")
              </span>
              <span className="text-[10px] text-txt-muted font-mono flex items-center gap-1.5">
                <Activity className={`w-3 h-3 ${aiStatus === 'online' ? 'text-emerald-400 animate-pulse' : 'text-red-400'}`} /> 
                {aiStatus === 'online' ? `Latency: ~${aiLatency ?? 38}ms` : 'Engine Offline'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-txt-muted mb-1">Model Engine</label>
                <select 
                  value={provider} 
                  onChange={(e) => setProvider(e.target.value as 'ollama' | 'llamacpp')}
                  className="w-full bg-canvas border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent"
                >
                  <option value="ollama">Ollama (Local GGUF)</option>
                  <option value="llamacpp">Llama.cpp Backend</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-txt-muted mb-1">Active Model</label>
                <select 
                  value={model} 
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-canvas border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent"
                >
                  <option value="llama3:8b-instruct-q4_K_M">llama3:8b-instruct-q4_K_M</option>
                  <option value="mistral:7b-instruct">mistral:7b-instruct</option>
                  <option value="phi3:mini">phi3:mini-4k</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-txt-muted mb-1">GPU Acceleration</label>
              <select 
                value={gpuAccel} 
                onChange={(e) => setGpuAccel(e.target.value)}
                className="w-full bg-canvas border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent"
              >
                <option value="vulkan">Auto-Detect (Vulkan / Metal Enabled) 🟢</option>
                <option value="cuda">NVIDIA CUDA</option>
                <option value="cpu">CPU Fallback (No GPU)</option>
              </select>
            </div>
          </div>

          <hr className="border-border-subtle my-0.5" />

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-txt-muted mb-1 flex items-center gap-1">
                <Folder className="w-3.5 h-3.5" /> USB Auto-Sync Directory
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={usbPath} 
                  onChange={(e) => setUsbPath(e.target.value)}
                  className="w-full bg-canvas border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-accent"
                />
                <button
                  onClick={handleSelectUsbDir}
                  title="Browse Folder"
                  className="bg-canvas border border-border-subtle hover:border-accent px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-accent" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-txt-muted mb-1">Photo Compression</label>
              <select 
                value={photoQuality} 
                onChange={(e) => setPhotoQuality(e.target.value)}
                className="w-full bg-canvas border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent"
              >
                <option value="60">60% (Fastest)</option>
                <option value="80">80% (Balanced)</option>
                <option value="100">100% (Lossless)</option>
              </select>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};