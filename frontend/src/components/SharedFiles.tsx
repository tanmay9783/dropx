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
  Sparkles,
  Zap,
  Clock,
  Eye,
  Archive,
  Folder,
  Wifi
} from 'lucide-react';
import { SharedFile } from '../services/api';
import { formatBytes } from '../utils/format';
import { TextSnippets } from './TextSnippets';
import { FilePreviewModal } from './FilePreviewModal';
import { traverseDataTransferItems } from '../utils/fileTraverse';
import { UploadItem } from '../hooks/useRoomFiles';

interface SharedFilesProps {
  roomCode?: string;
  socketToken?: string;
  roomKey?: string | null;
  currentParticipantId?: string;
  files: SharedFile[];
  loading: boolean;
  uploading: boolean;
  downloadingId?: string | null;
  uploadProgress: number;
  uploadSpeedFormatted?: string;
  etaFormatted?: string;
  zipping?: boolean;
  zipProgress?: string;
  p2pStatus?: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';
  error: string | null;
  onUpload: (files: FileList | File[] | UploadItem[]) => void;
  onDownload?: (fileId: string) => void;
  onDelete: (fileId: string) => void;
  onDownloadAllZip?: () => void;
  newSnippet?: any;
  deletedSnippetId?: string | null;
}

export const SharedFiles: React.FC<SharedFilesProps> = ({
  roomCode,
  socketToken,
  roomKey,
  currentParticipantId,
  files,
  loading,
  uploading,
  downloadingId,
  uploadProgress,
  uploadSpeedFormatted,
  etaFormatted,
  zipping = false,
  zipProgress = '',
  p2pStatus = 'DISCONNECTED',
  error,
  onUpload,
  onDownload,
  onDelete,
  onDownloadAllZip,
  newSnippet,
  deletedSnippetId,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [recentUploadName, setRecentUploadName] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [previewingFile, setPreviewingFile] = useState<SharedFile | null>(null);

  const handleClosePreview = useCallback(() => {
    setPreviewingFile(null);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const items: UploadItem[] = Array.from(e.target.files).map((f) => ({
        file: f,
        relativePath: (f as any).webkitRelativePath || f.name,
      }));
      processFiles(items);
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }
    }
  };

  const processFiles = (fileList: FileList | File[] | UploadItem[]) => {
    const filesArray = Array.from(fileList as any[]);
    const firstItem = filesArray[0];
    const name = firstItem?.relativePath || firstItem?.name || firstItem?.file?.name || 'files';
    setRecentUploadName(name);

    // Create local object URL previews for images
    const imageFiles = filesArray
      .map((item) => (item instanceof File ? item : item.file || item))
      .filter((f) => f && f.type && f.type.startsWith('image/'));

    const urls = imageFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);

    onUpload(fileList);
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

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        // Recursively traverse folders and files
        const traversed = await traverseDataTransferItems(e.dataTransfer.items);
        if (traversed.length > 0) {
          processFiles(traversed);
          return;
        }
      }

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [onUpload]
  );

  const renderFileIcon = (mimeType: string, filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      return <ImageIcon className="w-5 h-5 text-cyan-400" />;
    }
    if (mimeType.startsWith('video/') || ['mp4', 'mkv', 'webm', 'mov'].includes(ext)) {
      return <Film className="w-5 h-5 text-violet-400" />;
    }
    if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
      return <FileArchive className="w-5 h-5 text-amber-400" />;
    }
    if (mimeType.startsWith('text/') || ['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) {
      return <FileText className="w-5 h-5 text-emerald-400" />;
    }
    return <FileGeneric className="w-5 h-5 text-slate-400" />;
  };

  const totalBytesShared = files.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);

  return (
    <div className="w-full mt-8 pt-8 border-t border-slate-800/80 text-left">
      {/* Header & Stats Strip */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-extrabold text-white flex items-center space-x-2">
              <span>Shared Files</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 font-mono font-bold">
                {files.length}
              </span>
            </h3>

            {p2pStatus === 'CONNECTED' && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold tracking-wide animate-pulse">
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span>P2P Direct LAN</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Fast, zero-knowledge local file & folder sync.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {files.length > 0 && (
            <div className="flex items-center space-x-1.5 text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
              <HardDrive className="w-3.5 h-3.5 text-yellow-400" />
              <span>{formatBytes(totalBytesShared)}</span>
            </div>
          )}

          {/* Download All as ZIP Button */}
          {files.length > 0 && onDownloadAllZip && (
            <button
              onClick={onDownloadAllZip}
              disabled={zipping}
              className="py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-yellow-400 border border-yellow-500/40 text-xs font-bold transition-all flex items-center space-x-1.5 shadow-sm active:scale-95 disabled:opacity-50"
              title="Download all files bundled into a single ZIP archive"
            >
              {zipping ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-yellow-400" />
              ) : (
                <Archive className="w-3.5 h-3.5 text-yellow-400" />
              )}
              <span>{zipping ? 'Zipping...' : 'Download All (.ZIP)'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ZIP Compression Progress Banner */}
      {zipping && (
        <div className="mb-4 p-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs flex items-center space-x-2.5 animate-fade-in">
          <RefreshCw className="w-4 h-4 animate-spin text-yellow-400 flex-shrink-0" />
          <span className="font-semibold">{zipProgress || 'Packaging ZIP archive...'}</span>
        </div>
      )}

      {/* Hidden File & Folder Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        className="hidden"
        id="file-upload-input"
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderChange}
        multiple
        {...({ webkitdirectory: '', directory: '' } as any)}
        className="hidden"
        id="folder-upload-input"
      />

      {/* Modern Drag & Drop Upload Zone (supports files AND folders) */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative overflow-hidden rounded-2xl p-6 sm:p-8 border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center group ${
          isDragOver
            ? 'dropzone-active border-yellow-400 bg-yellow-500/10'
            : 'border-slate-800 hover:border-yellow-500/60 bg-slate-950/60 hover:bg-slate-900/80'
        } ${uploading ? 'pointer-events-none opacity-80' : ''}`}
      >
        <div className="h-14 w-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400 mb-3 group-hover:scale-110 transition-transform shadow-lg shadow-yellow-500/10">
          {uploading ? (
            <RefreshCw className="w-6 h-6 animate-spin text-yellow-400" />
          ) : (
            <UploadCloud className="w-7 h-7" />
          )}
        </div>

        <h4 className="text-sm font-bold text-white mb-1">
          {uploading ? 'Streaming File Data...' : 'Drop files or folders here'}
        </h4>
        <p className="text-xs text-slate-400 max-w-sm mb-3">
          Drag & drop any file or folder hierarchy up to 100MB.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              folderInputRef.current?.click();
            }}
            className="py-1 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-yellow-400 border border-yellow-500/30 text-[11px] font-bold flex items-center space-x-1.5 transition-all"
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Upload Entire Folder</span>
          </button>

          <span className="text-[11px] font-semibold text-slate-500">•</span>

          <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-yellow-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Resumable Chunks & E2EE</span>
          </div>
        </div>

        {/* Thumbnail Previews during upload selection */}
        {previewUrls.length > 0 && !uploading && (
          <div className="flex items-center space-x-2 mt-4">
            {previewUrls.slice(0, 4).map((url, i) => (
              <img
                key={i}
                src={url}
                alt="preview"
                className="w-10 h-10 object-cover rounded-lg border border-yellow-500/30 shadow-xs"
              />
            ))}
          </div>
        )}
      </div>

      {/* Uploading Speedometer & Progress Bar Card */}
      {uploading && (
        <div className="mt-4 p-4 rounded-2xl glass-panel border border-yellow-500/40 shadow-lg shadow-yellow-500/10 animate-fade-in">
          <div className="flex items-center justify-between text-xs font-bold text-yellow-400 mb-2">
            <div className="flex items-center space-x-2 truncate">
              <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              <span className="truncate">Uploading {recentUploadName || 'file'}...</span>
            </div>

            <div className="flex items-center space-x-3 text-xs font-mono">
              {uploadSpeedFormatted && (
                <span className="flex items-center space-x-1 text-emerald-400">
                  <Zap className="w-3 h-3" />
                  <span>{uploadSpeedFormatted}</span>
                </span>
              )}
              {etaFormatted && (
                <span className="flex items-center space-x-1 text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>ETA: {etaFormatted}</span>
                </span>
              )}
              <span className="font-mono text-sm font-black">{uploadProgress}%</span>
            </div>
          </div>

          <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all duration-300 rounded-full"
              style={{ width: `${Math.max(uploadProgress, 4)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
          <span>{error}</span>
        </div>
      )}

      {/* Live Text Snippets & Clipboard Sync Component */}
      {roomCode && socketToken && (
        <TextSnippets
          roomCode={roomCode}
          socketToken={socketToken}
          roomKey={roomKey}
          newSnippet={newSnippet}
          deletedSnippetId={deletedSnippetId}
        />
      )}

      {/* Files List Header */}
      <div className="mt-6 mb-3 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Room Files ({files.length})
        </span>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin text-yellow-400" />
          <span>Syncing shared files...</span>
        </div>
      ) : files.length === 0 ? (
        /* Empty State */
        <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
          <FileCheck2 className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-60" />
          <h4 className="text-xs font-bold text-slate-300 mb-1">No files in room yet</h4>
          <p className="text-[11px] text-slate-400">
            Drag and drop or select files and folders above to share instantly with connected devices.
          </p>
        </div>
      ) : (
        /* Files List */
        <div className="space-y-2.5">
          {files.map((file) => {
            const isUploader = currentParticipantId && file.participantId === currentParticipantId;
            const isDownloading = downloadingId === file.id;
            const hasSubfolder = file.originalName.includes('/');
            const displayTitle = hasSubfolder ? file.originalName.split('/').pop() : file.originalName;
            const folderPath = hasSubfolder ? file.originalName.substring(0, file.originalName.lastIndexOf('/')) : null;

            return (
              <div
                key={file.id}
                className="glass-panel p-3.5 rounded-2xl border border-slate-800 hover:border-yellow-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all"
              >
                <div className="flex items-center space-x-3.5 min-w-0 w-full sm:w-auto">
                  <div className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0 shadow-sm">
                    {renderFileIcon(file.mimeType, file.originalName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate" title={file.originalName}>
                        {displayTitle}
                      </h4>
                      {folderPath && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800 truncate max-w-[120px]" title={folderPath}>
                          📁 {folderPath}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="font-mono font-semibold text-yellow-400">{formatBytes(file.sizeBytes)}</span>
                      <span>•</span>
                      <span className="truncate max-w-[120px] sm:max-w-xs">
                        {isUploader ? 'Uploaded by You' : `Uploaded by ${file.deviceName || 'Member'}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                  {/* In-Browser Preview Button */}
                  <button
                    onClick={() => setPreviewingFile(file)}
                    className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-yellow-400 border border-slate-800 hover:border-yellow-500/30 text-xs font-bold transition-all flex items-center space-x-1.5 active:scale-95"
                    title="Preview file in browser"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  {/* Direct download button */}
                  <button
                    onClick={() => onDownload && onDownload(file.id)}
                    disabled={isDownloading}
                    className="py-2 px-3.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs shadow-sm transition-all flex items-center space-x-1.5 active:scale-95 disabled:opacity-50"
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

      {/* In-Browser File Preview Modal */}
      {previewingFile && roomCode && socketToken && (
        <FilePreviewModal
          file={previewingFile}
          roomCode={roomCode}
          socketToken={socketToken}
          roomKey={roomKey}
          onClose={handleClosePreview}
          onDownload={(id) => {
            if (onDownload) onDownload(id);
          }}
        />
      )}
    </div>
  );
};
