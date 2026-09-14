import React, { useState, useRef } from 'react';
import { 
  Copy, 
  Check, 
  Trash2, 
  Clock, 
  ArrowLeft, 
  ShieldAlert, 
  Link, 
  QrCode, 
  Wifi, 
  WifiOff, 
  Bell, 
  Share2, 
  DownloadCloud, 
  MessageCircle,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { RoomData, destroyRoom } from '../services/api';
import { useCountdownTimer } from '../hooks/useCountdownTimer';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { useRoomFiles } from '../hooks/useRoomFiles';
import { SharedFiles } from './SharedFiles';
import { ConnectedDevices } from './ConnectedDevices';
import { getJoinUrl } from '../utils/validation';
import { generateRoomKey } from '../utils/crypto';

interface CreateRoomProps {
  room: RoomData;
  ownerToken: string;
  socketToken: string;
  onExpire: () => void;
  onDestroy: () => void;
  onBack: () => void;
}

export const CreateRoom: React.FC<CreateRoomProps> = ({
  room,
  ownerToken,
  socketToken,
  onExpire,
  onDestroy,
  onBack,
}) => {
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [sharedNative, setSharedNative] = useState<boolean>(false);
  const [destroying, setDestroying] = useState<boolean>(false);
  const [destroyError, setDestroyError] = useState<string | null>(null);
  const [roomKey, setRoomKey] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    generateRoomKey().then(setRoomKey);
  }, []);

  const joinUrl = getJoinUrl(room.roomCode, roomKey || undefined);
  const { formattedTime, isExpired } = useCountdownTimer(room.expiresAt, onExpire);

  // File Transfer Hook
  const {
    files,
    loading: filesLoading,
    uploading,
    downloadingId,
    uploadProgress,
    uploadSpeedFormatted,
    etaFormatted,
    error: fileError,
    handleUploadFiles,
    handleDownloadFile,
    handleDeleteFile,
    addFileFromSocket,
    removeFileFromSocket,
  } = useRoomFiles({
    roomCode: room.roomCode,
    socketToken,
    roomKey,
  });

  // Real-Time Socket Presence & File Events
  const { status: socketStatus, participantCount, participants, notifications } = useRoomSocket({
    roomCode: room.roomCode,
    socketToken,
    onRoomExpired: onExpire,
    onFileUploaded: addFileFromSocket,
    onFileDeleted: removeFileFromSocket,
  });

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`Join my secure temporary DropX room to share files:\nRoom Code: ${room.roomCode}\nLink: ${joinUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `DropX Room ${room.roomCode}`,
          text: `Join my secure temporary DropX room to share files: ${room.roomCode}`,
          url: joinUrl,
        });
        setSharedNative(true);
        setTimeout(() => setSharedNative(false), 2000);
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleDownloadQR = () => {
    if (!qrRef.current) return;
    const svgElement = qrRef.current.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    canvas.width = 400;
    canvas.height = 400;

    img.onload = () => {
      if (!ctx) return;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 20, 360, 360);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `DropX-Room-${room.roomCode}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const handleDestroyRoom = async () => {
    if (!window.confirm('Are you sure you want to destroy this room? This will terminate the room and delete all associated files immediately.')) {
      return;
    }
    setDestroying(true);
    setDestroyError(null);
    try {
      await destroyRoom(room.roomCode, ownerToken);
      onDestroy();
    } catch (err: any) {
      setDestroyError(err.message || 'Failed to destroy room');
    } finally {
      setDestroying(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-2xl relative transition-colors duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-5 mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Session</span>
        </button>

        {/* Real-Time Socket Connection Badge */}
        <div className="flex items-center space-x-2">
          {socketStatus === 'CONNECTED' ? (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <Wifi className="w-3.5 h-3.5" />
              <span>Real-Time Signaling Active</span>
            </div>
          ) : socketStatus === 'CONNECTING' ? (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold">
              <Wifi className="w-3.5 h-3.5 animate-pulse" />
              <span>Connecting...</span>
            </div>
          ) : (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-500 text-xs font-semibold">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Live Toast Notification Banner */}
      {notifications.length > 0 && (
        <div className="mb-6 p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 text-xs flex items-center space-x-2.5 animate-fade-in">
          <Bell className="w-4 h-4 text-cyan-500 flex-shrink-0 animate-bounce" />
          <span className="font-semibold">{notifications[0].message}</span>
        </div>
      )}

      <div className="text-center">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Host Device Session</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
          Temporary File Sharing Room
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Scan the QR code from any smartphone or tablet to transfer files with zero account setup.
        </p>

        {/* Holographic Glowing QR Code Container */}
        <div className="my-6 flex flex-col items-center">
          <div 
            ref={qrRef}
            className="p-5 bg-white rounded-3xl shadow-2xl border-2 border-cyan-400/40 inline-block transition-transform hover:scale-[1.03] animate-pulse-glow relative overflow-hidden"
          >
            <div className="qr-scanner-line absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent pointer-events-none opacity-70"></div>
            <QRCodeSVG
              value={joinUrl}
              size={210}
              bgColor="#FFFFFF"
              fgColor="#030712"
              level="H"
              includeMargin={false}
              aria-label={`QR code for joining DropX room ${room.roomCode}`}
            />
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-3 flex items-center space-x-1.5">
            <QrCode className="w-4 h-4 text-cyan-500" />
            <span>Scan with phone camera or QR scanner</span>
          </p>
        </div>

        {/* Room Code Display Banner */}
        <div className="my-4 py-4 px-6 bg-slate-100 dark:bg-slate-900/90 rounded-2xl border border-cyan-500/30 shadow-inner flex flex-col items-center justify-center">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">
            Host Room Code
          </span>
          <span className="text-4xl sm:text-5xl font-black tracking-widest text-cyan-600 dark:text-cyan-400 font-mono select-all">
            {room.roomCode}
          </span>
        </div>

        {/* 1-Click Share Sheet Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-5">
          <button
            onClick={handleCopyCode}
            className="py-2.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center space-x-1.5 active:scale-95 shadow-sm"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-cyan-500" />}
            <span>{copiedCode ? 'Copied' : 'Code'}</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="py-2.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center space-x-1.5 active:scale-95 shadow-sm"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Link className="w-3.5 h-3.5 text-cyan-500" />}
            <span>{copiedLink ? 'Copied' : 'Link'}</span>
          </button>

          <button
            onClick={handleWhatsAppShare}
            className="py-2.5 px-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-500/30 transition-all flex items-center justify-center space-x-1.5 active:scale-95 shadow-sm"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={handleNativeShare}
            className="py-2.5 px-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 text-xs font-bold border border-cyan-500/30 transition-all flex items-center justify-center space-x-1.5 active:scale-95 shadow-sm"
          >
            {sharedNative ? <Check className="w-3.5 h-3.5 text-cyan-500" /> : <Share2 className="w-3.5 h-3.5 text-cyan-500" />}
            <span>Share</span>
          </button>

          <button
            onClick={handleDownloadQR}
            className="col-span-2 sm:col-span-1 py-2.5 px-2.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-400 text-xs font-bold border border-violet-500/30 transition-all flex items-center justify-center space-x-1.5 active:scale-95 shadow-sm"
          >
            <DownloadCloud className="w-3.5 h-3.5 text-violet-500" />
            <span>Save QR</span>
          </button>
        </div>

        {/* Countdown & Connected Devices Grid */}
        <div className="grid grid-cols-2 gap-3 my-5">
          <div className="bg-slate-100/70 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-cyan-500" />
              <span>Room Expires In</span>
            </div>
            <span className="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-400">
              {isExpired ? '00:00:00' : formattedTime}
            </span>
          </div>

          <div className="bg-slate-100/70 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Security Policy</span>
            </div>
            <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
              Local Storage AES-256
            </span>
          </div>
        </div>

        {/* Connected Devices Live Avatars Card */}
        <ConnectedDevices
          participants={participants}
          participantCount={participantCount}
          isOwner={true}
        />

        {/* Shared Files Component */}
        <SharedFiles
          roomCode={room.roomCode}
          socketToken={socketToken}
          roomKey={roomKey}
          files={files}
          loading={filesLoading}
          uploading={uploading}
          downloadingId={downloadingId}
          uploadProgress={uploadProgress}
          uploadSpeedFormatted={uploadSpeedFormatted}
          etaFormatted={etaFormatted}
          error={fileError}
          onUpload={handleUploadFiles}
          onDownload={handleDownloadFile}
          onDelete={handleDeleteFile}
        />

        {destroyError && (
          <div className="my-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center justify-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span>{destroyError}</span>
          </div>
        )}

        {/* Destroy Room Button */}
        <button
          onClick={handleDestroyRoom}
          disabled={destroying}
          className="w-full mt-8 py-3 px-6 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/30 text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all active:scale-95"
        >
          <Trash2 className="w-4 h-4" />
          <span>{destroying ? 'Purging Room & File Data...' : 'Terminate Room & Delete Files'}</span>
        </button>
      </div>
    </div>
  );
};
