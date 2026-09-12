import { env } from '../config/env.js';
import { roomRepository } from '../db/roomRepository.js';
import { generateRoomCode, generateOwnerToken, generateParticipantId, generateUuid, safeCompare } from '../utils/crypto.js';
import { generateSocketToken } from '../utils/token.js';
import { createError } from '../utils/errors.js';
import { broadcastRoomExpired } from '../sockets/socketHandler.js';

export const roomService = {
  /**
   * Create a new temporary room.
   */
  async createRoom() {
    const id = generateUuid();
    const ownerToken = generateOwnerToken();
    let roomCode = generateRoomCode();

    // Ensure room code uniqueness (retry up to 5 times if collision)
    let retries = 5;
    while (retries > 0) {
      const existing = await roomRepository.findRoomByCode(roomCode);
      if (!existing) break;
      roomCode = generateRoomCode();
      retries--;
    }

    const now = new Date();
    const expiresAtDate = new Date(now.getTime() + env.ROOM_TTL_MINUTES * 60 * 1000);

    const createdAt = now.toISOString();
    const expiresAt = expiresAtDate.toISOString();
    const status = 'active';

    const room = await roomRepository.createRoom({
      id,
      roomCode,
      createdAt,
      expiresAt,
      status,
      ownerToken,
    });

    const socketToken = generateSocketToken({
      roomCode: room.roomCode,
      participantId: `owner-${room.id.substring(0, 8)}`,
      role: 'owner',
    });

    return {
      room: {
        id: room.id,
        roomCode: room.roomCode,
        status: room.status,
        createdAt: room.createdAt,
        expiresAt: room.expiresAt,
      },
      ownerToken,
      socketToken,
    };
  },

  /**
   * Get basic room details by room code, performing lazy expiration check.
   */
  async getRoom(roomCode) {
    const room = await roomRepository.findRoomByCode(roomCode);
    if (!room) {
      throw createError('ROOM_NOT_FOUND', 'Room not found', 404);
    }

    const now = new Date();
    const expiresAtDate = new Date(room.expiresAt);

    // Lazy Expiration Check
    if (now >= expiresAtDate) {
      if (room.status === 'active') {
        await roomRepository.updateRoomStatus(roomCode, 'expired');
        broadcastRoomExpired(roomCode);
      }
      throw createError('ROOM_EXPIRED', 'This room has expired', 410);
    }

    if (room.status === 'expired') {
      throw createError('ROOM_EXPIRED', 'This room has expired', 410);
    }

    return {
      room: {
        id: room.id,
        roomCode: room.roomCode,
        status: room.status,
        createdAt: room.createdAt,
        expiresAt: room.expiresAt,
      },
    };
  },

  /**
   * Join an active room.
   */
  async joinRoom(roomCode) {
    const { room } = await this.getRoom(roomCode);
    const participantId = generateParticipantId();

    const socketToken = generateSocketToken({
      roomCode: room.roomCode,
      participantId,
      role: 'participant',
    });

    return {
      room,
      participantId,
      socketToken,
    };
  },

  /**
   * Destroy an active room using owner token.
   */
  async destroyRoom(roomCode, ownerToken) {
    const room = await roomRepository.findRoomByCode(roomCode);
    if (!room) {
      throw createError('ROOM_NOT_FOUND', 'Room not found', 404);
    }

    // Constant-time timing safe token check
    if (!safeCompare(room.ownerToken, ownerToken)) {
      throw createError('UNAUTHORIZED', 'Invalid owner token', 403);
    }

    if (room.status === 'expired') {
      throw createError('ROOM_ALREADY_EXPIRED', 'Room is already expired', 400);
    }

    await roomRepository.updateRoomStatus(roomCode, 'expired');
    broadcastRoomExpired(roomCode);

    return { success: true, message: 'Room destroyed successfully' };
  },

  /**
   * Background cleanup of expired active rooms.
   */
  async cleanupExpiredRooms() {
    const nowIso = new Date().toISOString();
    const expiredCount = await roomRepository.expireOldRooms(nowIso);
    return expiredCount;
  },
};
