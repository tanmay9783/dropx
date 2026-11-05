import { Router } from 'express';
import { roomController } from '../controllers/roomController.js';
import { validateRoomCodeParam, validateAuthorizationHeader } from '../middleware/validation.js';
import { createLimiter } from '../middleware/rateLimiterStore.js';

const router = Router();

// Rate limiting for room creation
const roomCreationLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 5000 : 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many room creation requests, please try again later.' } },
});

// Rate limiting for room joining
const roomJoinLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 5000 : 150,
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
