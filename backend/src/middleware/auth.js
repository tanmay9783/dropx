import { verifySocketToken } from '../utils/token.js';
import { roomRepository } from '../db/roomRepository.js';
import { safeCompare } from '../utils/crypto.js';
import { createError } from '../utils/errors.js';

/**
 * Middleware to authenticate room requests using a signed socketToken or ownerToken.
 */
export async function authenticateRoomAccess(req, _res, next) {
  try {
    let token = null;

    // 1. Check Authorization Bearer header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1]?.trim();
    }

    if (!token) {
      return next(createError('UNAUTHORIZED', 'Authentication token is required', 401));
    }

    const { roomCode } = req.params;
    if (!roomCode) {
      return next(createError('INVALID_ROOM_CODE', 'Room code is required', 400));
    }

    const cleanRoomCode = roomCode.trim().toUpperCase();

    // A. Check if token is a signed socketToken
    const socketPayload = verifySocketToken(token);
    if (socketPayload) {
      if (socketPayload.roomCode !== cleanRoomCode) {
        return next(createError('UNAUTHORIZED', 'Token is not authorized for this room', 403));
      }

      req.auth = {
        roomCode: cleanRoomCode,
        participantId: socketPayload.participantId,
        role: socketPayload.role,
      };
      return next();
    }

    // B. Check if token is a 64-char ownerToken
    if (token.length === 64) {
      const room = await roomRepository.findRoomByCode(cleanRoomCode);
      if (room && safeCompare(room.ownerToken, token)) {
        req.auth = {
          roomCode: cleanRoomCode,
          participantId: `owner-${room.id.substring(0, 8)}`,
          role: 'owner',
        };
        return next();
      }
    }

    return next(createError('UNAUTHORIZED', 'Invalid or expired room authentication token', 401));
  } catch (err) {
    next(err);
  }
}
