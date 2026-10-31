import React from 'react';
import { useFlux } from '../context/FluxContext';
import { ArrowUpRight, ArrowDownLeft, ShieldCheck, Smartphone, Laptop, CheckCircle2, ChevronRight, File } from 'lucide-react';
import { formatDate, formatBytes } from '../utils/format';

export const HomeScreen: React.FC = () => {
  const { setScreen, device, createReceiveSession, history, setErrorMessage } = useFlux();

  const handleReceiveClick = async () => {
    try {
      await createReceiveSession();
    } catch {
      setErrorMessage('Failed to initialize receive session. Ensure the server is reachable.');
    }
  };

  const recentTransfers = history.slice(0, 3);

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 sm:py-12 flex flex-col items-center animate-fade-in">
      {/* Hero Section */}
      <div className="text-center mb-10 w-full">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-flux-accent-light text-flux-accent text-xs font-semibold mb-4 border border-flux-accent/15">
          <span>Cross-Platform File Transfer</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-flux-primary mb-3">
          Send anything.<br />
          <span className="text-flux-secondary font-semibold">To any device.</span>
        </h1>
        <p className="text-sm sm:text-base text-flux-secondary max-w-md mx-auto">
          Fast. Simple. Private. Seamless QR code pairing between iOS Safari and Android Chrome with zero app installation.
        </p>
      </div>

      {/* Main Action Buttons Grid */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* Send Card */}
        <button
          onClick={() => setScreen('send')}
          className="group relative p-6 rounded-3xl bg-flux-surface border border-flux-border hover:border-flux-accent hover:shadow-glow transition-all duration-300 text-left flex flex-col justify-between min-h-[160px] active:scale-[0.98]"
        >
          <div className="flex items-center justify-between w-full mb-4">
            <div className="w-12 h-12 rounded-2xl bg-flux-primary text-flux-surface flex items-center justify-center group-hover:bg-flux-accent transition-colors">
              <ArrowUpRight className="w-6 h-6 stroke-[2.5]" />
            </div>
            <span className="text-xs font-medium text-flux-secondary group-hover:text-flux-accent transition-colors">
              Outgoing
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-flux-primary mb-1 group-hover:text-flux-accent transition-colors">
              Send Files
            </h2>
            <p className="text-xs text-flux-secondary">
              Pick photos, videos, or documents to send
            </p>
          </div>
        </button>

        {/* Receive Card */}
        <button
          onClick={handleReceiveClick}
          className="group relative p-6 rounded-3xl bg-flux-surface border border-flux-border hover:border-flux-accent hover:shadow-glow transition-all duration-300 text-left flex flex-col justify-between min-h-[160px] active:scale-[0.98]"
        >
          <div className="flex items-center justify-between w-full mb-4">
            <div className="w-12 h-12 rounded-2xl bg-flux-accent text-white flex items-center justify-center group-hover:scale-105 transition-transform">
              <ArrowDownLeft className="w-6 h-6 stroke-[2.5]" />
            </div>
            <span className="text-xs font-medium text-flux-secondary group-hover:text-flux-accent transition-colors">
              Incoming
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-flux-primary mb-1 group-hover:text-flux-accent transition-colors">
              Receive Files
            </h2>
            <p className="text-xs text-flux-secondary">
              Generate QR code to receive files on this device
            </p>
          </div>
        </button>
      </div>

      {/* Device Info Badge */}
      <div className="w-full p-4 rounded-2xl bg-flux-surface-subtle border border-flux-border mb-8 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-flux-surface border border-flux-border flex items-center justify-center text-flux-primary">
            {device.isMobile ? (
              <Smartphone className="w-5 h-5 text-flux-secondary" />
            ) : (
              <Laptop className="w-5 h-5 text-flux-secondary" />
            )}
          </div>
          <div>
            <div className="text-xs text-flux-secondary">This device</div>
            <div className="text-sm font-semibold text-flux-primary">{device.name}</div>
          </div>
        </div>
        <button
          onClick={() => setScreen('settings')}
          className="text-xs font-medium text-flux-accent hover:underline px-2 py-1"
        >
          Change
        </button>
      </div>

      {/* Recent Transfers Section */}
      <div className="w-full mb-8">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-semibold text-flux-primary">Recent Transfers</h2>
          {history.length > 0 && (
            <button
              onClick={() => setScreen('history')}
              className="text-xs text-flux-accent hover:underline flex items-center"
            >
              View all ({history.length})
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          )}
        </div>

        {recentTransfers.length > 0 ? (
          <div className="space-y-2">
            {recentTransfers.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-flux-surface border border-flux-border flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-3 truncate">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    item.direction === 'sent' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40'
                  }`}>
                    {item.direction === 'sent' ? (
                      <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                    )}
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-flux-primary truncate">
                      {item.files[0]?.name}
                      {item.files.length > 1 && ` +${item.files.length - 1} more`}
                    </div>
                    <div className="text-flux-secondary">
                      {formatBytes(item.totalSize)} • {item.peerName}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="flex items-center justify-end space-x-1 text-flux-success font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Done</span>
                  </div>
                  <div className="text-flux-secondary text-[11px]">{formatDate(item.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-flux-surface border border-dashed border-flux-border text-center">
            <File className="w-8 h-8 text-flux-secondary mx-auto mb-2 stroke-[1.5] opacity-50" />
            <p className="text-xs text-flux-secondary">No transfer history yet</p>
          </div>
        )}
      </div>

      {/* Security Principles Footnote */}
      <div className="w-full flex items-center justify-center space-x-2 text-xs text-flux-secondary text-center pt-2 border-t border-flux-border/60">
        <ShieldCheck className="w-4 h-4 text-flux-success stroke-[2]" />
        <span>End-to-End Encrypted • Direct WebRTC P2P • No Permanent Cloud Storage</span>
      </div>
    </div>
  );
};
