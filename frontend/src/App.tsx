import React, { useEffect, useState } from 'react';
import { 
  QrCode, 
  Zap, 
  Server, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Plus, 
  LogIn, 
  Cloud, 
  Lock
} from 'lucide-react';
import { fetchHealth, HealthResponse, createRoom, RoomData, JoinRoomResponse } from './services/api';
import { CreateRoom } from './components/CreateRoom';
import { JoinRoom } from './components/JoinRoom';
import { ActiveRoom } from './components/ActiveRoom';
import { ExpiredRoom } from './components/ExpiredRoom';
import { JoinPage } from './components/JoinPage';
import { ThemeToggle } from './components/ThemeToggle';

type AppState = 'HOME' | 'CREATING' | 'ACTIVE_OWNER' | 'JOIN_MANUAL' | 'JOIN_URL' | 'ACTIVE_PARTICIPANT' | 'EXPIRED';

export const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('HOME');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);

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
    const match = path.match(/^\/join\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      setUrlRoomCode(match[1].toUpperCase());
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

  const checkStatus = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const data = await fetchHealth();
      setHealth(data);
    } catch (err: any) {
      setHealthError(err.message || 'Failed to connect to backend server');
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
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
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-8 bg-slate-950 dark:bg-slate-950 text-slate-900 dark:text-slate-100 bg-mesh bg-grid-pattern selection:bg-cyan-500 selection:text-slate-950 transition-colors duration-300">
      {/* Navigation Bar */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <button
          onClick={resetToHome}
          className="flex items-center space-x-3 text-left focus:outline-none group"
        >
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-cyan-500 via-brand-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 group-hover:scale-105 group-hover:shadow-cyan-500/40 transition-all">
            <QrCode className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-2xl font-black tracking-wider gradient-text font-sans">DROPX</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 font-bold uppercase">
                v2.0
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium tracking-tight block -mt-0.5">
              Cloud QR File Sharing
            </span>
          </div>
        </button>

        {/* Right Nav Utilities: Health Check & Theme Toggle */}
        <div className="flex items-center space-x-3">
          {/* Health Badge */}
          <div className="glass-panel px-3.5 py-1.5 rounded-full flex items-center space-x-2 text-xs font-semibold border border-slate-200 dark:border-slate-800 shadow-sm">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline text-slate-500 dark:text-slate-400">Server Node:</span>
            {healthLoading ? (
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            ) : healthError ? (
              <span className="flex items-center text-rose-500 font-bold">
                <AlertCircle className="w-3.5 h-3.5 mr-1" /> Offline
              </span>
            ) : (
              <span className="flex items-center text-emerald-500 font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
                Active ({health?.uptime})
              </span>
            )}
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </header>

      {/* Main App Content Viewport */}
      <main className="max-w-5xl mx-auto w-full my-auto py-8 sm:py-12 flex flex-col items-center">
        {appState === 'HOME' && (
          <div className="w-full flex flex-col items-center text-center">
            {/* Top Pill Badge */}
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
              <Zap className="w-3.5 h-3.5 text-cyan-500" />
              <span>Zero-Knowledge QR File Transfer</span>
            </div>

            {/* Hero Heading */}
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-slate-900 dark:text-slate-100 max-w-4xl leading-[1.1] mb-6">
              Share files instantly.<br />
              <span className="gradient-text">Zero accounts required.</span>
            </h1>

            {/* Hero Description */}
            <p className="text-base sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mb-10 leading-relaxed font-normal">
              Create an encrypted temporary room, scan the QR code from any smartphone or laptop, and transfer files directly through high-speed local storage with automated session cleanup.
            </p>

            {createError && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center justify-center space-x-2 max-w-md w-full">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>{createError}</span>
              </div>
            )}

            {/* Main Action CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md mb-16">
              <button
                onClick={handleCreateRoom}
                className="w-full sm:w-1/2 py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-brand-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-black text-sm flex items-center justify-center space-x-2 shadow-xl shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-98"
              >
                <Plus className="w-4 h-4" />
                <span>Create Room</span>
              </button>
              <button
                onClick={() => setAppState('JOIN_MANUAL')}
                className="w-full sm:w-1/2 py-4 px-6 rounded-2xl glass-panel hover:bg-slate-100 dark:hover:bg-slate-800/90 text-slate-800 dark:text-slate-200 font-bold text-sm flex items-center justify-center space-x-2 border border-slate-300 dark:border-slate-700 transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-98 shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                <span>Join with Code</span>
              </button>
            </div>

            {/* Bento Grid Feature Showcase */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full text-left">
              {/* Feature 1 */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 hover:border-cyan-500/40 dark:hover:border-cyan-500/40 transition-all hover:shadow-xl group">
                <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <QrCode className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mb-2">
                  Instant QR Pairing
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Scan the host QR code using any smartphone camera to pair instantly without entering URLs or installing apps.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 hover:border-violet-500/40 dark:hover:border-violet-500/40 transition-all hover:shadow-xl group">
                <div className="h-12 w-12 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Cloud className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mb-2">
                  High-Speed Transfer
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Files upload directly to high-speed local disk storage via secure streams up to 100MB per file.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all hover:shadow-xl group">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mb-2">
                  Zero-Trace Auto Cleanup
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Rooms automatically expire after their lifespan. Storage files and metadata are purged with zero leftover traces.
                </p>
              </div>
            </div>

            {/* Architecture Metrics Strip */}
            <div className="mt-10 py-4 px-6 rounded-2xl glass-panel-subtle border border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-around gap-6 w-full text-xs text-slate-600 dark:text-slate-400 font-mono">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-500" />
                <span>Self-Hosted Core</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Local Storage AES-256</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-violet-500" />
                <span>Socket.IO Real-Time Engine</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500" />
                <span>100MB Max File Size</span>
              </div>
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
          <span>Self-Hosted Edition</span>
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
