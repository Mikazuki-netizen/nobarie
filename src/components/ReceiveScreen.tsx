import React, { useState, useEffect } from 'react';
import { useFlux } from '../context/FluxContext';
import QRCode from 'qrcode';
import { generateWifiQrString } from '../utils/wifi';
import {
  Copy,
  Check,
  Clock,
  Smartphone,
  ShieldCheck,
  Share2,
  RefreshCw,
  Wifi,
  Radio,
  HelpCircle,
  ArrowLeft
} from 'lucide-react';

export const ReceiveScreen: React.FC = () => {
  const { session, device, networkInfo, createReceiveSession, setScreen } = useFlux();
  const [tab, setTab] = useState<'hotspot' | 'wifi'>('hotspot');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60);

  // Clean hotspot name & password
  const cleanDeviceName = device.name.replace(/[^a-zA-Z0-9]/g, '') || 'Device';
  const hotspotSsid = `NoBarier-${cleanDeviceName}`;
  const hotspotPassword = 'nobarierpass';

  // Compute pairing URL (prioritizing LAN IP for direct local transfer)
  const getPairingUrl = () => {
    const host = networkInfo.localIp && networkInfo.localIp !== '127.0.0.1'
      ? `${networkInfo.localIp}:${networkInfo.clientPort || window.location.port || '3001'}`
      : window.location.host;
    const protocol = window.location.protocol;
    return `${protocol}//${host}/?sid=${session.sessionId}&token=${session.token}&code=${session.shortCode}`;
  };

  // Generate QR Code based on active tab
  useEffect(() => {
    if (!session.sessionId || !session.token) return;

    const pairingUrl = getPairingUrl();
    let qrPayload = pairingUrl;

    if (tab === 'hotspot') {
      // Generate standard Wi-Fi QR with embedded pairing URL
      qrPayload = generateWifiQrString(hotspotSsid, hotspotPassword, pairingUrl);
    }

    QRCode.toDataURL(qrPayload, {
      width: 400,
      margin: 2,
      color: {
        dark: '#171717',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl) => {
        setQrDataUrl(dataUrl);
      })
      .catch((err) => {
        console.error('QR code generation failed:', err);
      });
  }, [tab, session.sessionId, session.token, networkInfo, hotspotSsid]);

  // Session expiration countdown
  useEffect(() => {
    if (!session.expiresAt) return;

    const updateTimer = () => {
      const remainingSecs = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
      setTimeLeft(remainingSecs);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session.expiresAt]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(getPairingUrl());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(session.shortCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Ignore
    }
  };

  const copyHotspotPassword = async () => {
    try {
      await navigator.clipboard.writeText(hotspotPassword);
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 sm:py-8 flex flex-col items-center animate-fade-in">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between mb-4">
        <button
          onClick={() => setScreen('home')}
          className="p-2 rounded-xl text-flux-secondary hover:text-flux-primary hover:bg-flux-surface-subtle transition-colors flex items-center space-x-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-semibold">Beranda</span>
        </button>

        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-flux-accent-light text-flux-accent text-xs font-semibold border border-flux-accent/15">
          <span className="w-2 h-2 rounded-full bg-flux-accent animate-ping"></span>
          <span>Siap Menerima</span>
        </div>
      </div>

      <div className="text-center mb-5 w-full">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-flux-primary mb-1">
          Mode Penerima (SHAREit)
        </h1>
        <p className="text-xs sm:text-sm text-flux-secondary">
          {tab === 'hotspot'
            ? 'Aktifkan Hotspot atau minta pengirim scan QR untuk auto-connect'
            : 'Perangkat terdeteksi otomatis pada radar pengirim di Wi-Fi yang sama'}
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="w-full flex p-1 rounded-2xl bg-flux-surface-subtle border border-flux-border mb-5">
        <button
          onClick={() => setTab('hotspot')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
            tab === 'hotspot'
              ? 'bg-flux-surface text-flux-primary shadow-subtle'
              : 'text-flux-secondary hover:text-flux-primary'
          }`}
        >
          <Radio className="w-4 h-4 text-flux-accent" />
          <span>Hotspot Mandiri (Offline)</span>
        </button>
        <button
          onClick={() => setTab('wifi')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
            tab === 'wifi'
              ? 'bg-flux-surface text-flux-primary shadow-subtle'
              : 'text-flux-secondary hover:text-flux-primary'
          }`}
        >
          <Wifi className="w-4 h-4 text-emerald-500" />
          <span>Wi-Fi yang Sama</span>
        </button>
      </div>

      {/* Main QR Card */}
      <div className="relative p-6 rounded-3xl bg-flux-surface border border-flux-border shadow-elevated flex flex-col items-center w-full mb-6">
        {/* QR Code Canvas */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 bg-white rounded-2xl p-3 border border-flux-border flex items-center justify-center shadow-subtle mb-4">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="NoBarier Pairing QR Code"
              className="w-full h-full object-contain rounded-xl"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-flux-secondary">
              <div className="w-8 h-8 border-2 border-flux-accent border-t-transparent rounded-full animate-spin mb-2"></div>
              <span className="text-xs">Membuat QR Code...</span>
            </div>
          )}

          {/* Center Brand Badge on QR */}
          {qrDataUrl && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <img
                src="./pirate_icon.png"
                alt="NoBarier"
                className="w-12 h-12 rounded-xl shadow-elevated border-2 border-white object-cover"
              />
            </div>
          )}
        </div>

        {/* Tab 1 Details: Hotspot Info Box */}
        {tab === 'hotspot' ? (
          <div className="w-full mb-4 p-3.5 rounded-2xl bg-flux-surface-subtle border border-flux-border text-xs flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-flux-secondary font-medium">Nama Hotspot:</span>
              <span className="font-bold text-flux-primary">{hotspotSsid}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-flux-secondary font-medium">Sandi Hotspot:</span>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-flux-primary">{hotspotPassword}</span>
                <button
                  onClick={copyHotspotPassword}
                  className="p-1 text-flux-secondary hover:text-flux-primary"
                  title="Salin Sandi"
                >
                  {copiedPass ? <Check className="w-3.5 h-3.5 text-flux-success" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-flux-secondary pt-1 border-t border-flux-border/60">
              Pengirim cukup scan QR di atas untuk otomatis bergabung ke Hotspot ini.
            </p>
          </div>
        ) : (
          /* Tab 2 Details: Same Wi-Fi LAN broadcast info */
          <div className="w-full mb-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex flex-col space-y-1.5">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span className="font-semibold flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Terhubung di Wi-Fi Lokal</span>
              </span>
              <span className="font-mono text-[11px]">{networkInfo.localIp || '10.0.10.20'}</span>
            </div>
            <p className="text-[11px] text-flux-secondary">
              Perangkat ini otomatis tampil di layar Radar pengirim yang berada di jaringan Wi-Fi yang sama.
            </p>
          </div>
        )}

        {/* 6-Digit Pairing Code Pill */}
        <div className="w-full mb-4">
          <div className="text-[11px] font-semibold text-flux-secondary uppercase text-center mb-1">
            Kode Pairing 6-Digit
          </div>
          <div className="flex items-center justify-between p-3 rounded-2xl bg-flux-surface-subtle border border-flux-border">
            <span className="text-xl sm:text-2xl font-bold font-mono tracking-widest text-flux-primary pl-2">
              {session.shortCode ? `${session.shortCode.slice(0, 3)} ${session.shortCode.slice(3)}` : '------'}
            </span>
            <button
              onClick={copyCode}
              className="p-2 rounded-xl bg-flux-surface border border-flux-border text-flux-primary hover:bg-flux-border transition-colors flex items-center space-x-1.5 text-xs font-semibold"
            >
              {copiedCode ? (
                <>
                  <Check className="w-4 h-4 text-flux-success" />
                  <span className="text-flux-success">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Salin</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Expiration Timer & Device */}
        <div className="flex items-center justify-between w-full text-xs text-flux-secondary pt-2 border-t border-flux-border">
          <div className="flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Kedaluwarsa dalam <strong className="text-flux-primary font-mono">{formatCountdown(timeLeft)}</strong>
            </span>
          </div>
          <div className="flex items-center space-x-1.5 truncate max-w-[160px]">
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{device.name}</span>
          </div>
        </div>
      </div>

      {/* Waiting Indicator Banner */}
      <div className="w-full p-4 rounded-2xl bg-flux-surface-subtle border border-flux-border flex items-center justify-between mb-4 shadow-subtle">
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-flux-accent"></span>
            <span className="absolute w-6 h-6 rounded-full bg-flux-accent/30 animate-ping"></span>
          </div>
          <div>
            <div className="text-xs font-semibold text-flux-primary">Menunggu kiriman dari perangkat pengirim...</div>
            <div className="text-[11px] text-flux-secondary">Biarkan layar ini tetap terbuka</div>
          </div>
        </div>

        <button
          onClick={() => createReceiveSession()}
          className="p-2 rounded-xl text-flux-secondary hover:text-flux-primary hover:bg-flux-surface transition-colors"
          title="Sesi Baru"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Security Note */}
      <div className="flex items-center space-x-2 text-xs text-flux-secondary">
        <ShieldCheck className="w-4 h-4 text-flux-success" />
        <span>Koneksi Jaringan Lokal 100% Offline • Tanpa Kuota Internet</span>
      </div>
    </div>
  );
};
