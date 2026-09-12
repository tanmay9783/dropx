import React, { useState } from 'react';
import { ArrowLeft, LogIn, AlertCircle, KeyRound } from 'lucide-react';
import { joinRoom, JoinRoomResponse } from '../services/api';

interface JoinRoomProps {
  onSuccess: (data: JoinRoomResponse) => void;
  onBack: () => void;
}

export const JoinRoom: React.FC<JoinRoomProps> = ({ onSuccess, onBack }) => {
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setError('Please enter a valid 6-character room code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await joinRoom(cleanCode);
      onSuccess(data);
    } catch (err: any) {
      if (err.code === 'ROOM_NOT_FOUND') {
        setError('Room not found. Please check the room code.');
      } else if (err.code === 'ROOM_EXPIRED') {
        setError('This room has expired and is no longer available.');
      } else {
        setError(err.message || 'Failed to join room. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^2-9A-Z]/g, '');
    if (val.length <= 6) {
      setCode(val);
      setError(null);
    }
  };

  return (
    <div className="max-w-md mx-auto w-full glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-2xl transition-colors duration-300">
      <button
        onClick={onBack}
        className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home</span>
      </button>

      <div className="text-center mb-8">
        <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center mx-auto mb-3">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-1">
          Join File Room
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Enter the 6-character room code displayed on the host screen.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 text-center">
            6-Character Room Code
          </label>
          <input
            type="text"
            value={code}
            onChange={handleInputChange}
            placeholder="X7K9P2"
            maxLength={6}
            className="w-full py-4 text-center text-3xl font-black font-mono tracking-widest bg-slate-50 dark:bg-slate-900/90 border-2 border-slate-200 dark:border-slate-700 focus:border-cyan-500 dark:focus:border-cyan-400 rounded-2xl text-cyan-600 dark:text-cyan-400 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none uppercase transition-all shadow-inner"
            autoFocus
          />
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center justify-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          {loading ? (
            <span>Connecting to Room...</span>
          ) : (
            <>
              <span>Join Session</span>
              <LogIn className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
