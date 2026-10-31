import React from 'react';
import { useFlux } from '../context/FluxContext';
import { Zap, ShieldCheck, X, Wifi, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { formatBytes, formatSpeed, formatETA } from '../utils/format';

export const TransferProgressScreen: React.FC = () => {
  const { session, transferStats, cancelActiveTransfer } = useFlux();

  const isSender = session.role === 'sender';
  const percent = Math.min(100, Math.max(0, transferStats.percent || 0));

  // Circular progress calculations
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8 flex flex-col items-center animate-fade-in">
      <div className="w-full p-6 sm:p-8 rounded-3xl bg-flux-surface border border-flux-border shadow-elevated flex flex-col items-center">
        {/* Header Badge */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-flux-accent-light text-flux-accent text-xs font-semibold mb-6 border border-flux-accent/15">
          {isSender ? (
            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
          ) : (
            <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
          )}
          <span>{isSender ? 'Sending Files' : 'Receiving Files'}</span>
        </div>

        {/* Circular Progress Ring */}
        <div className="relative w-44 h-44 mb-6 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
            {/* Background Track */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="currentColor"
              strokeWidth="10"
              fill="transparent"
              className="text-flux-surface-subtle"
            />
            {/* Progress Arc */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="currentColor"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="text-flux-accent transition-all duration-300 ease-out"
            />
          </svg>

          {/* Center Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-bold tracking-tight text-flux-primary">
              {percent.toFixed(0)}%
            </span>
            <span className="text-xs font-semibold text-flux-secondary mt-0.5">
              {formatSpeed(transferStats.speed)}
            </span>
          </div>
        </div>

        {/* Current File Information */}
        <div className="text-center w-full mb-6 px-2">
          <div className="text-sm font-semibold text-flux-primary truncate mb-1">
            {transferStats.currentFileName || 'Processing transfer...'}
          </div>
          <div className="text-xs text-flux-secondary">
            {transferStats.totalFiles > 1 && (
              <span>
                File {transferStats.currentFileIndex || 1} of {transferStats.totalFiles} •{' '}
              </span>
            )}
            {formatBytes(transferStats.transferredBytes)} of {formatBytes(transferStats.totalBytes)}
          </div>
        </div>

        {/* Real-time Metrics Card */}
        <div className="grid grid-cols-2 gap-3 w-full mb-6">
          <div className="p-3.5 rounded-2xl bg-flux-surface-subtle border border-flux-border text-center">
            <div className="text-[11px] text-flux-secondary font-medium mb-0.5">Transfer Speed</div>
            <div className="text-sm font-bold text-flux-primary">
              {formatSpeed(transferStats.speed)}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-flux-surface-subtle border border-flux-border text-center">
            <div className="text-[11px] text-flux-secondary font-medium mb-0.5">Time Remaining</div>
            <div className="text-sm font-bold text-flux-primary">
              {formatETA(transferStats.etaSeconds)}
            </div>
          </div>
        </div>

        {/* Connection Mode Pill */}
        <div className="w-full p-3 rounded-2xl bg-flux-surface-subtle border border-flux-border flex items-center justify-between text-xs text-flux-secondary mb-6">
          <div className="flex items-center space-x-2">
            <Wifi className="w-4 h-4 text-flux-accent" />
            <span>Connection Mode</span>
          </div>
          <span className="font-semibold text-flux-primary">
            {transferStats.mode === 'p2p' ? 'Direct P2P (WebRTC)' : 'Secure Relay Fallback'}
          </span>
        </div>

        {/* Cancel Button */}
        <button
          onClick={() => cancelActiveTransfer('Transfer cancelled by user')}
          className="w-full py-3 rounded-2xl bg-flux-surface border border-flux-border hover:bg-flux-error-light hover:text-flux-error hover:border-flux-error text-flux-secondary text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
        >
          <X className="w-4 h-4" />
          <span>Cancel Transfer</span>
        </button>
      </div>
    </div>
  );
};
