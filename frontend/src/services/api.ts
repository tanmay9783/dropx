import { getDeviceName } from '../utils/device';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function parseApiError(data: any, fallbackMessage: string, status?: number): string {
  if (status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  if (!data) return fallbackMessage;
  if (typeof data === 'string') return data;
  if (typeof data.error === 'string') return data.error;
  if (data.error && typeof data.error.message === 'string') return data.error.message;
  if (typeof data.message === 'string') return data.message;
  return fallbackMessage;
}

export async function safeParseJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: string;
  environment: string;
}

export interface ReadyResponse {
  status: string;
  timestamp: string;
  checks: Record<string, string>;
}

export interface RoomData {
  id: string;
  roomCode: string;
  status: 'active' | 'expired';
  createdAt: string;
  expiresAt: string;
}

export interface SharedFile {
  id: string;
  roomCode: string;
  participantId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  deviceName?: string;
}

export interface CreateRoomResponse {
  room: RoomData;
  ownerToken: string;
  socketToken: string;
}

export interface GetRoomResponse {
  room: RoomData;
}

export interface JoinRoomResponse {
  room: RoomData;
  participantId: string;
  socketToken: string;
}

export interface DestroyRoomResponse {
  success: boolean;
  message: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE}/api/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchReadiness(): Promise<ReadyResponse> {
  const response = await fetch(`${API_BASE}/api/ready`);
  if (!response.ok) {
    throw new Error(`Readiness check failed: ${response.statusText}`);
  }
  return response.json();
}

export async function createRoom(): Promise<CreateRoomResponse> {
  const response = await fetch(`${API_BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(parseApiError(data, 'Failed to create room', response.status));
  }
  return data;
}

export async function getPresence(roomCode: string, socketToken: string): Promise<{ count: number; list: { id: string; role: string; deviceName?: string }[] }> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomCode}/presence`, {
    headers: { Authorization: `Bearer ${socketToken}` },
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(parseApiError(data, 'Failed to fetch room presence', response.status));
  }
  return data;
}

export async function getRoom(roomCode: string): Promise<GetRoomResponse> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomCode}`);
  const data = await safeParseJson(response);
  if (!response.ok) {
    const error = new Error(parseApiError(data, 'Failed to fetch room', response.status)) as any;
    error.code = data?.error?.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function joinRoom(roomCode: string): Promise<JoinRoomResponse> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    const error = new Error(parseApiError(data, 'Failed to join room', response.status)) as any;
    error.code = data?.error?.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function destroyRoom(roomCode: string, ownerToken: string): Promise<DestroyRoomResponse> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomCode}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(parseApiError(data, 'Failed to destroy room', response.status));
  }
  return data;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  fileId: string;
  objectKey: string;
  expiresIn: number;
}

export async function requestUploadUrl(
  roomCode: string,
  fileName: string,
  contentType: string,
  sizeBytes: number,
  socketToken: string,
  deviceName?: string
): Promise<UploadUrlResponse> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomCode}/files/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${socketToken}`,
    },
    body: JSON.stringify({ fileName, contentType, sizeBytes, deviceName: deviceName || getDeviceName() }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(parseApiError(data, 'Failed to request upload URL', response.status));
  }
  return data;
}

