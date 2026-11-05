import React, { useState } from 'react';
import { ArrowLeft, LogIn, AlertCircle, KeyRound, Camera } from 'lucide-react';
import { joinRoom, JoinRoomResponse } from '../services/api';
import { QrScannerModal } from './QrScannerModal';

interface JoinRoomProps {
  onSuccess: (data: JoinRoomResponse) => void;
  onBack: () => void;
}

export const JoinRoom: React.FC<JoinRoomProps> = ({ onSuccess, onBack }) => {
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  const performJoin = async (targetCode: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await joinRoom(targetCode);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setError('Please enter a valid 6-character room code.');
      return;
    }
    await performJoin(cleanCode);
  };

  const handleScanSuccess = async (scannedCode: string, scannedKey?: string | null) => {
    setCode(scannedCode);
    if (scannedKey) {
      window.location.hash = `#key=${scannedKey}`;
    }
    await performJoin(scannedCode);
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

      <div className="text-center mb-6">
        <div className="h-12 w-12 rounded-2xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center justify-center mx-auto mb-3">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-1">
          Join File Room
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Scan the QR code or enter the 6-character room code.
        </p>
      </div>

      {/* Built-in Camera QR Scan Button */}
      <button
        type="button"
        onClick={() => setIsScannerOpen(true)}
        className="w-full py-3.5 px-4 mb-5 rounded-2xl bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-400 border border-yellow-500/30 font-bold text-xs flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-sm"
      >
        <Camera className="w-4 h-4 text-yellow-400 animate-pulse" />
        <span>Scan QR Code with Camera</span>
      </button>

      <div className="relative flex py-1 items-center mb-5">
        <div className="flex-grow border-t border-slate-800"></div>
        <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          or enter code manually
        </span>
        <div className="flex-grow border-t border-slate-800"></div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
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
            className="w-full py-3.5 text-center text-3xl font-black font-mono tracking-widest bg-slate-50 dark:bg-slate-900/90 border-2 border-slate-200 dark:border-slate-700 focus:border-yellow-400 dark:focus:border-yellow-400 rounded-2xl text-yellow-400 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none uppercase transition-all shadow-inner"
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
          className="w-full py-3.5 px-6 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold flex items-center justify-center space-x-2 shadow-lg shadow-yellow-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
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

      {/* Camera QR Scanner Viewfinder Modal */}
      {isScannerOpen && (
        <QrScannerModal
          onScan={handleScanSuccess}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </div>
  );
};

