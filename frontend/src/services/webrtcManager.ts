/**
 * WebRTC P2P Direct LAN DataChannel Manager
 * Enables direct peer-to-peer file streaming between devices on the same local network.
 */

import { Socket } from 'socket.io-client';

export type P2PConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

export interface WebRTCFileTransferProgress {
  fileId: string;
  fileName: string;
  percent: number;
  loadedBytes: number;
  totalBytes: number;
  speedFormatted: string;
}

export interface P2PReceivedFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  blob: Blob;
}

const CHUNK_SIZE = 64 * 1024; // 64KB per WebRTC DataChannel chunk
const MAX_BUFFERED_AMOUNT = 1024 * 1024; // 1MB buffer ceiling for backpressure

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private socket: Socket | null = null;
  private targetParticipantId: string | null = null;
  public readonly currentParticipantId: string;
  private isInitiator: boolean;
  private statusListeners: ((status: P2PConnectionStatus) => void)[] = [];
  private fileReceivedListeners: ((file: P2PReceivedFile) => void)[] = [];
  private progressListeners: ((progress: WebRTCFileTransferProgress) => void)[] = [];
  private remoteStreamListeners: ((stream: MediaStream | null) => void)[] = [];

  public status: P2PConnectionStatus = 'DISCONNECTED';
  public localStream: MediaStream | null = null;
  public remoteStream: MediaStream | null = null;

  // Receiving state buffer
  private incomingMeta: { id: string; name: string; size: number; mimeType: string } | null = null;
  private incomingChunks: ArrayBuffer[] = [];
  private incomingBytes = 0;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(currentParticipantId: string, isInitiator = false) {
    this.currentParticipantId = currentParticipantId;
    this.isInitiator = isInitiator;
  }

  public init(socket: Socket, targetParticipantId: string) {
    this.socket = socket;
    this.targetParticipantId = targetParticipantId;

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
      ],
    };

    try {
      this.peerConnection = new RTCPeerConnection(config);
      this.updateStatus('CONNECTING');

      // ICE candidate exchange
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.socket && this.targetParticipantId) {
          this.socket.emit('webrtc:signal', {
            toParticipantId: this.targetParticipantId,
            signal: { type: 'candidate', candidate: event.candidate },
          });
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        if (state === 'connected') {
          this.updateStatus('CONNECTED');
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          this.updateStatus('DISCONNECTED');
          this.clearRemoteStream();
        }
      };

      // Inbound Media Stream for P2P Screen Sharing
      this.peerConnection.ontrack = (event) => {
        const stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
        this.remoteStream = stream;
        this.remoteStreamListeners.forEach((l) => l(this.remoteStream));

        // Listen for track ending on receiver
        event.track.onended = () => {
          this.clearRemoteStream();
        };
      };

      if (this.isInitiator) {
        // Create DataChannel as initiator
        const dc = this.peerConnection.createDataChannel('dropx-lan-transfer', {
          ordered: true,
        });
        this.setupDataChannel(dc);

        this.peerConnection
          .createOffer()
          .then((offer) => this.peerConnection?.setLocalDescription(offer))
          .then(() => {
            if (this.socket && this.peerConnection?.localDescription) {
              this.socket.emit('webrtc:signal', {
                toParticipantId: this.targetParticipantId,
                signal: { type: 'offer', sdp: this.peerConnection.localDescription },
              });
            }
          })
          .catch(() => this.updateStatus('DISCONNECTED'));
      } else {
        // Wait for incoming DataChannel
        this.peerConnection.ondatachannel = (event) => {
          this.setupDataChannel(event.channel);
        };
      }
    } catch {
      this.updateStatus('DISCONNECTED');
    }
  }

  public async handleSignal(signal: any) {
    if (!this.peerConnection || !signal) return;

    try {
      if (signal.type === 'screenshare:stopped') {
        this.clearRemoteStream();
        return;
      }

      if (signal.type === 'offer') {
        if (this.peerConnection.signalingState !== 'stable') {
          try {
            await this.peerConnection.setLocalDescription({ type: 'rollback' } as any);
          } catch {}
        }
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        while (this.pendingCandidates.length > 0) {
          const cand = this.pendingCandidates.shift();
          if (cand) await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        if (this.socket && this.targetParticipantId) {
          this.socket.emit('webrtc:signal', {
            toParticipantId: this.targetParticipantId,
            signal: { type: 'answer', sdp: this.peerConnection.localDescription },
          });
        }
      } else if (signal.type === 'answer') {
        if (this.peerConnection.signalingState === 'have-local-offer') {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          while (this.pendingCandidates.length > 0) {
            const cand = this.pendingCandidates.shift();
            if (cand) await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        if (!this.peerConnection.remoteDescription || !this.peerConnection.remoteDescription.type) {
          this.pendingCandidates.push(signal.candidate);
        } else {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
        }
      }
    } catch {
      // Ignore signaling errors gracefully
    }
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    this.dataChannel.binaryType = 'arraybuffer';

    this.dataChannel.onopen = () => {
      this.updateStatus('CONNECTED');
    };

    this.dataChannel.onclose = () => {
      this.updateStatus('DISCONNECTED');
    };

    this.dataChannel.onerror = () => {
      this.updateStatus('DISCONNECTED');
    };

    this.dataChannel.onmessage = (event) => {
      this.handleIncomingData(event.data);
    };
  }

  private handleIncomingData(data: string | ArrayBuffer) {
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'screenshare:stopped') {
          this.clearRemoteStream();
          return;
        }
        if (msg.type === 'file-start') {
          this.incomingMeta = {
            id: msg.id,
            name: msg.name,
            size: msg.size,
            mimeType: msg.mimeType,
          };
          this.incomingChunks = [];
          this.incomingBytes = 0;
        } else if (msg.type === 'file-end' && this.incomingMeta) {
          const blob = new Blob(this.incomingChunks, { type: this.incomingMeta.mimeType });
          const file: P2PReceivedFile = {
            id: this.incomingMeta.id,
            name: this.incomingMeta.name,
            size: this.incomingMeta.size,
            mimeType: this.incomingMeta.mimeType,
            blob,
          };
          this.fileReceivedListeners.forEach((l) => l(file));
          this.incomingMeta = null;
          this.incomingChunks = [];
          this.incomingBytes = 0;
        }
      } catch {
        // Non-JSON message
      }
    } else if (data instanceof ArrayBuffer && this.incomingMeta) {
      this.incomingChunks.push(data);
      this.incomingBytes += data.byteLength;
      const percent = Math.min(Math.round((this.incomingBytes / this.incomingMeta.size) * 100), 100);

      this.progressListeners.forEach((l) =>
        l({
          fileId: this.incomingMeta!.id,
          fileName: this.incomingMeta!.name,
          percent,
          loadedBytes: this.incomingBytes,
          totalBytes: this.incomingMeta!.size,
          speedFormatted: 'P2P LAN Transfer',
        })
      );
    }
  }

  public async sendFileP2P(
    file: File | Blob,
    fileName: string,
    onProgress?: (percent: number, loaded: number, total: number) => void
  ): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('WebRTC P2P DataChannel is not open');
    }

    const fileId = Math.random().toString(36).substring(2, 10);
    const size = file.size;
    const mimeType = file.type || 'application/octet-stream';

    // 1. Send file metadata header
    this.dataChannel.send(
      JSON.stringify({
        type: 'file-start',
        id: fileId,
        name: fileName,
        size,
        mimeType,
      })
    );

    // 2. Stream binary chunks
    const buffer = await file.arrayBuffer();
    let offset = 0;

    while (offset < size) {
      // Flow control backpressure: wait if buffer exceeds ceiling
      if (this.dataChannel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (!this.dataChannel || this.dataChannel.bufferedAmount <= MAX_BUFFERED_AMOUNT / 2) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 20);
        });
      }

      const end = Math.min(offset + CHUNK_SIZE, size);
      const chunk = buffer.slice(offset, end);
      this.dataChannel.send(chunk);
      offset = end;

      if (onProgress) {
        const percent = Math.round((offset / size) * 100);
        onProgress(percent, offset, size);
      }
    }

    // 3. Send completion notice
    this.dataChannel.send(JSON.stringify({ type: 'file-end', id: fileId }));
  }

  private updateStatus(status: P2PConnectionStatus) {
    this.status = status;
    this.statusListeners.forEach((l) => l(status));
  }

  public onStatusChange(callback: (status: P2PConnectionStatus) => void) {
    this.statusListeners.push(callback);
    callback(this.status);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== callback);
    };
  }

  public onFileReceived(callback: (file: P2PReceivedFile) => void) {
    this.fileReceivedListeners.push(callback);
    return () => {
      this.fileReceivedListeners = this.fileReceivedListeners.filter((l) => l !== callback);
    };
  }

  public onProgress(callback: (progress: WebRTCFileTransferProgress) => void) {
    this.progressListeners.push(callback);
    return () => {
      this.progressListeners = this.progressListeners.filter((l) => l !== callback);
    };
  }

  public onRemoteStream(callback: (stream: MediaStream | null) => void) {
    this.remoteStreamListeners.push(callback);
    callback(this.remoteStream);
    return () => {
      this.remoteStreamListeners = this.remoteStreamListeners.filter((l) => l !== callback);
    };
  }

  public clearRemoteStream() {
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      this.remoteStream = null;
    }
    this.remoteStreamListeners.forEach((l) => l(null));
  }

  public async startMediaShare(mode: 'screen' | 'camera' = 'screen'): Promise<MediaStream | null> {
    if (!this.peerConnection || !this.socket || !this.targetParticipantId) {
      throw new Error('Peer connection not established. Connect a second device first.');
    }

    let stream: MediaStream | null = null;

    if (mode === 'screen') {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
        throw new Error(
          'Screen sharing is not supported by this mobile browser. Please use "Share Camera" to stream live video, or share screen from a desktop PC.'
        );
      }
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          return null; // User cancelled prompt
        }
        if (err.name === 'NotSupportedError' || err.name === 'TypeError') {
          throw new Error(
            'Screen sharing is restricted by your device/browser. Please use "Share Camera" to stream live video instead.'
          );
        }
        throw err;
      }
    } else if (mode === 'camera') {
      if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
        throw new Error('Camera access is not supported in this browser.');
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
    }

    if (!stream) return null;

    this.localStream = stream;

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        this.stopScreenShare();
      };

      const senders = this.peerConnection.getSenders();
      const existingSender = senders.find(
        (s) => s.track?.kind === 'video' || (s as any).kind === 'video'
      );
      if (existingSender) {
        await existingSender.replaceTrack(videoTrack);
      } else {
        this.peerConnection.addTrack(videoTrack, stream);
      }
    }

    // Renegotiate SDP with peer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.socket.emit('webrtc:signal', {
      toParticipantId: this.targetParticipantId,
      signal: { type: 'offer', sdp: this.peerConnection.localDescription },
    });

    return stream;
  }

  public async startScreenShare(mode: 'screen' | 'camera' = 'screen'): Promise<MediaStream | null> {
    return this.startMediaShare(mode);
  }

  public async stopScreenShare() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      this.localStream = null;
    }

    // 1. Send immediate stop notification over DataChannel (zero-latency LAN)
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({ type: 'screenshare:stopped' }));
      } catch {}
    }

    // 2. Send stop notification over signaling socket
    if (this.socket && this.targetParticipantId) {
      this.socket.emit('webrtc:signal', {
        toParticipantId: this.targetParticipantId,
        signal: { type: 'screenshare:stopped' },
      });
    }

    if (this.peerConnection) {
      const senders = this.peerConnection.getSenders();
      for (const sender of senders) {
        if (sender.track && sender.track.kind === 'video') {
          try {
            await sender.replaceTrack(null);
          } catch {}
          try {
            this.peerConnection?.removeTrack(sender);
          } catch {}
        }
      }

      try {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        if (this.socket && this.targetParticipantId) {
          this.socket.emit('webrtc:signal', {
            toParticipantId: this.targetParticipantId,
            signal: { type: 'offer', sdp: this.peerConnection.localDescription },
          });
        }
      } catch {
        // Ignore renegotiation failure on stop
      }
    }
  }

  public destroy() {
    this.pendingCandidates = [];
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.clearRemoteStream();

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.updateStatus('DISCONNECTED');
  }
}
