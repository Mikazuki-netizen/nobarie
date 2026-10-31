import { DeviceInfo } from '../types/flux';
import { getWsUrl } from '../utils/api';

export type SignalingEventMap = {
  registeredReceiver: (data: { sessionId: string; shortCode: string; expiresAt: number }) => void;
  connectedSender: (data: { sessionId: string; receiverDevice?: DeviceInfo }) => void;
  peerJoined: (data: { role: 'sender' | 'receiver'; device?: DeviceInfo }) => void;
  peerDisconnected: (data: { role: 'sender' | 'receiver' }) => void;
  signal: (data: { from: 'sender' | 'receiver'; signal: any }) => void;
  offerFiles: (data: { files: any[]; senderDevice?: DeviceInfo }) => void;
  approveFiles: (data: { approved: boolean }) => void;
  relayModeTrigger: (data: { reason: string }) => void;
  relayFileReady: (data: { file: { id: string; name: string; size: number; mimeType: string; downloadUrl: string } }) => void;
  transferProgress: (data: any) => void;
  transferComplete: (data: any) => void;
  transferCancelled: (data: { reason: string }) => void;
  error: (data: { message: string }) => void;
  connectionStateChange: (state: 'connecting' | 'open' | 'closed') => void;
};

export class SignalingService {
  private ws: WebSocket | null = null;
  private listeners: { [K in keyof SignalingEventMap]?: SignalingEventMap[K][] } = {};
  private pingInterval: any = null;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const wsUrl = getWsUrl();

      this.emit('connectionStateChange', 'connecting');

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (err) {
        this.emit('connectionStateChange', 'closed');
        reject(err);
        return;
      }

      this.ws.onopen = () => {
        this.emit('connectionStateChange', 'open');
        this.startPing();
        resolve();
      };

      this.ws.onclose = () => {
        this.emit('connectionStateChange', 'closed');
        this.stopPing();
      };

      this.ws.onerror = (err) => {
        this.emit('error', { message: 'WebSocket connection error' });
        reject(err);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('[Signaling] Failed to parse message:', e);
        }
      };
    });
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 25000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleMessage(msg: any) {
    switch (msg.type) {
      case 'REGISTERED_RECEIVER':
        this.emit('registeredReceiver', msg);
        break;
      case 'CONNECTED_SENDER':
        this.emit('connectedSender', msg);
        break;
      case 'PEER_JOINED':
        this.emit('peerJoined', msg);
        break;
      case 'PEER_DISCONNECTED':
        this.emit('peerDisconnected', msg);
        break;
      case 'SIGNAL':
        this.emit('signal', msg);
        break;
      case 'OFFER_FILES':
        this.emit('offerFiles', msg);
        break;
      case 'APPROVE_FILES':
        this.emit('approveFiles', msg);
        break;
      case 'RELAY_MODE_TRIGGER':
        this.emit('relayModeTrigger', msg);
        break;
      case 'RELAY_FILE_READY':
        this.emit('relayFileReady', msg);
        break;
      case 'TRANSFER_PROGRESS':
        this.emit('transferProgress', msg);
        break;
      case 'TRANSFER_COMPLETE':
        this.emit('transferComplete', msg);
        break;
      case 'TRANSFER_CANCELLED':
        this.emit('transferCancelled', msg);
        break;
      case 'ERROR':
        this.emit('error', msg);
        break;
    }
  }

  registerReceiver(sessionId: string, token: string, device: DeviceInfo) {
    this.send({
      type: 'REGISTER_RECEIVER',
      sessionId,
      token,
      device,
    });
  }

  connectSender(options: {
    sessionId?: string;
    token?: string;
    shortCode?: string;
    device: DeviceInfo;
  }) {
    this.send({
      type: 'CONNECT_SENDER',
      ...options,
    });
  }

  sendSignal(signal: any) {
    this.send({
      type: 'SIGNAL',
      signal,
    });
  }

  offerFiles(files: any[]) {
    this.send({
      type: 'OFFER_FILES',
      files,
    });
  }

  approveFiles(approved: boolean) {
    this.send({
      type: 'APPROVE_FILES',
      approved,
    });
  }

  triggerRelay(reason: string) {
    this.send({
      type: 'RELAY_MODE_TRIGGER',
      reason,
    });
  }

  notifyProgress(data: any) {
    this.send({
      type: 'TRANSFER_PROGRESS',
      ...data,
    });
  }

  notifyComplete(data: any) {
    this.send({
      type: 'TRANSFER_COMPLETE',
      ...data,
    });
  }

  cancelTransfer(reason: string) {
    this.send({
      type: 'CANCEL_TRANSFER',
      reason,
    });
  }

  private send(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  on<K extends keyof SignalingEventMap>(event: K, listener: SignalingEventMap[K]) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
  }

  off<K extends keyof SignalingEventMap>(event: K, listener: SignalingEventMap[K]) {
    if (!this.listeners[event]) return;
    this.listeners[event] = (this.listeners[event] as any[]).filter((l) => l !== listener);
  }

  private emit<K extends keyof SignalingEventMap>(event: K, ...args: Parameters<SignalingEventMap[K]>) {
    const handlers = this.listeners[event];
    if (handlers) {
      for (const handler of handlers) {
        (handler as any)(...args);
      }
    }
  }

  disconnect() {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const signaling = new SignalingService();
