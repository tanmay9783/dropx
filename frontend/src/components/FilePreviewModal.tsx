import React, { useEffect, useState } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  RefreshCw, 
  Image as ImageIcon, 
  Film, 
  Music, 
  FileText, 
  File as FileGeneric,
  AlertCircle
} from 'lucide-react';
import { SharedFile, requestDownloadUrl } from '../services/api';
import { decryptBlob } from '../utils/crypto';
import { formatBytes } from '../utils/format';

interface FilePreviewModalProps {
  file: SharedFile;
  roomCode: string;
  socketToken: string;
  roomKey?: string | null;
  onClose: () => void;
  onDownload: (fileId: string) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  roomCode,
  socketToken,
  roomKey,
  onClose,
  onDownload,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const ext = file.originalName.split('.').pop()?.toLowerCase() || '';
  const mime = (file.mimeType || '').toLowerCase();

  const isImage = mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);
  const isVideo = mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv'].includes(ext);
  const isAudio = mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext);
  const isPdf = mime === 'application/pdf' || ext === 'pdf';
  const isText =
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('javascript') ||
    mime.includes('typescript') ||
    mime.includes('xml') ||
    ['txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'sh', 'csv', 'yaml', 'yml'].includes(ext);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    const loadContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const { downloadUrl } = await requestDownloadUrl(roomCode, file.id, socketToken);
        const finalUrl = downloadUrl.startsWith('/') ? `${import.meta.env.VITE_API_URL || ''}${downloadUrl}` : downloadUrl;

        const res = await fetch(finalUrl);
        if (!res.ok) throw new Error(`Failed to fetch file content (${res.status})`);

        let blob = await res.blob();
        if (roomKey) {
          blob = await decryptBlob(blob, roomKey, file.mimeType);
        }

        if (active) {
          if (isText) {
            const text = await blob.text();
            setTextContent(text);
          }
          createdUrl = URL.createObjectURL(blob);
          setObjectUrl(createdUrl);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Unable to preview this file.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadContent();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      active = false;
      window.removeEventListener('keydown', handleKeyDown);
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [file.id, roomCode, socketToken, roomKey, isText, file.mimeType, onClose]);

  const handleCopyText = async () => {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col glass-panel rounded-3xl border border-slate-700/80 shadow-2xl overflow-hidden bg-slate-950/95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 sm:px-6 flex items-center justify-between border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-3 min-w-0 pr-4">
            <div className="h-9 w-9 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 flex items-center justify-center flex-shrink-0">
              {isImage && <ImageIcon className="w-4 h-4" />}
              {isVideo && <Film className="w-4 h-4" />}
              {isAudio && <Music className="w-4 h-4" />}
              {isPdf && <FileText className="w-4 h-4" />}
              {isText && <FileText className="w-4 h-4" />}
              {!isImage && !isVideo && !isAudio && !isPdf && !isText && <FileGeneric className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate" title={file.originalName}>
                {file.originalName}
              </h3>
              <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                <span className="font-mono text-yellow-400 font-semibold">{formatBytes(file.sizeBytes)}</span>
                <span>•</span>
                <span>{file.deviceName || 'Shared File'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {isText && textContent && (
              <button
                onClick={handleCopyText}
                className="py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-yellow-400 border border-yellow-500/30 text-xs font-bold transition-all flex items-center space-x-1.5"
                title="Copy all text"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            )}

            <button
              onClick={() => onDownload(file.id)}
              className="py-1.5 px-3.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              title="Close preview (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Viewport Body */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 flex flex-col items-center justify-center min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center space-y-3 py-16 text-slate-400 text-xs">
              <RefreshCw className="w-8 h-8 animate-spin text-yellow-400" />
              <p>Decrypting & loading preview...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex flex-col items-center space-y-3 max-w-md text-center">
              <AlertCircle className="w-8 h-8 text-rose-500" />
              <p className="font-semibold">{error}</p>
              <button
                onClick={() => onDownload(file.id)}
                className="py-2 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold"
              >
                Download Raw File Instead
              </button>
            </div>
          ) : isImage && objectUrl ? (
            <div className="w-full flex items-center justify-center p-2">
              <img
                src={objectUrl}
                alt={file.originalName}
                className="max-h-[70vh] max-w-full object-contain rounded-2xl shadow-xl border border-slate-800/80"
              />
            </div>
          ) : isVideo && objectUrl ? (
            <div className="w-full flex items-center justify-center">
              <video
                src={objectUrl}
                controls
                autoPlay
                className="max-h-[70vh] max-w-full rounded-2xl border border-slate-800 shadow-2xl bg-black"
              />
            </div>
          ) : isAudio && objectUrl ? (
            <div className="w-full max-w-md p-8 glass-panel rounded-2xl border border-slate-800 text-center flex flex-col items-center space-y-6">
              <div className="h-20 w-20 rounded-3xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400 shadow-lg shadow-yellow-500/10">
                <Music className="w-10 h-10 animate-pulse" />
              </div>
              <div className="w-full">
                <h4 className="text-sm font-bold text-white truncate mb-1">{file.originalName}</h4>
                <p className="text-xs text-slate-400">{formatBytes(file.sizeBytes)}</p>
              </div>
              <audio src={objectUrl} controls className="w-full" autoPlay />
            </div>
          ) : isPdf && objectUrl ? (
            <div className="w-full h-[70vh] rounded-2xl overflow-hidden border border-slate-800 bg-white shadow-xl">
              <iframe src={objectUrl} title={file.originalName} className="w-full h-full" />
            </div>
          ) : isText && textContent !== null ? (
            <div className="w-full h-[65vh] rounded-2xl border border-slate-800 bg-black/90 p-4 overflow-auto font-mono text-xs text-slate-200 shadow-inner select-text">
              <pre className="whitespace-pre-wrap break-all leading-relaxed">{textContent}</pre>
            </div>
          ) : (
            <div className="p-8 text-center flex flex-col items-center space-y-4 max-w-md">
              <div className="h-16 w-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                <FileGeneric className="w-8 h-8 text-yellow-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">No Inline Preview Available</h4>
                <p className="text-xs text-slate-400">
                  This file format ({ext.toUpperCase() || 'Binary'}) can be downloaded and opened with your device's native app.
                </p>
              </div>
              <button
                onClick={() => onDownload(file.id)}
                className="py-2.5 px-6 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold shadow-md transition-all active:scale-95 flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Download File ({formatBytes(file.sizeBytes)})</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
