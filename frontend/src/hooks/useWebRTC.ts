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
  const [isSharingScreen, setIsSharingScreen] = useState<boolean>(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const managerRef = useRef<WebRTCManager | null>(null);
  const activePeerIdRef = useRef<string | null>(null);

  // Identify target peer (the other participant in the room)
  const otherParticipant = participants.find(
    (p) => p.id && currentParticipantId && p.id !== currentParticipantId
  );
  const otherParticipantId = otherParticipant?.id;

  // Listen directly to WebRTC signaling from the socket
  useEffect(() => {
    if (!socket) return;

    const onWebRTCSignal = (data: { fromParticipantId: string; toParticipantId?: string; signal: any }) => {
      if (!data || !data.signal) return;
      if (data.toParticipantId && currentParticipantId && data.toParticipantId !== currentParticipantId) {
        return; // Signal for another peer
      }
      if (data.signal.type === 'screenshare:stopped') {
        setRemoteStream(null);
      }
      managerRef.current?.handleSignal(data.signal);
    };

    socket.on('webrtc:signal', onWebRTCSignal);
    return () => {
      socket.off('webrtc:signal', onWebRTCSignal);
    };
  }, [socket, currentParticipantId]);

  useEffect(() => {
    if (!socket || !currentParticipantId || !otherParticipantId) {
      if (managerRef.current) {
        managerRef.current.destroy();
        managerRef.current = null;
        activePeerIdRef.current = null;
      }
      setP2PStatus('DISCONNECTED');
      setRemoteStream(null);
      return;
    }

    // Avoid recreation if already bound to this peer
    if (activePeerIdRef.current === otherParticipantId && managerRef.current) {
      return;
    }

    activePeerIdRef.current = otherParticipantId;

    // Deterministic initiator: the participant with lexicographically smaller ID initiates
    const isInitiator = currentParticipantId < otherParticipantId;

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

    manager.onRemoteStream((stream) => {
      setRemoteStream(stream);
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
    manager.init(socket, otherParticipantId);

    return () => {
      manager.destroy();
      managerRef.current = null;
      activePeerIdRef.current = null;
    };
  }, [socket, currentParticipantId, otherParticipantId]);

  // Handle incoming signaling messages (fallback manual handler)
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

  const startScreenShare = useCallback(async (mode: 'screen' | 'camera' = 'screen') => {
    if (!managerRef.current) {
      throw new Error('Peer connection not established. Connect a second device first.');
    }
    const stream = await managerRef.current.startScreenShare(mode);
    if (stream) {
      setIsSharingScreen(true);
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.onended = () => {
          setIsSharingScreen(false);
        };
      }
    }
    return stream;
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (!managerRef.current) return;
    await managerRef.current.stopScreenShare();
    setIsSharingScreen(false);
  }, []);

  const supportsScreenShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
  const supportsCameraShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  return {
    p2pStatus,
    transferProgress,
    handleSignal,
    sendFileP2P,
    hasP2P: p2pStatus === 'CONNECTED',
    isSharingScreen,
    remoteStream,
    startScreenShare,
    stopScreenShare,
    supportsScreenShare,
    supportsCameraShare,
  };
}

