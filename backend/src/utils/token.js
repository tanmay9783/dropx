import crypto from 'node:crypto';

import { logger } from './logger.js';

// Shared secret key for HMAC token signing across multi-instance deployment
const SOCKET_SECRET = process.env.SOCKET_TOKEN_SECRET || process.env.SOCKET_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    logger.warn('⚠️ SOCKET_TOKEN_SECRET is not defined in production environment! Generating random process-local secret.');
  }
  return crypto.randomBytes(32).toString('hex');
})();

/**
 * Generate a signed short-lived socket token for a participant/owner.
 */
export function generateSocketToken({ roomCode, participantId, role, ttlMs = 2 * 60 * 60 * 1000 }) {
  const payload = {
    roomCode: roomCode.toUpperCase(),
    participantId,
    role,
    exp: Date.now() + ttlMs,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SOCKET_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verify signature and expiration of a socket token.
 * Returns payload if valid, null otherwise.
 */
export function verifySocketToken(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadBase64, signature] = parts;

  // Verify signature using constant-time comparison
  const expectedSignature = crypto
    .createHmac('sha256', SOCKET_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  const bufSig = Buffer.from(signature);
  const bufExp = Buffer.from(expectedSignature);

  if (bufSig.length !== bufExp.length || !crypto.timingSafeEqual(bufSig, bufExp)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    if (Date.now() >= payload.exp) {
      return null; // Expired token
    }
    return payload;
  } catch {
    return null;
  }
}
