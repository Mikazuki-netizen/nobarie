import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  FluxScreen,
  DeviceInfo,
  FileItem,
  SessionState,
  TransferStats,
  HistoryRecord,
  AppSettings,
  DiscoveredPeer,
} from '../types/flux';
import { detectDevice } from '../utils/device';
import { sounds } from '../utils/audio';
import { signaling } from '../services/signaling';
import { webrtc } from '../services/webrtc';
import { relay } from '../services/relay';
import { getApiEndpoint, setTargetServerUrl, fetchWithFallback, discoverWorkingServer } from '../utils/api';
import { disconnectNativeWifi } from '../utils/wifi';
import { saveFileToNativeGallery, deleteFileFromDevice } from '../utils/gallery';
import confetti from 'canvas-confetti';

interface FluxContextType {
  screen: FluxScreen;
  setScreen: (screen: FluxScreen) => void;
  device: DeviceInfo;
  updateDeviceName: (name: string) => void;
  session: SessionState;
  selectedFiles: FileItem[];
  incomingFiles: FileItem[];
  transferredFiles: FileItem[];
  transferStats: TransferStats;
  history: HistoryRecord[];
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  networkInfo: { localIp?: string; clientPort?: number };
  discoveredPeers: DiscoveredPeer[];
  connectToPeer: (peer: DiscoveredPeer) => Promise<void>;
  
  // Actions
  addFiles: (files: FileList | File[]) => Promise<void>;
  removeFile: (id: string) => void;
  clearSelectedFiles: () => void;
  createReceiveSession: () => Promise<void>;
  connectToSession: (sessionId: string, token: string) => Promise<void>;
  connectWithCode: (shortCode: string) => Promise<void>;
  startTransfer: () => Promise<void>;
  acceptIncomingTransfer: () => Promise<void>;
  rejectIncomingTransfer: () => void;
  cancelActiveTransfer: (reason?: string) => void;
  resetTransferState: () => void;
  clearHistory: () => void;
  deleteHistoryRecord: (id: string) => void;
  deleteFileFromDeviceAndHistory: (recordId: string, fileIndex?: number) => Promise<{ success: boolean; error?: string }>;
  switchRelayMode: (reason?: string) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  deviceName: '',
  autoAccept: false,
  theme: 'system',
  preferRelay: false,
  audioFeedback: true,
  hapticFeedback: true,
};

const INITIAL_STATS: TransferStats = {
  speed: 0,
  transferredBytes: 0,
  totalBytes: 0,
  percent: 0,
  etaSeconds: 0,
  currentFileName: '',
  currentFileIndex: 0,
  totalFiles: 0,
  mode: 'p2p',
};

const INITIAL_SESSION: SessionState = {
  sessionId: '',
  token: '',
  shortCode: '',
  expiresAt: 0,
  role: null,
  connected: false,
  peerDevice: null,
  mode: 'p2p',
};

const FluxContext = createContext<FluxContextType | undefined>(undefined);

