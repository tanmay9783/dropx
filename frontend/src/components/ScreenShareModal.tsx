import React, { useEffect, useRef, useState } from 'react';
import { 
  Monitor, 
  X, 
  Maximize, 
  Minimize, 
  Camera, 
  ExternalLink,
  Wifi,
  Sparkles
} from 'lucide-react';

interface ScreenShareModalProps {
  stream: MediaStream | null;
  peerDeviceName?: string;
  onClose: () => void;
}

export const ScreenShareModal: React.FC<ScreenShareModalProps> = ({
  stream,
  peerDeviceName = 'Connected Device',
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState(false);

  useEffect(() => {
    if (!stream) {
      onClose();
      return;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }

    // Auto-close modal when stream tracks end
    const tracks = stream.getVideoTracks();
    const handleEnded = () => {
      const liveTracks = tracks.filter((t) => t.readyState === 'live');
      if (liveTracks.length === 0) {
        onClose();
      }
    };

    tracks.forEach((t) => {
      t.addEventListener('ended', handleEnded);
    });

    return () => {
      tracks.forEach((t) => {
        t.removeEventListener('ended', handleEnded);
      });
    };
  }, [stream, onClose]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Ignore fullscreen failure
    }
  };

  const togglePip = async () => {
    try {
      if (videoRef.current) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled) {
          await videoRef.current.requestPictureInPicture();
        }
      }
    } catch {
      // Ignore PiP failure
    }
  };

  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ScreenShare-${peerDeviceName.replace(/\s+/g, '_')}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSnapshotSuccess(true);
      setTimeout(() => setSnapshotSuccess(false), 2000);
    }, 'image/png');
  };

  if (!stream) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        ref={containerRef}
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col glass-panel rounded-3xl border border-yellow-500/30 shadow-2xl overflow-hidden bg-slate-950"
      >
        {/* Header Bar */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
              <Monitor className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white truncate">
                  {peerDeviceName}'s Screen
                </h3>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>LIVE P2P</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center space-x-1">
                <Wifi className="w-3 h-3 text-yellow-400" />
                <span>Zero Server Bandwidth • WebRTC Stream</span>
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
            <button
              onClick={captureSnapshot}
              className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center space-x-1.5 active:scale-95"
              title="Capture screenshot of live screen"
            >
              <Camera className="w-3.5 h-3.5 text-yellow-400" />
              <span className="hidden sm:inline">
                {snapshotSuccess ? 'Saved!' : 'Snapshot'}
              </span>
            </button>

            {document.pictureInPictureEnabled && (
              <button
                onClick={togglePip}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                title="Picture in Picture"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
              title="Close viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Viewport Container */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[360px] sm:min-h-[500px]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full max-h-[75vh] object-contain"
          />

          <div className="absolute bottom-3 left-3 pointer-events-none px-3 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-slate-800 text-[10px] text-slate-400 flex items-center space-x-1.5">
            <Sparkles className="w-3 h-3 text-yellow-400" />
            <span>Hardware-Accelerated Direct Stream</span>
          </div>
        </div>
      </div>
    </div>
  );
};
