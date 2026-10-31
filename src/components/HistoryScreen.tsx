import React, { useState, useEffect } from 'react';
import { useFlux } from '../context/FluxContext';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  CheckCircle2,
  File,
  Calendar,
  Wifi,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Files,
  AlertTriangle,
  HardDriveDownload,
  Download,
  FolderOpen,
  ExternalLink,
  X,
  RefreshCw,
  FolderCheck,
} from 'lucide-react';
import { formatBytes, formatDate, getFileCategory } from '../utils/format';
import { HistoryRecord, HistoryFileItem } from '../types/flux';
import {
  openFileOnDevice,
  openNoBarierFolder,
  listDeviceFiles,
  downloadFileLocally,
  isNativeBridgeActive,
} from '../utils/gallery';

export const HistoryScreen: React.FC = () => {
  const {
    history,
    clearHistory,
    deleteHistoryRecord,
    deleteFileFromDeviceAndHistory,
    setScreen,
    device,
  } = useFlux();

  const [filter, setFilter] = useState<'All' | 'sent' | 'received'>('All');
  
  // Modals state
  const [deleteDeviceModal, setDeleteDeviceModal] = useState<{
    recordId: string;
    fileIndex: number;
    fileName: string;
    category: string;
  } | null>(null);

  const [deleteRecordModal, setDeleteRecordModal] = useState<HistoryRecord | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [folderExplorerModal, setFolderExplorerModal] = useState(false);
  const [folderFiles, setFolderFiles] = useState<Array<{ name: string; size: number; timestamp?: number; path?: string }>>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const platform = isNativeBridgeActive();
  const isIos = platform === 'ios' || device.platform === 'iOS';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredHistory = history.filter((item) => {
    if (filter === 'All') return true;
    return item.direction === filter;
  });

  const sentCount = history.filter((h) => h.direction === 'sent').length;
  const receivedCount = history.filter((h) => h.direction === 'received').length;

  const renderIconForCategory = (cat: string) => {
    switch (cat) {
      case 'Photos':
        return <ImageIcon className="w-4 h-4 text-purple-500" />;
      case 'Videos':
        return <Video className="w-4 h-4 text-blue-500" />;
      case 'Documents':
        return <FileText className="w-4 h-4 text-amber-500" />;
      case 'Audio':
        return <Music className="w-4 h-4 text-rose-500" />;
      default:
        return <Files className="w-4 h-4 text-gray-500" />;
    }
  };

  // Open file with native viewer / QuickLook
  const handleOpenFile = async (file: HistoryFileItem) => {
    showToast(`Membuka "${file.name}"...`);
    const res = await openFileOnDevice({
      name: file.name,
      localId: file.localId,
      path: file.path,
      type: file.type,
      downloadUrl: file.downloadUrl,
    });
    if (!res.success && res.error) {
      showToast(res.error);
    }
  };

  // Download / Save file locally
  const handleDownloadFile = (file: HistoryFileItem) => {
    downloadFileLocally({
      name: file.name,
      downloadUrl: file.downloadUrl,
      type: file.type,
    });
    showToast(`Mengunduh "${file.name}"...`);
  };

  // Load physical folder files
  const refreshFolderFiles = async () => {
    setLoadingFiles(true);
    try {
      const files = await listDeviceFiles();
      setFolderFiles(files);
    } catch {
      setFolderFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (folderExplorerModal) {
      refreshFolderFiles();
    }
  }, [folderExplorerModal]);

  const handleConfirmDeleteFromDevice = async () => {
    if (!deleteDeviceModal) return;
    setIsDeleting(true);
    try {
      await deleteFileFromDeviceAndHistory(deleteDeviceModal.recordId, deleteDeviceModal.fileIndex);
      showToast(`"${deleteDeviceModal.fileName}" berhasil dihapus dari HP.`);
    } catch (err: any) {
      showToast('Gagal menghapus file dari HP.');
    } finally {
      setIsDeleting(false);
      setDeleteDeviceModal(null);
    }
  };

  const handleConfirmDeleteRecord = async (deleteFilesFromStorage: boolean) => {
    if (!deleteRecordModal) return;
    setIsDeleting(true);
    try {
      if (deleteFilesFromStorage && deleteRecordModal.direction === 'received') {
        await deleteFileFromDeviceAndHistory(deleteRecordModal.id);
      }
      deleteHistoryRecord(deleteRecordModal.id);
      showToast('Riwayat berhasil dihapus.');
    } catch {
      showToast('Gagal menghapus riwayat.');
    } finally {
      setIsDeleting(false);
      setDeleteRecordModal(null);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6 sm:py-8 flex flex-col min-h-[calc(100vh-5rem)] animate-fade-in relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-flux-primary text-flux-surface px-4 py-2.5 rounded-2xl shadow-elevated text-xs font-semibold flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setScreen('home')}
          className="p-2 rounded-xl text-flux-secondary hover:text-flux-primary hover:bg-flux-surface-subtle transition-colors flex items-center space-x-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-semibold">Home</span>
        </button>

        <div className="flex items-center space-x-2">
          {/* Explore Folder Button */}
          <button
            onClick={() => setFolderExplorerModal(true)}
            className="p-2 bg-flux-surface-subtle border border-flux-border hover:bg-flux-border text-flux-primary rounded-xl transition-colors flex items-center space-x-1.5 text-xs font-semibold shadow-subtle"
            title="Jelajah Folder NoBarier"
          >
            <FolderOpen className="w-3.5 h-3.5 text-flux-accent" />
            <span>Jelajah Folder</span>
          </button>

          {history.length > 0 && (
            <button
              onClick={() => setClearAllConfirm(true)}
              className="p-2 text-flux-error hover:bg-flux-error-light rounded-xl transition-colors flex items-center space-x-1.5 text-xs font-semibold"
              title="Hapus semua riwayat"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hapus Semua</span>
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-flux-primary mb-1">
          Riwayat Transfer
        </h1>
        <p className="text-xs sm:text-sm text-flux-secondary">
          Daftar file yang dikirim dan diterima. File tersimpan langsung di galeri dan folder NoBarier.
        </p>
      </div>

      {/* iOS Folder Guide Banner */}
      {isIos && (
        <div className="mb-4 p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 flex items-start space-x-2.5 text-xs text-indigo-900 dark:text-indigo-200">
          <FolderCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-bold">Lokasi File di iPhone:</span> Tersimpan di aplikasi{' '}
            <span className="font-semibold underline">File (Files)</span> &gt;{' '}
            <span className="font-semibold">Di iPhone Saya</span> &gt;{' '}
            <span className="font-semibold text-flux-accent">NoBarier</span>, serta Album{' '}
            <span className="font-semibold text-flux-accent">"NoBarier"</span> di aplikasi Foto.
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex p-1 rounded-2xl bg-flux-surface-subtle border border-flux-border mb-6 w-full max-w-xs">
        <button
          onClick={() => setFilter('All')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 ${
            filter === 'All'
              ? 'bg-flux-surface text-flux-primary shadow-subtle'
              : 'text-flux-secondary hover:text-flux-primary'
          }`}
        >
          <span>Semua</span>
          <span className="text-[10px] opacity-75">({history.length})</span>
        </button>
        <button
          onClick={() => setFilter('received')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 ${
            filter === 'received'
              ? 'bg-flux-surface text-flux-primary shadow-subtle'
              : 'text-flux-secondary hover:text-flux-primary'
          }`}
        >
          <span>Diterima</span>
          <span className="text-[10px] opacity-75">({receivedCount})</span>
        </button>
        <button
          onClick={() => setFilter('sent')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 ${
            filter === 'sent'
              ? 'bg-flux-surface text-flux-primary shadow-subtle'
              : 'text-flux-secondary hover:text-flux-primary'
          }`}
        >
          <span>Terkirim</span>
          <span className="text-[10px] opacity-75">({sentCount})</span>
        </button>
      </div>

      {/* History List */}
      {filteredHistory.length > 0 ? (
        <div className="space-y-4 flex-1 pb-16">
          {filteredHistory.map((item) => {
            const isReceived = item.direction === 'received';
            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 rounded-3xl bg-flux-surface border border-flux-border shadow-subtle flex flex-col space-y-3.5 transition-all hover:border-flux-border-hover"
              >
                {/* Header row */}
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
                      <div className="text-xs sm:text-sm font-semibold text-flux-primary">
                        {item.direction === 'sent' ? 'Terkirim ke ' : 'Diterima dari '}
                        <span className="font-bold text-flux-accent">{item.peerName}</span>
                      </div>
                      <div className="text-[11px] text-flux-secondary flex items-center space-x-2 mt-0.5">
                        <span>{formatDate(item.timestamp)}</span>
                        <span>•</span>
                        <span className="uppercase text-[10px] font-semibold">{item.mode}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-bold text-flux-primary">
                        {formatBytes(item.totalSize)}
                      </div>
                      <div className="flex items-center justify-end space-x-1 text-[11px] text-flux-success font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Selesai</span>
                      </div>
                    </div>

                    {/* Delete Record Button */}
                    <button
                      onClick={() => setDeleteRecordModal(item)}
                      className="p-2 rounded-xl text-flux-secondary hover:text-flux-error hover:bg-flux-error-light transition-colors ml-1"
                      title="Hapus Riwayat ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Files breakdown in this transfer */}
                <div className="space-y-2 pt-2 border-t border-flux-border">
                  {item.files.map((file, fileIdx) => {
                    const cat = getFileCategory(file.type, file.name);
                    const isVideo = cat === 'Videos';
                    const isDeleted = !!file.deletedFromDevice;

                    return (
                      <div
                        key={fileIdx}
                        className="p-3 rounded-2xl bg-flux-surface-subtle/80 border border-flux-border/60 flex flex-col sm:flex-row sm:items-center justify-between text-xs space-y-2 sm:space-y-0"
                      >
                        <div className="flex items-center space-x-2.5 truncate mr-2">
                          <div className="w-8 h-8 rounded-xl bg-flux-surface border border-flux-border flex items-center justify-center shrink-0">
                            {renderIconForCategory(cat)}
                          </div>
                          <div className="truncate">
                            <div className="font-medium text-flux-primary truncate">
                              {file.name}
                            </div>
                            <div className="text-[10px] text-flux-secondary flex items-center space-x-1.5 mt-0.5">
                              <span>{formatBytes(file.size)}</span>
                              {isReceived && (
                                <>
                                  <span>•</span>
                                  {isDeleted ? (
                                    <span className="text-flux-error font-medium">
                                      Sudah dihapus dari HP
                                    </span>
                                  ) : (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-0.5">
                                      <HardDriveDownload className="w-2.5 h-2.5 mr-0.5 inline" />
                                      Tersimpan di Galeri & Folder
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons for this file */}
                        <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                          {/* 1. Open / Browse / QuickLook */}
                          {!isDeleted && (
                            <button
                              onClick={() => handleOpenFile(file)}
                              className="px-2.5 py-1.5 rounded-xl bg-flux-surface border border-flux-border hover:bg-flux-accent hover:text-white text-flux-primary text-[11px] font-semibold flex items-center space-x-1 transition-all shadow-subtle"
                              title="Buka / Jelajah / Putar File"
                            >
                              <ExternalLink className="w-3 h-3 text-flux-accent hover:text-white" />
                              <span>Buka</span>
                            </button>
                          )}

                          {/* 2. Download / Re-save */}
                          <button
                            onClick={() => handleDownloadFile(file)}
                            className="px-2.5 py-1.5 rounded-xl bg-flux-surface border border-flux-border hover:bg-flux-accent hover:text-white text-flux-secondary hover:text-white text-[11px] font-semibold flex items-center space-x-1 transition-all shadow-subtle"
                            title="Unduh / Simpan Ulang"
                          >
                            <Download className="w-3 h-3" />
                            <span>Unduh</span>
                          </button>

                          {/* 3. Delete from Phone */}
                          {isReceived && !isDeleted && (
                            <button
                              onClick={() =>
                                setDeleteDeviceModal({
                                  recordId: item.id,
                                  fileIndex: fileIdx,
                                  fileName: file.name,
                                  category: cat,
                                })
                              }
                              className="px-2 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 hover:text-red-700 text-[11px] font-semibold flex items-center space-x-1 transition-colors"
                              title={isVideo ? 'Hapus Video dari HP' : 'Hapus File dari HP'}
                            >
                              <Trash2 className="w-3 h-3" />
                              <span className="hidden sm:inline">
                                {isVideo ? 'Hapus Video' : 'Hapus'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-flux-surface border border-dashed border-flux-border">
          <File className="w-12 h-12 text-flux-secondary opacity-40 mb-3" />
          <h2 className="text-base font-semibold text-flux-primary mb-1">
            Belum ada riwayat transfer
          </h2>
          <p className="text-xs text-flux-secondary max-w-xs">
            File yang Anda kirim atau terima akan tercatat di sini dan tersimpan langsung di galeri dan folder NoBarier.
          </p>
        </div>
      )}

      {/* --- MODAL: JELAJAH FOLDER NOBARIER --- */}
      {folderExplorerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-flux-surface border border-flux-border p-6 shadow-elevated flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-flux-border mb-4">
              <div className="flex items-center space-x-2">
                <FolderOpen className="w-5 h-5 text-flux-accent" />
                <h3 className="text-base font-bold text-flux-primary">
                  Folder NoBarier
                </h3>
              </div>
              <button
                onClick={() => setFolderExplorerModal(false)}
                className="p-1.5 rounded-xl text-flux-secondary hover:text-flux-primary hover:bg-flux-surface-subtle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Folder Location Description */}
            <div className="mb-4 p-3 rounded-2xl bg-flux-surface-subtle border border-flux-border text-xs text-flux-secondary">
              <div className="font-semibold text-flux-primary mb-1">
                {isIos ? '📱 Lokasi di iPhone:' : '🤖 Lokasi di Android:'}
              </div>
              <div className="font-mono text-[11px] text-flux-accent break-all">
                {isIos
                  ? 'File (Files app) > Di iPhone Saya > NoBarier'
                  : 'Memori Internal > Download / Movies / Pictures > NoBarier'}
              </div>
              <p className="text-[10px] text-flux-secondary mt-1">
                Semua file yang diterima disimpan secara offline di folder custom ini dan dapat diakses kapan saja.
              </p>
            </div>

            {/* Native Open Folder Action */}
            <button
              onClick={() => {
                openNoBarierFolder();
                showToast('Membuka folder penyimpanan...');
              }}
              className="w-full py-2.5 px-4 rounded-2xl bg-flux-primary text-flux-surface hover:bg-flux-accent text-xs font-bold transition-all shadow-subtle mb-3 flex items-center justify-center space-x-1.5"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Buka di Aplikasi File / Berkas HP</span>
            </button>

            {/* Files List in Directory */}
            <div className="flex items-center justify-between text-xs text-flux-secondary mb-2">
              <span className="font-semibold text-flux-primary">
                File di Folder ({folderFiles.length})
              </span>
              <button
                onClick={refreshFolderFiles}
                className="p-1 rounded-lg hover:bg-flux-surface-subtle text-flux-accent flex items-center space-x-1 text-[11px]"
              >
                <RefreshCw className={`w-3 h-3 ${loadingFiles ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[240px] pr-1 mb-4 flex-1">
              {loadingFiles ? (
                <div className="py-8 text-center text-xs text-flux-secondary">
                  Memuat berkas folder...
                </div>
              ) : folderFiles.length > 0 ? (
                folderFiles.map((file, idx) => {
                  const cat = getFileCategory('', file.name);
                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-2xl bg-flux-surface-subtle border border-flux-border flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2 truncate mr-2">
                        <div className="w-7 h-7 rounded-lg bg-flux-surface border border-flux-border flex items-center justify-center shrink-0">
                          {renderIconForCategory(cat)}
                        </div>
                        <div className="truncate">
                          <div className="font-medium text-flux-primary truncate">
                            {file.name}
                          </div>
                          <div className="text-[10px] text-flux-secondary">
                            {formatBytes(file.size)}
                            {file.timestamp ? ` • ${formatDate(file.timestamp)}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => handleOpenFile(file as any)}
                          className="px-2.5 py-1.5 rounded-xl bg-flux-primary text-flux-surface hover:bg-flux-accent text-[11px] font-semibold flex items-center space-x-1 transition-all"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Buka</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-center text-xs text-flux-secondary border border-dashed border-flux-border rounded-2xl">
                  Belum ada file di folder NoBarier.
                </div>
              )}
            </div>

            <button
              onClick={() => setFolderExplorerModal(false)}
              className="w-full py-2.5 rounded-2xl bg-flux-surface-subtle hover:bg-flux-border text-flux-secondary hover:text-flux-primary text-xs font-semibold transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL: HAPUS FILE / VIDEO DARI HP --- */}
      {deleteDeviceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-flux-surface border border-flux-border p-6 shadow-elevated flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/60 text-flux-error flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
            </div>

            <h3 className="text-base font-bold text-flux-primary mb-1">
              {deleteDeviceModal.category === 'Videos' ? 'Hapus Video dari HP?' : 'Hapus File dari HP?'}
            </h3>
            <p className="text-xs text-flux-secondary mb-4 leading-relaxed">
              File <span className="font-semibold text-flux-primary">"{deleteDeviceModal.fileName}"</span> akan dihapus secara permanen dari galeri dan memori perangkat HP Anda.
            </p>

            <div className="flex flex-col space-y-2 w-full">
              <button
                onClick={handleConfirmDeleteFromDevice}
                disabled={isDeleting}
                className="w-full py-3 rounded-2xl bg-flux-error hover:bg-flux-error/90 text-white text-xs font-bold transition-all shadow-subtle flex items-center justify-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus dari HP'}</span>
              </button>
              <button
                onClick={() => setDeleteDeviceModal(null)}
                disabled={isDeleting}
                className="w-full py-2.5 rounded-2xl bg-flux-surface-subtle hover:bg-flux-border text-flux-secondary hover:text-flux-primary text-xs font-semibold transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: HAPUS RIWAYAT TRANSFER --- */}
      {deleteRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-flux-surface border border-flux-border p-6 shadow-elevated flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 stroke-[2.5]" />
            </div>

            <h3 className="text-base font-bold text-flux-primary mb-1">
              Hapus Riwayat Transfer?
            </h3>
            <p className="text-xs text-flux-secondary mb-5 leading-relaxed">
              Pilih tindakan untuk riwayat transfer ini:
            </p>

            <div className="flex flex-col space-y-2 w-full">
              {deleteRecordModal.direction === 'received' && (
                <button
                  onClick={() => handleConfirmDeleteRecord(true)}
                  disabled={isDeleting}
                  className="w-full py-3 rounded-2xl bg-flux-error hover:bg-flux-error/90 text-white text-xs font-bold transition-all shadow-subtle flex items-center justify-center space-x-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Hapus Riwayat & File dari HP</span>
                </button>
              )}

              <button
                onClick={() => handleConfirmDeleteRecord(false)}
                disabled={isDeleting}
                className="w-full py-2.5 rounded-2xl bg-flux-primary text-flux-surface hover:bg-flux-accent text-xs font-bold transition-all shadow-subtle"
              >
                <span>Hapus Riwayat Saja</span>
              </button>

              <button
                onClick={() => setDeleteRecordModal(null)}
                disabled={isDeleting}
                className="w-full py-2 rounded-2xl bg-flux-surface-subtle hover:bg-flux-border text-flux-secondary hover:text-flux-primary text-xs font-semibold transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: CLEAR ALL CONFIRM --- */}
      {clearAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-flux-surface border border-flux-border p-6 shadow-elevated flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/60 text-flux-error flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
            </div>

            <h3 className="text-base font-bold text-flux-primary mb-1">
              Hapus Semua Riwayat?
            </h3>
            <p className="text-xs text-flux-secondary mb-5 leading-relaxed">
              Semua log riwayat pengiriman dan penerimaan akan dihapus dari aplikasi. File yang sudah tersimpan di galeri HP tidak akan terhapus.
            </p>

            <div className="flex flex-col space-y-2 w-full">
              <button
                onClick={() => {
                  clearHistory();
                  setClearAllConfirm(false);
                  showToast('Semua riwayat transfer telah dibersihkan.');
                }}
                className="w-full py-3 rounded-2xl bg-flux-error hover:bg-flux-error/90 text-white text-xs font-bold transition-all shadow-subtle"
              >
                Hapus Semua Riwayat
              </button>

              <button
                onClick={() => setClearAllConfirm(false)}
                className="w-full py-2.5 rounded-2xl bg-flux-surface-subtle hover:bg-flux-border text-flux-secondary hover:text-flux-primary text-xs font-semibold transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
