import React, { useState } from 'react';
import { Copy, Check, Trash2, Clock, Users, ArrowLeft, ShieldAlert, Link, QrCode, Wifi, WifiOff, Bell } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { RoomData, destroyRoom } from '../services/api';
import { useCountdownTimer } from '../hooks/useCountdownTimer';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { useRoomFiles } from '../hooks/useRoomFiles';
import { SharedFiles } from './SharedFiles';
import { getJoinUrl } from '../utils/validation';

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
  const [destroying, setDestroying] = useState<boolean>(false);
  const [destroyError, setDestroyError] = useState<string | null>(null);

  const joinUrl = getJoinUrl(room.roomCode);
  const { formattedTime, isExpired } = useCountdownTimer(room.expiresAt, onExpire);

  // File Transfer Hook
  const {
    files,
    loading: filesLoading,
    uploading,
    downloadingId,
    uploadProgress,
    error: fileError,
    handleUploadFiles,
    handleDownloadFile,
    handleDeleteFile,
    addFileFromSocket,
    removeFileFromSocket,
  } = useRoomFiles({
    roomCode: room.roomCode,
    socketToken,
  });

  // Real-Time Socket Presence & File Events
  const { status: socketStatus, participantCount, notifications } = useRoomSocket({
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

  const handleDestroyRoom = async () => {
    if (!window.confirm('Are you sure you want to destroy this room? This will terminate the room and delete all associated files.')) {
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
    <div className="max-w-xl mx-auto w-full glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl relative">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-5 mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Room</span>
        </button>

        {/* Real-Time Socket Connection Badge */}
        <div className="flex items-center space-x-2">
          {socketStatus === 'CONNECTED' ? (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Wifi className="w-3.5 h-3.5" />
              <span>Real-Time Active</span>
            </div>
          ) : socketStatus === 'CONNECTING' ? (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <Wifi className="w-3.5 h-3.5 animate-pulse" />
              <span>Connecting...</span>
            </div>
          ) : (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-400 text-xs font-semibold">
              <WifiOff className="w-3.5 h-3.5 text-slate-500" />
              <span>Offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Live Toast Notification Banner */}
      {notifications.length > 0 && (
        <div className="mb-6 p-3 rounded-2xl bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 text-xs flex items-center space-x-2.5 animate-fade-in">
          <Bell className="w-4 h-4 text-cyan-400 flex-shrink-0 animate-bounce" />
          <span className="font-medium">{notifications[0].message}</span>
        </div>
      )}

      <div className="text-center">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
          Your Temporary Sharing Room
        </h2>

        {/* QR Code Container */}
        <div className="my-6 flex flex-col items-center">
          <div className="p-4 bg-white rounded-3xl shadow-xl border border-slate-200 inline-block transition-transform hover:scale-[1.02]">
            <QRCodeSVG
              value={joinUrl}
              size={200}
              bgColor="#FFFFFF"
              fgColor="#090d16"
              level="H"
              includeMargin={true}
              aria-label={`QR code for joining DropX room ${room.roomCode}`}
            />
          </div>
          <p className="text-xs font-medium text-slate-400 mt-3 flex items-center space-x-1.5">
            <QrCode className="w-3.5 h-3.5 text-cyan-400" />
            <span>Scan with phone camera to join instantly</span>
          </p>
        </div>

        {/* Room Code Display */}
        <div className="my-4 py-4 px-4 bg-slate-900/90 rounded-2xl border border-cyan-500/30 shadow-inner flex flex-col items-center justify-center">
          <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">Room Code</span>
          <span className="text-3xl sm:text-4xl font-black tracking-wider text-cyan-400 font-mono">
            {room.roomCode}
          </span>
        </div>

        {/* Action Buttons: Copy Code & Copy Join Link */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          <button
            onClick={handleCopyCode}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center justify-center space-x-2 active:scale-95"
          >
            {copiedCode ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Code Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-300" />
                <span>Copy Room Code</span>
              </>
            )}
          </button>

          <button
            onClick={handleCopyLink}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center justify-center space-x-2 active:scale-95"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Link Copied!</span>
              </>
            ) : (
              <>
                <Link className="w-4 h-4 text-cyan-400" />
                <span>Copy Join Link</span>
              </>
            )}
          </button>
        </div>

        {/* Countdown & Presence Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center">
            <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Expires In</span>
            </div>
            <span className="text-xl font-bold font-mono text-cyan-400">
              {isExpired ? '00:00:00' : formattedTime}
            </span>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center">
            <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1">
              <Users className="w-3.5 h-3.5 text-violet-400" />
              <span>Connected Devices</span>
            </div>
            <span className="text-xl font-bold font-mono text-violet-400">
              {participantCount} {participantCount === 1 ? '(You)' : 'Devices'}
            </span>
          </div>
        </div>

        {/* Shared Files Component */}
        <SharedFiles
          roomCode={room.roomCode}
          socketToken={socketToken}
          files={files}
          loading={filesLoading}
          uploading={uploading}
          downloadingId={downloadingId}
          uploadProgress={uploadProgress}
          error={fileError}
          onUpload={handleUploadFiles}
          onDownload={handleDownloadFile}
          onDelete={handleDeleteFile}
        />

        {destroyError && (
          <div className="my-6 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>{destroyError}</span>
          </div>
        )}

        {/* Destroy Room Button */}
        <button
          onClick={handleDestroyRoom}
          disabled={destroying}
          className="w-full mt-8 py-3 px-6 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 font-semibold border border-rose-800/60 text-sm flex items-center justify-center space-x-2 transition-all"
        >
          <Trash2 className="w-4 h-4" />
          <span>{destroying ? 'Destroying Room...' : 'Destroy Room'}</span>
        </button>
      </div>
    </div>
  );
};
