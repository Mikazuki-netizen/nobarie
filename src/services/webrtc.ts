import { computeSHA256 } from '../utils/crypto';
import { FileItem, TransferStats } from '../types/flux';
import { signaling } from './signaling';

const CHUNK_SIZE = 64 * 1024; // 64 KB chunks
const BUFFER_THRESHOLD = 256 * 1024; // 256 KB backpressure threshold
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export interface WebRTCProgressPayload {
  fileId: string;
  stats: TransferStats;
}

export type WebRTCEventMap = {
  connected: () => void;
  disconnected: () => void;
  fallbackToRelay: (reason: string) => void;
  progress: (payload: WebRTCProgressPayload) => void;
  fileReceived: (file: FileItem) => void;
  transferComplete: () => void;
  cancelled: (reason: string) => void;
  error: (err: Error) => void;
};

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private role: 'sender' | 'receiver' | null = null;
  private listeners: { [K in keyof WebRTCEventMap]?: WebRTCEventMap[K][] } = {};
  private iceTimeout: any = null;
  private isConnected = false;
  private isCancelled = false;

  // Active receiving state
  private incomingFileMeta: {
    id: string;
    name: string;
    size: number;
    type: string;
    sha256?: string;
    totalChunks: number;
  } | null = null;
  private incomingChunks: ArrayBuffer[] = [];
  private incomingBytesReceived = 0;
  private lastProgressEmit = 0;
  private bytesSinceLastSample = 0;
  private lastSampleTime = Date.now();
  private currentSpeed = 0;

  init(role: 'sender' | 'receiver') {
    this.role = role;
    this.close();
    this.isCancelled = false;

    this.pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 2,
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.sendSignal({ candidate: event.candidate });
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        this.clearIceTimeout();
        this.isConnected = true;
        this.emit('connected');
      } else if (state === 'failed') {
        this.emit('fallbackToRelay', 'Direct P2P connection failed. Switching to relay.');
      } else if (state === 'disconnected') {
        // May temporarily disconnect
      }
    };

    if (role === 'sender') {
      this.dc = this.pc.createDataChannel('flux-transfer', {
        ordered: true,
      });
      this.setupDataChannel(this.dc);
    } else {
      this.pc.ondatachannel = (event) => {
        this.dc = event.channel;
        this.setupDataChannel(this.dc);
      };
    }

    // Set 12s timeout for ICE connection before offering relay fallback
    this.iceTimeout = setTimeout(() => {
      if (!this.isConnected) {
        this.emit('fallbackToRelay', 'P2P negotiation timed out. Switching to relay fallback.');
      }
    }, 12000);
  }

  private clearIceTimeout() {
    if (this.iceTimeout) {
      clearTimeout(this.iceTimeout);
      this.iceTimeout = null;
    }
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = BUFFER_THRESHOLD;

    channel.onopen = () => {
      this.clearIceTimeout();
      this.isConnected = true;
      this.emit('connected');
    };

    channel.onclose = () => {
      this.isConnected = false;
      this.emit('disconnected');
    };

    channel.onerror = (err) => {
      console.error('[WebRTC DataChannel] Error:', err);
      this.emit('error', new Error('DataChannel encountered an error'));
    };

    channel.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          await this.handleControlMessage(msg);
        } catch (e) {
          console.error('[WebRTC] Failed to parse control message:', e);
        }
      } else if (event.data instanceof ArrayBuffer) {
        this.handleBinaryChunk(event.data);
      }
    };
  }

  private async handleControlMessage(msg: any) {
    switch (msg.type) {
      case 'FILE_START': {
        this.incomingFileMeta = {
          id: msg.id,
          name: msg.name,
          size: msg.size,
          type: msg.mimeType,
          sha256: msg.sha256,
          totalChunks: msg.totalChunks,
        };
        this.incomingChunks = [];
        this.incomingBytesReceived = 0;
        this.bytesSinceLastSample = 0;
        this.lastSampleTime = Date.now();
        break;
      }

      case 'FILE_END': {
        if (!this.incomingFileMeta) return;

        const blob = new Blob(this.incomingChunks, {
          type: this.incomingFileMeta.type || 'application/octet-stream',
        });
        const downloadUrl = URL.createObjectURL(blob);
        const verifiedSha256 = await computeSHA256(blob);

        const receivedFile: FileItem = {
          id: this.incomingFileMeta.id,
          name: this.incomingFileMeta.name,
          size: this.incomingFileMeta.size,
          type: this.incomingFileMeta.type,
          sha256: verifiedSha256,
          progress: 100,
          status: 'completed',
          blob,
          downloadUrl,
        };

        this.emit('fileReceived', receivedFile);
        this.incomingFileMeta = null;
        this.incomingChunks = [];
        break;
      }

      case 'ALL_TRANSFERS_COMPLETE': {
        this.emit('transferComplete');
        break;
      }

      case 'CANCEL_TRANSFER': {
        this.emit('cancelled', msg.reason || 'Sender cancelled the transfer.');
        break;
      }
    }
  }

  private handleBinaryChunk(chunk: ArrayBuffer) {
    if (!this.incomingFileMeta) return;

    this.incomingChunks.push(chunk);
    this.incomingBytesReceived += chunk.byteLength;
    this.bytesSinceLastSample += chunk.byteLength;

    const now = Date.now();
    const timeDiff = (now - this.lastSampleTime) / 1000;
    if (timeDiff >= 0.5) {
      this.currentSpeed = this.bytesSinceLastSample / timeDiff;
      this.bytesSinceLastSample = 0;
      this.lastSampleTime = now;
    }

    if (now - this.lastProgressEmit >= 150) {
      this.lastProgressEmit = now;
      const percent = Math.min(100, Math.round((this.incomingBytesReceived / this.incomingFileMeta.size) * 1000) / 10);
      const remainingBytes = Math.max(0, this.incomingFileMeta.size - this.incomingBytesReceived);
      const etaSeconds = this.currentSpeed > 0 ? remainingBytes / this.currentSpeed : 0;

      this.emit('progress', {
        fileId: this.incomingFileMeta.id,
        stats: {
          speed: this.currentSpeed,
          transferredBytes: this.incomingBytesReceived,
          totalBytes: this.incomingFileMeta.size,
          percent,
          etaSeconds,
          currentFileName: this.incomingFileMeta.name,
          currentFileIndex: 1,
          totalFiles: 1,
          mode: 'p2p',
        },
      });
    }
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('[WebRTC] Candidate error ignored:', e);
    }
  }

  // Sender file streaming with adaptive backpressure
  async sendFiles(files: FileItem[]): Promise<void> {
    if (!this.dc || this.dc.readyState !== 'open') {
      throw new Error('DataChannel is not ready');
    }

    this.isCancelled = false;
    const totalBytesAll = files.reduce((acc, f) => acc + f.size, 0);
    let bytesSentAll = 0;
    let speedSampleBytes = 0;
    let sampleStartTime = Date.now();
    let currentSpeed = 0;

    for (let fIdx = 0; fIdx < files.length; fIdx++) {
      if (this.isCancelled) break;
      const fileItem = files[fIdx];
      const rawFile = fileItem.file;
      if (!rawFile) continue;

      const totalChunks = Math.ceil(rawFile.size / CHUNK_SIZE);

      // Compute SHA-256 before starting stream
      const sha256 = fileItem.sha256 || await computeSHA256(rawFile);
      fileItem.sha256 = sha256;

      // Send FILE_START control message
      this.dc.send(
        JSON.stringify({
          type: 'FILE_START',
          id: fileItem.id,
          name: rawFile.name,
          size: rawFile.size,
          mimeType: rawFile.type || 'application/octet-stream',
          totalChunks,
          sha256,
        })
      );

      let offset = 0;
      let lastProgressReport = Date.now();

      while (offset < rawFile.size && !this.isCancelled) {
        // Backpressure check
        if (this.dc.bufferedAmount > BUFFER_THRESHOLD) {
          await this.waitForBufferDrain();
        }

        const sliceEnd = Math.min(offset + CHUNK_SIZE, rawFile.size);
        const slice = rawFile.slice(offset, sliceEnd);
        const arrayBuffer = await slice.arrayBuffer();

        this.dc.send(arrayBuffer);

        const chunkLen = arrayBuffer.byteLength;
        offset += chunkLen;
        bytesSentAll += chunkLen;
        speedSampleBytes += chunkLen;

        const now = Date.now();
        const durationSec = (now - sampleStartTime) / 1000;
        if (durationSec >= 0.5) {
          currentSpeed = speedSampleBytes / durationSec;
          speedSampleBytes = 0;
          sampleStartTime = now;
        }

        if (now - lastProgressReport >= 120 || offset >= rawFile.size) {
          lastProgressReport = now;
          const overallPercent = Math.min(100, Math.round((bytesSentAll / totalBytesAll) * 1000) / 10);
          const remainingBytes = Math.max(0, totalBytesAll - bytesSentAll);
          const etaSeconds = currentSpeed > 0 ? remainingBytes / currentSpeed : 0;

          this.emit('progress', {
            fileId: fileItem.id,
            stats: {
              speed: currentSpeed,
              transferredBytes: bytesSentAll,
              totalBytes: totalBytesAll,
              percent: overallPercent,
              etaSeconds,
              currentFileName: rawFile.name,
              currentFileIndex: fIdx + 1,
              totalFiles: files.length,
              mode: 'p2p',
            },
          });
        }
      }

      if (!this.isCancelled) {
        // Send FILE_END control message
        this.dc.send(
          JSON.stringify({
            type: 'FILE_END',
            id: fileItem.id,
          })
        );
      }
    }

    if (!this.isCancelled) {
      this.dc.send(JSON.stringify({ type: 'ALL_TRANSFERS_COMPLETE' }));
      this.emit('transferComplete');
    }
  }

  private waitForBufferDrain(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.dc || this.dc.bufferedAmount <= BUFFER_THRESHOLD) {
        resolve();
        return;
      }
      const onLow = () => {
        if (this.dc) {
          this.dc.removeEventListener('bufferedamountlow', onLow);
        }
        resolve();
      };
      this.dc.addEventListener('bufferedamountlow', onLow);
    });
  }

  cancel(reason = 'User cancelled transfer') {
    this.isCancelled = true;
    if (this.dc && this.dc.readyState === 'open') {
      try {
        this.dc.send(JSON.stringify({ type: 'CANCEL_TRANSFER', reason }));
      } catch {
        // Ignore
      }
    }
    this.emit('cancelled', reason);
  }

  on<K extends keyof WebRTCEventMap>(event: K, listener: WebRTCEventMap[K]) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
  }

  off<K extends keyof WebRTCEventMap>(event: K, listener: WebRTCEventMap[K]) {
    if (!this.listeners[event]) return;
    this.listeners[event] = (this.listeners[event] as any[]).filter((l) => l !== listener);
  }

  private emit<K extends keyof WebRTCEventMap>(event: K, ...args: Parameters<WebRTCEventMap[K]>) {
    const handlers = this.listeners[event];
    if (handlers) {
      for (const handler of handlers) {
        (handler as any)(...args);
      }
    }
  }

  close() {
    this.clearIceTimeout();
    this.isConnected = false;
    if (this.dc) {
      this.dc.close();
      this.dc = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }
}

export const webrtc = new WebRTCManager();
