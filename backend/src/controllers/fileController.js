import { fileService } from '../services/fileService.js';

export const fileController = {
  async requestUploadUrl(req, res, next) {
    try {
      const { roomCode } = req.params;
      const { fileName, contentType, sizeBytes } = req.body || {};
      const participantId = req.auth.participantId;

      const result = await fileService.requestUploadUrl({
        roomCode,
        participantId,
        fileName,
        contentType,
        sizeBytes,
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