export async function uploadFileStorage(
  uploadUrl: string,
  file: File | Blob,
  onProgress?: (percent: number, loadedBytes: number, totalBytes: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const finalUrl = uploadUrl.startsWith('/') ? `${API_BASE}${uploadUrl}` : uploadUrl;
    xhr.open('PUT', finalUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent, e.loaded, e.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`File upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during file upload'));
    };

    xhr.send(file);
  });
}

export const uploadToS3 = uploadFileStorage;

export async function completeUpload(
  roomCode: string,
  fileId: string,
  socketToken: string
): Promise<{ file: SharedFile }> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomCode}/files/${fileId}/complete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${socketToken}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(parseApiError(data, 'Failed to finalize upload', response.status));
  }
  return data;
}

export async function getChunkStatus(
  roomCode: string,
  fileId: string,
  socketToken: string
): Promise<{ fileId: string; uploadedChunks: number[] }> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomCode}/files/${fileId}/chunks`, {
    headers: { Authorization: `Bearer ${socketToken}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(parseApiError(data, 'Failed to fetch chunk status', response.status));
  }
  return data;
}

export async function uploadChunk(
  roomCode: string,
  fileId: string,
  chunkIndex: number,
  chunkBlob: Blob
): Promise<void> {
  const url = `${API_BASE}/api/rooms/${roomCode}/files/${fileId}/chunk?index=${chunkIndex}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: chunkBlob,
  });
  if (!response.ok) {
    throw new Error(`Failed to upload chunk ${chunkIndex} (${response.status === 429 ? 'Rate limited' : `status: ${response.status}`})`);
  }
}

export async function completeChunkedUpload(
  roomCode: string,
  fileId: string,
  totalChunks: number,
  socketToken: string
): Promise<{ file: SharedFile }> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomCode}/files/${fileId}/chunked/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${socketToken}`,
    },
    body: JSON.stringify({ totalChunks }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(parseApiError(data, 'Failed to assemble chunked upload', response.status));
  }
  return data;
}

export async function uploadFile(
  roomCode: string,
  socketToken: string,
  file: File | Blob,
  fileName?: string,
  onProgress?: (percent: number, loadedBytes: number, totalBytes: number) => void
): Promise<{ file: SharedFile }> {
  const fileToUpload = file as File;
  const name = fileName || fileToUpload.name || 'file';
  const size = file.size;

  // 1. Request presigned upload URL / slot
  const response = await fetch(`${API_BASE}/api/rooms/${roomCode}/files/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${socketToken}`,
    },
    body: JSON.stringify({
      fileName: name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: size,
      deviceName: getDeviceName(),
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(parseApiError(data, 'Failed to request upload URL', response.status));
  }

  const CHUNK_THRESHOLD = 4 * 1024 * 1024; // 4MB threshold for chunked upload
  const CHUNK_SIZE = 2 * 1024 * 1024;      // 2MB chunk size

  // 2A. Resumable Chunked Upload for files > 4MB
  if (size > CHUNK_THRESHOLD) {
    const totalChunks = Math.ceil(size / CHUNK_SIZE);
    let uploadedBytes = 0;

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, size);
      const chunkBlob = file.slice(start, end);

      // Retry up to 3 times per chunk for network resilience
      let attempts = 0;
      let success = false;
      let lastErr: any;

      while (attempts < 3 && !success) {
        try {
          await uploadChunk(roomCode, data.fileId, i, chunkBlob);
          success = true;
        } catch (err) {
          attempts++;
          lastErr = err;
          await new Promise((r) => setTimeout(r, 800 * attempts));
        }
      }

      if (!success) {
        throw new Error(lastErr?.message || `Failed to upload chunk ${i + 1} after 3 attempts`);
      }

      uploadedBytes += (end - start);
      if (onProgress) {
        const percent = Math.round((uploadedBytes / size) * 100);
        onProgress(percent, uploadedBytes, size);
      }
    }

    return completeChunkedUpload(roomCode, data.fileId, totalChunks, socketToken);
  }

  // 2B. Direct single PUT stream for files <= 4MB
  await uploadFileStorage(data.uploadUrl, file, onProgress);
  return completeUpload(roomCode, data.fileId, socketToken);
}

export async function getFiles(roomCode: string, socketToken: string): Promise<{ files: SharedFile[] }> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomCode}/files`, {
    headers: {
      Authorization: `Bearer ${socketToken}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(parseApiError(data, 'Failed to fetch room files', response.status));
  }
  return data;
}

export async function deleteFile(roomCode: string, fileId: string, socketToken: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomCode}/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${socketToken}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(parseApiError(data, 'Failed to delete file', response.status));
  }
  return data;
}

export async function requestDownloadUrl(
  roomCode: string,
  fileId: string,
  socketToken: string
): Promise<{ downloadUrl: string; expiresIn: number; fileName: string }> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomCode}/files/${fileId}/download-url`, {
    headers: {
      Authorization: `Bearer ${socketToken}`,
    },
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(parseApiError(data, 'Failed to generate download URL', response.status));
  }
  return data;
}

export interface TextSnippet {
  id: string;
  roomCode: string;
  content: string;
  createdAt: string;
}

export async function getSnippets(roomCode: string, socketToken: string): Promise<{ snippets: TextSnippet[] }> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomCode}/snippets`, {
    headers: {
      Authorization: `Bearer ${socketToken}`,
    },
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(parseApiError(data, 'Failed to fetch room snippets', response.status));
  }
  return data;
}

export async function createSnippet(roomCode: string, socketToken: string, content: string): Promise<{ snippet: TextSnippet }> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomCode}/snippets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${socketToken}`,
    },
    body: JSON.stringify({ content }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(parseApiError(data, 'Failed to share snippet', response.status));
  }
  return data;
}

export async function deleteSnippet(roomCode: string, snippetId: string, socketToken: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomCode}/snippets/${snippetId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${socketToken}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(parseApiError(data, 'Failed to delete snippet', response.status));
  }
  return data;
}

