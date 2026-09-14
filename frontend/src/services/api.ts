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
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchReadiness(): Promise<ReadyResponse> {
  const response = await fetch('/api/ready');
  if (!response.ok) {
    throw new Error(`Readiness check failed: ${response.statusText}`);
  }
  return response.json();
}

export async function createRoom(): Promise<CreateRoomResponse> {
  const response = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to create room');
  }
  return data;
}

export async function getRoom(roomCode: string): Promise<GetRoomResponse> {
  const response = await fetch(`/api/rooms/${roomCode}`);
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Failed to fetch room') as any;
    error.code = data.error?.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function joinRoom(roomCode: string): Promise<JoinRoomResponse> {
  const response = await fetch(`/api/rooms/${roomCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Failed to join room') as any;
    error.code = data.error?.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function destroyRoom(roomCode: string, ownerToken: string): Promise<DestroyRoomResponse> {
  const response = await fetch(`/api/rooms/${roomCode}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to destroy room');
  }
  return data;
}

export async function requestUploadUrl(
  roomCode: string,
  socketToken: string,
  file: File
): Promise<{ uploadUrl: string; fileId: string; objectKey: string; expiresIn: number }> {
  const response = await fetch(`/api/rooms/${roomCode}/files/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${socketToken}`,
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to request upload URL');
  }
  return data;
}

export async function uploadFileStorage(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
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
  const response = await fetch(`/api/rooms/${roomCode}/files/${fileId}/complete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${socketToken}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to finalize upload');
  }
  return data;
}

export async function uploadFile(
  roomCode: string,
  socketToken: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ file: SharedFile }> {
  // 1. Request presigned upload URL
  const { uploadUrl, fileId } = await requestUploadUrl(roomCode, socketToken, file);

  // 2. Upload file directly to S3
  await uploadToS3(uploadUrl, file, onProgress);

  // 3. Confirm completion with server
  return completeUpload(roomCode, fileId, socketToken);
}

export async function getFiles(roomCode: string, socketToken: string): Promise<{ files: SharedFile[] }> {
  const response = await fetch(`/api/rooms/${roomCode}/files`, {
    headers: {
      Authorization: `Bearer ${socketToken}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to fetch room files');
  }
  return data;
}

export async function deleteFile(roomCode: string, fileId: string, socketToken: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/rooms/${roomCode}/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${socketToken}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to delete file');
  }
  return data;
}

export async function requestDownloadUrl(
  roomCode: string,
  fileId: string,
  socketToken: string
): Promise<{ downloadUrl: string; expiresIn: number; fileName: string }> {
  const response = await fetch(`/api/rooms/${roomCode}/files/${fileId}/download-url`, {
    headers: {
      Authorization: `Bearer ${socketToken}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to generate download URL');
  }
  return data;
}
