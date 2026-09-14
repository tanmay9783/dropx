import React, { useEffect, useState } from 'react';
import { ArrowLeft, Clock, LogIn, RefreshCw, ShieldAlert, ShieldX, Home, QrCode } from 'lucide-react';
import { getRoom, joinRoom, RoomData, JoinRoomResponse } from '../services/api';
import { useCountdownTimer } from '../hooks/useCountdownTimer';
import { isValidRoomCode } from '../utils/validation';

interface JoinPageProps {
  roomCode: string;
  onSuccess: (data: JoinRoomResponse) => void;
  onCancel: () => void;
  onCreateNew: () => void;
}

export const JoinPage: React.FC<JoinPageProps> = ({
  roomCode,
  onSuccess,
  onCancel,
  onCreateNew,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [joining, setJoining] = useState<boolean>(false);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [errorState, setErrorState] = useState<'NONE' | 'INVALID_CODE' | 'NOT_FOUND' | 'EXPIRED' | 'NETWORK_ERROR'>('NONE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cleanCode = roomCode.trim().toUpperCase();

  const { formattedTime, isExpired } = useCountdownTimer(room?.expiresAt || null, () => {
    setErrorState('EXPIRED');
  });

  useEffect(() => {
    // 1. Client-side room code validation
    if (!isValidRoomCode(cleanCode)) {
      setLoading(false);
      setErrorState('INVALID_CODE');
      setErrorMessage('The room code provided in the URL is malformed.');
      return;
    }

    // 2. Fetch room details
    const loadRoom = async () => {
      setLoading(true);
      setErrorState('NONE');
      setErrorMessage(null);
      try {
        const res = await getRoom(cleanCode);
        setRoom(res.room);
      } catch (err: any) {
        if (err.code === 'ROOM_NOT_FOUND' || err.status === 404) {
          setErrorState('NOT_FOUND');
        } else if (err.code === 'ROOM_EXPIRED' || err.status === 410) {
          setErrorState('EXPIRED');
        } else {
          setErrorState('NETWORK_ERROR');
          setErrorMessage(err.message || 'Unable to connect to DropX. Please check your internet connection.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadRoom();
  }, [cleanCode]);

  const handleJoin = async () => {
    setJoining(true);
    setErrorMessage(null);
    try {
      const data = await joinRoom(cleanCode);
      onSuccess(data);
    } catch (err: any) {
      if (err.code === 'ROOM_EXPIRED' || err.status === 410) {
        setErrorState('EXPIRED');
      } else if (err.code === 'ROOM_NOT_FOUND' || err.status === 404) {
        setErrorState('NOT_FOUND');
      } else {
        setErrorMessage(err.message || 'Failed to join room.');
      }
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto w-full glass-panel p-8 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 text-center flex flex-col items-center shadow-2xl">
        <RefreshCw className="w-10 h-10 text-yellow-400 animate-spin mb-4" />
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">Verifying Room Code {cleanCode}...</h2>
      </div>
    );
  }

  if (errorState === 'INVALID_CODE') {
    return (
      <div className="max-w-md mx-auto w-full glass-panel p-8 rounded-3xl border border-rose-500/30 text-center shadow-2xl">
        <div className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Invalid Room Code</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{errorMessage || 'The room code format is invalid.'}</p>
        <button
          onClick={onCancel}
          className="w-full py-3 px-6 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm flex items-center justify-center space-x-2 border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
        >
          <Home className="w-4 h-4" />
          <span>Go Home</span>
        </button>
      </div>
    );
  }

  if (errorState === 'NOT_FOUND') {
    return (
      <div className="max-w-md mx-auto w-full glass-panel p-8 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 text-center shadow-2xl">
        <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-900 text-slate-500 flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-slate-800">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Room Not Found</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          This room does not exist or may have already expired and been cleaned up.
        </p>
        <button
          onClick={onCancel}
          className="w-full py-3 px-6 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm flex items-center justify-center space-x-2 border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
        >
          <Home className="w-4 h-4" />
          <span>Go Home</span>
        </button>
      </div>
    );
  }

  if (errorState === 'EXPIRED') {
    return (
      <div className="max-w-md mx-auto w-full glass-panel p-8 rounded-3xl border border-rose-500/30 text-center shadow-2xl">
        <div className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
          <ShieldX className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Room Expired</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          This sharing session has ended. All temporary files have been permanently purged from cloud storage.
        </p>
        <button
          onClick={onCreateNew}
          className="w-full py-3.5 px-6 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold flex items-center justify-center space-x-2 shadow-lg shadow-yellow-500/20 transition-all active:scale-95"
        >
          <span>Create New Room</span>
        </button>
      </div>
    );
  }

  if (errorState === 'NETWORK_ERROR') {
    return (
      <div className="max-w-md mx-auto w-full glass-panel p-8 rounded-3xl border border-amber-500/30 text-center shadow-2xl">
        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Connection Error</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{errorMessage}</p>
        <button
          onClick={() => window.location.reload()}
          className="w-full py-3 px-6 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm flex items-center justify-center space-x-2 border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto w-full glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-2xl text-center transition-colors duration-300">
      <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-bold uppercase tracking-wider mb-2">
        <QrCode className="w-3.5 h-3.5" />
        <span>QR Invitation</span>
      </div>

      <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
        Join Temporary Room
      </h2>

      <div className="my-5 py-5 px-4 bg-slate-100 dark:bg-slate-900/90 rounded-2xl border border-yellow-500/30 shadow-inner">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider block mb-1">
          Room Code
        </span>
        <span className="text-4xl font-black tracking-widest text-yellow-400 font-mono">
          {cleanCode}
        </span>
      </div>

      <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-semibold mb-6">
        <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse"></span>
        <span>Session Active</span>
      </div>

      {/* Countdown timer */}
      <div className="bg-slate-100/70 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 mb-8 flex flex-col items-center justify-center">
        <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
          <Clock className="w-3.5 h-3.5 text-yellow-400" />
          <span>Session Expires In</span>
        </div>
        <span className="text-xl font-bold font-mono text-yellow-400">
          {isExpired ? '00:00:00' : formattedTime}
        </span>
      </div>

      {errorMessage && (
        <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center justify-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={handleJoin}
          disabled={joining || isExpired}
          className="w-full py-3.5 px-6 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold flex items-center justify-center space-x-2 shadow-lg shadow-yellow-500/20 transition-all disabled:opacity-50 active:scale-95"
        >
          {joining ? (
            <span>Connecting...</span>
          ) : (
            <>
              <span>Join Session</span>
              <LogIn className="w-4 h-4" />
            </>
          )}
        </button>

        <button
          onClick={onCancel}
          className="w-full py-3 px-6 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center space-x-2 border border-slate-200 dark:border-slate-800 transition-all active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Cancel</span>
        </button>
      </div>
    </div>
  );
};
