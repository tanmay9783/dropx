import crypto from 'node:crypto';

// Character set for room codes: Uppercase letters & numbers, excluding confusing characters (0, O, 1, I)
const ROOM_CODE_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a cryptographically random, unpredictable 6-character room code.
 */
export function generateRoomCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_CHARSET[bytes[i] % ROOM_CODE_CHARSET.length];
  }
  return code;
}

/**
 * Generates a cryptographically secure 64-character hex token for room ownership.
 */
export function generateOwnerToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generates a cryptographically secure 32-character hex identifier for room participants.
 */
export function generateParticipantId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generates a standard UUID v4.
 */
export function generateUuid() {
  return crypto.randomUUID();
}

/**
 * Performs a constant-time comparison of two strings to prevent timing attacks.
 */
export function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
