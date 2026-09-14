import { Router } from 'express';
import { roomController } from '../controllers/roomController.js';
import { validateRoomCodeParam, validateAuthorizationHeader } from '../middleware/validation.js';
import { createLimiter } from '../middleware/rateLimiterStore.js';

const router = Router();

// Stricter rate limiting for room creation (max 20 rooms per 15 minutes per IP)
const roomCreationLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many room creation requests, please try again later.' } },
});

// Stricter rate limiting for room joining (max 30 join attempts per 15 minutes per IP)
const roomJoinLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many room join attempts, please try again later.' } },
});

import { snippetController } from '../controllers/snippetController.js';
import { authenticateRoomAccess } from '../middleware/auth.js';

// Create Room
router.post('/rooms', roomCreationLimiter, roomController.createRoom);

// Get Room Status
router.get('/rooms/:roomCode', validateRoomCodeParam, roomController.getRoom);

// Get Room Presence
router.get('/rooms/:roomCode/presence', validateRoomCodeParam, authenticateRoomAccess, roomController.getRoomPresence);

// Join Room
router.post('/rooms/:roomCode/join', roomJoinLimiter, validateRoomCodeParam, roomController.joinRoom);

// Destroy Room
router.delete('/rooms/:roomCode', validateRoomCodeParam, validateAuthorizationHeader, roomController.destroyRoom);

// Text Snippets Routes
router.get('/rooms/:roomCode/snippets', validateRoomCodeParam, authenticateRoomAccess, snippetController.getSnippets);
router.post('/rooms/:roomCode/snippets', validateRoomCodeParam, authenticateRoomAccess, snippetController.createSnippet);
router.delete('/rooms/:roomCode/snippets/:snippetId', validateRoomCodeParam, authenticateRoomAccess, snippetController.deleteSnippet);

export default router;
