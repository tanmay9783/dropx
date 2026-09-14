import React, { useEffect, useState } from 'react';
import {
  QrCode,
  Zap,
  Plus,
  LogIn,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Lock,
  Cpu,
  Share2,
  CheckCircle2,
  Terminal,
  Code2,
  Layers,
  Wifi
} from 'lucide-react';
import { createRoom, RoomData, JoinRoomResponse } from './services/api';
import { CreateRoom } from './components/CreateRoom';
import { JoinRoom } from './components/JoinRoom';
import { ActiveRoom } from './components/ActiveRoom';
import { ExpiredRoom } from './components/ExpiredRoom';
import { JoinPage } from './components/JoinPage';

type AppState = 'HOME' | 'CREATING' | 'ACTIVE_OWNER' | 'JOIN_MANUAL' | 'JOIN_URL' | 'ACTIVE_PARTICIPANT' | 'EXPIRED';

export const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('HOME');

  // Active room data
  const [activeRoom, setActiveRoom] = useState<RoomData | null>(null);
  const [ownerToken, setOwnerToken] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [socketToken, setSocketToken] = useState<string | null>(null);
  const [urlRoomCode, setUrlRoomCode] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Parse path on initial load and handle browser back/forward buttons
  const syncRouteFromLocation = () => {
    const path = window.location.pathname;
    const matchJoin = path.match(/^\/join\/([a-zA-Z0-9_-]+)/);
    const matchRoom = path.match(/^\/room\/([a-zA-Z0-9_-]+)/);
    const code = matchJoin?.[1] || matchRoom?.[1];
    if (code) {
      setUrlRoomCode(code.toUpperCase());
      setAppState('JOIN_URL');
    } else if (path === '/' && (appState === 'JOIN_URL' || appState === 'JOIN_MANUAL')) {
      setAppState('HOME');
    }
  };

  useEffect(() => {
    syncRouteFromLocation();
    window.addEventListener('popstate', syncRouteFromLocation);
    return () => window.removeEventListener('popstate', syncRouteFromLocation);
  }, []);

  const handleCreateRoom = async () => {
    setAppState('CREATING');
    setCreateError(null);
    try {
      const data = await createRoom();
      setActiveRoom(data.room);
      setOwnerToken(data.ownerToken);
      setSocketToken(data.socketToken);
      setAppState('ACTIVE_OWNER');
      window.history.pushState({}, '', `/room/${data.room.roomCode}`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create room');
      setAppState('HOME');
    }
  };

  const handleJoinSuccess = (data: JoinRoomResponse) => {
    setActiveRoom(data.room);
    setParticipantId(data.participantId);
    setSocketToken(data.socketToken);
    setAppState('ACTIVE_PARTICIPANT');
    window.history.pushState({}, '', `/room/${data.room.roomCode}`);
  };

  const handleExpire = () => {
    setAppState('EXPIRED');
  };

  const resetToHome = () => {
    setActiveRoom(null);
    setOwnerToken(null);
    setParticipantId(null);
    setSocketToken(null);
    setUrlRoomCode(null);
    setCreateError(null);
    setAppState('HOME');
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-8 bg-black text-slate-100 bg-mesh selection:bg-yellow-400 selection:text-black transition-colors duration-300">
      {/* Navigation Bar */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-800/80">
        <button
          onClick={resetToHome}
          className="flex items-center space-x-3 text-left focus:outline-none group"
        >
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-yellow-400 via-amber-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20 group-hover:scale-105 transition-all">
            <QrCode className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-2xl font-black tracking-wider gradient-text font-sans">DROPX</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium tracking-tight block -mt-0.5">
              Instant Encrypted File & Text Share
            </span>
          </div>
        </button>
      </header>

      {/* Main App Content Viewport */}
      <main className="max-w-5xl mx-auto w-full my-auto py-8 sm:py-12 flex flex-col items-center">
        {appState === 'HOME' && (
          <div className="w-full flex flex-col items-center text-center">
            {/* Top Badge */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-semibold tracking-wide mb-6 animate-fade-in-up">
              {/* <Zap className="w-3.5 h-3.5 text-yellow-400" /> */}
              <span>Instant & Private Local Sharing</span>
            </div>

            {/* Hero Heading */}
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-3xl leading-[1.12] mb-5 animate-fade-in-up">
              High-Speed Local Sharing.<br />
              <span className="gradient-text">Zero Trace. Zero Logs.</span>
            </h1>

            {/* Hero Description */}
            <p className="text-sm sm:text-base text-slate-400 max-w-xl mb-8 leading-relaxed font-normal animate-fade-in-up delay-100">
              Pair any phone, laptop, or tablet in seconds via QR code. Instantly sync files, photos, and live clipboard text with end-to-end memory isolation.
            </p>

            {createError && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-center space-x-2 max-w-md w-full animate-fade-in-up delay-100">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>{createError}</span>
              </div>
            )}

            {/* Main Action CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full max-w-md mb-8 animate-fade-in-up delay-200">
              <button
                onClick={handleCreateRoom}
                className="w-full sm:w-1/2 min-h-[54px] py-3.5 px-6 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-black font-black text-sm flex items-center justify-center space-x-2 shadow-xl shadow-yellow-500/20 transition-all transform hover:scale-[1.02] active:scale-95"
              >
                <Plus className="w-4.5 h-4.5 stroke-[2.5]" />
                <span>Create Instant Room</span>
              </button>
              <button
                onClick={() => setAppState('JOIN_MANUAL')}
                className="w-full sm:w-1/2 min-h-[54px] py-3.5 px-6 rounded-2xl glass-panel hover:bg-slate-900 text-yellow-400 font-bold text-sm flex items-center justify-center space-x-2 border border-yellow-500/30 transition-all transform hover:scale-[1.02] active:scale-95 shadow-sm"
              >
                <LogIn className="w-4.5 h-4.5" />
                <span>Join with Code</span>
              </button>
            </div>

            {/* Trust Micro Badges */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs text-slate-400 mb-14 animate-fade-in-up delay-200">
              <div className="flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-yellow-400" />
                <span>100% Ephemeral RAM Storage</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span>Sub-50ms Sync Latency</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Lock className="w-4 h-4 text-yellow-400" />
                <span>No Login Required</span>
              </div>
            </div>

            {/* Step-by-Step Trust Section */}
            <div className="w-full mb-14 text-left animate-fade-in-up delay-300">
              <div className="flex items-center space-x-2 mb-6">
                <div className="h-2 w-2 rounded-full bg-yellow-400"></div>
                <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
                  How DropX Works
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-panel p-6 rounded-2xl border border-slate-800/90 relative overflow-hidden group hover:border-yellow-500/40 transition-all">
                  <div className="text-3xl font-black text-slate-800 group-hover:text-yellow-500/20 transition-colors mb-2 font-mono">01</div>
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center space-x-2">
                    <QrCode className="w-4 h-4 text-yellow-400" />
                    <span>Instant Pairing</span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Click "Create Room" or scan the QR code with your phone camera. No logins, accounts, or emails required.
                  </p>
                </div>

                <div className="glass-panel p-6 rounded-2xl border border-slate-800/90 relative overflow-hidden group hover:border-yellow-500/40 transition-all">
                  <div className="text-3xl font-black text-slate-800 group-hover:text-yellow-500/20 transition-colors mb-2 font-mono">02</div>
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center space-x-2">
                    <Share2 className="w-4 h-4 text-yellow-400" />
                    <span>Stream & Sync</span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Drag and drop files up to 100MB or type live clipboard notes. Data syncs across devices via Socket.IO events.
                  </p>
                </div>

                <div className="glass-panel p-6 rounded-2xl border border-slate-800/90 relative overflow-hidden group hover:border-yellow-500/40 transition-all">
                  <div className="text-3xl font-black text-slate-800 group-hover:text-yellow-500/20 transition-colors mb-2 font-mono">03</div>
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-yellow-400" />
                    <span>Auto-Purge Security</span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    When you close the tab or session expires, all data is wiped clean from server memory. 0% disk persistence.
                  </p>
                </div>
              </div>
            </div>

            {/* Engineering Highlights Section */}
            <div className="w-full glass-panel p-6 sm:p-8 rounded-3xl border border-yellow-500/30 text-left animate-fade-in-up delay-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Terminal className="w-36 h-36 text-yellow-400" />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 mb-6 border-b border-slate-800/80 pb-4">
                <div className="flex items-center space-x-2">
                  <Code2 className="w-5 h-5 text-yellow-400" />
                  <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-widest">
                    How DropX Is Built
                  </span>
                </div>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-semibold">
                  Created by Tanmay
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-white mb-3">
                Real-Time WebSockets & In-Memory Sync
              </h3>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6 max-w-3xl">
                DropX connects your devices instantly across mobile and desktop. Built with Socket.IO and temporary memory buffers, it streams files and copied text live without saving anything to a persistent database.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="glass-panel-subtle p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center space-x-2 text-yellow-400 text-xs font-bold mb-1">
                    <Wifi className="w-4 h-4" />
                    <span>Real-Time Data Streaming</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Socket.IO event listeners stream file chunks and clipboard text instantly between your connected devices.
                  </p>
                </div>

                <div className="glass-panel-subtle p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center space-x-2 text-yellow-400 text-xs font-bold mb-1">
                    <Cpu className="w-4 h-4" />
                    <span>Zero Database / RAM Only</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Files reside strictly in volatile RAM and are automatically purged when your session ends or expires.
                  </p>
                </div>

                <div className="glass-panel-subtle p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center space-x-2 text-yellow-400 text-xs font-bold mb-1">
                    <Lock className="w-4 h-4" />
                    <span>Secure Session Isolation</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Every room uses random codes and session tokens so only your paired devices can access shared content.
                  </p>
                </div>

                <div className="glass-panel-subtle p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center space-x-2 text-yellow-400 text-xs font-bold mb-1">
                    <Layers className="w-4 h-4" />
                    <span>Clean Dark-Mode UI</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Crafted with React, TypeScript, and Tailwind CSS featuring an OLED black theme optimized for phones and PCs.
                  </p>
                </div>
              </div>

              {/* Tech Stack Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                <span className="text-[11px] font-mono text-slate-400 font-semibold mr-1">TECH STACK:</span>
                {['React', 'TypeScript', 'Node.js', 'Express', 'Socket.IO', 'Tailwind CSS', 'Vite'].map((tech) => (
                  <span key={tech} className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-slate-900 text-yellow-400/90 border border-slate-800 font-medium">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {appState === 'CREATING' && (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="h-16 w-16 rounded-3xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400 mb-4 shadow-xl shadow-yellow-500/10">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">
              Generating Secure Session...
            </h2>
            <p className="text-xs text-slate-400">
              Creating private temporary room & security tokens.
            </p>
          </div>
        )}

        {appState === 'ACTIVE_OWNER' && activeRoom && ownerToken && socketToken && (
          <CreateRoom
            room={activeRoom}
            ownerToken={ownerToken}
            socketToken={socketToken}
            onExpire={handleExpire}
            onDestroy={resetToHome}
            onBack={resetToHome}
          />
        )}

        {appState === 'JOIN_MANUAL' && (
          <JoinRoom
            onSuccess={handleJoinSuccess}
            onBack={resetToHome}
          />
        )}

        {appState === 'JOIN_URL' && urlRoomCode && (
          <JoinPage
            roomCode={urlRoomCode}
            onSuccess={handleJoinSuccess}
            onCancel={resetToHome}
            onCreateNew={handleCreateRoom}
          />
        )}

        {appState === 'ACTIVE_PARTICIPANT' && activeRoom && participantId && socketToken && (
          <ActiveRoom
            room={activeRoom}
            participantId={participantId}
            socketToken={socketToken}
            onExpire={handleExpire}
            onLeave={resetToHome}
          />
        )}

        {appState === 'EXPIRED' && (
          <ExpiredRoom onCreateNew={handleCreateRoom} />
        )}
      </main>

      {/* SaaS Footer */}
      {appState === 'HOME' && (
        <footer className="max-w-5xl mx-auto w-full pt-8 pb-4 border-t border-slate-800/80 text-xs text-slate-400 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Col 1: Branding */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="h-6 w-6 rounded-lg bg-yellow-400 flex items-center justify-center">
                  <QrCode className="w-4 h-4 text-black" />
                </div>
                <span className="font-black text-sm tracking-wider text-white">DROPX</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Fast, private file and text sharing between devices. No logins, no permanent logs.
              </p>
              <div className="pt-1">
                <span className="text-xs font-semibold text-yellow-400">Made with ❤️ by Tanmay &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </span>
              </div>
            </div>

            {/* Col 2: Core Features */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-white uppercase tracking-wider font-mono">Privacy & Security</h4>
              <ul className="space-y-1.5 text-xs text-slate-400">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                  <span>Zero File Persistence & No Databases</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                  <span>Automatic Memory Purge on Exit</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                  <span>Private Socket Communications</span>
                </li>
              </ul>
            </div>

            {/* Col 3: Specifications */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-white uppercase tracking-wider font-mono">Platform Limits</h4>
              <div className="space-y-1.5 text-xs text-slate-400">
                <div className="flex justify-between border-b border-slate-800/60 pb-1">
                  <span>Max Payload Cap:</span>
                  <span className="font-mono text-yellow-400">100 MB</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1">
                  <span>Session Duration:</span>
                  <span className="font-mono text-yellow-400">15 Minutes</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1">
                  <span>Storage Logs:</span>
                  <span className="font-mono text-emerald-400">0% Stored</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-4 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
            <div>
              © {new Date().getFullYear()} DropX by <span className="text-slate-300 font-medium">Tanmay</span>. Transfers are completely ephemeral.
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default App;

