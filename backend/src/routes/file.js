import express, { Router } from 'express';
import { fileController } from '../controllers/fileController.js';
import { validateRoomCodeParam } from '../middleware/validation.js';
import { authenticateRoomAccess } from '../middleware/auth.js';
import { createLimiter } from '../middleware/rateLimiterStore.js';
import { env } from '../config/env.js';

const router = Router();

// Upload URL Request Rate Limiter
const uploadUrlLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 5000 : 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many upload URL requests, please try again later.' } },
});

// Complete Upload Rate Limiter
const completeUploadLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 5000 : 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many completion requests, please try again later.' } },
});

// Presigned Download URL Request Rate Limiter
const downloadUrlLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 5000 : 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many download URL requests, please try again later.' } },
});

const maxFileSizeBytes = (env.MAX_FILE_SIZE_MB || 100) * 1024 * 1024;
const rawBodyParser = express.raw({ type: '*/*', limit: maxFileSizeBytes });

// Request Upload URL
router.post(
  '/rooms/:roomCode/files/upload-url',
  uploadUrlLimiter,
  validateRoomCodeParam,
  authenticateRoomAccess,
  fileController.requestUploadUrl
);

// Upload File Payload directly to Local Storage
router.put(
  '/rooms/:roomCode/files/:fileId/upload',
  validateRoomCodeParam,
  rawBodyParser,
  fileController.uploadFileContent
);

// Confirm Upload Completion
router.post(
  '/rooms/:roomCode/files/:fileId/complete',
  completeUploadLimiter,
  validateRoomCodeParam,
  authenticateRoomAccess,
  fileController.completeUpload
);

// Get Shared Files Metadata List
router.get(
  '/rooms/:roomCode/files',
  validateRoomCodeParam,
  authenticateRoomAccess,
  fileController.getFiles
);

// Request Download URL
router.get(
  '/rooms/:roomCode/files/:fileId/download-url',
  downloadUrlLimiter,
  validateRoomCodeParam,
  authenticateRoomAccess,
  fileController.requestDownloadUrl
);

// Serve/Stream Download File Content
router.get(
  '/rooms/:roomCode/files/:fileId/download',
  validateRoomCodeParam,
  fileController.downloadFile
);

// Delete File
router.delete(
  '/rooms/:roomCode/files/:fileId',
  validateRoomCodeParam,
  authenticateRoomAccess,
  fileController.deleteFile
);

export default router;
