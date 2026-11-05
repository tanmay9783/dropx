import React from 'react';
import { Monitor, Wifi, Play, StopCircle, Sparkles, Smartphone } from 'lucide-react';

interface ScreenShareCardProps {
  isSharingScreen: boolean;
  hasRemoteStream: boolean;
  participantCount: number;
  p2pStatus: string;
  supportsScreenShare: boolean;
  onStartShare: () => void;
  onStopShare: () => void;
  onOpenViewer: () => void;
  peerDeviceName?: string;
}

export const ScreenShareCard: React.FC<ScreenShareCardProps> = ({
  isSharingScreen,
  hasRemoteStream,
  participantCount,
  p2pStatus,
  supportsScreenShare,
  onStartShare,
  onStopShare,
  onOpenViewer,
  peerDeviceName = 'Connected Device',
}) => {
  const isP2PConnected = p2pStatus === 'CONNECTED';
  const hasMultipleDevices = participantCount > 1;

  return (
    <div className="w-full glass-panel-subtle rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800/80 my-4 text-left transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <Monitor className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              P2P Screen Share & Remote View
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Zero server bandwidth • WebRTC direct device mirroring
            </p>
          </div>
        </div>

        {/* Live Status Pill */}
        {isSharingScreen ? (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            <span>Broadcasting</span>
          </span>
        ) : hasRemoteStream ? (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Live Feed Ready</span>
          </span>
        ) : isP2PConnected ? (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span>LAN P2P Ready</span>
          </span>
        ) : hasMultipleDevices ? (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
            <Wifi className="w-3 h-3 animate-pulse" />
            <span>Connecting P2P...</span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-medium border border-slate-700/50">
            <span>Waiting for 2nd Device</span>
          </span>
        )}
      </div>

      {/* Dynamic Action / Information Area */}
      {isSharingScreen ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
          <div className="flex items-center space-x-2 text-xs text-rose-300">
            <Sparkles className="w-4 h-4 text-rose-400 flex-shrink-0 animate-bounce" />
            <span>You are actively sharing your screen with connected room devices.</span>
          </div>
          <button
            onClick={onStopShare}
            className="w-full sm:w-auto py-1.5 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all active:scale-95 shadow-sm"
          >
            <StopCircle className="w-3.5 h-3.5" />
            <span>Stop Sharing</span>
          </button>
        </div>
      ) : hasRemoteStream ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center space-x-2 text-xs text-emerald-300">
            <Monitor className="w-4 h-4 text-emerald-400 flex-shrink-0 animate-pulse" />
            <span>Live screen stream available from <strong>{peerDeviceName}</strong>.</span>
          </div>
          <button
            onClick={onOpenViewer}
            className="w-full sm:w-auto py-1.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all active:scale-95 shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Open Live Viewer</span>
          </button>
        </div>
      ) : supportsScreenShare ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-400">
            {!hasMultipleDevices
              ? 'Connect your phone or a 2nd device to enable real-time wireless screen mirroring.'
              : 'Stream your entire display, application window, or browser tab to your phone or tablet.'}
          </p>

          <button
            onClick={onStartShare}
            disabled={!hasMultipleDevices}
            className="w-full sm:w-auto py-2 px-4 rounded-xl bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:hover:bg-yellow-400 text-black font-bold text-xs flex items-center justify-center space-x-1.5 transition-all active:scale-95 shadow-sm flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Share Screen to Devices</span>
          </button>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center space-x-2.5">
          <Smartphone className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <span>
            <strong>Screen Viewer Mode:</strong> Mobile browsers cannot broadcast their screen, but when your laptop or desktop starts sharing, the live display will stream right here automatically.
          </span>
        </div>
      )}
    </div>
  );
};
