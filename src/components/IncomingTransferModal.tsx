import React from 'react';
import { useFlux } from '../context/FluxContext';
import { Smartphone, Laptop, Check, X, ShieldAlert, Image, Video, FileText, Music, Files } from 'lucide-react';
import { formatBytes, getFileCategory } from '../utils/format';

export const IncomingTransferModal: React.FC = () => {
  const { session, incomingFiles, acceptIncomingTransfer, rejectIncomingTransfer } = useFlux();

  const totalSize = incomingFiles.reduce((acc, f) => acc + f.size, 0);

  const renderIconForCategory = (cat: string) => {
    switch (cat) {
      case 'Photos':
        return <Image className="w-5 h-5 text-purple-500" />;
      case 'Videos':
        return <Video className="w-5 h-5 text-blue-500" />;
      case 'Documents':
        return <FileText className="w-5 h-5 text-amber-500" />;
      case 'Audio':
        return <Music className="w-5 h-5 text-rose-500" />;
      default:
        return <Files className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8 flex flex-col items-center animate-fade-in">
      <div className="w-full p-6 sm:p-8 rounded-3xl bg-flux-surface border border-flux-border shadow-elevated">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-flux-accent flex items-center justify-center mx-auto mb-3">
            <Files className="w-6 h-6 stroke-[2]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-flux-primary mb-1">
            Incoming transfer
          </h1>
          <p className="text-xs sm:text-sm text-flux-secondary">
            Review the files before accepting the transfer.
          </p>
        </div>

        {/* Sender Device Card */}
        <div className="p-3.5 rounded-2xl bg-flux-surface-subtle border border-flux-border flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-flux-surface border border-flux-border flex items-center justify-center text-flux-primary shrink-0">
            {session.peerDevice?.isMobile ? (
              <Smartphone className="w-5 h-5 text-flux-accent" />
            ) : (
              <Laptop className="w-5 h-5 text-flux-accent" />
            )}
          </div>
          <div className="truncate">
            <div className="text-[11px] text-flux-secondary font-medium">Sender Device</div>
            <div className="text-xs sm:text-sm font-semibold text-flux-primary truncate">
              {session.peerDevice?.name || 'Remote Device'}
            </div>
          </div>
        </div>

        {/* Files Manifest List */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-semibold text-flux-primary mb-2 px-1">
            <span>Files ({incomingFiles.length})</span>
            <span>{formatBytes(totalSize)}</span>
          </div>

          <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
            {incomingFiles.map((file) => {
              const cat = getFileCategory(file.type, file.name);
              return (
                <div
                  key={file.id}
                  className="p-3 rounded-2xl bg-flux-surface-subtle border border-flux-border flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div className="w-9 h-9 rounded-xl bg-flux-surface border border-flux-border flex items-center justify-center shrink-0">
                      {renderIconForCategory(cat)}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold text-flux-primary truncate">
                        {file.name}
                      </div>
                      <div className="text-[11px] text-flux-secondary">
                        {formatBytes(file.size)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={rejectIncomingTransfer}
            className="py-3.5 px-4 rounded-2xl bg-flux-surface-subtle border border-flux-border hover:bg-flux-error-light hover:text-flux-error hover:border-flux-error text-flux-primary text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all active:scale-95"
          >
            <X className="w-4 h-4" />
            <span>Decline</span>
          </button>

          <button
            onClick={acceptIncomingTransfer}
            className="py-3.5 px-4 rounded-2xl bg-flux-success text-white hover:bg-emerald-600 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all shadow-subtle active:scale-95"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Accept Files</span>
          </button>
        </div>
      </div>
    </div>
  );
};
