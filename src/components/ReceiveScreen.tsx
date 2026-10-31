import React, { useState, useEffect, useRef } from 'react';
import { useFlux } from '../context/FluxContext';
import QRCode from 'qrcode';
import { Copy, Check, Clock, Smartphone, ShieldCheck, Share2, RefreshCw } from 'lucide-react';

export const ReceiveScreen: React.FC = () => {
  const { session, device, networkInfo, createReceiveSession } = useFlux();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60);

  // Compute pairing URL (prioritizing LAN IP for cross-device camera scanning)
  const getPairingUrl = () => {
    const host = networkInfo.localIp && networkInfo.localIp !== '127.0.0.1'
      ? `${networkInfo.localIp}:${networkInfo.clientPort || window.location.port || '3000'}`
      : window.location.host;
    const protocol = window.location.protocol;
    return `${protocol}//${host}/?sid=${session.sessionId}&token=${session.token}`;
  };

  // Generate QR Code
  useEffect(() => {
    if (!session.sessionId || !session.token) return;

    const url = getPairingUrl();
    QRCode.toDataURL(url, {
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
  }, [session.sessionId, session.token, networkInfo]);

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

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'NoBarier File Transfer',
          text: `Connect to ${device.name} using NoBarier code: ${session.shortCode}`,
          url: getPairingUrl(),
        });
      } catch {
        // Dismissed
      }
    } else {
      copyLink();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 sm:py-8 flex flex-col items-center animate-fade-in">
      {/* Header */}
      <div className="text-center mb-6 w-full">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-flux-accent-light text-flux-accent text-xs font-semibold mb-3 border border-flux-accent/15">
          <span className="w-2 h-2 rounded-full bg-flux-accent animate-ping"></span>
          <span>Ready to receive</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-flux-primary mb-1">
          Scan to connect
        </h1>
        <p className="text-xs sm:text-sm text-flux-secondary">
          Point the sender device's camera at this QR code.
        </p>
      </div>

      {/* Main QR Card */}
      <div className="relative p-6 rounded-3xl bg-flux-surface border border-flux-border shadow-elevated flex flex-col items-center w-full mb-6">
        {/* QR Code Canvas */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 bg-white rounded-2xl p-3 border border-flux-border flex items-center justify-center shadow-subtle mb-4">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="FLUX Pairing QR Code"
              className="w-full h-full object-contain rounded-xl"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-flux-secondary">
              <div className="w-8 h-8 border-2 border-flux-accent border-t-transparent rounded-full animate-spin mb-2"></div>
              <span className="text-xs">Generating secure QR...</span>
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

        {/* 6-Digit Pairing Code Pill */}
        <div className="w-full mb-4">
          <div className="text-[11px] font-semibold text-flux-secondary uppercase text-center mb-1">
            Manual Pairing Code
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
                  <span className="text-flux-success">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy</span>
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
              Expires in <strong className="text-flux-primary font-mono">{formatCountdown(timeLeft)}</strong>
            </span>
          </div>
          <div className="flex items-center space-x-1.5 truncate max-w-[160px]">
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{device.name}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 w-full mb-6">
        <button
          onClick={copyLink}
          className="p-3.5 rounded-2xl bg-flux-surface border border-flux-border hover:bg-flux-surface-subtle text-flux-primary text-xs font-semibold flex items-center justify-center space-x-2 transition-colors active:scale-95"
        >
          {copiedLink ? (
            <>
              <Check className="w-4 h-4 text-flux-success" />
              <span className="text-flux-success">Link Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy Link</span>
            </>
          )}
        </button>

        <button
          onClick={shareNative}
          className="p-3.5 rounded-2xl bg-flux-surface border border-flux-border hover:bg-flux-surface-subtle text-flux-primary text-xs font-semibold flex items-center justify-center space-x-2 transition-colors active:scale-95"
        >
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </button>
      </div>

      {/* Pulse Waiting Status */}
      <div className="w-full p-4 rounded-2xl bg-flux-surface-subtle border border-flux-border flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-flux-accent"></span>
            <span className="absolute w-6 h-6 rounded-full bg-flux-accent/30 animate-ping"></span>
          </div>
          <div>
            <div className="text-xs font-semibold text-flux-primary">Waiting for sender device...</div>
            <div className="text-[11px] text-flux-secondary">Keep this screen open</div>
          </div>
        </div>

        <button
          onClick={() => createReceiveSession()}
          className="p-2 rounded-xl text-flux-secondary hover:text-flux-primary hover:bg-flux-surface transition-colors"
          title="New session"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Security Note */}
      <div className="flex items-center space-x-2 text-xs text-flux-secondary">
        <ShieldCheck className="w-4 h-4 text-flux-success" />
        <span>One-time temporary session • End-to-end encrypted</span>
      </div>
    </div>
  );
};
