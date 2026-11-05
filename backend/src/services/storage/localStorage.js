import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export const localStorage = {
  /**
   * Constructs server-side object key for room storage.
   */
  getObjectKey(roomCode, fileId) {
    const cleanRoomCode = roomCode.trim().toUpperCase();
    const cleanFileId = fileId.trim();
    return `rooms/${cleanRoomCode}/${cleanFileId}`;
  },

  /**
   * Returns full absolute filesystem path for a given objectKey.
   */
  getFilePath(objectKey) {
    return path.resolve(env.LOCAL_STORAGE_DIR || './data/uploads', objectKey);
  },

  /**
   * Ensures directory exists for target filepath.
   */
  async ensureDir(filePath) {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
  },

  /**
   * Returns local upload URL endpoint.
   */
  async createUploadPresignedUrl({ roomCode, fileId, contentType }) {
    const objectKey = this.getObjectKey(roomCode, fileId);
    const uploadUrl = `/api/rooms/${roomCode}/files/${fileId}/upload`;

    return {
      uploadUrl,
      objectKey,
      expiresIn: env.UPLOAD_URL_EXPIRY_SECONDS,
    };
  },

  /**
   * Saves file content to local disk.
   */
  async saveFile({ objectKey, buffer }) {
    const filePath = this.getFilePath(objectKey);
    await this.ensureDir(filePath);
    await fs.promises.writeFile(filePath, buffer);
    const stat = await fs.promises.stat(filePath);
    return { sizeBytes: stat.size };
  },

  /**
   * Verifies an object exists on local disk.
   */
  async verifyObjectExists({ objectKey }) {
    const filePath = this.getFilePath(objectKey);
    try {
      const stat = await fs.promises.stat(filePath);
      return {
        exists: true,
        sizeBytes: stat.size,
      };
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { exists: false, sizeBytes: 0 };
      }
      logger.warn({ errMessage: err.message, objectKey }, 'Local storage stat error');
      throw err;
    }
  },

  /**
   * Returns local download URL endpoint.
   */
  async createDownloadPresignedUrl({ roomCode, fileId, objectKey, originalName, contentType }) {
    const downloadUrl = `/api/rooms/${roomCode}/files/${fileId}/download`;
    return {
      downloadUrl,
      expiresIn: env.DOWNLOAD_URL_EXPIRY_SECONDS,
    };
  },

  /**
   * Returns directory path where intermediate chunks are stored.
   */
  getChunksDir(objectKey) {
    return `${this.getFilePath(objectKey)}.chunks`;
  },

  /**
   * Saves an individual binary chunk.
   */
  async saveChunk({ objectKey, chunkIndex, buffer }) {
    const chunksDir = this.getChunksDir(objectKey);
    await fs.promises.mkdir(chunksDir, { recursive: true });
    const chunkPath = path.join(chunksDir, String(chunkIndex));
    await fs.promises.writeFile(chunkPath, buffer);
    return { success: true };
  },

  /**
   * Returns list of chunk indices successfully saved to disk.
   */
  async getUploadedChunks({ objectKey }) {
    const chunksDir = this.getChunksDir(objectKey);
    try {
      const files = await fs.promises.readdir(chunksDir);
      return files.map((f) => parseInt(f, 10)).filter((n) => !isNaN(n)).sort((a, b) => a - b);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  },

  /**
   * Assembles all chunks sequentially into the final file.
   */
  async assembleChunks({ objectKey, totalChunks }) {
    const filePath = this.getFilePath(objectKey);
    const chunksDir = this.getChunksDir(objectKey);
    await this.ensureDir(filePath);

    const writeStream = fs.createWriteStream(filePath);

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunksDir, String(i));
      const chunkBuffer = await fs.promises.readFile(chunkPath);
      writeStream.write(chunkBuffer);
    }

    await new Promise((resolve, reject) => {
      writeStream.end(resolve);
      writeStream.on('error', reject);
    });

    // Clean up temporary chunks directory
    try {
      await fs.promises.rm(chunksDir, { recursive: true, force: true });
    } catch (_) {}

    const stat = await fs.promises.stat(filePath);
    return { sizeBytes: stat.size };
  },

  /**
   * Deletes a single object from local disk.
   */
  async deleteObject({ objectKey }) {
    const filePath = this.getFilePath(objectKey);
    const chunksDir = this.getChunksDir(objectKey);

    try {
      await fs.promises.rm(chunksDir, { recursive: true, force: true });
    } catch (_) {}

    try {
      await fs.promises.unlink(filePath);
      return { success: true };
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { success: true, missing: true };
      }
      logger.error({ errMessage: err.message, objectKey }, 'Failed to delete object from local disk');
      throw err;
    }
  },

  /**
   * Deletes multiple objects from local disk.
   */
  async deleteObjects({ objectKeys }) {
    if (!objectKeys || objectKeys.length === 0) return { success: true };
    for (const key of objectKeys) {
      try {
        await this.deleteObject({ objectKey: key });
      } catch (_) {}
    }
    return { success: true };
  },
};
