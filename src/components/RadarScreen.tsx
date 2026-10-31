import React, { useState, useEffect } from 'react';
import { useFlux } from '../context/FluxContext';
import { DiscoveredPeer } from '../types/flux';
import {
  Smartphone,
  Laptop,
  QrCode,
  KeyRound,
  ArrowLeft,
  Wifi,
  RefreshCw,
  Radio,
  Share2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const RadarScreen: React.FC = () => {
  const {
    discoveredPeers,
    connectToPeer,
    device,
    setScreen,
    selectedFiles,
    session,
    startTransfer,
    setErrorMessage
  } = useFlux();

  const [connectingPeerId, setConnectingPeerId] = useState<string | null>(null);

  // If connected, start transfer
  useEffect(() => {
    if (session.connected && session.role === 'sender') {
      startTransfer();
    }
  }, [session.connected, session.role, startTransfer]);

  const handlePeerClick = async (peer: DiscoveredPeer) => {
    if (connectingPeerId) return;
    setConnectingPeerId(peer.id);
    try {
      await connectToPeer(peer);
    } catch (err: any) {
      setConnectingPeerId(null);
      setErrorMessage(err.message || 'Gagal terhubung ke perangkat');
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'iOS':
      case 'Android':
        return <Smartphone className="w-5 h-5" />;
      default:
        return <Laptop className="w-5 h-5" />;
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6 sm:py-8 flex flex-col items-center animate-fade-in select-none">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between mb-4">
        <button
          onClick={() => setScreen('send')}
          className="p-2 rounded-xl text-flux-secondary hover:text-flux-primary hover:bg-flux-surface-subtle transition-colors flex items-center space-x-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-semibold">Pilih File ({selectedFiles.length})</span>
        </button>

        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-flux-accent/10 border border-flux-accent/20 text-flux-accent text-xs font-semibold">
          <Wifi className="w-3.5 h-3.5" />
          <span>SHAREit Mode Lokal</span>
        </div>
      </div>

      <div className="text-center mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-flux-primary">
          Mencari Penerima Terdekat
        </h1>
        <p className="text-xs sm:text-sm text-flux-secondary mt-1">
          Ketuk perangkat di radar atau scan QR code untuk mengirim langsung
        </p>
      </div>

      {/* SHAREit Animated Radar Container */}
      <div className="relative w-full aspect-square max-w-[340px] sm:max-w-[380px] my-4 flex items-center justify-center">
        {/* Radar Concentric Rings */}
        <div className="absolute inset-0 rounded-full border border-flux-border opacity-70"></div>
        <div className="absolute inset-[15%] rounded-full border border-flux-border opacity-60"></div>
        <div className="absolute inset-[30%] rounded-full border border-flux-border opacity-50"></div>
        <div className="absolute inset-[45%] rounded-full border border-flux-border opacity-40"></div>

        {/* Pulse Animations */}
        <div className="absolute inset-0 rounded-full bg-flux-accent/5 animate-ping opacity-25"></div>
        <div className="absolute inset-[20%] rounded-full bg-flux-accent/10 animate-pulse"></div>

        {/* Radar Sweep Rotating Beam */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'conic-gradient(from 0deg, rgba(59, 130, 246, 0.25) 0deg, transparent 60deg, transparent 360deg)',
            animation: 'spin 4s linear infinite',
          }}
        ></div>

        {/* Center: My Device Avatar */}
        <div className="relative z-10 w-16 h-16 rounded-full bg-flux-primary text-flux-surface flex flex-col items-center justify-center shadow-elevated border-2 border-flux-surface">
          <Radio className="w-6 h-6 animate-pulse text-flux-accent" />
          <span className="text-[10px] font-bold mt-0.5 truncate max-w-[50px]">{device.name.slice(0, 8)}</span>
        </div>

        {/* Discovered Peer Avatars Placed on Radar */}
        {discoveredPeers.map((peer, idx) => {
          // Calculate orbital positions based on index
          const angle = (idx * (360 / Math.max(discoveredPeers.length, 4)) + 45) * (Math.PI / 180);
          const radius = 110; // distance from center in px
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const isConnecting = connectingPeerId === peer.id;

          return (
            <button
              key={peer.id}
              onClick={() => handlePeerClick(peer)}
              disabled={isConnecting}
              style={{
                transform: `translate(${x}px, ${y}px)`,
              }}
              className={`absolute z-20 flex flex-col items-center group transition-all duration-300 hover:scale-110 active:scale-95`}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-card border-2 transition-all ${
                  isConnecting
                    ? 'bg-flux-accent text-white border-flux-accent animate-bounce'
                    : 'bg-flux-surface text-flux-primary border-flux-accent hover:bg-flux-accent hover:text-white'
                }`}
              >
                {isConnecting ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  getPlatformIcon(peer.platform)
                )}
              </div>
              <div className="mt-1 px-2 py-0.5 rounded-full bg-flux-surface/95 backdrop-blur-sm border border-flux-border shadow-subtle text-center">
                <p className="text-[11px] font-bold text-flux-primary truncate max-w-[80px]">
                  {peer.name}
                </p>
                <p className="text-[9px] text-flux-accent font-semibold">
                  {isConnecting ? 'Menghubungkan...' : 'Ketuk untuk kirim'}
                </p>
              </div>
            </button>
          );
        })}

        {/* Empty State when no peers yet */}
        {discoveredPeers.length === 0 && (
          <div className="absolute bottom-2 z-10 px-3 py-1.5 rounded-xl bg-flux-surface/90 backdrop-blur-sm border border-flux-border text-center shadow-subtle">
            <p className="text-[11px] text-flux-secondary font-medium">
              Memindai jaringan Wi-Fi lokal...
            </p>
          </div>
        )}
      </div>

      {/* Alternative Connection Options */}
      <div className="w-full grid grid-cols-2 gap-3 mt-4 mb-4">
        <button
          onClick={() => setScreen('pairing')}
          className="p-3.5 rounded-2xl bg-flux-surface border border-flux-border hover:border-flux-accent text-flux-primary flex items-center justify-center space-x-2 text-xs font-semibold shadow-subtle transition-all active:scale-[0.98]"
        >
          <QrCode className="w-4 h-4 text-flux-accent" />
          <span>Scan QR Code</span>
        </button>

        <button
          onClick={() => setScreen('pairing')}
          className="p-3.5 rounded-2xl bg-flux-surface border border-flux-border hover:border-flux-accent text-flux-primary flex items-center justify-center space-x-2 text-xs font-semibold shadow-subtle transition-all active:scale-[0.98]"
        >
          <KeyRound className="w-4 h-4 text-flux-accent" />
          <span>6-Digit Code</span>
        </button>
      </div>

      {/* Helper Banner */}
      <div className="w-full p-3.5 rounded-2xl bg-flux-surface-subtle border border-flux-border flex items-start space-x-2.5 text-xs text-flux-secondary">
        <Wifi className="w-4 h-4 text-flux-accent shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-flux-primary">Tips SHAREit:</strong> Kedua perangkat harus terhubung ke Wi-Fi / Hotspot yang sama. Jika tidak ada Wi-Fi, salah satu HP bisa mengaktifkan Hotspot Pribadi dan perangkat lain melakukan scan QR untuk auto-connect.
        </div>
      </div>
    </div>
  );
};
