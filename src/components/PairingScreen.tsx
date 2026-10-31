import React, { useState, useEffect, useRef } from 'react';
import { useFlux } from '../context/FluxContext';
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from 'html5-qrcode';
import { QrCode, KeyRound, Camera, RefreshCw, AlertCircle, ArrowLeft, Flashlight, Upload } from 'lucide-react';
import { parseWifiQr, joinNativeWifi } from '../utils/wifi';
import { setTargetServerUrl } from '../utils/api';

export const PairingScreen: React.FC = () => {
  const { session, selectedFiles, connectToSession, connectWithCode, startTransfer, setScreen, setErrorMessage, errorMessage } = useFlux();
  const [tab, setTab] = useState<'scan' | 'manual'>('scan');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatusText, setConnectionStatusText] = useState('Connecting to receiver...');
  const [scannerStarted, setScannerStarted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);
  const qrRegionId = 'flux-qr-reader';

  // Handle scanned result
  const handleScanSuccess = async (decodedText: string) => {
    if (isConnecting) return;
    setIsConnecting(true);
    setConnectionStatusText('Memproses QR Code...');

    try {
      // Stop scanner
      if (scannerRef.current && scannerStarted) {
        await scannerRef.current.stop();
        setScannerStarted(false);
      }

      // 0. Try Wi-Fi QR code parsing (SHAREit Hotspot / Local Network QR)
      const wifi = parseWifiQr(decodedText);
      if (wifi.isWifi) {
        if (wifi.ssid) {
          setConnectionStatusText(`Menghubungkan ke Wi-Fi ${wifi.ssid}...`);
          joinNativeWifi(wifi.ssid, wifi.password);
        }
        if (wifi.url) {
          try {
            const urlObj = new URL(wifi.url);
            const backendPort = urlObj.port === '3000' ? ':3001' : (urlObj.port ? `:${urlObj.port}` : '');
            const backendOrigin = `${urlObj.protocol}//${urlObj.hostname}${backendPort}`;
            setTargetServerUrl(backendOrigin);
          } catch {
            setTargetServerUrl(wifi.url);
          }
        }
        if (wifi.code) {
          setConnectionStatusText('Memasangkan kode 6-digit...');
          await connectWithCode(wifi.code);
          return;
        } else if (wifi.sid && wifi.token) {
          setConnectionStatusText('Membuat koneksi langsung...');
          await connectToSession(wifi.sid, wifi.token);
          return;
        }

        setIsConnecting(false);
        setTab('manual');
        return;
      }

      // 1. Try URL parsing (e.g. http://10.0.10.20:3000/?sid=...&token=...)
      try {
        const url = new URL(decodedText);
        if (url.origin && url.origin !== window.location.origin) {
          const backendPort = url.port === '3000' ? ':3001' : (url.port ? `:${url.port}` : '');
          const backendOrigin = `${url.protocol}//${url.hostname}${backendPort}`;
          setTargetServerUrl(backendOrigin);
        }

        const sid = url.searchParams.get('sid');
        const token = url.searchParams.get('token');
        const code = url.searchParams.get('code');

        if (sid && token) {
          setConnectionStatusText('Membuat koneksi langsung...');
          await connectToSession(sid, token);
          return;
        } else if (code) {
          setConnectionStatusText('Memasangkan kode 6-digit...');
          await connectWithCode(code);
          return;
        }
      } catch {
        // Not a URL, continue
      }

      // 2. Try JSON parsing
      try {
        const parsed = JSON.parse(decodedText);
        if (parsed.sid && parsed.token) {
          setConnectionStatusText('Membuat koneksi langsung...');
          await connectToSession(parsed.sid, parsed.token);
          return;
        }
      } catch {
        // Not JSON, continue
      }

      // 3. Try 6-digit code
      const cleanDigits = decodedText.trim().replace(/\D/g, '');
      if (cleanDigits.length === 6) {
        setConnectionStatusText('Memasangkan kode 6-digit...');
        await connectWithCode(cleanDigits);
        return;
      }

      throw new Error('Format QR code tidak dikenali. Silakan scan QR code NoBarier yang valid.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal terhubung melalui QR code.');
      setIsConnecting(false);
    }
  };

  // Start HTML5 QR Scanner
  const startCamera = async (mode: 'environment' | 'user') => {
    try {
      setCameraError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera is not supported or restricted in this environment.');
      }

      // Properly clean up previous instance if any
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch {
          // Ignore
        }
        scannerRef.current = null;
      }

      const scanner = new Html5Qrcode(qrRegionId);
      scannerRef.current = scanner;

      const config: Html5QrcodeCameraScanConfig = {
        fps: 15,
        qrbox: { width: 240, height: 240 },
      };

      // Use standard facingMode (environment / user) for optimal iOS sensor mapping
      await scanner.start(
        { facingMode: mode },
        config,
        handleScanSuccess,
        () => {}
      );

      // Enforce iOS inline video playback attributes
      setTimeout(() => {
        const videoEl = document.querySelector<HTMLVideoElement>(`#${qrRegionId} video`);
        if (videoEl) {
          videoEl.setAttribute('autoplay', 'true');
          videoEl.setAttribute('playsinline', 'true');
          videoEl.setAttribute('webkit-playsinline', 'true');
          videoEl.setAttribute('muted', 'true');
          videoEl.muted = true;
          videoEl.style.width = '100%';
          videoEl.style.height = '100%';
          videoEl.style.objectFit = 'cover';
          videoEl.play().catch((e) => console.warn('[Camera] iOS inline play:', e));
        }
      }, 50);

      setScannerStarted(true);
    } catch (err: any) {
      console.warn('Camera start error:', err);
      const msg = err?.message || 'Unable to open camera';
      setCameraError(
        msg.includes('NotAllowedError') || msg.includes('Permission')
          ? 'Camera permission denied. Please allow Camera access in iPhone Settings > NoBarier, or enter the 6-digit code manually.'
          : `Camera could not start (${msg}). Please enter the 6-digit code manually.`
      );
      setScannerStarted(false);
    }
  };

  // Stop scanner on unmount or tab switch
  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch {
        // Ignore
      }
      setScannerStarted(false);
    }
  };

  useEffect(() => {
    if (tab === 'scan') {
      startCamera(facingMode);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [tab, facingMode]);

  // Flip camera (environment <-> user)
  const toggleCameraFacing = async () => {
    await stopCamera();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Torch toggle (if supported by track)
  const toggleTorch = async () => {
    try {
      if (scannerRef.current) {
        const capabilities = (scannerRef.current as any).getRunningTrackCapabilities?.();
        if (capabilities && capabilities.torch) {
          await (scannerRef.current as any).applyVideoConstraints({
            advanced: [{ torch: !torchOn }],
          });
          setTorchOn(!torchOn);
        }
      }
    } catch {
      // Not supported
    }
  };

  // QR screenshot file upload fallback
  const handleQrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const file = e.target.files[0];
        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode(qrRegionId);
        }
        const result = await scannerRef.current.scanFile(file, true);
        handleScanSuccess(result);
      } catch (err: any) {
        setErrorMessage('Could not find a valid QR code in the selected image.');
      }
    }
  };

  // Manual 6-digit code entry
  const handleDigitChange = (index: number, value: string) => {
    const char = value.slice(-1).replace(/\D/g, '');
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);

    if (char && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }

    // If all 6 digits entered, auto-submit
    const fullCode = newDigits.join('');
    if (fullCode.length === 6 && !newDigits.includes('')) {
      submitManualCode(fullCode);
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = [...digits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setDigits(newDigits);
      if (pasted.length === 6) {
        submitManualCode(pasted);
      } else {
        digitRefs.current[Math.min(pasted.length, 5)]?.focus();
      }
    }
  };

  const submitManualCode = async (code: string) => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      await connectWithCode(code);
    } catch (err: any) {
      setIsConnecting(false);
      setErrorMessage(err.message || 'Invalid code. Please check and try again.');
    }
  };

  // If connected, show connected banner and trigger file transfer approval request
  useEffect(() => {
    if (session.connected && session.role === 'sender') {
      setIsConnecting(false);
      startTransfer();
    }
  }, [session.connected, session.role, startTransfer]);

  // Safety connection timeout to prevent infinite stuck spinner
  useEffect(() => {
    let timer: any;
    if (isConnecting) {
      timer = setTimeout(() => {
        setIsConnecting(false);
        setErrorMessage('Connection timed out. Please verify the 6-digit code or check that the receiver is still on the receive screen.');
      }, 15000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isConnecting, setErrorMessage]);

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 sm:py-8 flex flex-col items-center animate-fade-in">
      {/* Top Bar */}
      <div className="w-full flex items-center justify-between mb-6">
        <button
          onClick={() => setScreen(selectedFiles.length > 0 ? 'radar' : 'send')}
          className="p-2 rounded-xl text-flux-secondary hover:text-flux-primary hover:bg-flux-surface-subtle transition-colors flex items-center space-x-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-semibold">Kembali ke Radar</span>
        </button>
      </div>

      {/* Header */}
      <div className="text-center mb-6 w-full">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-flux-primary mb-1">
          Connect to a device
        </h1>
        <p className="text-xs sm:text-sm text-flux-secondary">
          Scan the QR code displayed on the receiving device.
        </p>
      </div>

      {/* Tabs */}
      <div className="w-full flex p-1 rounded-2xl bg-flux-surface-subtle border border-flux-border mb-6">
        <button
          onClick={() => setTab('scan')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
            tab === 'scan'
              ? 'bg-flux-surface text-flux-primary shadow-subtle'
              : 'text-flux-secondary hover:text-flux-primary'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Scan QR Code</span>
        </button>
        <button
          onClick={() => setTab('manual')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
            tab === 'manual'
              ? 'bg-flux-surface text-flux-primary shadow-subtle'
              : 'text-flux-secondary hover:text-flux-primary'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Enter 6-digit Code</span>
        </button>
      </div>

      {/* Tab 1: Active QR Scanner */}
      {tab === 'scan' && (
        <div className="w-full flex flex-col items-center">
          <div className="relative w-full aspect-square max-w-[320px] rounded-3xl overflow-hidden bg-black border-2 border-flux-border shadow-elevated flex items-center justify-center mb-4">
            {/* HTML5 QR Code Container */}
            <div id={qrRegionId} className="w-full h-full object-cover"></div>

            {/* Target Reticle Overlay */}
            {scannerStarted && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                <div className="w-full h-full relative border-2 border-white/40 rounded-2xl">
                  {/* Corner Accent Markers */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-flux-accent rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-flux-accent rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-flux-accent rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-flux-accent rounded-br-lg"></div>

                  {/* Animated Laser Scanline */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-flux-accent to-transparent shadow-glow animate-scan"></div>
                </div>
              </div>
            )}

            {/* Camera Error / Permission Fallback */}
            {cameraError && (
              <div className="absolute inset-0 bg-flux-surface p-6 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-10 h-10 text-flux-error mb-3" />
                <h3 className="text-sm font-semibold text-flux-primary mb-1">Camera Access Required</h3>
                <p className="text-xs text-flux-secondary mb-4 leading-relaxed">{cameraError}</p>
                <div className="flex flex-col space-y-2 w-full">
                  <button
                    onClick={() => startCamera(facingMode)}
                    className="py-2.5 px-4 rounded-xl bg-flux-primary text-flux-surface text-xs font-semibold hover:bg-flux-accent transition-colors"
                  >
                    Retry Camera
                  </button>
                  <button
                    onClick={() => setTab('manual')}
                    className="py-2.5 px-4 rounded-xl bg-flux-surface-subtle text-flux-primary text-xs font-semibold hover:bg-flux-border transition-colors"
                  >
                    Use 6-digit Code Instead
                  </button>
                </div>
              </div>
            )}

            {/* Loading / Connecting Overlay */}
            {isConnecting && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4">
                <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-sm font-semibold">{connectionStatusText}</p>
                <p className="text-xs text-white/70 mt-1">Membangun saluran transfer lokal...</p>
              </div>
            )}
          </div>

          {/* Scanner Controls */}
          {scannerStarted && (
            <div className="flex items-center space-x-3 mb-4">
              <button
                onClick={toggleCameraFacing}
                className="p-3 rounded-2xl bg-flux-surface border border-flux-border text-flux-primary hover:bg-flux-surface-subtle flex items-center space-x-2 text-xs font-semibold transition-colors"
                title="Switch Camera"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Switch camera</span>
              </button>
              <button
                onClick={toggleTorch}
                className="p-3 rounded-2xl bg-flux-surface border border-flux-border text-flux-primary hover:bg-flux-surface-subtle flex items-center space-x-2 text-xs font-semibold transition-colors"
                title="Flashlight"
              >
                <Flashlight className={`w-4 h-4 ${torchOn ? 'text-amber-500 fill-amber-500' : ''}`} />
                <span>Torch</span>
              </button>
            </div>
          )}

          {/* Upload Screenshot Fallback */}
          <label className="cursor-pointer text-xs font-medium text-flux-secondary hover:text-flux-accent flex items-center space-x-1.5 transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload QR code screenshot instead</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleQrFileUpload}
            />
          </label>
        </div>
      )}

      {/* Tab 2: Manual 6-Digit Code */}
      {tab === 'manual' && (
        <div className="w-full flex flex-col items-center p-6 rounded-3xl bg-flux-surface border border-flux-border shadow-card">
          <KeyRound className="w-10 h-10 text-flux-accent mb-3" />
          <h2 className="text-base font-semibold text-flux-primary mb-1">Enter pairing code</h2>
          <p className="text-xs text-flux-secondary text-center mb-6">
            Enter the 6-digit code shown on the receiver screen
          </p>

          {/* 6 Digit Input Boxes */}
          <div className="flex justify-center space-x-2 sm:space-x-3 w-full mb-6" onPaste={handlePaste}>
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  digitRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                disabled={isConnecting}
                className="w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold rounded-2xl bg-flux-surface-subtle border border-flux-border text-flux-primary focus:border-flux-accent focus:ring-2 focus:ring-flux-accent/20 focus:outline-none transition-all disabled:opacity-50"
              />
            ))}
          </div>

          <button
            onClick={() => submitManualCode(digits.join(''))}
            disabled={digits.includes('') || isConnecting}
            className={`w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] ${
              !digits.includes('') && !isConnecting
                ? 'bg-flux-primary text-flux-surface hover:bg-flux-accent'
                : 'bg-flux-surface-subtle text-flux-secondary cursor-not-allowed border border-flux-border'
            }`}
          >
            {isConnecting ? 'Connecting...' : 'Connect to Receiver'}
          </button>
        </div>
      )}

      {/* Connection Status Banner */}
      {session.connected && (
        <div className="w-full mt-6 p-4 rounded-2xl bg-flux-success-light border border-flux-success/20 flex items-center space-x-3 text-flux-success">
          <div className="w-2.5 h-2.5 rounded-full bg-flux-success animate-ping shrink-0"></div>
          <div className="text-xs">
            <span className="font-semibold">Device connected!</span> Waiting for receiver to approve transfer...
          </div>
        </div>
      )}
    </div>
  );
};
