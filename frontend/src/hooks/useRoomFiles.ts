import { useEffect, useState, useCallback } from 'react';
import { getFiles, uploadFile, deleteFile, requestDownloadUrl, SharedFile } from '../services/api';

interface UseRoomFilesOptions {
  roomCode: string | null;
  socketToken: string | null;
  participantId?: string;
}

export function useRoomFiles({ roomCode, socketToken }: UseRoomFilesOptions) {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
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
    setError(null);

    const filesArray = Array.from(fileList);

    try {
      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        const res = await uploadFile(roomCode, socketToken, file, (percent) => {
          setUploadProgress(percent);
        });

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
    }
  };

  // Handle local storage file download
  const handleDownloadFile = async (fileId: string) => {
    if (!roomCode || !socketToken) return;
    setDownloadingId(fileId);
    setError(null);
    try {
      const { downloadUrl } = await requestDownloadUrl(roomCode, fileId, socketToken);
      const anchor = document.createElement('a');
      const finalUrl = downloadUrl.startsWith('/') ? `${import.meta.env.VITE_API_URL || ''}${downloadUrl}` : downloadUrl;
      anchor.href = finalUrl;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (err: any) {
      setError(err.message || 'Failed to generate download URL');
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
    error,
    handleUploadFiles,
    handleDownloadFile,
    handleDeleteFile,
    addFileFromSocket,
    removeFileFromSocket,
  };
}
