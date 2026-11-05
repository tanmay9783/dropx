import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { WebRTCManager, P2PConnectionStatus, P2PReceivedFile, WebRTCFileTransferProgress } from '../services/webrtcManager';
import { ParticipantInfo } from './useRoomSocket';

interface UseWebRTCOptions {
  socket: Socket | null;
  currentParticipantId?: string;
  participants: ParticipantInfo[];
}

export function useWebRTC({ socket, currentParticipantId, participants }: UseWebRTCOptions) {
  const [p2pStatus, setP2PStatus] = useState<P2PConnectionStatus>('DISCONNECTED');
  const [transferProgress, setTransferProgress] = useState<WebRTCFileTransferProgress | null>(null);
  const managerRef = useRef<WebRTCManager | null>(null);

  // Identify target peer (the other participant in the room)
  const otherParticipant = participants.find(
    (p) => p.id && currentParticipantId && p.id !== currentParticipantId
  );

  useEffect(() => {
    if (!socket || !currentParticipantId || !otherParticipant) {
      if (managerRef.current) {
        managerRef.current.destroy();
        managerRef.current = null;
      }
      setP2PStatus('DISCONNECTED');
      return;
    }

    // Deterministic initiator: the participant with lexicographically smaller ID initiates
    const isInitiator = currentParticipantId < otherParticipant.id;

    const manager = new WebRTCManager(currentParticipantId, isInitiator);
    managerRef.current = manager;

    manager.onStatusChange((status) => {
      setP2PStatus(status);
    });

    manager.onProgress((progress) => {
      setTransferProgress(progress);
      if (progress.percent >= 100) {
        setTimeout(() => setTransferProgress(null), 2500);
      }
    });

    manager.onFileReceived((receivedFile: P2PReceivedFile) => {
      // Trigger instant direct download in browser
      const objectUrl = URL.createObjectURL(receivedFile.blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = receivedFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    });

    // Initialize WebRTC with socket and peer ID
    manager.init(socket, otherParticipant.id);

    return () => {
      manager.destroy();
      managerRef.current = null;
    };
  }, [socket, currentParticipantId, otherParticipant?.id]);

  // Handle incoming signaling messages
  const handleSignal = useCallback((signal: any) => {
    if (managerRef.current) {
      managerRef.current.handleSignal(signal);
    }
  }, []);

  const sendFileP2P = useCallback(
    async (file: File | Blob, fileName: string, onProgress?: (p: number, l: number, t: number) => void) => {
      if (!managerRef.current || managerRef.current.status !== 'CONNECTED') {
        throw new Error('P2P DataChannel not connected');
      }
      return managerRef.current.sendFileP2P(file, fileName, onProgress);
    },
    []
  );

  return {
    p2pStatus,
    transferProgress,
    handleSignal,
    sendFileP2P,
    hasP2P: p2pStatus === 'CONNECTED',
  };
}

