import React from 'react';
import { ArrowLeft, Clock, ShieldCheck, Wifi, WifiOff, Users, Bell } from 'lucide-react';
import { RoomData } from '../services/api';
import { useCountdownTimer } from '../hooks/useCountdownTimer';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { useRoomFiles } from '../hooks/useRoomFiles';
import { SharedFiles } from './SharedFiles';

interface ActiveRoomProps {
  room: RoomData;
  participantId: string;
  socketToken: string;
  onExpire: () => void;
  onLeave: () => void;
}

export const ActiveRoom: React.FC<ActiveRoomProps> = ({
  room,
  participantId,
  socketToken,
  onExpire,
  onLeave,
}) => {
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
    participantId,
  });

  // Real-Time Socket Presence & File Events
  const { status: socketStatus, participantCount, notifications } = useRoomSocket({
    roomCode: room.roomCode,
    socketToken,
    onRoomExpired: onExpire,
    onFileUploaded: addFileFromSocket,
    onFileDeleted: removeFileFromSocket,
  });

  return (
    <div className="max-w-xl mx-auto w-full glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-5 mb-6">
        <button
          onClick={onLeave}
          className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Leave Room</span>
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
          Connected to Room
        </h2>

        <div className="my-4 py-6 px-4 bg-slate-900/90 rounded-2xl border border-emerald-500/30 flex items-center justify-center">
          <span className="text-4xl sm:text-5xl font-black tracking-wider text-emerald-400 font-mono">
            {room.roomCode}
          </span>
        </div>

        {/* Countdown & Connected Devices Grid */}
        <div className="grid grid-cols-2 gap-4 my-6">
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center">
            <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Session Expires In</span>
            </div>
            <span className="text-xl font-bold font-mono text-emerald-400">
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

        {/* Status Box */}
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-300 my-6">
          <div className="h-10 w-10 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold mb-1">Room Session Active</h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto mb-3">
            You are connected via secure real-time signaling. Select files below to transfer directly to other device(s).
          </p>
          <div className="text-[10px] font-mono text-slate-500 bg-slate-950/60 px-3 py-1 rounded-md inline-block">
            Device Identity: {participantId.substring(0, 12)}...
          </div>
        </div>

        {/* Shared Files Component */}
        <SharedFiles
          roomCode={room.roomCode}
          socketToken={socketToken}
          currentParticipantId={participantId}
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
      </div>
    </div>
  );
};
