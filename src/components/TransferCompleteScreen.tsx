import React, { useState } from 'react';
import { useFlux } from '../context/FluxContext';
import JSZip from 'jszip';
import {
  CheckCircle2,
  Download,
  ShieldCheck,
  RotateCcw,
  Home,
  Archive,
  ExternalLink,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Files,
} from 'lucide-react';
import { formatBytes, getFileCategory } from '../utils/format';

import { openFileOnDevice, downloadFileLocally, isNativeBridgeActive } from '../utils/gallery';

export const TransferCompleteScreen: React.FC = () => {
  const { session, transferredFiles, resetTransferState, setScreen, device } = useFlux();
  const [isZipping, setIsZipping] = useState(false);

  const isReceiver = session.role === 'receiver';
  const totalSize = transferredFiles.reduce((acc, f) => acc + f.size, 0);
  const platform = isNativeBridgeActive();
  const isIos = platform === 'ios' || device.platform === 'iOS';

  const renderIconForCategory = (cat: string) => {
    switch (cat) {
      case 'Photos':
        return <ImageIcon className="w-5 h-5 text-purple-500" />;
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

  const handleOpenFile = async (file: any) => {
    await openFileOnDevice({
      name: file.name,
      localId: file.localId,
      path: file.path,
      type: file.type,
      downloadUrl: file.downloadUrl,
    });
  };

  const handleDownloadAllZip = async () => {
    if (transferredFiles.length === 0) return;
    setIsZipping(true);

    try {
      const zip = new JSZip();

      for (const item of transferredFiles) {
        if (item.blob) {
          zip.file(item.name, item.blob);
        } else if (item.file) {
          zip.file(item.name, item.file);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `flux-transfer-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(zipUrl), 5000);
    } catch (e) {
      console.error('Error creating ZIP archive:', e);
    } finally {
      setIsZipping(false);
    }
  };

  const handleDownloadSingle = (item: any) => {
    downloadFileLocally({
      name: item.name,
      blob: item.blob,
      downloadUrl: item.downloadUrl,
      type: item.type,
    });
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8 flex flex-col items-center animate-fade-in">
      <div className="w-full p-6 sm:p-8 rounded-3xl bg-flux-surface border border-flux-border shadow-elevated flex flex-col items-center">
        {/* Success Icon */}
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-flux-success flex items-center justify-center mb-4 shadow-subtle">
          <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold tracking-tight text-flux-primary mb-1">
          {isReceiver ? 'File Berhasil Diterima!' : 'Transfer Selesai!'}
        </h1>
        <p className="text-xs sm:text-sm text-flux-secondary text-center mb-4">
          {isReceiver
            ? isIos
              ? 'Tersimpan di Aplikasi File (Di iPhone Saya > NoBarier) & Album Foto NoBarier.'
              : 'Tersimpan otomatis di Galeri HP & Memori Internal NoBarier.'
            : 'Semua file berhasil dikirim dan diverifikasi.'}
        </p>

        {/* Summary Pill */}
        <div className="w-full p-3.5 rounded-2xl bg-flux-surface-subtle border border-flux-border flex items-center justify-between text-xs text-flux-secondary mb-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-flux-success" />
            <span className="font-semibold text-flux-primary">SHA-256 Terverifikasi</span>
          </div>
          <span>
            {transferredFiles.length} {transferredFiles.length === 1 ? 'file' : 'files'} •{' '}
            {formatBytes(totalSize)}
          </span>
        </div>

        {/* Transferred Files List */}
        <div className="w-full space-y-2.5 max-h-[260px] overflow-y-auto pr-1 mb-6">
          {transferredFiles.map((file) => {
            const cat = getFileCategory(file.type, file.name);
            return (
              <div
                key={file.id}
                className="p-3 rounded-2xl bg-flux-surface border border-flux-border flex items-center justify-between group hover:border-flux-accent/40 transition-colors"
              >
                <div className="flex items-center space-x-3 truncate">
                  <div className="w-9 h-9 rounded-xl bg-flux-surface-subtle border border-flux-border flex items-center justify-center shrink-0">
                    {renderIconForCategory(cat)}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-semibold text-flux-primary truncate">
                      {file.name}
                    </div>
                    <div className="text-[11px] text-flux-secondary flex items-center space-x-1.5 mt-0.5">
                      <span>{formatBytes(file.size)}</span>
                      {isReceiver && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center">
                            <CheckCircle2 className="w-3 h-3 mr-0.5 inline" />
                            Tersimpan
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Receiver Actions */}
                {isReceiver && (
                  <div className="flex items-center space-x-1 shrink-0 ml-2">
                    <button
                      onClick={() => handleOpenFile(file)}
                      className="p-2 rounded-xl bg-flux-primary text-flux-surface hover:bg-flux-accent transition-colors text-xs font-semibold flex items-center space-x-1 shadow-subtle"
                      title="Buka / Putar File"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Buka</span>
                    </button>
                    <button
                      onClick={() => handleDownloadSingle(file)}
                      className="p-2 rounded-xl bg-flux-surface-subtle border border-flux-border text-flux-secondary hover:text-flux-primary transition-colors text-xs font-semibold"
                      title="Unduh file"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* If multiple files received: Download All ZIP button */}
        {isReceiver && transferredFiles.length > 1 && (
          <button
            onClick={handleDownloadAllZip}
            disabled={isZipping}
            className="w-full py-3.5 px-4 rounded-2xl bg-flux-primary text-flux-surface hover:bg-flux-accent text-xs font-semibold flex items-center justify-center space-x-2 transition-all active:scale-95 mb-3 shadow-subtle"
          >
            <Archive className="w-4 h-4" />
            <span>{isZipping ? 'Membuat ZIP...' : 'Download Semua sebagai ZIP'}</span>
          </button>
        )}

        {/* Navigation Action Buttons */}
        <div className="flex flex-col space-y-2.5 w-full">
          <button
            onClick={resetTransferState}
            className="w-full py-3.5 px-4 rounded-2xl bg-flux-primary text-flux-surface hover:bg-flux-accent text-sm font-bold flex items-center justify-center space-x-2 transition-all active:scale-[0.98] shadow-elevated"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>Selesai (Putuskan Koneksi)</span>
          </button>

          <button
            onClick={() => setScreen('history')}
            className="w-full py-2.5 px-4 rounded-2xl bg-flux-surface-subtle border border-flux-border hover:bg-flux-border text-flux-secondary hover:text-flux-primary text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors active:scale-95"
          >
            <Files className="w-4 h-4 text-flux-accent" />
            <span>Buka Riwayat Transfer</span>
          </button>

          <button
            onClick={() => {
              if (session.role === 'sender') {
                setScreen('send');
              } else {
                setScreen('receive');
              }
            }}
            className="w-full py-2 px-4 rounded-2xl text-flux-secondary hover:text-flux-primary text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Kirim / Terima File Lagi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
