import React, { useEffect, useState } from 'react';
import { QrCode, ShieldCheck, Zap, Server, CheckCircle2, AlertCircle, RefreshCw, Plus, LogIn } from 'lucide-react';
import { fetchHealth, HealthResponse, createRoom, RoomData, JoinRoomResponse } from './services/api';
import { CreateRoom } from './components/CreateRoom';
import { JoinRoom } from './components/JoinRoom';
import { ActiveRoom } from './components/ActiveRoom';
import { ExpiredRoom } from './components/ExpiredRoom';
import { JoinPage } from './components/JoinPage';

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
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-8 bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
      {/* Navigation Header */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-800/60">
        <button
          onClick={resetToHome}
          className="flex items-center space-x-3 text-left focus:outline-none group"
        >
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <QrCode className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-black tracking-wider gradient-text">DROPX</span>
        </button>

        {/* Backend Health Badge */}
        <div className="flex items-center space-x-2">
          <div className="glass-panel px-3.5 py-1.5 rounded-full flex items-center space-x-2 text-xs font-medium border border-slate-800">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span>Backend:</span>
            {healthLoading ? (
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            ) : healthError ? (
              <span className="flex items-center text-rose-400 font-semibold">
                <AlertCircle className="w-3.5 h-3.5 mr-1" /> Offline
              </span>
            ) : (
              <span className="flex items-center text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Active ({health?.uptime})
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Body State Router */}
      <main className="max-w-4xl mx-auto w-full my-auto py-10 flex flex-col items-center">
        {appState === 'HOME' && (
          <div className="w-full flex flex-col items-center text-center">
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-8 shadow-sm">
              <Zap className="w-3.5 h-3.5" />
              <span>Temporary & Anonymous File Transfer</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-100 max-w-3xl leading-tight mb-6">
              Share files instantly.<br />
              <span className="gradient-text">No account required.</span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
              Create a secure temporary room, scan the QR code from another device, and transfer files with server-enforced automatic expiration.
            </p>

            {createError && (
              <div className="mb-6 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-center space-x-2 max-w-md w-full">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>{createError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md mb-14">
              <button
                onClick={handleCreateRoom}
                className="w-full sm:w-1/2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="w-4 h-4" />
                <span>Create Room</span>
              </button>
              <button
                onClick={() => setAppState('JOIN_MANUAL')}
                className="w-full sm:w-1/2 py-3.5 px-6 rounded-xl glass-panel hover:bg-slate-800/80 text-slate-200 font-semibold flex items-center justify-center space-x-2 border border-slate-700 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <LogIn className="w-4 h-4" />
                <span>Join Room</span>
              </button>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full text-left">
              <div className="glass-panel p-6 rounded-2xl border border-slate-800/80">
                <div className="h-10 w-10 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-4">
                  <QrCode className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-2">QR Code Pairing</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Scan the host QR code from mobile devices to open `/join/:roomCode` instantly.
                </p>
              </div>

              <div className="glass-panel p-6 rounded-2xl border border-slate-800/80">
                <div className="h-10 w-10 rounded-xl bg-violet-950/60 border border-violet-500/30 text-violet-400 flex items-center justify-center mb-4">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-2">Real-Time Signaling</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Socket.IO room presence notifies connected members live when devices join or disconnect.
                </p>
              </div>

              <div className="glass-panel p-6 rounded-2xl border border-slate-800/80">
                <div className="h-10 w-10 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-4">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-2">Owner Controls</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Timing-safe owner token authorization for immediate session termination.
                </p>
              </div>
            </div>
          </div>
        )}

        {appState === 'CREATING' && (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
            <h2 className="text-lg font-bold text-slate-200">Creating Secure Temporary Room...</h2>
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
      <footer className="max-w-6xl mx-auto w-full pt-8 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <div>DropX Platform — Phase 4 Socket.IO Real-Time Active</div>
        <div className="flex items-center space-x-4">
          <span>Signed Socket Auth</span>
          <span>•</span>
          <span>Zero File Data on Sockets</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
