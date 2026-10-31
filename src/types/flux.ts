export type FluxScreen =
  | 'home'
  | 'send'
  | 'radar'
  | 'pairing'
  | 'receive'
  | 'incoming'
  | 'transferring'
  | 'complete'
  | 'history'
  | 'settings';

export interface DeviceInfo {
  name: string;
  platform: 'iOS' | 'Android' | 'macOS' | 'Windows' | 'Linux' | 'Other';
  browser: string;
  isMobile: boolean;
}

export interface DiscoveredPeer {
  id: string;
  name: string;
  platform: 'iOS' | 'Android' | 'macOS' | 'Windows' | 'Linux' | 'Other';
  ip: string;
  port: number;
  sessionId?: string;
  token?: string;
  shortCode?: string;
  role: 'receiver' | 'sender';
  lastSeen: number;
}

export interface HotspotInfo {
  ssid: string;
  password?: string;
  gatewayIp: string;
  clientIp?: string;
}


export interface FileItem {
  id: string;
  file?: File;
  name: string;
  size: number;
  type: string;
  sha256?: string;
  previewUrl?: string;
  progress: number;
  status: 'pending' | 'transferring' | 'completed' | 'failed';
  blob?: Blob;
  downloadUrl?: string;
  savedToGallery?: boolean;
  localId?: string;
  deletedFromDevice?: boolean;
}

export interface SessionState {
  sessionId: string;
  token: string;
  shortCode: string;
  expiresAt: number;
  role: 'sender' | 'receiver' | null;
  connected: boolean;
  peerDevice: DeviceInfo | null;
  mode: 'p2p' | 'relay';
}

export interface TransferStats {
  speed: number; // bytes per second
  transferredBytes: number;
  totalBytes: number;
  percent: number;
  etaSeconds: number;
  currentFileName: string;
  currentFileIndex: number;
  totalFiles: number;
  mode: 'p2p' | 'relay';
}

export interface HistoryFileItem {
  name: string;
  size: number;
  type: string;
  savedToGallery?: boolean;
  localId?: string;
  deletedFromDevice?: boolean;
}

export interface HistoryRecord {
  id: string;
  timestamp: number;
  direction: 'sent' | 'received';
  files: HistoryFileItem[];
  totalSize: number;
  peerName: string;
  status: 'completed' | 'cancelled' | 'failed';
  mode: 'p2p' | 'relay';
}

export interface AppSettings {
  deviceName: string;
  autoAccept: boolean;
  theme: 'light' | 'dark' | 'system';
  preferRelay: boolean;
  audioFeedback: boolean;
  hapticFeedback: boolean;
}
