import { Router } from 'express';
import { fileController } from '../controllers/fileController.js';
import { validateRoomCodeParam } from '../middleware/validation.js';
import { authenticateRoomAccess } from '../middleware/auth.js';
import { createLimiter } from '../middleware/rateLimiterStore.js';

const router = Router();

// Upload URL Request Rate Limiter (Max 50 upload URL requests per 15 min per IP)
const uploadUrlLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many upload URL requests, please try again later.' } },
});

// Complete Upload Rate Limiter (Max 50 completion confirmations per 15 min per IP)
const completeUploadLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many completion requests, please try again later.' } },
});

// Presigned Download URL Request Rate Limiter (Max 100 download URL requests per 15 min per IP)
const downloadUrlLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many download URL requests, please try again later.' } },
});

// Request Presigned Upload URL
router.post(
  '/rooms/:roomCode/files/upload-url',
  uploadUrlLimiter,
  validateRoomCodeParam,
  authenticateRoomAccess,
  fileController.requestUploadUrl
);

// Confirm Upload Completion (HeadObject Verification)
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

// Request Presigned Download URL
router.get(
  '/rooms/:roomCode/files/:fileId/download-url',
  downloadUrlLimiter,
  validateRoomCodeParam,
  authenticateRoomAccess,
  fileController.requestDownloadUrl
);

// Delete File
router.delete(
  '/rooms/:roomCode/files/:fileId',
  validateRoomCodeParam,
  authenticateRoomAccess,
  fileController.deleteFile
);

export default router;
