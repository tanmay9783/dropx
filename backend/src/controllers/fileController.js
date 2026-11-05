import { fileService } from '../services/fileService.js';

export const fileController = {
  async requestUploadUrl(req, res, next) {
    try {
      const { roomCode } = req.params;
      const { fileName, contentType, sizeBytes, deviceName } = req.body || {};
      const participantId = req.auth.participantId;

      const result = await fileService.requestUploadUrl({
        roomCode,
        participantId,
        fileName,
        contentType,
        sizeBytes,
        deviceName,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async uploadFileContent(req, res, next) {
    try {
      const { roomCode, fileId } = req.params;
      const buffer = req.body;
      await fileService.uploadFileContent({ roomCode, fileId, buffer });
      res.status(200).send();
    } catch (err) {
      next(err);
    }
  },

  async uploadChunk(req, res, next) {
    try {
      const { roomCode, fileId } = req.params;
      const chunkIndex = parseInt(req.query.index ?? req.headers['x-chunk-index'], 10);
      if (isNaN(chunkIndex) || chunkIndex < 0) {
        return res.status(400).json({ error: { code: 'INVALID_CHUNK_INDEX', message: 'Valid chunk index is required' } });
      }
      const buffer = req.body;
      const result = await fileService.uploadChunk({ roomCode, fileId, chunkIndex, buffer });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async getChunkStatus(req, res, next) {
    try {
      const { roomCode, fileId } = req.params;
      const result = await fileService.getChunkStatus({ roomCode, fileId });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async completeChunkedUpload(req, res, next) {
    try {
      const { roomCode, fileId } = req.params;
      const { participantId, role } = req.auth;
      const totalChunks = parseInt(req.body.totalChunks, 10);

      const result = await fileService.completeChunkedUpload({
        roomCode,
        fileId,
        participantId,
        role,
        totalChunks,
      });

      res.status(200).json({ file: result });
    } catch (err) {
      next(err);
    }
  },

  async completeUpload(req, res, next) {
    try {
      const { roomCode, fileId } = req.params;
      const { participantId, role } = req.auth;

      const result = await fileService.completeUpload({
        roomCode,
        fileId,
        participantId,
        role,
      });

      res.status(200).json({ file: result });
    } catch (err) {
      next(err);
    }
  },

  async getFiles(req, res, next) {
    try {
      const { roomCode } = req.params;
      const files = await fileService.getRoomFiles(roomCode);
      res.status(200).json({ files });
    } catch (err) {
      next(err);
    }
  },

  async requestDownloadUrl(req, res, next) {
    try {
      const { roomCode, fileId } = req.params;
      const result = await fileService.requestDownloadUrl({ roomCode, fileId });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async downloadFile(req, res, next) {
    try {
      const { roomCode, fileId } = req.params;
      const { filePath, originalName, mimeType } = await fileService.getDownloadFile({ roomCode, fileId });
      res.setHeader('Content-Type', mimeType || 'application/octet-stream');
      res.download(filePath, originalName);
    } catch (err) {
      next(err);
    }
  },

  async deleteFile(req, res, next) {
    try {
      const { roomCode, fileId } = req.params;
      const { participantId, role } = req.auth;

      const result = await fileService.deleteFile({ roomCode, fileId, participantId, role });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
};
