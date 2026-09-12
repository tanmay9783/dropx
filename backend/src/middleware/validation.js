import { createError } from '../utils/errors.js';

// 6-character uppercase alphanumeric regex matching ROOM_CODE_CHARSET
const ROOM_CODE_REGEX = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

/**
 * Middleware to validate and format roomCode route parameter.
 */
export function validateRoomCodeParam(req, _res, next) {
  let { roomCode } = req.params;
  if (!roomCode || typeof roomCode !== 'string') {
    return next(createError('INVALID_ROOM_CODE', 'Room code parameter is required', 400));
  }

  roomCode = roomCode.trim().toUpperCase();
  if (!ROOM_CODE_REGEX.test(roomCode)) {
    return next(createError('INVALID_ROOM_CODE', 'Invalid room code format', 400));
  }

  req.params.roomCode = roomCode;
  next();
}

/**
 * Middleware to extract and validate Authorization Bearer header.
 */
export function validateAuthorizationHeader(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(createError('UNAUTHORIZED', 'Authorization header with Bearer token is required', 401));
  }

  const token = authHeader.split(' ')[1]?.trim();
  if (!token || token.length !== 64) {
    return next(createError('INVALID_OWNER_TOKEN', 'Invalid owner token format', 401));
  }

  req.ownerToken = token;
  next();
}
