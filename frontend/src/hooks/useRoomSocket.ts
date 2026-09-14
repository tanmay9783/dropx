import { getDeviceName } from "../utils/device";
import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { SharedFile, getPresence } from '../services/api';

export type SocketStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

export interface ParticipantInfo {
  id: string;
  role: string;
  deviceName?: string;
}

export interface SocketNotification {
  id: string;
  message: string;
  type: 'info' | 'warn' | 'success';
  timestamp: number;
}

interface UseRoomSocketOptions {
  roomCode: string | null;
  socketToken: string | null;
  onRoomExpired?: () => void;
  onFileUploaded?: (file: SharedFile) => void;
  onFileDeleted?: (fileId: string) => void;
  onSnippetCreated?: (snippet: any) => void;
  onSnippetDeleted?: (id: string) => void;
}

export function useRoomSocket({
  roomCode,
  socketToken,
  onRoomExpired,
  onFileUploaded,
  onFileDeleted,
  onSnippetCreated,
  onSnippetDeleted,
}: UseRoomSocketOptions) {
  const [status, setStatus] = useState<SocketStatus>('DISCONNECTED');
  const [participantCount, setParticipantCount] = useState<number>(1);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [notifications, setNotifications] = useState<SocketNotification[]>([]);

  const socketRef = useRef<Socket | null>(null);

  const addNotification = useCallback((message: string, type: 'info' | 'warn' | 'success' = 'info') => {
    const newNotif: SocketNotification = {
      id: Math.random().toString(36).substring(2, 9),
      message,
      type,
      timestamp: Date.now(),
    };
    setNotifications((prev) => [newNotif, ...prev.slice(0, 4)]);
  }, []);

  // Periodic Presence Sync
  const fetchPresenceSync = useCallback(async () => {
    if (!roomCode || !socketToken) return;
    try {
      const res = await getPresence(roomCode, socketToken);
      if (res && typeof res.count === 'number') {
        setParticipantCount(Math.max(res.count, 1));
        if (Array.isArray(res.list) && res.list.length > 0) {
          setParticipants(res.list);
        }
      }
    } catch (_) {
      // Ignore presence polling failure
    }
  }, [roomCode, socketToken]);

  useEffect(() => {
    fetchPresenceSync();
    const interval = setInterval(fetchPresenceSync, 4000);
    const handleFocus = () => fetchPresenceSync();
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchPresenceSync]);

  useEffect(() => {
    if (!roomCode || !socketToken) {
      setStatus('DISCONNECTED');
      return;
    }

    setStatus('CONNECTING');

    const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;

    const socket = io(socketUrl, {
      path: '/socket.io',
      auth: {
        token: socketToken,
        roomCode,
        deviceName: getDeviceName(),
      },
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('CONNECTED');
      fetchPresenceSync();
    });

    socket.on('disconnect', () => {
      setStatus('DISCONNECTED');
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket.IO connection error:', err.message);
      setStatus('DISCONNECTED');
    });

    socket.on('room-state', (data: { roomCode: string; participantCount: number; participants: ParticipantInfo[] }) => {
      setParticipantCount(data.participantCount || 1);
      setParticipants(data.participants || []);
    });

    socket.on('user-joined', (data: { participantId: string; role: string; deviceName?: string; participantCount: number }) => {
      setParticipantCount(data.participantCount);
      setParticipants((prev) => {
        if (prev.some((p) => p.id === data.participantId)) {
          return prev.map((p) => (p.id === data.participantId ? { ...p, deviceName: data.deviceName || p.deviceName } : p));
        }
        return [...prev, { id: data.participantId, role: data.role, deviceName: data.deviceName }];
      });
      addNotification('A new device joined the room', 'info');
    });

    socket.on('user-left', (data: { participantId: string; participantCount: number }) => {
      setParticipantCount(data.participantCount);
      setParticipants((prev) => prev.filter((p) => p.id !== data.participantId));
      addNotification('A device disconnected from the room', 'warn');
    });

    socket.on('file-uploaded', (fileData: SharedFile) => {
      addNotification(`New file available: ${fileData.originalName}`, 'success');
      if (onFileUploaded) {
        onFileUploaded(fileData);
      }
    });

    socket.on('file-deleted', (data: { fileId: string }) => {
      addNotification('A shared file was deleted', 'info');
      if (onFileDeleted) {
        onFileDeleted(data.fileId);
      }
    });

    socket.on('snippet:created', (snippet: any) => {
      addNotification('New text snippet shared', 'info');
      if (onSnippetCreated) {
        onSnippetCreated(snippet);
      }
    });

    socket.on('snippet:deleted', (data: { id: string }) => {
      if (onSnippetDeleted) {
        onSnippetDeleted(data.id);
      }
    });

    socket.on('room-expired', () => {
      addNotification('This sharing room has expired', 'warn');
      if (onRoomExpired) {
        onRoomExpired();
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('room-state');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('file-uploaded');
      socket.off('file-deleted');
      socket.off('snippet:created');
      socket.off('snippet:deleted');
      socket.off('room-expired');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomCode, socketToken, onRoomExpired, onFileUploaded, onFileDeleted, onSnippetCreated, onSnippetDeleted, addNotification, fetchPresenceSync]);

  return {
    status,
    participantCount,
    participants,
    notifications,
  };
}
