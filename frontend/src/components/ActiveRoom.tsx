import React from 'react';
import { ArrowLeft, Clock, ShieldCheck, Wifi, WifiOff, Bell, Sparkles } from 'lucide-react';
import { RoomData } from '../services/api';
import { useCountdownTimer } from '../hooks/useCountdownTimer';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { useRoomFiles } from '../hooks/useRoomFiles';
import { SharedFiles } from './SharedFiles';
import { ConnectedDevices } from './ConnectedDevices';

interface ActiveRoomProps {
  room: RoomData;
  participantId: string;
  socketToken: string;
  roomKey?: string | null;
  onExpire: () => void;
  onLeave: () => void;
}

export const ActiveRoom: React.FC<ActiveRoomProps> = ({
  room,
  participantId,
  socketToken,
  roomKey: propRoomKey,
  onExpire,
  onLeave,
}) => {
  // Extract key from URL fragment #key=... if available
  const [roomKey, setRoomKey] = React.useState<string | null>(propRoomKey || null);
  const [newSnippet, setNewSnippet] = React.useState<any>(null);
  const [deletedSnippetId, setDeletedSnippetId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!roomKey && typeof window !== 'undefined' && window.location.hash) {
      const match = window.location.hash.match(/key=([^&]+)/);
      if (match && match[1]) {
        setRoomKey(match[1]);
      }
    }
  }, [roomKey]);

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
    participantId,
    roomKey,
  });

  // Real-Time Socket Presence & File Events
  const { status: socketStatus, participantCount, participants, notifications } = useRoomSocket({
    roomCode: room.roomCode,
    socketToken,
    onRoomExpired: onExpire,
    onFileUploaded: addFileFromSocket,
    onFileDeleted: removeFileFromSocket,
    onSnippetCreated: setNewSnippet,
    onSnippetDeleted: setDeletedSnippetId,
  });

  return (
    <div className="max-w-2xl mx-auto w-full glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-2xl transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-5 mb-6">
        <button
          onClick={onLeave}
          className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Leave Room</span>
        </button>

        {/* Real-Time Socket Connection Badge */}
        <div className="flex items-center space-x-2">
          {socketStatus === 'CONNECTED' ? (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <Wifi className="w-3.5 h-3.5" />
              <span>Real-Time Active</span>
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
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Connected Guest Device</span>
        </div>

        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
          Connected to Room Session
        </h2>

        {/* Room Code Display */}
        <div className="my-4 py-4 px-6 bg-slate-100 dark:bg-slate-900/90 rounded-2xl border border-emerald-500/30 shadow-inner flex flex-col items-center justify-center">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">
            Active Room Code
          </span>
          <span className="text-4xl sm:text-5xl font-black tracking-widest text-emerald-600 dark:text-emerald-400 font-mono select-all">
            {room.roomCode}
          </span>
        </div>

        {/* Countdown & Connected Devices Grid */}
        <div className="grid grid-cols-2 gap-3 my-5">
          <div className="bg-slate-100/70 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              <span>Session Expires In</span>
            </div>
            <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {isExpired ? '00:00:00' : formattedTime}
            </span>
          </div>

          <div className="bg-slate-100/70 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
              <span>Direct Transfer</span>
            </div>
            <span className="text-xs font-bold font-mono text-cyan-600 dark:text-cyan-400">
              Local High-Speed Storage
            </span>
          </div>
        </div>

        {/* Live Connected Devices Avatars Card */}
        <ConnectedDevices
          participants={participants}
          participantCount={participantCount}
          currentParticipantId={participantId}
          isOwner={false}
        />

        {/* Shared Files Component */}
        <SharedFiles
          roomCode={room.roomCode}
          socketToken={socketToken}
          roomKey={roomKey}
          currentParticipantId={participantId}
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
          newSnippet={newSnippet}
          deletedSnippetId={deletedSnippetId}
        />
      </div>
    </div>
  );
};
