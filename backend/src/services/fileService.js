import path from 'node:path';
import { env } from '../config/env.js';
import { fileRepository } from '../db/fileRepository.js';
import { roomService } from './roomService.js';
import { localStorage } from './storage/localStorage.js';
import { generateUuid } from '../utils/crypto.js';
import { createError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const fileService = {
  /**
   * Authorizes file upload and generates a local upload URL.
   */
  async requestUploadUrl({ roomCode, participantId, fileName, contentType, sizeBytes }) {
    // 1. Verify room exists and is active
    await roomService.getRoom(roomCode);

    if (!fileName || typeof fileName !== 'string' || fileName.trim().length === 0) {
      throw createError('INVALID_FILE', 'File name is required', 400);
    }

    if (typeof sizeBytes !== 'number' || sizeBytes <= 0) {
      throw createError('INVALID_FILE_SIZE', 'File size must be greater than 0 bytes.', 400);
    }

    const sanitizedInput = String(fileName).replace(/[\r\n\0]/g, '').replace(/[\\/]/g, '_');
    const safeFileName = path.basename(sanitizedInput)
      .replace(/[<>"']/g, '_')
      .trim()
      .slice(0, 255);

    if (!safeFileName) {
      throw createError('INVALID_FILE', 'Invalid file name', 400);
    }

    const maxSizeBytes = (env.MAX_FILE_SIZE_MB || 100) * 1024 * 1024;

    if (sizeBytes > maxSizeBytes) {
      throw createError('FILE_TOO_LARGE', `File size exceeds the ${env.MAX_FILE_SIZE_MB}MB limit.`, 413);
    }

    // Enforce MAX_FILES_PER_ROOM limit
    const nonTerminalCount = await fileRepository.countNonTerminalFilesByRoom(roomCode);
    if (nonTerminalCount >= (env.MAX_FILES_PER_ROOM || 20)) {
      throw createError(
        'ROOM_FILE_LIMIT_EXCEEDED',
        `Room has reached the maximum allowed limit of ${env.MAX_FILES_PER_ROOM} files.`,
        400
      );
    }

    // Enforce MAX_ROOM_STORAGE_BYTES limit
    const currentStorageBytes = await fileRepository.getRoomStorageUsageBytes(roomCode);
    if (currentStorageBytes + sizeBytes > env.MAX_ROOM_STORAGE_BYTES) {
      throw createError(
        'ROOM_STORAGE_LIMIT_EXCEEDED',
        `Room aggregate storage capacity limit (${Math.round(env.MAX_ROOM_STORAGE_BYTES / (1024 * 1024))}MB) exceeded.`,
        400
      );
    }

    const fileId = generateUuid();
    const cleanContentType = contentType || 'application/octet-stream';

    // 2. Generate local upload URL
    const { uploadUrl, objectKey, expiresIn } = await localStorage.createUploadPresignedUrl({
      roomCode,
      fileId,
      contentType: cleanContentType,
    });

    // 3. Create intermediate 'pending' database metadata record
    const createdAt = new Date().toISOString();
    await fileRepository.createFileRecord({
      id: fileId,
      roomCode,
      participantId,
      originalName: safeFileName,
      objectKey,
      mimeType: cleanContentType,
      sizeBytes,
      createdAt,
      status: 'pending',
      storageProvider: 'local',
    });

    return {
      fileId,
      objectKey,
      uploadUrl,
      expiresIn,
    };
  },

  /**
   * Saves uploaded binary payload to local storage.
   */
  async uploadFileContent({ roomCode, fileId, buffer }) {
    await roomService.getRoom(roomCode);
    const record = await fileRepository.findFileById(fileId, roomCode);
    if (!record) {
      throw createError('FILE_NOT_FOUND', 'Upload metadata not found', 404);
    }
    const { sizeBytes } = await localStorage.saveFile({ objectKey: record.objectKey, buffer });
    return { success: true, sizeBytes };
  },

  /**
   * Verifies local file completion and updates DB record to 'active'.
   */
  async completeUpload({ roomCode, fileId, participantId, role }) {
    // Re-verify room validity (handles race condition where room expired mid-upload)
    try {
      await roomService.getRoom(roomCode);
    } catch (roomErr) {
      // If room has expired, clean up uploaded file immediately if record exists
      const record = await fileRepository.findFileById(fileId, roomCode);
      if (record) {
        await localStorage.deleteObject({ objectKey: record.objectKey });
        await fileRepository.updateFileStatus(fileId, 'expired');
      }
      throw roomErr;
    }

    const record = await fileRepository.findFileById(fileId, roomCode);

    if (!record) {
      throw createError('FILE_NOT_FOUND', 'Upload metadata not found', 404);
    }

    // Verify uploader authorization
    if (role !== 'owner' && participantId && record.participantId !== participantId) {
      throw createError('FORBIDDEN', 'You are not authorized to complete this upload', 403);
    }

    // Verify object exists on local disk
    const head = await localStorage.verifyObjectExists({ objectKey: record.objectKey });
    if (!head.exists) {
      throw createError('UPLOAD_NOT_FOUND', 'Uploaded file object was not found', 404);
    }

    const actualSize = head.sizeBytes || record.sizeBytes;

    // Update status to 'active'
    await fileRepository.updateFileStatus(fileId, 'active', actualSize);

    const fileMetadata = {
      id: record.id,
      roomCode: record.roomCode,
      participantId: record.participantId,
      originalName: record.originalName,
      mimeType: record.mimeType,
      sizeBytes: Number(actualSize),
      createdAt: record.createdAt,
    };

    // Broadcast Socket.IO file-uploaded event (metadata ONLY)
    try {
      const { getSocketIo } = await import('../sockets/socketHandler.js');
      const io = getSocketIo();
      if (io) {
        io.to(roomCode).emit('file-uploaded', fileMetadata);
      }
    } catch (err) {
      logger.error({ errMessage: err.message }, 'Failed to broadcast file-uploaded event');
    }

    return fileMetadata;
  },

  /**
   * Get list of active shared files for a room.
   */
  async getRoomFiles(roomCode) {
    await roomService.getRoom(roomCode);
    const records = await fileRepository.findFilesByRoomCode(roomCode);
    return records.map((r) => ({
      id: r.id,
      roomCode: r.roomCode,
      participantId: r.participantId,
      originalName: r.originalName,
      mimeType: r.mimeType,
      sizeBytes: Number(r.sizeBytes),
      createdAt: r.createdAt,
    }));
  },

  /**
   * Generates local download URL.
   */
  async requestDownloadUrl({ roomCode, fileId }) {
    await roomService.getRoom(roomCode);
    const record = await fileRepository.findFileById(fileId, roomCode);

    if (!record || record.status !== 'active') {
      throw createError('FILE_NOT_FOUND', 'File not found or has expired', 404);
    }

    const { downloadUrl, expiresIn } = await localStorage.createDownloadPresignedUrl({
      roomCode,
      fileId,
      objectKey: record.objectKey,
      originalName: record.originalName,
      contentType: record.mimeType,
    });

    return {
      downloadUrl,
      expiresIn,
      fileName: record.originalName,
    };
  },

  /**
   * Retrieves local filesystem path and metadata for streaming download.
   */
  async getDownloadFile({ roomCode, fileId }) {
    await roomService.getRoom(roomCode);
    const record = await fileRepository.findFileById(fileId, roomCode);

    if (!record || record.status !== 'active') {
      throw createError('FILE_NOT_FOUND', 'File not found or has expired', 404);
    }

    const filePath = localStorage.getFilePath(record.objectKey);
    const stat = await localStorage.verifyObjectExists({ objectKey: record.objectKey });
    if (!stat.exists) {
      throw createError('FILE_NOT_FOUND', 'File content missing from storage', 404);
    }

    return {
      filePath,
      originalName: record.originalName,
      mimeType: record.mimeType,
      sizeBytes: stat.sizeBytes,
    };
  },

  /**
   * Delete a shared file from local storage and database.
   */
  async deleteFile({ roomCode, fileId, participantId, role }) {
    await roomService.getRoom(roomCode);
    const record = await fileRepository.findFileById(fileId, roomCode);

    if (!record || record.status !== 'active') {
      throw createError('FILE_NOT_FOUND', 'File not found or already deleted', 404);
    }

    // Authorization policy check
    if (role !== 'owner' && participantId && record.participantId !== participantId) {
      throw createError('FORBIDDEN', 'Only the file uploader or room owner can delete this file', 403);
    }

    // Delete local file object
    await localStorage.deleteObject({ objectKey: record.objectKey });

    // Mark status in DB
    await fileRepository.updateFileStatus(fileId, 'deleted');

    // Broadcast file-deleted event
    try {
      const { getSocketIo } = await import('../sockets/socketHandler.js');
      const io = getSocketIo();
      if (io) {
        io.to(roomCode).emit('file-deleted', { fileId, roomCode });
      }
    } catch (_) {}

    return { success: true, message: 'File deleted successfully' };
  },

  /**
   * Cleanup stale pending upload records older than PENDING_FILE_TTL_MINUTES.
   */
  async cleanupPendingFiles() {
    try {
      const pendingTtlMs = (env.PENDING_FILE_TTL_MINUTES || 30) * 60 * 1000;
      const cutoffIso = new Date(Date.now() - pendingTtlMs).toISOString();

      const stalePendingFiles = await fileRepository.findStalePendingFiles(cutoffIso);
      if (!stalePendingFiles || stalePendingFiles.length === 0) return 0;

      for (const item of stalePendingFiles) {
        try {
          await localStorage.deleteObject({ objectKey: item.objectKey });
        } catch (err) {
          logger.warn({ errMessage: err.message, fileId: item.id }, 'Pending file deletion failed during cleanup');
        }
        await fileRepository.updateFileStatus(item.id, 'expired');
      }

      logger.info({ count: stalePendingFiles.length }, '🧹 Cleaned up stale pending file uploads');
      return stalePendingFiles.length;
    } catch (err) {
      logger.error({ errMessage: err.message }, 'Error during pending file cleanup');
      return 0;
    }
  },

  /**
   * Cleanup local files and metadata for expired rooms and stale pending uploads.
   */
  async cleanupExpiredFiles() {
    try {
      const expiredFiles = await fileRepository.findActiveFilesForExpiredRooms();
      let filesDeletedCount = 0;

      if (expiredFiles && expiredFiles.length > 0) {
        const objectKeys = expiredFiles.map((f) => f.objectKey);
        try {
          await localStorage.deleteObjects({ objectKeys });
          filesDeletedCount = expiredFiles.length;
        } catch (err) {
          logger.warn({ errMessage: err.message }, 'Batch delete failed, falling back to individual deletes');
          for (const item of expiredFiles) {
            try {
              await localStorage.deleteObject({ objectKey: item.objectKey });
              filesDeletedCount++;
            } catch (_) {}
          }
        }

        for (const item of expiredFiles) {
          await fileRepository.updateFileStatus(item.id, 'expired');
        }
      }

      // Run stale pending file cleanup
      const pendingExpiredCount = await this.cleanupPendingFiles();

      const totalCleaned = filesDeletedCount + pendingExpiredCount;
      return totalCleaned;
    } catch (err) {
      logger.error({ errMessage: err.message }, 'Error during local expired file cleanup');
      return 0;
    }
  },
};
