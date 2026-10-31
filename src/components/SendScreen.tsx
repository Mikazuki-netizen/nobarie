import React, { useState, useRef } from 'react';
import { useFlux } from '../context/FluxContext';
import {
  Upload,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Files,
  X,
  Trash2,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { formatBytes, getFileCategory } from '../utils/format';

type CategoryFilter = 'All' | 'Photos' | 'Videos' | 'Documents' | 'Audio' | 'Other';

export const SendScreen: React.FC = () => {
  const { selectedFiles, addFiles, removeFile, clearSelectedFiles, setScreen, setErrorMessage } = useFlux();
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All');
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const filteredFiles = selectedFiles.filter((item) => {
    if (activeCategory === 'All') return true;
    return getFileCategory(item.type, item.name) === activeCategory;
  });

  const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  const handleContinue = () => {
    if (selectedFiles.length === 0) {
      setErrorMessage('Please select at least one file to continue.');
      return;
    }
    setScreen('radar');
  };

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

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6 sm:py-8 flex flex-col min-h-[calc(100vh-5rem)] animate-fade-in">
      {/* Hidden file inputs for direct camera/category picking on iOS & Android */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={photoInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={videoInputRef}
        type="file"
        multiple
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-flux-primary mb-1">
          Choose your files
        </h1>
        <p className="text-xs sm:text-sm text-flux-secondary">
          Select photos, videos, or documents you want to share.
        </p>
      </div>

      {/* Quick Category Pickers */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-6">
        <button
          onClick={() => photoInputRef.current?.click()}
          className="p-3 rounded-2xl bg-flux-surface border border-flux-border hover:border-flux-accent flex flex-col items-center space-y-1.5 transition-all text-center active:scale-95"
        >
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 flex items-center justify-center">
            <ImageIcon className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-flux-primary">Photos</span>
        </button>

        <button
          onClick={() => videoInputRef.current?.click()}
          className="p-3 rounded-2xl bg-flux-surface border border-flux-border hover:border-flux-accent flex flex-col items-center space-y-1.5 transition-all text-center active:scale-95"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 flex items-center justify-center">
            <Video className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-flux-primary">Videos</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-3 rounded-2xl bg-flux-surface border border-flux-border hover:border-flux-accent flex flex-col items-center space-y-1.5 transition-all text-center active:scale-95"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-flux-primary">Docs</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-3 rounded-2xl bg-flux-surface border border-flux-border hover:border-flux-accent flex flex-col items-center space-y-1.5 transition-all text-center active:scale-95 col-span-1"
        >
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 flex items-center justify-center">
            <Music className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-flux-primary">Audio</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-3 rounded-2xl bg-flux-surface border border-flux-border hover:border-flux-accent flex flex-col items-center space-y-1.5 transition-all text-center active:scale-95 col-span-2 sm:col-span-1"
        >
          <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 flex items-center justify-center">
            <Files className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-flux-primary">Browse All</span>
        </button>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full p-8 rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center mb-6 ${
          isDragging
            ? 'border-flux-accent bg-flux-accent-light scale-[1.01]'
            : 'border-flux-border hover:border-flux-accent hover:bg-flux-surface-subtle'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-flux-surface border border-flux-border flex items-center justify-center text-flux-accent mb-3 shadow-sm">
          <Upload className="w-6 h-6 stroke-[2]" />
        </div>
        <p className="text-sm font-semibold text-flux-primary mb-1">
          Drop files here, or tap to browse
        </p>
        <p className="text-xs text-flux-secondary">
          Supports any file format: images, large 4K videos, documents, archives
        </p>
      </div>

      {/* Selected Files Section */}
      {selectedFiles.length > 0 && (
        <div className="flex-1 flex flex-col mb-24">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-flux-primary">
                Selected ({selectedFiles.length})
              </span>
              <span className="text-xs text-flux-secondary">
                • {formatBytes(totalSize)}
              </span>
            </div>
            <button
              onClick={clearSelectedFiles}
              className="text-xs text-flux-error hover:underline flex items-center space-x-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear all</span>
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
            {(['All', 'Photos', 'Videos', 'Documents', 'Audio', 'Other'] as CategoryFilter[]).map(
              (cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    activeCategory === cat
                      ? 'bg-flux-primary text-flux-surface'
                      : 'bg-flux-surface-subtle text-flux-secondary hover:text-flux-primary border border-flux-border'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>

          {/* File Cards List */}
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {filteredFiles.map((item) => {
              const cat = getFileCategory(item.type, item.name);
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-flux-surface border border-flux-border flex items-center justify-between group hover:border-flux-accent/40 transition-colors"
                >
                  <div className="flex items-center space-x-3 truncate">
                    {/* Preview Thumbnail or Category Icon */}
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="w-10 h-10 rounded-xl object-cover border border-flux-border shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-flux-surface-subtle border border-flux-border flex items-center justify-center shrink-0">
                        {renderIconForCategory(cat)}
                      </div>
                    )}
                    <div className="truncate">
                      <div className="text-xs font-semibold text-flux-primary truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-flux-secondary">
                        {formatBytes(item.size)} • {cat}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => removeFile(item.id)}
                    className="p-2 text-flux-secondary hover:text-flux-error rounded-xl hover:bg-flux-surface-subtle transition-colors shrink-0 ml-2"
                    aria-label="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe glass-panel border-t border-flux-border z-30">
        <div className="max-w-xl mx-auto flex items-center justify-between space-x-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3.5 rounded-2xl bg-flux-surface border border-flux-border hover:bg-flux-surface-subtle text-flux-primary font-semibold text-xs flex items-center space-x-1.5 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add more</span>
          </button>

          <button
            onClick={handleContinue}
            disabled={selectedFiles.length === 0}
            className={`flex-1 py-3.5 px-6 rounded-2xl font-semibold text-sm flex items-center justify-center space-x-2 transition-all active:scale-[0.98] ${
              selectedFiles.length > 0
                ? 'bg-flux-primary text-flux-surface hover:bg-flux-accent shadow-subtle'
                : 'bg-flux-surface-subtle text-flux-secondary cursor-not-allowed border border-flux-border'
            }`}
          >
            <span>
              {selectedFiles.length > 0
                ? `Connect Device (${selectedFiles.length} ${
                    selectedFiles.length === 1 ? 'file' : 'files'
                  })`
                : 'Select files to continue'}
            </span>
            <ArrowRight className="w-4 h-4 stroke-[2]" />
          </button>
        </div>
      </div>
    </div>
  );
};
