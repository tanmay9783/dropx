import { Server as SocketIoServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { env } from '../config/env.js';
import { getRedisClient, getPubSubClients } from '../config/redisClient.js';
import { verifySocketToken } from '../utils/token.js';
import { roomRepository } from '../db/roomRepository.js';
import { logger } from '../utils/logger.js';

let io = null;

// Fallback in-memory single-instance socket presence tracking map: roomCode -> Map(participantId -> { socketId, role, joinedAt })
const roomSocketsMap = new Map();

export function getSocketIo() {
  return io;
}

// Internal presence abstraction supporting Redis shared state with in-memory fallback
async function addParticipantPresence(roomCode, participantId, info) {
  const redis = await getRedisClient();
  if (redis) {
    const key = `room:presence:${roomCode}`;
    await redis.hset(key, participantId, JSON.stringify(info));
    await redis.expire(key, env.ROOM_TTL_MINUTES * 60);
  } else {
    if (!roomSocketsMap.has(roomCode)) {
      roomSocketsMap.set(roomCode, new Map());
    }
    roomSocketsMap.get(roomCode).set(participantId, info);
  }
}

async function getRoomPresence(roomCode) {
  const redis = await getRedisClient();
  if (redis) {
    const key = `room:presence:${roomCode}`;
    const raw = await redis.hgetall(key);
    const participantsList = [];
    if (raw) {
      for (const [id, value] of Object.entries(raw)) {
        try {
          const parsed = JSON.parse(value);
          participantsList.push({ id, role: parsed.role });
        } catch {
          // Ignore parse error
        }
      }
    }
    return {
      count: participantsList.length,
      list: participantsList,
    };
  } else {
    const participantMap = roomSocketsMap.get(roomCode);
    if (!participantMap) return { count: 0, list: [] };
    const list = Array.from(participantMap.entries()).map(([id, info]) => ({
      id,
      role: info.role,
    }));
    return { count: participantMap.size, list };
  }
}

async function removeParticipantPresence(roomCode, participantId) {
  const redis = await getRedisClient();
  if (redis) {
    const key = `room:presence:${roomCode}`;
    await redis.hdel(key, participantId);
    const raw = await redis.hgetall(key);
    const count = raw ? Object.keys(raw).length : 0;
    if (count === 0) {
      await redis.del(key);
    }
    return count;
  } else {
    const participantMap = roomSocketsMap.get(roomCode);
    if (participantMap && participantMap.has(participantId)) {
      participantMap.delete(participantId);
      const remainingCount = participantMap.size;
      if (remainingCount === 0) {
        roomSocketsMap.delete(roomCode);
      }
      return remainingCount;
    }
    return 0;
  }
}

async function clearRoomPresence(roomCode) {
  const redis = await getRedisClient();
  if (redis) {
    await redis.del(`room:presence:${roomCode}`);
  } else {
    roomSocketsMap.delete(roomCode);
  }
}

export function initSocketIo(httpServer) {
  io = new SocketIoServer(httpServer, {
    cors: {
      origin: env.ALLOWED_ORIGINS.includes('*') ? '*' : env.ALLOWED_ORIGINS,
      credentials: true,
    },
    path: '/socket.io',
  });

  // Attach Redis Adapter asynchronously if Redis is configured
  getPubSubClients().then(({ pubClient, subClient }) => {
    if (pubClient && subClient) {
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Registered Redis Adapter for Socket.IO multi-instance signaling');
    }
  }).catch((err) => {
    logger.error({ err }, 'Failed to initialize Redis Adapter for Socket.IO');
  });

  // Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth || {};
      const token = auth.token;
      const roomCode = auth.roomCode ? auth.roomCode.trim().toUpperCase() : null;

      if (!token || !roomCode) {
        return next(new Error('Authentication failed: Missing token or roomCode'));
      }

      // 1. Verify signed socket token
      const payload = verifySocketToken(token);
      if (!payload) {
        return next(new Error('Authentication failed: Invalid or expired socket token'));
      }

      if (payload.roomCode !== roomCode) {
        return next(new Error('Authentication failed: Token room mismatch'));
      }

      // 2. Verify room status in database
      const room = await roomRepository.findRoomByCode(roomCode);
      if (!room) {
        return next(new Error('Authentication failed: Room not found'));
      }

      if (room.status !== 'active' || new Date() >= new Date(room.expiresAt)) {
        return next(new Error('Authentication failed: Room has expired'));
      }

      // Attach session info to socket
      socket.roomCode = roomCode;
      socket.participantId = payload.participantId;
      socket.role = payload.role;
      socket.expiresAt = room.expiresAt;

      next();
    } catch (err) {
      logger.error({ err }, 'Socket authentication error');
      next(new Error('Authentication failed: Internal error'));
    }
  });

  // Socket Connection Handling
  io.on('connection', async (socket) => {
    const { roomCode, participantId, role, expiresAt } = socket;
    logger.info({ roomCode, participantId, role, socketId: socket.id }, 'Socket connected to room');

    socket.join(roomCode);

    // Track presence across instances
    await addParticipantPresence(roomCode, participantId, {
      socketId: socket.id,
      role,
      joinedAt: new Date().toISOString(),
    });

    const presence = await getRoomPresence(roomCode);

    // Send room-state to newly connected socket
    socket.emit('room-state', {
      roomCode,
      participantCount: presence.count,
      participants: presence.list,
      expiresAt,
    });

    // Broadcast user-joined to all members in room (across all EC2 instances via Redis adapter)
    socket.to(roomCode).emit('user-joined', {
      participantId,
      role,
      participantCount: presence.count,
    });

    // Handle explicit leave-room
    socket.on('leave-room', async () => {
      await handleSocketLeave(socket);
    });

    // Handle disconnect
    socket.on('disconnect', async (reason) => {
      logger.info({ roomCode, participantId, reason }, 'Socket disconnected');
      await handleSocketLeave(socket);
    });
  });

  return io;
}

async function handleSocketLeave(socket) {
  const { roomCode, participantId } = socket;
  if (!roomCode || !participantId) return;

  const remainingCount = await removeParticipantPresence(roomCode, participantId);

  // Broadcast user-left to remaining room members globally
  if (io) {
    io.to(roomCode).emit('user-left', {
      participantId,
      participantCount: remainingCount,
    });
  }

  socket.leave(roomCode);
}

/**
 * Broadcast real-time room-expired event and disconnect sockets in room across all instances.
 */
export async function broadcastRoomExpired(roomCode) {
  if (!io) return;
  const cleanCode = roomCode.toUpperCase();
  
  io.to(cleanCode).emit('room-expired', {
    roomCode: cleanCode,
    message: 'This sharing session has expired',
  });

  await clearRoomPresence(cleanCode);

  // Disconnect local sockets in this instance if connected
  const localSockets = await io.in(cleanCode).fetchSockets();
  for (const s of localSockets) {
    s.leave(cleanCode);
    s.disconnect(true);
  }
}
