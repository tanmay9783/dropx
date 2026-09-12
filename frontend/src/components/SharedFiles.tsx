import React, { useRef } from 'react';
import { Upload, Download, Trash2, FileText, Image as ImageIcon, Film, FileArchive, File as FileGeneric, RefreshCw } from 'lucide-react';
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
  onUpload: (files: FileList) => void;
  onDownload?: (fileId: string) => void;
  onDelete: (fileId: string) => void;
}

export const SharedFiles: React.FC<SharedFilesProps> = ({
  roomCode: _roomCode,
  socketToken: _socketToken,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

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

  return (
    <div className="w-full mt-8 pt-8 border-t border-slate-800/80 text-left">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-slate-100 flex items-center space-x-2">
            <span>Shared Files</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-cyan-400 border border-slate-700 font-mono">
              {files.length}
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Files uploaded to this temporary room will automatically expire with the room.
          </p>
        </div>

        {/* Select Files Button */}
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            className="hidden"
            id="file-upload-input"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold text-xs flex items-center space-x-2 shadow-md shadow-cyan-500/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Uploading... {uploadProgress}%</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Select Files</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Upload Progress Bar */}
      {uploading && (
        <div className="mb-6 p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/30">
          <div className="flex items-center justify-between text-xs font-semibold text-cyan-400 mb-2">
            <span>Uploading File to S3...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-300 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
          <span>Loading room files...</span>
        </div>
      ) : files.length === 0 ? (
        /* Empty State */
        <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center">
          <div className="h-12 w-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-300 mb-1">No files shared yet</h4>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Click "Select Files" above to transfer files directly to connected devices.
          </p>
        </div>
      ) : (
        /* Files List */
        <div className="space-y-3">
          {files.map((file) => {
            const isUploader = currentParticipantId && file.participantId === currentParticipantId;
            const isDownloading = downloadingId === file.id;

            return (
              <div
                key={file.id}
                className="glass-panel p-4 rounded-2xl border border-slate-800 hover:border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
              >
                <div className="flex items-center space-x-3.5 min-w-0 w-full sm:w-auto">
                  <div className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">
                    {renderFileIcon(file.mimeType, file.originalName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-slate-100 truncate pr-2" title={file.originalName}>
                      {file.originalName}
                    </h4>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="font-mono text-cyan-400">{formatBytes(file.sizeBytes)}</span>
                      <span>•</span>
                      <span>{isUploader ? 'Uploaded by You' : 'Uploaded by Device'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                  {/* Presigned S3 download button */}
                  <button
                    onClick={() => onDownload && onDownload(file.id)}
                    disabled={isDownloading}
                    className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center space-x-1.5 active:scale-95 disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span>{isDownloading ? 'Preparing...' : 'Download'}</span>
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => onDelete(file.id)}
                    title="Delete file"
                    className="py-2 px-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 border border-rose-800/60 text-xs transition-all active:scale-95"
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
