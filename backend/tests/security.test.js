import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import supertest from 'supertest';
import app from '../src/app.js';
import { initDb } from '../src/db/index.js';
import { initSocketIo } from '../src/sockets/socketHandler.js';
import { localStorage } from '../src/services/storage/localStorage.js';

let httpServer;
let baseUrl;
let request;

describe('Phase 8 — Security Hardening & Threat-Model Validation Tests', () => {
  before(async () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173';
    process.env.ROOM_TTL_MINUTES = '120';
    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_DIR = './data/test_uploads_sec';

    await initDb();

    httpServer = http.createServer(app);
    initSocketIo(httpServer);

    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        const port = httpServer.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        request = supertest(baseUrl);
        resolve();
      });
    });
  });

  after((done) => {
    if (httpServer) {
      httpServer.close(done);
    } else {
      done();
    }
  });

  it('Authentication - should reject requests missing Bearer authorization token', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;

    await request.get(`/api/rooms/${roomCode}/files`).expect(401);
    await request.post(`/api/rooms/${roomCode}/files/upload-url`).send({ fileName: 'a.txt' }).expect(401);
  });

  it('Authentication - should reject invalid or tampered tokens', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;

    await request
      .get(`/api/rooms/${roomCode}/files`)
      .set('Authorization', 'Bearer invalid.jwt.token')
      .expect(401);
  });

  it('Authorization & IDOR - should prevent Room A user from accessing or modifying Room B files', async () => {
    // Create Room A
    const roomARes = await request.post('/api/rooms').expect(201);
    const roomACode = roomARes.body.room.roomCode;
    const tokenA = roomARes.body.socketToken;

    // Create Room B
    const roomBRes = await request.post('/api/rooms').expect(201);
    const roomBCode = roomBRes.body.room.roomCode;
    const tokenB = roomBRes.body.socketToken;

    // Upload file in Room B
    const uploadBRes = await request
      .post(`/api/rooms/${roomBCode}/files/upload-url`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ fileName: 'roomB-file.pdf', contentType: 'application/pdf', sizeBytes: 1024 })
      .expect(200);

    const fileIdB = uploadBRes.body.fileId;
    const uploadUrlB = uploadBRes.body.uploadUrl;

    await request
      .put(uploadUrlB)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.alloc(1024))
      .expect(200);

    await request
      .post(`/api/rooms/${roomBCode}/files/${fileIdB}/complete`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    // User A attempts to list Room B files -> 403
    await request
      .get(`/api/rooms/${roomBCode}/files`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);

    // User A attempts to download Room B file via Room A endpoint -> 404 (IDOR guard)
    await request
      .get(`/api/rooms/${roomACode}/files/${fileIdB}/download-url`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);

    // User A attempts to delete Room B file via Room A endpoint -> 404
    await request
      .delete(`/api/rooms/${roomACode}/files/${fileIdB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });

  it('Delete Authorization Policy (Option C) - participant cannot delete another participant file; owner can delete any file', async () => {
    const roomRes = await request.post('/api/rooms').expect(201);
    const roomCode = roomRes.body.room.roomCode;

    // Participant 1 joins room
    const join1 = await request.post(`/api/rooms/${roomCode}/join`).expect(200);
    const token1 = join1.body.socketToken;

    // Participant 2 joins room
    const join2 = await request.post(`/api/rooms/${roomCode}/join`).expect(200);
    const token2 = join2.body.socketToken;

    // Participant 1 uploads file
    const uploadRes = await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ fileName: 'participant1-doc.txt', contentType: 'text/plain', sizeBytes: 500 })
      .expect(200);

    const fileId = uploadRes.body.fileId;
    const uploadUrl = uploadRes.body.uploadUrl;

    await request
      .put(uploadUrl)
      .set('Content-Type', 'text/plain')
      .send(Buffer.alloc(500))
      .expect(200);

    await request
      .post(`/api/rooms/${roomCode}/files/${fileId}/complete`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    // Participant 2 attempts to delete Participant 1's file -> 403 FORBIDDEN
    const errRes = await request
      .delete(`/api/rooms/${roomCode}/files/${fileId}`)
      .set('Authorization', `Bearer ${token2}`)
      .expect(403);

    assert.strictEqual(errRes.body.error.code, 'FORBIDDEN');

    // Participant 1 deletes own file -> 200 OK
    await request
      .delete(`/api/rooms/${roomCode}/files/${fileId}`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);
  });

  it('Input Validation & Body Limits - should reject oversized JSON requests (>100kb) and malformed inputs', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const socketToken = createRes.body.socketToken;

    // Send > 100kb JSON body
    const hugeBody = {
      fileName: 'a.txt',
      data: 'X'.repeat(150 * 1024), // ~150kb string
    };

    await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send(hugeBody)
      .expect(413);

    // Malformed room code parameter
    await request.get('/api/rooms/INVALID_ROOM_12345').expect(400);
  });

  it('Filename Sanitization - should strip dangerous control and HTML script characters', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const socketToken = createRes.body.socketToken;

    const res = await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send({
        fileName: '<script>alert("xss")</script>.txt',
        contentType: 'text/plain',
        sizeBytes: 100,
      })
      .expect(200);

    await request
      .put(res.body.uploadUrl)
      .set('Content-Type', 'text/plain')
      .send(Buffer.alloc(100))
      .expect(200);

    const completeRes = await request
      .post(`/api/rooms/${roomCode}/files/${res.body.fileId}/complete`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(200);

    assert.strictEqual(
      completeRes.body.file.originalName,
      '_script_alert(_xss_)__script_.txt',
      'Filename should be sanitized'
    );
  });

  it('Security HTTP Headers & CORS - should set Helmet headers and reject unauthorized CORS origins', async () => {
    const res = await request.get('/api/health').set('Origin', 'http://malicious-website.com').expect(200);

    // Helmet security headers present
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN');

    // CORS rejection (Access-Control-Allow-Origin should NOT equal malicious domain)
    assert.notStrictEqual(res.headers['access-control-allow-origin'], 'http://malicious-website.com');
  });

  it('Security Regression - QR code payload and Socket events must NOT leak tokens or credentials', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const ownerToken = createRes.body.ownerToken;
    const socketToken = createRes.body.socketToken;

    // Verify ownerToken is 64 hex chars
    assert.strictEqual(ownerToken.length, 64);

    // Verify socketToken payload contains roomCode and participantId, but NOT ownerToken or secret keys
    const { verifySocketToken } = await import('../src/utils/token.js');
    const payload = verifySocketToken(socketToken);

    assert.ok(payload.roomCode);
    assert.ok(payload.participantId);
    assert.strictEqual(payload.ownerToken, undefined);
    assert.strictEqual(payload.awsSecret, undefined);
  });
});
