import React, { useState } from 'react';
import { Monitor, Wifi, Play, StopCircle, Sparkles, Camera, AlertCircle, X } from 'lucide-react';

interface ScreenShareCardProps {
  isSharingScreen: boolean;
  hasRemoteStream: boolean;
  participantCount: number;
  p2pStatus: string;
  supportsScreenShare: boolean;
  supportsCameraShare?: boolean;
  onStartShare: (mode: 'screen' | 'camera') => Promise<any> | void;
  onStopShare: () => void;
  onOpenViewer: () => void;
  peerDeviceName?: string;
}

export const ScreenShareCard: React.FC<ScreenShareCardProps> = ({
  isSharingScreen,
  hasRemoteStream,
  participantCount,
  p2pStatus,
  supportsScreenShare: _supportsScreenShare,
  onStartShare,
  onStopShare,
  onOpenViewer,
  peerDeviceName = 'Connected Device',
}) => {
  const isP2PConnected = p2pStatus === 'CONNECTED';
  const hasMultipleDevices = participantCount > 1;
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  const [shareError, setShareError] = useState<string | null>(null);
  const [startingMode, setStartingMode] = useState<'screen' | 'camera' | null>(null);

  const handleStart = async (mode: 'screen' | 'camera') => {
    setShareError(null);
    setStartingMode(mode);
    try {
      await onStartShare(mode);
    } catch (err: any) {
      setShareError(err?.message || 'Failed to start media share.');
    } finally {
      setStartingMode(null);
    }
  };

  return (
    <div className="w-full glass-panel-subtle rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800/80 my-4 text-left transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex-shrink-0">
            <Monitor className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
              P2P Screen Share & Remote View
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Zero server bandwidth • WebRTC direct device mirroring
            </p>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="flex-shrink-0 self-start sm:self-auto">
          {isSharingScreen ? (
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              <span>Broadcasting</span>
            </span>
          ) : hasRemoteStream ? (
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Live Feed Ready</span>
            </span>
          ) : isP2PConnected ? (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span>LAN P2P Ready</span>
            </span>
          ) : hasMultipleDevices ? (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
              <Wifi className="w-3 h-3 animate-pulse" />
              <span>Connecting P2P...</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-medium border border-slate-700/50">
              <span>Waiting for 2nd Device</span>
            </span>
          )}
        </div>
      </div>

      {/* Dynamic Action / Information Area */}
      {isSharingScreen ? (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
          <div className="flex items-center space-x-2 text-xs text-rose-300">
            <Sparkles className="w-4 h-4 text-rose-400 flex-shrink-0 animate-bounce" />
            <span>You are actively sharing your screen/camera with connected room devices.</span>
          </div>
          <button
            onClick={onStopShare}
            className="w-full sm:w-auto min-h-[42px] py-2 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all active:scale-95 shadow-sm"
          >
            <StopCircle className="w-4 h-4" />
            <span>Stop Sharing</span>
          </button>
        </div>
      ) : hasRemoteStream ? (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center space-x-2.5 text-xs text-emerald-300 min-w-0">
            <Monitor className="w-4 h-4 text-emerald-400 flex-shrink-0 animate-pulse" />
            <span className="truncate">Live screen stream available from <strong>{peerDeviceName}</strong>.</span>
          </div>
          <button
            onClick={onOpenViewer}
            className="w-full sm:w-auto min-h-[42px] py-2 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Open Live Viewer</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-400 leading-relaxed">
            {!hasMultipleDevices
              ? 'Connect a 2nd device (phone or laptop) to share screen or live camera peer-to-peer.'
              : isMobile
              ? 'Stream your mobile screen or camera directly to connected devices.'
              : 'Mirror your screen or stream your camera directly to connected devices with zero server lag.'}
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {/* Share Screen Button */}
            <button
              onClick={() => handleStart('screen')}
              disabled={!hasMultipleDevices || startingMode !== null}
              className="w-full sm:w-auto min-h-[44px] py-2.5 px-4 rounded-xl bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:hover:bg-yellow-400 text-black font-bold text-xs flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-sm cursor-pointer disabled:cursor-not-allowed"
              title="Share your display, app window, or mobile screen"
            >
              <Monitor className="w-4 h-4" />
              <span>
                {startingMode === 'screen'
                  ? 'Starting...'
                  : isMobile
                  ? 'Share Screen'
                  : 'Share Screen'}
              </span>
            </button>

            {/* Share Camera Button */}
            <button
              onClick={() => handleStart('camera')}
              disabled={!hasMultipleDevices || startingMode !== null}
              className="w-full sm:w-auto min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 hover:border-yellow-500/40 text-slate-200 font-semibold text-xs flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Stream live camera directly from your phone or webcam"
            >
              <Camera className="w-4 h-4 text-yellow-400" />
              <span>
                {startingMode === 'camera'
                  ? 'Opening Camera...'
                  : isMobile
                  ? 'Share Camera'
                  : 'Share Camera'}
              </span>
            </button>
          </div>
        </div>
      )}

      {shareError && (
        <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start justify-between animate-fade-in gap-2">
          <div className="flex items-start space-x-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{shareError}</span>
          </div>
          <button
            onClick={() => setShareError(null)}
            className="text-slate-400 hover:text-white p-1 transition-colors flex-shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

