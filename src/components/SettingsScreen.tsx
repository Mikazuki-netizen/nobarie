import React, { useState } from 'react';
import { useFlux } from '../context/FluxContext';
import { getServerUrl, setTargetServerUrl } from '../utils/api';
import {
  ArrowLeft,
  Smartphone,
  ShieldCheck,
  Volume2,
  Vibrate,
  Check,
  Zap,
  Pencil,
} from 'lucide-react';

export const SettingsScreen: React.FC = () => {
  const { device, updateDeviceName, settings, updateSettings, setScreen } = useFlux();
  const [nameInput, setNameInput] = useState(device.name);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [serverUrl, setServerUrl] = useState(() => getServerUrl());
  const [serverSavedSuccess, setServerSavedSuccess] = useState(false);

  const handleSaveName = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nameInput.trim()) return;
    updateDeviceName(nameInput.trim());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handlePromptName = () => {
    const val = window.prompt('Ubah Nama Perangkat (Device Name):', nameInput);
    if (val !== null && val.trim()) {
      setNameInput(val.trim());
      updateDeviceName(val.trim());
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }
  };

  const handleSaveServer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!serverUrl.trim()) return;
    setTargetServerUrl(serverUrl.trim());
    setServerSavedSuccess(true);
    setTimeout(() => setServerSavedSuccess(false), 2000);
  };

  const handlePromptServer = () => {
    const val = window.prompt('Ubah Signaling & Relay Server URL:', serverUrl);
    if (val !== null && val.trim()) {
      setServerUrl(val.trim());
      setTargetServerUrl(val.trim());
      setServerSavedSuccess(true);
      setTimeout(() => setServerSavedSuccess(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6 sm:py-8 flex flex-col min-h-[calc(100vh-5rem)] animate-fade-in">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setScreen('home')}
          className="p-2 rounded-xl text-flux-secondary hover:text-flux-primary hover:bg-flux-surface-subtle transition-colors flex items-center space-x-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-semibold">Home</span>
        </button>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-flux-primary mb-1">
          Settings
        </h1>
        <p className="text-xs sm:text-sm text-flux-secondary">
          Customize device identification and transfer preferences.
        </p>
      </div>

      {/* Device Name Form */}
      <div className="p-5 rounded-3xl bg-flux-surface border border-flux-border shadow-subtle mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2.5">
            <Smartphone className="w-5 h-5 text-flux-accent" />
            <h2 className="text-sm font-semibold text-flux-primary">Device Name</h2>
          </div>
          <button
            onClick={handlePromptName}
            className="p-1.5 px-2.5 rounded-lg bg-flux-surface-subtle hover:bg-flux-border text-flux-accent text-xs font-semibold flex items-center space-x-1 transition-colors"
            title="Edit with native keyboard"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>
        <p className="text-xs text-flux-secondary mb-4">
          This name is visible to paired devices during connection.
        </p>

        <form onSubmit={handleSaveName} className="flex items-center space-x-2">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="e.g. Yahya's iPhone"
            maxLength={32}
            className="flex-1 py-3 px-4 rounded-xl bg-flux-surface-subtle border border-flux-border text-base font-medium text-flux-primary focus:border-flux-accent focus:outline-none transition-colors"
          />
          <button
            type="submit"
            className="py-3 px-4 rounded-xl bg-flux-primary text-flux-surface hover:bg-flux-accent text-xs font-semibold transition-colors flex items-center space-x-1 shrink-0"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-flux-success" />
                <span>Saved</span>
              </>
            ) : (
              <span>Save</span>
            )}
          </button>
        </form>
      </div>

      {/* Server URL Configuration */}
      <div className="p-5 rounded-3xl bg-flux-surface border border-flux-border shadow-subtle mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2.5">
            <Zap className="w-5 h-5 text-flux-accent" />
            <h2 className="text-sm font-semibold text-flux-primary">Signaling & Relay Server</h2>
          </div>
          <button
            onClick={handlePromptServer}
            className="p-1.5 px-2.5 rounded-lg bg-flux-surface-subtle hover:bg-flux-border text-flux-accent text-xs font-semibold flex items-center space-x-1 transition-colors"
            title="Edit with native keyboard"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>
        <p className="text-xs text-flux-secondary mb-3">
          Alamat IP jaringan lokal (Wi-Fi / Hotspot) untuk komunikasi server backend.
        </p>
        <form onSubmit={handleSaveServer} className="flex items-center space-x-2">
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="http://10.0.10.20:3001"
            className="flex-1 py-3 px-3 rounded-xl bg-flux-surface-subtle border border-flux-border text-base font-mono text-flux-primary focus:border-flux-accent focus:outline-none transition-colors"
          />
          <button
            type="submit"
            className="py-3 px-4 rounded-xl bg-flux-primary text-flux-surface hover:bg-flux-accent text-xs font-semibold transition-colors flex items-center space-x-1 shrink-0"
          >
            {serverSavedSuccess ? (
              <>
                <Check className="w-4 h-4 text-flux-success" />
                <span>Tersimpan</span>
              </>
            ) : (
              <span>Simpan</span>
            )}
          </button>
        </form>
      </div>

      {/* Transfer Preferences */}
      <div className="p-5 rounded-3xl bg-flux-surface border border-flux-border shadow-subtle mb-6 space-y-4">
        <h2 className="text-sm font-semibold text-flux-primary mb-2">Preferensi</h2>

        {/* Auto-Accept Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-flux-primary">Auto-accept transfers</div>
            <div className="text-[11px] text-flux-secondary">
              Otomatis menerima file tanpa konfirmasi
            </div>
          </div>
          <button
            onClick={() => updateSettings({ autoAccept: !settings.autoAccept })}
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
              settings.autoAccept ? 'bg-flux-accent' : 'bg-flux-border'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.autoAccept ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Prefer Relay Toggle */}
        <div className="flex items-center justify-between pt-3 border-t border-flux-border">
          <div>
            <div className="text-xs font-semibold text-flux-primary">Mode Server Lokal (HTTP)</div>
            <div className="text-[11px] text-flux-secondary">
              Gunakan upload/download server lokal langsung
            </div>
          </div>
          <button
            onClick={() => updateSettings({ preferRelay: !settings.preferRelay })}
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
              settings.preferRelay ? 'bg-flux-accent' : 'bg-flux-border'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.preferRelay ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Audio Feedback Toggle */}
        <div className="flex items-center justify-between pt-3 border-t border-flux-border">
          <div className="flex items-center space-x-2">
            <Volume2 className="w-4 h-4 text-flux-secondary" />
            <div>
              <div className="text-xs font-semibold text-flux-primary">Sound chimes</div>
              <div className="text-[11px] text-flux-secondary">Auditory feedback on transfer events</div>
            </div>
          </div>
          <button
            onClick={() => updateSettings({ audioFeedback: !settings.audioFeedback })}
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
              settings.audioFeedback ? 'bg-flux-accent' : 'bg-flux-border'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.audioFeedback ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Haptic Feedback Toggle */}
        <div className="flex items-center justify-between pt-3 border-t border-flux-border">
          <div className="flex items-center space-x-2">
            <Vibrate className="w-4 h-4 text-flux-secondary" />
            <div>
              <div className="text-xs font-semibold text-flux-primary">Haptic vibration</div>
              <div className="text-[11px] text-flux-secondary">Tactile pulses on mobile devices</div>
            </div>
          </div>
          <button
            onClick={() => updateSettings({ hapticFeedback: !settings.hapticFeedback })}
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
              settings.hapticFeedback ? 'bg-flux-accent' : 'bg-flux-border'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.hapticFeedback ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Security & Privacy */}
      <div className="p-5 rounded-3xl bg-flux-surface border border-flux-border shadow-subtle mb-6">
        <div className="flex items-center space-x-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-flux-success" />
          <h2 className="text-sm font-semibold text-flux-primary">Security & Privacy</h2>
        </div>
        <div className="space-y-2 text-xs text-flux-secondary leading-relaxed">
          <p>
            • <strong>DTLS-SRTP WebRTC:</strong> Peer-to-peer data streams are encrypted directly between devices.
          </p>
          <p>
            • <strong>Zero Persistent Retention:</strong> Relay transfer chunks are strictly temporary and purged immediately upon download completion.
          </p>
          <p>
            • <strong>No Accounts Required:</strong> Anonymous ephemeral session pairing with short-lived tokens.
          </p>
        </div>
      </div>

      {/* About NoBarier */}
      <div className="p-5 rounded-3xl bg-flux-surface-subtle border border-flux-border text-center">
        <div className="flex items-center justify-center space-x-2 mb-1">
          <img
            src="./pirate_icon.png"
            alt="NoBarier"
            className="w-6 h-6 rounded-lg object-cover"
          />
          <span className="font-bold text-sm text-flux-primary">NoBarier v1.0</span>
        </div>
        <p className="text-xs text-flux-secondary">
          Move files. Simply.
        </p>
      </div>
    </div>
  );
};
