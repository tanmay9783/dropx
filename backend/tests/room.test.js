import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import supertest from 'supertest';
import app from '../src/app.js';
import { initDb, getDb } from '../src/db/index.js';
import { roomRepository } from '../src/db/roomRepository.js';
import { roomService } from '../src/services/roomService.js';

const request = supertest(app);

describe('Room System API Tests', () => {
  before(async () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
    process.env.ROOM_TTL_MINUTES = '120';
    await initDb();
  });

  it('POST /api/rooms - should create a room successfully', async () => {
    const res = await request.post('/api/rooms').expect(201);

    assert.ok(res.body.room, 'Response should contain room object');
    assert.ok(res.body.room.id, 'Room should have id');
    assert.ok(res.body.room.roomCode, 'Room should have roomCode');
    assert.strictEqual(res.body.room.status, 'active');
    assert.ok(res.body.room.createdAt);
    assert.ok(res.body.room.expiresAt);
    assert.ok(res.body.ownerToken, 'Response should contain ownerToken');
    assert.strictEqual(res.body.ownerToken.length, 64, 'Owner token should be 64 characters hex');
    assert.strictEqual(res.body.room.roomCode.length, 6, 'Room code should be 6 characters');
  });

  it('GET /api/rooms/:roomCode - should fetch active room details without exposing ownerToken', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;

    const getRes = await request.get(`/api/rooms/${roomCode}`).expect(200);

    assert.ok(getRes.body.room);
    assert.strictEqual(getRes.body.room.roomCode, roomCode);
    assert.strictEqual(getRes.body.room.status, 'active');
    assert.strictEqual(getRes.body.ownerToken, undefined, 'Owner token MUST NOT be exposed in GET');
  });

  it('GET /api/rooms/:roomCode - should return 404 for non-existent room', async () => {
    const res = await request.get('/api/rooms/ZZZZZZ').expect(404);
    assert.strictEqual(res.body.error.code, 'ROOM_NOT_FOUND');
  });

  it('GET /api/rooms/:roomCode - should reject malformed room code', async () => {
    const res = await request.get('/api/rooms/INVALID123').expect(400);
    assert.strictEqual(res.body.error.code, 'INVALID_ROOM_CODE');
  });

  it('POST /api/rooms/:roomCode/join - should allow participant to join active room', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;

    const joinRes = await request.post(`/api/rooms/${roomCode}/join`).expect(200);

    assert.ok(joinRes.body.room);
    assert.strictEqual(joinRes.body.room.roomCode, roomCode);
    assert.ok(joinRes.body.participantId, 'Should return participantId');
    assert.strictEqual(joinRes.body.participantId.length, 32, 'Participant ID should be 32 characters hex');
  });

  it('DELETE /api/rooms/:roomCode - should destroy room with valid owner token', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const ownerToken = createRes.body.ownerToken;

    const destroyRes = await request
      .delete(`/api/rooms/${roomCode}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    assert.strictEqual(destroyRes.body.success, true);

    // Verify room is now expired
    const getRes = await request.get(`/api/rooms/${roomCode}`).expect(410);
    assert.strictEqual(getRes.body.error.code, 'ROOM_EXPIRED');
  });

  it('DELETE /api/rooms/:roomCode - should reject invalid owner token', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const invalidToken = '0000000000000000000000000000000000000000000000000000000000000000';

    const res = await request
      .delete(`/api/rooms/${roomCode}`)
      .set('Authorization', `Bearer ${invalidToken}`)
      .expect(403);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('Lazy Expiration Test - expired room on fetch should automatically update status and return 410', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;

    // Manually set expires_at to past in DB
    const pastIso = new Date(Date.now() - 10000).toISOString();
    const db = getDb();
    await db.query(`UPDATE rooms SET expires_at = $1 WHERE room_code = $2`, [pastIso, roomCode]);

    const res = await request.get(`/api/rooms/${roomCode}`).expect(410);
    assert.strictEqual(res.body.error.code, 'ROOM_EXPIRED');

    // Verify DB status is now 'expired'
    const roomRecord = await roomRepository.findRoomByCode(roomCode);
    assert.strictEqual(roomRecord.status, 'expired');
  });

  it('Cleanup Job Test - should mark past rooms as expired', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;

    // Set expires_at to past
    const pastIso = new Date(Date.now() - 10000).toISOString();
    const db = getDb();
    await db.query(`UPDATE rooms SET expires_at = $1 WHERE room_code = $2`, [pastIso, roomCode]);

    const expiredCount = await roomService.cleanupExpiredRooms();
    assert.ok(expiredCount >= 1, 'Cleanup should expire at least 1 room');

    const roomRecord = await roomRepository.findRoomByCode(roomCode);
    assert.strictEqual(roomRecord.status, 'expired');
  });
});
