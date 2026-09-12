import path from 'node:path';
import { env } from '../config/env.js';
import { fileRepository } from '../db/fileRepository.js';
import { roomService } from './roomService.js';
import { s3Storage } from './storage/s3Storage.js';
import { generateUuid } from '../utils/crypto.js';
import { createError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const fileService = {
  /**
   * Authorizes file upload and generates an S3 presigned PUT URL.
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
    if (nonTerminalCount >= env.MAX_FILES_PER_ROOM) {
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

    // 2. Generate S3 presigned PUT URL
    const { uploadUrl, objectKey, expiresIn } = await s3Storage.createUploadPresignedUrl({
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
      storageProvider: 's3',
    });

    return {
      fileId,
      objectKey,
      uploadUrl,
      expiresIn,
    };
  },

  /**
   * Verifies S3 upload completion using HeadObject and updates DB record to 'active'.
   */
  async completeUpload({ roomCode, fileId, participantId, role }) {
    // Re-verify room validity (handles race condition where room expired mid-upload)
    try {
      await roomService.getRoom(roomCode);
    } catch (roomErr) {
      // If room has expired, clean up uploaded S3 object immediately if record exists
      const record = await fileRepository.findFileById(fileId, roomCode);
      if (record) {
        await s3Storage.deleteObject({ objectKey: record.objectKey });
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

    // Verify object in S3 via HeadObject
    const head = await s3Storage.verifyObjectExists({ objectKey: record.objectKey });
    if (!head.exists) {
      throw createError('UPLOAD_NOT_FOUND', 'Uploaded S3 object was not found', 404);
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
   * Generates a short-lived presigned GET URL for direct browser download from S3.
   */
  async requestDownloadUrl({ roomCode, fileId }) {
    await roomService.getRoom(roomCode);
    const record = await fileRepository.findFileById(fileId, roomCode);

    if (!record || record.status !== 'active') {
      throw createError('FILE_NOT_FOUND', 'File not found or has expired', 404);
    }

    const { downloadUrl, expiresIn } = await s3Storage.createDownloadPresignedUrl({
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
   * Delete a shared file from S3 and database according to Option C policy:
   * Owner can delete any file in room; participant can delete only their own uploaded file.
   */
  async deleteFile({ roomCode, fileId, participantId, role }) {
    await roomService.getRoom(roomCode);
    const record = await fileRepository.findFileById(fileId, roomCode);

    if (!record || record.status !== 'active') {
      throw createError('FILE_NOT_FOUND', 'File not found or already deleted', 404);
    }

    // Option C authorization policy check
    if (role !== 'owner' && participantId && record.participantId !== participantId) {
      throw createError('FORBIDDEN', 'Only the file uploader or room owner can delete this file', 403);
    }

    // Delete S3 object
    await s3Storage.deleteObject({ objectKey: record.objectKey });

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
          await s3Storage.deleteObject({ objectKey: item.objectKey });
        } catch (err) {
          logger.warn({ errMessage: err.message, fileId: item.id }, 'Pending file S3 deletion failed during cleanup');
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
   * Cleanup S3 objects and metadata for expired rooms and stale pending uploads.
   */
  async cleanupExpiredFiles() {
    try {
      const expiredFiles = await fileRepository.findActiveFilesForExpiredRooms();
      let filesDeletedCount = 0;

      if (expiredFiles && expiredFiles.length > 0) {
        const objectKeys = expiredFiles.map((f) => f.objectKey);
        try {
          await s3Storage.deleteObjects({ objectKeys });
          filesDeletedCount = expiredFiles.length;
        } catch (s3Err) {
          logger.warn({ errMessage: s3Err.message }, 'Batch S3 delete failed, falling back to individual deletes');
          for (const item of expiredFiles) {
            try {
              await s3Storage.deleteObject({ objectKey: item.objectKey });
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
      logger.error({ errMessage: err.message }, 'Error during S3 expired file cleanup');
      return 0;
    }
  },
};
