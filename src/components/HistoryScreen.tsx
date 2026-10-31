import React, { useState } from 'react';
import { useFlux } from '../context/FluxContext';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  CheckCircle2,
  XCircle,
  File,
  Calendar,
  Wifi,
} from 'lucide-react';
import { formatBytes, formatDate } from '../utils/format';

export const HistoryScreen: React.FC = () => {
  const { history, clearHistory, setScreen } = useFlux();
  const [filter, setFilter] = useState<'All' | 'sent' | 'received'>('All');

  const filteredHistory = history.filter((item) => {
    if (filter === 'All') return true;
    return item.direction === filter;
  });

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

        {history.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all transfer history?')) {
                clearHistory();
              }
            }}
            className="p-2 text-flux-error hover:bg-flux-error-light rounded-xl transition-colors flex items-center space-x-1 text-xs font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear history</span>
          </button>
        )}
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-flux-primary mb-1">
          Recent Transfers
        </h1>
        <p className="text-xs sm:text-sm text-flux-secondary">
          Log of files sent and received on this browser.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex p-1 rounded-2xl bg-flux-surface-subtle border border-flux-border mb-6 w-full max-w-xs">
        {(['All', 'sent', 'received'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
              filter === tab
                ? 'bg-flux-surface text-flux-primary shadow-subtle'
                : 'text-flux-secondary hover:text-flux-primary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* History List */}
      {filteredHistory.length > 0 ? (
        <div className="space-y-3 flex-1 pb-12">
          {filteredHistory.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-3xl bg-flux-surface border border-flux-border shadow-subtle flex flex-col space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 truncate">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      item.direction === 'sent'
                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40'
                    }`}
                  >
                    {item.direction === 'sent' ? (
                      <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                    ) : (
                      <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
                    )}
                  </div>
                  <div className="truncate">
                    <div className="text-sm font-semibold text-flux-primary truncate">
                      {item.files[0]?.name}
                      {item.files.length > 1 && ` +${item.files.length - 1} more`}
                    </div>
                    <div className="text-xs text-flux-secondary">
                      {item.direction === 'sent' ? 'Sent to ' : 'Received from '}
                      <span className="font-medium text-flux-primary">{item.peerName}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-flux-primary">
                    {formatBytes(item.totalSize)}
                  </div>
                  <div className="flex items-center justify-end space-x-1 text-[11px] text-flux-success font-medium mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Completed</span>
                  </div>
                </div>
              </div>

              {/* Detail row */}
              <div className="flex items-center justify-between text-[11px] text-flux-secondary pt-2 border-t border-flux-border">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDate(item.timestamp)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Wifi className="w-3.5 h-3.5" />
                  <span className="capitalize">{item.mode.toUpperCase()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-flux-surface border border-dashed border-flux-border">
          <File className="w-12 h-12 text-flux-secondary opacity-40 mb-3" />
          <h2 className="text-base font-semibold text-flux-primary mb-1">No transfers yet</h2>
          <p className="text-xs text-flux-secondary max-w-xs">
            Files you send or receive will be safely logged here for quick reference.
          </p>
        </div>
      )}
    </div>
  );
};
