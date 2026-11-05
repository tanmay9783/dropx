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

  public status: P2PConnectionStatus = 'DISCONNECTED';

  // Receiving state buffer
  private incomingMeta: { id: string; name: string; size: number; mimeType: string } | null = null;
  private incomingChunks: ArrayBuffer[] = [];
  private incomingBytes = 0;

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
        }
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
      if (signal.type === 'offer') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        if (this.socket && this.targetParticipantId) {
          this.socket.emit('webrtc:signal', {
            toParticipantId: this.targetParticipantId,
            signal: { type: 'answer', sdp: this.peerConnection.localDescription },
          });
        }
      } else if (signal.type === 'answer') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'candidate' && signal.candidate) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
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

  public destroy() {
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