export const FluxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [screen, setScreen] = useState<FluxScreen>('home');
  const [device, setDevice] = useState<DeviceInfo>(detectDevice());
  const [session, setSession] = useState<SessionState>(INITIAL_SESSION);
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [incomingFiles, setIncomingFiles] = useState<FileItem[]>([]);
  const [transferredFiles, setTransferredFiles] = useState<FileItem[]>([]);
  const [transferStats, setTransferStats] = useState<TransferStats>(INITIAL_STATS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [networkInfo, setNetworkInfo] = useState<{ localIp?: string; clientPort?: number }>({});
  const [discoveredPeers, setDiscoveredPeers] = useState<DiscoveredPeer[]>([]);

  const isTransferringRef = useRef(false);

  // Settings state persisted in localStorage
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem('flux_settings');
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Ignore
    }
    return DEFAULT_SETTINGS;
  });

  // History state persisted in localStorage
  const [history, setHistory] = useState<HistoryRecord[]>(() => {
    try {
      const stored = localStorage.getItem('flux_history');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore
    }
    return [];
  });

  // Fetch server info on mount
  useEffect(() => {
    fetchWithFallback('/api/info')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.localIp) {
          setNetworkInfo({
            localIp: data.localIp,
            clientPort: data.clientPort,
          });
        }
      })
      .catch(() => {
        // Fallback
      });
  }, []);

  // Periodic announcement when on 'receive' screen
  useEffect(() => {
    if (screen !== 'receive' || !session.sessionId) return;

    const announce = async () => {
      try {
        await fetchWithFallback('/api/discovery/announce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: session.sessionId,
            name: device.name,
            platform: device.platform,
            sessionId: session.sessionId,
            token: session.token,
            shortCode: session.shortCode,
            role: 'receiver',
          }),
        });
      } catch {
        // Ignore network errors
      }
    };

    announce();
    const interval = setInterval(announce, 3000);
    return () => clearInterval(interval);
  }, [screen, session.sessionId, session.token, session.shortCode, device]);

  // Periodic discovery polling when searching for peers on 'radar', 'send', or 'pairing'
  useEffect(() => {
    if (screen !== 'radar' && screen !== 'pairing' && screen !== 'send') return;

    const fetchPeers = async () => {
      try {
        const res = await fetchWithFallback(`/api/discovery/peers?excludeId=${session.sessionId || ''}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.peers)) {
            setDiscoveredPeers(data.peers);
          }
        }
      } catch {
        // Ignore network errors
      }
    };

    fetchPeers();
    const interval = setInterval(fetchPeers, 2500);
    return () => clearInterval(interval);
  }, [screen, session.sessionId]);

  // Theme synchronization
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System mode
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [settings.theme]);

  // Persist settings
  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem('flux_settings', JSON.stringify(next));
      return next;
    });
  }, []);

  const updateDeviceName = useCallback((name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    localStorage.setItem('flux_device_name', cleanName);
    setDevice((prev) => ({ ...prev, name: cleanName }));
    updateSettings({ deviceName: cleanName });
  }, [updateSettings]);

  // Add files to sender queue
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const newItems: FileItem[] = [];
    const arrayFiles = Array.from(files);

    for (const file of arrayFiles) {
      let previewUrl: string | undefined;
      if (file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
      }

      newItems.push({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        previewUrl,
        progress: 0,
        status: 'pending',
      });
    }

    setSelectedFiles((prev) => [...prev, ...newItems]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setSelectedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clearSelectedFiles = useCallback(() => {
    selectedFiles.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setSelectedFiles([]);
  }, [selectedFiles]);

  const addHistoryRecord = useCallback((record: HistoryRecord) => {
    setHistory((prev) => {
      const next = [record, ...prev].slice(0, 50); // Keep last 50
      localStorage.setItem('flux_history', JSON.stringify(next));
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem('flux_history');
  }, []);

  const deleteHistoryRecord = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((item) => item.id !== id);
      localStorage.setItem('flux_history', JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteFileFromDeviceAndHistory = useCallback(async (recordId: string, fileIndex?: number) => {
    let fileInfo: { localId?: string; name: string } | undefined;
    setHistory((prev) => {
      const record = prev.find((item) => item.id === recordId);
      if (record) {
        if (typeof fileIndex === 'number' && record.files[fileIndex]) {
          fileInfo = {
            localId: record.files[fileIndex].localId,
            name: record.files[fileIndex].name,
          };
        } else if (record.files[0]) {
          fileInfo = {
            localId: record.files[0].localId,
            name: record.files[0].name,
          };
        }
      }
      return prev;
    });

    if (fileInfo) {
      await deleteFileFromDevice(fileInfo.localId, fileInfo.name);
    }

    setHistory((prev) => {
      const next = prev.map((item) => {
        if (item.id !== recordId) return item;
        const updatedFiles = item.files.map((f, idx) => {
          if (typeof fileIndex === 'number' && idx !== fileIndex) return f;
          return { ...f, deletedFromDevice: true };
        });
        return { ...item, files: updatedFiles };
      });
      localStorage.setItem('flux_history', JSON.stringify(next));
      return next;
    });

    return { success: true };
  }, []);

  // WebRTC Signal forwarding listener setup
  useEffect(() => {
    const onSignal = async ({ signal }: { from: 'sender' | 'receiver'; signal: any }) => {
      if (signal.candidate) {
        await webrtc.addIceCandidate(signal.candidate);
      } else if (signal.sdp) {
        if (signal.sdp.type === 'offer') {
          const answer = await webrtc.handleOffer(signal.sdp);
          signaling.sendSignal({ sdp: answer });
        } else if (signal.sdp.type === 'answer') {
          await webrtc.handleAnswer(signal.sdp);
        }
      }
    };

    let offerInitiated = false;

    const initiateWebRtcOffer = () => {
      if (offerInitiated) return;
      offerInitiated = true;
      webrtc.init('sender');
      webrtc.createOffer().then((offer) => {
        signaling.sendSignal({ sdp: offer });
      }).catch((err) => {
        console.error('[WebRTC] Failed to create offer:', err);
      });
    };

    const onConnectedSender = ({ sessionId, receiverDevice }: { sessionId: string; receiverDevice?: DeviceInfo }) => {
      setSession((prev) => ({
        ...prev,
        sessionId,
        connected: true,
        peerDevice: receiverDevice || prev.peerDevice || null,
      }));
      sounds.playConnect();
      initiateWebRtcOffer();
    };

    const onPeerJoined = ({ role, device: peerDev }: { role: 'sender' | 'receiver'; device?: DeviceInfo }) => {
      setSession((prev) => ({
        ...prev,
        connected: true,
        peerDevice: peerDev || prev.peerDevice || null,
      }));
      sounds.playConnect();

      // If this client is sender, initiate WebRTC offer once
      if (session.role === 'sender' || role === 'receiver') {
        initiateWebRtcOffer();
      }
    };

    const onPeerDisconnected = () => {
      offerInitiated = false;
      disconnectNativeWifi();
      webrtc.close();
      signaling.disconnect();
      setSession(INITIAL_SESSION);
      clearSelectedFiles();
      setIncomingFiles([]);
      setTransferredFiles([]);
      setTransferStats(INITIAL_STATS);
      isTransferringRef.current = false;
      setScreen('home');
    };

    const onOfferFiles = ({ files, senderDevice }: { files: any[]; senderDevice?: DeviceInfo }) => {
      setSession((prev) => ({
        ...prev,
        peerDevice: senderDevice || prev.peerDevice,
      }));

      const mappedFiles: FileItem[] = files.map((f: any) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type,
        sha256: f.sha256,
        progress: 0,
        status: 'pending',
      }));

      setIncomingFiles(mappedFiles);

      if (settings.autoAccept) {
        sounds.playStart();
        signaling.approveFiles(true);
        isTransferringRef.current = true;
        setScreen('transferring');
      } else {
        sounds.playConnect();
        setScreen('incoming');
      }
    };

    const executeRelayUpload = async () => {
      try {
        setSession((prev) => ({ ...prev, mode: 'relay' }));
        setTransferStats((prev) => ({ ...prev, mode: 'relay' }));
        await relay.uploadFiles(
          session.sessionId,
          session.token,
          selectedFiles,
          (payload) => {
            setTransferStats(payload.stats);
            signaling.notifyProgress(payload);
          }
        );
        signaling.notifyComplete({});
        sounds.playComplete();
        confetti({ particleCount: 75, spread: 60, origin: { y: 0.7 } });
        setTransferredFiles(selectedFiles);
        setScreen('complete');
        addHistoryRecord({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          direction: 'sent',
          files: selectedFiles.map((f) => ({ name: f.name, size: f.size, type: f.type })),
          totalSize: selectedFiles.reduce((acc, f) => acc + f.size, 0),
          peerName: session.peerDevice?.name || 'Receiver',
          status: 'completed',
          mode: 'relay',
        });
      } catch (e: any) {
        sounds.playError();
        setErrorMessage(e.message || 'Gagal mengirim file via relay lokal.');
        setScreen('send');
      }
    };

    const onApproveFiles = async ({ approved }: { approved: boolean }) => {
      if (!approved) {
        sounds.playError();
        setErrorMessage('Transfer ditolak oleh penerima.');
        setScreen('send');
        return;
      }

      sounds.playStart();
      isTransferringRef.current = true;
      setScreen('transferring');

      if (session.mode === 'relay' || settings.preferRelay) {
        await executeRelayUpload();
      } else {
        // Direct WebRTC P2P transfer with instant Relay fallback
        try {
          await webrtc.sendFiles(selectedFiles);
          sounds.playComplete();
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          setTransferredFiles(selectedFiles);
          setScreen('complete');
          addHistoryRecord({
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            direction: 'sent',
            files: selectedFiles.map((f) => ({ name: f.name, size: f.size, type: f.type })),
            totalSize: selectedFiles.reduce((acc, f) => acc + f.size, 0),
            peerName: session.peerDevice?.name || 'Receiver',
            status: 'completed',
            mode: 'p2p',
          });
        } catch (e: any) {
          console.warn('[WebRTC] P2P channel unavailable, immediately switching to fast local relay:', e);
          switchRelayMode('P2P dialihkan ke Relay Lokal Berkecepatan Tinggi.');
          await executeRelayUpload();
        }
      }
    };

    const onRelayModeTrigger = ({ reason }: { reason: string }) => {
      setSession((prev) => ({ ...prev, mode: 'relay' }));
      setTransferStats((prev) => ({ ...prev, mode: 'relay' }));
      console.log('[Relay Fallback Triggered]:', reason);
    };

    const onRelayFileReady = async ({ file }: { file: any }) => {
      try {
        const received = await relay.downloadFile(file.downloadUrl, file, (payload) => {
          setTransferStats(payload.stats);
        });

        // Auto-save received file directly to device Gallery (Apple Photos / Android MediaStore)
        let localId: string | undefined;
        let savedToGallery = false;
        try {
          const saveRes = await saveFileToNativeGallery({
            name: received.name,
            blob: received.blob,
            type: received.type,
            downloadUrl: received.downloadUrl,
          });
          if (saveRes.success) {
            savedToGallery = true;
            localId = saveRes.localId;
            console.log('[Gallery] Auto-saved to gallery successfully:', received.name, localId);
          }
        } catch (saveErr) {
          console.warn('[Gallery] Auto-save error:', saveErr);
        }

        const finalReceived: FileItem = {
          ...received,
          savedToGallery,
          localId,
        };

        setTransferredFiles((prev) => {
          const next = [...prev, finalReceived];
          if (incomingFiles.length > 0 && next.length >= incomingFiles.length) {
            sounds.playComplete();
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
            setScreen('complete');
          }
          return next;
        });

        addHistoryRecord({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          direction: 'received',
          files: [{
            name: received.name,
            size: received.size,
            type: received.type,
            savedToGallery,
            localId,
          }],
          totalSize: received.size,
          peerName: session.peerDevice?.name || 'Sender',
          status: 'completed',
          mode: 'relay',
        });
      } catch (err: any) {
        sounds.playError();
        setErrorMessage(err.message || 'Relay download failed.');
      }
    };

    const onTransferProgress = (data: any) => {
      if (data.stats) {
        setTransferStats(data.stats);
      }
    };

    const onTransferComplete = () => {
      sounds.playComplete();
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setScreen('complete');
    };

    const onTransferCancelled = ({ reason }: { reason: string }) => {
      sounds.playError();
      setErrorMessage(reason || 'Transfer cancelled by peer.');
      setScreen('home');
    };

    const onError = ({ message }: { message: string }) => {
      sounds.playError();
      setErrorMessage(message);
    };

    // Attach signaling listeners
    signaling.on('signal', onSignal);
    signaling.on('connectedSender', onConnectedSender);
    signaling.on('peerJoined', onPeerJoined);
    signaling.on('peerDisconnected', onPeerDisconnected);
    signaling.on('offerFiles', onOfferFiles);
    signaling.on('approveFiles', onApproveFiles);
    signaling.on('relayModeTrigger', onRelayModeTrigger);
    signaling.on('relayFileReady', onRelayFileReady);
    signaling.on('transferProgress', onTransferProgress);
    signaling.on('transferComplete', onTransferComplete);
    signaling.on('transferCancelled', onTransferCancelled);
    signaling.on('error', onError);

    // WebRTC events
    const onWebrtcFallback = (reason: string) => {
      switchRelayMode(reason);
    };

    const onWebrtcFileReceived = async (file: FileItem) => {
      // Auto-save received file directly to device Gallery (Apple Photos / Android MediaStore)
      let localId: string | undefined;
      let savedToGallery = false;
      try {
        const saveRes = await saveFileToNativeGallery({
          name: file.name,
          blob: file.blob,
          type: file.type,
          downloadUrl: file.downloadUrl,
        });
        if (saveRes.success) {
          savedToGallery = true;
          localId = saveRes.localId;
          console.log('[Gallery] WebRTC file auto-saved to gallery:', file.name, localId);
        }
      } catch (saveErr) {
        console.warn('[Gallery] Auto-save error:', saveErr);
      }

      const finalFile: FileItem = {
        ...file,
        savedToGallery,
        localId,
      };

      setTransferredFiles((prev) => [...prev, finalFile]);
    };

    const onWebrtcProgress = (payload: { fileId: string; stats: TransferStats }) => {
      setTransferStats(payload.stats);
    };

    const onWebrtcComplete = () => {
      sounds.playComplete();
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setScreen('complete');

      setTransferredFiles((currentTransferred) => {
        const filesToLog = currentTransferred.length > 0
          ? currentTransferred.map((f) => ({
              name: f.name,
              size: f.size,
              type: f.type,
              savedToGallery: f.savedToGallery,
              localId: f.localId,
            }))
          : incomingFiles.map((f) => ({
              name: f.name,
              size: f.size,
              type: f.type,
            }));

        addHistoryRecord({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          direction: 'received',
          files: filesToLog,
          totalSize: filesToLog.reduce((acc, f) => acc + f.size, 0),
          peerName: session.peerDevice?.name || 'Sender',
          status: 'completed',
          mode: 'p2p',
        });
        return currentTransferred;
      });
    };

    webrtc.on('fallbackToRelay', onWebrtcFallback);
    webrtc.on('fileReceived', onWebrtcFileReceived);
    webrtc.on('progress', onWebrtcProgress);
    webrtc.on('transferComplete', onWebrtcComplete);

    return () => {
      signaling.off('signal', onSignal);
      signaling.off('connectedSender', onConnectedSender);
      signaling.off('peerJoined', onPeerJoined);
      signaling.off('peerDisconnected', onPeerDisconnected);
      signaling.off('offerFiles', onOfferFiles);
      signaling.off('approveFiles', onApproveFiles);
      signaling.off('relayModeTrigger', onRelayModeTrigger);
      signaling.off('relayFileReady', onRelayFileReady);
      signaling.off('transferProgress', onTransferProgress);
      signaling.off('transferComplete', onTransferComplete);
      signaling.off('transferCancelled', onTransferCancelled);
      signaling.off('error', onError);

      webrtc.off('fallbackToRelay', onWebrtcFallback);
      webrtc.off('fileReceived', onWebrtcFileReceived);
      webrtc.off('progress', onWebrtcProgress);
      webrtc.off('transferComplete', onWebrtcComplete);
    };
  }, [session, selectedFiles, incomingFiles, settings, addHistoryRecord]);

  const switchRelayMode = useCallback((reason?: string) => {
    setSession((prev) => ({ ...prev, mode: 'relay' }));
    setTransferStats((prev) => ({ ...prev, mode: 'relay' }));
    signaling.triggerRelay(reason || 'Switching to relay mode');
  }, []);

  // Create Receiver Session
  const createReceiveSession = useCallback(async () => {
    try {
      setErrorMessage(null);
      
      // Standalone local session credentials
      const localSessionId = crypto.randomUUID();
      const localToken = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      const localShortCode = Math.floor(100000 + Math.random() * 900000).toString();
      const localExpiresAt = Date.now() + 15 * 60 * 1000;

      let sessionData = {
        sessionId: localSessionId,
        token: localToken,
        shortCode: localShortCode,
        expiresAt: localExpiresAt,
      };

      // Attempt to register with local server if reachable
      try {
        const res = await fetchWithFallback('/api/session/create', {
          method: 'POST',
        });
        if (res.ok) {
          const data = await res.json();
          sessionData = data;
        }
      } catch (err) {
        console.warn('[Session] Server unreachable, running receiver in offline standalone mode:', err);
      }

      setSession({
        sessionId: sessionData.sessionId,
        token: sessionData.token,
        shortCode: sessionData.shortCode,
        expiresAt: sessionData.expiresAt,
        role: 'receiver',
        connected: false,
        peerDevice: null,
        mode: 'p2p',
      });

      // Attempt signaling connection if available
      try {
        await signaling.connect();
        signaling.registerReceiver(sessionData.sessionId, sessionData.token, device);
      } catch (err) {
        console.warn('[Signaling] Standalone receiver mode active:', err);
      }

      webrtc.init('receiver');
      setScreen('receive');
    } catch (err: any) {
      sounds.playError();
      setErrorMessage(err.message || 'Failed to start receive session');
    }
  }, [device]);

  // Connect as Sender to an existing session
  const connectToSession = useCallback(async (sessionId: string, token: string) => {
    try {
      setErrorMessage(null);
      await signaling.connect();
      signaling.connectSender({
        sessionId,
        token,
        device,
      });

      setSession((prev) => ({
        ...prev,
        sessionId,
        token,
        role: 'sender',
        mode: 'p2p',
      }));

      sounds.playConnect();
    } catch (err: any) {
      sounds.playError();
      setErrorMessage(err.message || 'Could not connect to receiver');
    }
  }, [device]);

  // Connect with 6-digit code
  const connectWithCode = useCallback(async (shortCode: string) => {
    try {
      setErrorMessage(null);
      const res = await fetchWithFallback('/api/session/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: shortCode }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Kode pairing 6-digit tidak ditemukan atau sudah kadaluarsa');
      }
      const data = await res.json();
      await connectToSession(data.sessionId, data.token);
    } catch (err: any) {
      sounds.playError();
      const msg = err?.message || '';
      if (msg.includes('Load failed') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setErrorMessage('Gagal menghubungi server relay. Pastikan kedua HP terhubung ke Wi-Fi / Hotspot yang sama.');
      } else {
        setErrorMessage(msg || 'Kode pairing tidak valid atau sudah kadaluarsa');
      }
    }
  }, [connectToSession]);

  // Connect to discovered local peer (SHAREit Radar)
  const connectToPeer = useCallback(async (peer: DiscoveredPeer) => {
    try {
      setErrorMessage(null);
      if (peer.sessionId && peer.token) {
        await connectToSession(peer.sessionId, peer.token);
      } else if (peer.shortCode) {
        await connectWithCode(peer.shortCode);
      } else {
        throw new Error('Informasi pairing perangkat tidak lengkap.');
      }
    } catch (err: any) {
      sounds.playError();
      setErrorMessage(err.message || 'Gagal terhubung ke perangkat penerima.');
      throw err;
    }
  }, [connectToSession, connectWithCode]);

  // Start Transfer (Sender sends manifest to Receiver)
  const startTransfer = useCallback(async () => {
    if (selectedFiles.length === 0) {
      setErrorMessage('Please select at least one file to transfer.');
      return;
    }

    const manifest = selectedFiles.map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      type: f.type,
      sha256: f.sha256,
    }));

    signaling.offerFiles(manifest);
  }, [selectedFiles]);

  const acceptIncomingTransfer = useCallback(async () => {
    signaling.approveFiles(true);
    isTransferringRef.current = true;
    setScreen('transferring');
  }, []);

  const rejectIncomingTransfer = useCallback(() => {
    signaling.approveFiles(false);
    setIncomingFiles([]);
    setScreen('home');
  }, []);

  const cancelActiveTransfer = useCallback((reason = 'User cancelled transfer') => {
    if (session.role === 'sender') {
      webrtc.cancel(reason);
      relay.cancel();
      signaling.cancelTransfer(reason);
    } else {
      signaling.cancelTransfer(reason);
    }
    isTransferringRef.current = false;
    sounds.playError();
    setScreen('home');
  }, [session.role]);

  const resetTransferState = useCallback(() => {
    try {
      signaling.disconnectPeer();
    } catch {}
    disconnectNativeWifi();
    webrtc.close();
    signaling.disconnect();
    clearSelectedFiles();
    setIncomingFiles([]);
    setTransferredFiles([]);
    setTransferStats(INITIAL_STATS);
    setSession(INITIAL_SESSION);
    isTransferringRef.current = false;
    setScreen('home');
  }, [clearSelectedFiles]);

  // Deep-link auto-connect (?sid=...&token=... or ?code=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('sid');
    const tok = params.get('token');
    const code = params.get('code');

    if (sid && tok) {
      // Clean query parameters from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      connectToSession(sid, tok).then(() => {
        setScreen('send');
      });
    } else if (code) {
      window.history.replaceState({}, document.title, window.location.pathname);
      connectWithCode(code).then(() => {
        setScreen('send');
      });
    }
  }, [connectToSession, connectWithCode]);

  return (
    <FluxContext.Provider
      value={{
        screen,
        setScreen,
        device,
        updateDeviceName,
        session,
        selectedFiles,
        incomingFiles,
        transferredFiles,
        transferStats,
        history,
        settings,
        updateSettings,
        errorMessage,
        setErrorMessage,
        networkInfo,
        discoveredPeers,
        connectToPeer,
        addFiles,
        removeFile,
        clearSelectedFiles,
        createReceiveSession,
        connectToSession,
        connectWithCode,
        startTransfer,
        acceptIncomingTransfer,
        rejectIncomingTransfer,
        cancelActiveTransfer,
        resetTransferState,
        clearHistory,
        deleteHistoryRecord,
        deleteFileFromDeviceAndHistory,
        switchRelayMode,
      }}
    >
      {children}
    </FluxContext.Provider>
  );
};

export const useFlux = () => {
  const ctx = useContext(FluxContext);
  if (!ctx) {
    throw new Error('useFlux must be used within FluxProvider');
  }
  return ctx;
};
