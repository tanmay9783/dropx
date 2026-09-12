import React, { useState } from 'react';
import { ArrowLeft, LogIn, AlertCircle } from 'lucide-react';
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
    <div className="max-w-md mx-auto w-full glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl">
      <button
        onClick={onBack}
        className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-slate-200 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home</span>
      </button>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-100 mb-2">Join a Room</h2>
        <p className="text-xs text-slate-400">
          Enter the 6-character room code generated on the host device.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 text-center">
            Room Code
          </label>
          <input
            type="text"
            value={code}
            onChange={handleInputChange}
            placeholder="X7K9P2"
            maxLength={6}
            className="w-full py-4 text-center text-3xl font-black font-mono tracking-widest bg-slate-900 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-2xl text-cyan-400 placeholder:text-slate-600 outline-none uppercase transition-all"
            autoFocus
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span>Joining Room...</span>
          ) : (
            <>
              <span>Join Room</span>
              <LogIn className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
