import React, { useEffect, useState } from 'react';
import { 
  QrCode, 
  Zap, 
  Plus, 
  LogIn, 
  Cloud,
  AlertCircle,
  RefreshCw
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
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 font-bold uppercase">
                v2.0
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium tracking-tight block -mt-0.5">
              Instant QR File & Text Share
            </span>
          </div>
        </button>
      </header>

      {/* Main App Content Viewport */}
      <main className="max-w-4xl mx-auto w-full my-auto py-8 sm:py-12 flex flex-col items-center">
        {appState === 'HOME' && (
          <div className="w-full flex flex-col items-center text-center">
            {/* Top Pill Badge */}
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span>Instant Mobile & PC Pairing</span>
            </div>

            {/* Hero Heading */}
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-3xl leading-[1.15] mb-4 animate-fade-in-up">
              Share Files & Text Instantly.<br />
              <span className="gradient-text">Zero Login Required.</span>
            </h1>

            {/* Hero Description */}
            <p className="text-sm sm:text-base text-slate-400 max-w-lg mb-8 leading-relaxed font-normal animate-fade-in-up delay-100">
              Scan the QR code from any mobile device or PC to share files and live clipboard text in seconds.
            </p>

            {createError && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-center space-x-2 max-w-md w-full animate-fade-in-up delay-100">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>{createError}</span>
              </div>
            )}

            {/* Main Action CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md mb-12 animate-fade-in-up delay-200">
              <button
                onClick={handleCreateRoom}
                className="w-full sm:w-1/2 min-h-[52px] py-3.5 px-6 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-black font-black text-sm flex items-center justify-center space-x-2 shadow-xl shadow-yellow-500/20 transition-all transform hover:scale-[1.02] active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Create Room</span>
              </button>
              <button
                onClick={() => setAppState('JOIN_MANUAL')}
                className="w-full sm:w-1/2 min-h-[52px] py-3.5 px-6 rounded-2xl glass-panel hover:bg-slate-900 text-yellow-400 font-bold text-sm flex items-center justify-center space-x-2 border border-yellow-500/30 transition-all transform hover:scale-[1.02] active:scale-95 shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                <span>Join with Code</span>
              </button>
            </div>

            {/* Clean 2-Card Feature Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full text-left animate-fade-in-up delay-300">
              <div className="glass-panel p-5 rounded-2xl border border-slate-800 hover:border-yellow-500/40 transition-all hover:-translate-y-1">
                <div className="h-10 w-10 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center justify-center mb-3">
                  <QrCode className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">
                  Instant QR Connect
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Scan the QR code with phone camera to connect without typing URLs.
                </p>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-slate-800 hover:border-yellow-500/40 transition-all hover:-translate-y-1">
                <div className="h-10 w-10 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center justify-center mb-3">
                  <Cloud className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">
                  Files & Live Clipboard
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Transfer files up to 100MB and sync copied text notes in real-time.
                </p>
              </div>
            </div>

            {/* Recruiter / Portfolio Section */}
            <div className="mt-8 w-full glass-panel-subtle p-5 sm:p-6 rounded-2xl border border-yellow-500/20 text-left animate-fade-in-up delay-300 relative overflow-hidden group">
              <div className="absolute inset-0 bg-yellow-500/5 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>
              <h3 className="text-sm font-bold text-yellow-400 mb-2 flex items-center space-x-2">
                <Zap className="w-4 h-4" />
                <span>Built for Performance & Scale</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                DropX is engineered by Tanmay to demonstrate full-stack proficiency. Built using React, Node.js, and WebSocket architecture, this application features real-time bidirectional syncing, robust session management, and ephemeral storage. The UI leverages custom CSS properties and Tailwind for a state-of-the-art glassmorphism design, providing a buttery-smooth, responsive user experience across all devices.
              </p>
            </div>
          </div>
        )}

        {appState === 'CREATING' && (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="h-16 w-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500 mb-4 shadow-xl shadow-cyan-500/10">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
              Generating Secure Session...
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Allocating private temporary storage space & cryptographic room keys.
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

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full pt-8 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-4">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-700 dark:text-slate-300">DropX Platform</span>
          <span>•</span>
          <span className="text-yellow-500/80 font-medium">Created by Tanmay</span>
        </div>
        <div className="flex items-center space-x-4 font-mono text-[11px]">
          <span>High-Speed Local Storage</span>
          <span>•</span>
          <span>Zero File Persistence</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
