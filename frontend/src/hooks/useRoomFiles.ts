import { useEffect, useState, useCallback } from 'react';
import { getFiles, uploadFile, deleteFile, requestDownloadUrl, SharedFile } from '../services/api';
import { encryptBlob, decryptBlob } from '../utils/crypto';
import { formatBytes } from '../utils/format';

interface UseRoomFilesOptions {
  roomCode: string | null;
  socketToken: string | null;
  participantId?: string;
  roomKey?: string | null;
}

export function useRoomFiles({ roomCode, socketToken, roomKey }: UseRoomFilesOptions) {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadSpeedFormatted, setUploadSpeedFormatted] = useState<string>('');
  const [etaFormatted, setEtaFormatted] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Fetch initial files list
  const loadFiles = useCallback(async () => {
    if (!roomCode || !socketToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getFiles(roomCode, socketToken);
      setFiles(res.files || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load room files');
    } finally {
      setLoading(false);
    }
  }, [roomCode, socketToken]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Handle local upload of selected FileList
  const handleUploadFiles = async (fileList: FileList | File[]) => {
    if (!roomCode || !socketToken || fileList.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadSpeedFormatted('');
    setEtaFormatted('');
    setError(null);

    const filesArray = Array.from(fileList);

    try {
      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        let payload: Blob = file;

        // Transparent Zero-Knowledge Encrypt if roomKey present
        if (roomKey) {
          payload = await encryptBlob(file, roomKey);
        }

        const startTime = Date.now();

        const res = await uploadFile(
          roomCode,
          socketToken,
          payload,
          file.name,
          (percent, loadedBytes, totalBytes) => {
            setUploadProgress(percent);

            const elapsedSec = (Date.now() - startTime) / 1000;
            if (elapsedSec > 0.2 && loadedBytes > 0) {
              const bps = loadedBytes / elapsedSec;
              setUploadSpeedFormatted(`${formatBytes(bps)}/s`);
              const remainingBytes = totalBytes - loadedBytes;
              const remainingSec = Math.ceil(remainingBytes / bps);
              setEtaFormatted(remainingSec > 0 ? `${remainingSec}s` : '0s');
            }
          }
        );

        // Optimistically add to files state if not already added by socket
        setFiles((prev) => {
          if (prev.some((f) => f.id === res.file.id)) return prev;
          return [...prev, res.file];
        });
      }
    } catch (err: any) {
      setError(err.message || 'File upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadSpeedFormatted('');
      setEtaFormatted('');
    }
  };

  // Handle local storage file download with decryption support
  const handleDownloadFile = async (fileId: string) => {
    if (!roomCode || !socketToken) return;
    setDownloadingId(fileId);
    setError(null);
    try {
      const { downloadUrl, fileName } = await requestDownloadUrl(roomCode, fileId, socketToken);
      const finalUrl = downloadUrl.startsWith('/') ? `${import.meta.env.VITE_API_URL || ''}${downloadUrl}` : downloadUrl;

      if (roomKey) {
        // Fetch raw ciphertext blob and decrypt locally
        const response = await fetch(finalUrl);
        const encryptedBlob = await response.blob();
        const fileObj = files.find((f) => f.id === fileId);
        const decryptedBlob = await decryptBlob(encryptedBlob, roomKey, fileObj?.mimeType);

        const objectUrl = URL.createObjectURL(decryptedBlob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(objectUrl);
      } else {
        const anchor = document.createElement('a');
        anchor.href = finalUrl;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to download file');
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle local deletion of file
  const handleDeleteFile = async (fileId: string) => {
    if (!roomCode || !socketToken) return;
    try {
      await deleteFile(roomCode, fileId, socketToken);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete file');
    }
  };

  // Real-time socket event handlers for incremental updates
  const addFileFromSocket = useCallback((newFile: SharedFile) => {
    setFiles((prev) => {
      if (prev.some((f) => f.id === newFile.id)) return prev;
      return [...prev, newFile];
    });
  }, []);

  const removeFileFromSocket = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  return {
    files,
    loading,
    uploading,
    downloadingId,
    uploadProgress,
    uploadSpeedFormatted,
    etaFormatted,
    error,
    handleUploadFiles,
    handleDownloadFile,
    handleDeleteFile,
    addFileFromSocket,
    removeFileFromSocket,
  };
}
