import React, { useRef, useState, useCallback } from 'react';
import { 
  UploadCloud, 
  Download, 
  Trash2, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  FileArchive, 
  File as FileGeneric, 
  RefreshCw, 
  HardDrive,
  FileCheck2,
  Sparkles
} from 'lucide-react';
import { SharedFile } from '../services/api';
import { formatBytes } from '../utils/format';

interface SharedFilesProps {
  roomCode?: string;
  socketToken?: string;
  currentParticipantId?: string;
  files: SharedFile[];
  loading: boolean;
  uploading: boolean;
  downloadingId?: string | null;
  uploadProgress: number;
  error: string | null;
  onUpload: (files: FileList | File[]) => void;
  onDownload?: (fileId: string) => void;
  onDelete: (fileId: string) => void;
}

export const SharedFiles: React.FC<SharedFilesProps> = ({
  currentParticipantId,
  files,
  loading,
  uploading,
  downloadingId,
  uploadProgress,
  error,
  onUpload,
  onDownload,
  onDelete,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [recentUploadName, setRecentUploadName] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setRecentUploadName(e.target.files[0].name);
      onUpload(e.target.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setRecentUploadName(e.dataTransfer.files[0].name);
      onUpload(e.dataTransfer.files);
    }
  }, [onUpload]);

  const renderFileIcon = (mimeType: string, filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      return <ImageIcon className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />;
    }
    if (mimeType.startsWith('video/') || ['mp4', 'mkv', 'webm', 'mov'].includes(ext)) {
      return <Film className="w-5 h-5 text-violet-500 dark:text-violet-400" />;
    }
    if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
      return <FileArchive className="w-5 h-5 text-amber-500 dark:text-amber-400" />;
    }
    if (mimeType.startsWith('text/') || ['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) {
      return <FileText className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />;
    }
    return <FileGeneric className="w-5 h-5 text-slate-500 dark:text-slate-400" />;
  };

  const totalBytesShared = files.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);

  return (
    <div className="w-full mt-8 pt-8 border-t border-slate-200/80 dark:border-slate-800/80 text-left">
      {/* Header & Stats Strip */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <span>Shared Files</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 dark:border-slate-700 font-mono font-bold">
              {files.length}
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Zero-knowledge direct S3 presigned file transfers with automatic session expiration.
          </p>
        </div>

        {files.length > 0 && (
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <HardDrive className="w-3.5 h-3.5 text-cyan-500" />
            <span>Total: {formatBytes(totalBytesShared)}</span>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        className="hidden"
        id="file-upload-input"
      />

      {/* Modern Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative overflow-hidden rounded-2xl p-6 sm:p-8 border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center group ${
          isDragOver
            ? 'dropzone-active border-cyan-400 bg-cyan-500/10'
            : 'border-slate-300 dark:border-slate-700/80 hover:border-cyan-400/80 dark:hover:border-cyan-500/60 bg-white/40 dark:bg-slate-900/40 hover:bg-cyan-500/5 dark:hover:bg-slate-900/70'
        } ${uploading ? 'pointer-events-none opacity-80' : ''}`}
      >
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-violet-500/20 dark:from-cyan-500/20 dark:to-violet-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 mb-3 group-hover:scale-110 transition-transform shadow-lg shadow-cyan-500/10">
          {uploading ? (
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
          ) : (
            <UploadCloud className="w-7 h-7" />
          )}
        </div>

        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
          {uploading ? 'Uploading to S3 Cloud Storage...' : 'Drop files here or click to browse'}
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-3">
          Photos, videos, PDFs, and documents up to 100MB per file.
        </p>

        <div className="flex items-center space-x-2 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Encrypted Direct-to-S3 Upload</span>
        </div>
      </div>

      {/* Uploading Progress Bar Card */}
      {uploading && (
        <div className="mt-4 p-4 rounded-2xl glass-panel border border-cyan-500/40 shadow-lg shadow-cyan-500/10 animate-fade-in">
          <div className="flex items-center justify-between text-xs font-bold text-cyan-600 dark:text-cyan-400 mb-2">
            <div className="flex items-center space-x-2 truncate">
              <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              <span className="truncate">Uploading {recentUploadName || 'file'}...</span>
            </div>
            <span className="font-mono text-sm ml-2">{uploadProgress}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-300 rounded-full"
              style={{ width: `${Math.max(uploadProgress, 4)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center space-x-2">
          <span>{error}</span>
        </div>
      )}

      {/* Files List Header */}
      <div className="mt-6 mb-3 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Room Files ({files.length})
        </span>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
          <span>Syncing shared files...</span>
        </div>
      ) : files.length === 0 ? (
        /* Empty State */
        <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 text-center">
          <FileCheck2 className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">No files in room yet</h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Drag and drop or select files above to share instantly with connected devices.
          </p>
        </div>
      ) : (
        /* Files List */
        <div className="space-y-2.5">
          {files.map((file) => {
            const isUploader = currentParticipantId && file.participantId === currentParticipantId;
            const isDownloading = downloadingId === file.id;

            return (
              <div
                key={file.id}
                className="glass-panel p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 hover:border-cyan-500/40 dark:hover:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all hover:shadow-md"
              >
                <div className="flex items-center space-x-3.5 min-w-0 w-full sm:w-auto">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center flex-shrink-0 shadow-sm">
                    {renderFileIcon(file.mimeType, file.originalName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate pr-2" title={file.originalName}>
                      {file.originalName}
                    </h4>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">{formatBytes(file.sizeBytes)}</span>
                      <span>•</span>
                      <span>{isUploader ? 'Uploaded by You' : 'Uploaded by Member'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                  {/* Presigned S3 download button */}
                  <button
                    onClick={() => onDownload && onDownload(file.id)}
                    disabled={isDownloading}
                    className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold text-xs shadow-sm transition-all flex items-center space-x-1.5 active:scale-95 disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => onDelete(file.id)}
                    title="Delete file"
                    className="py-2 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs transition-all active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
