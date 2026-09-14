import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import supertest from 'supertest';
import app from '../src/app.js';
import { initDb, getDb } from '../src/db/index.js';
import { initSocketIo } from '../src/sockets/socketHandler.js';
import { fileService } from '../src/services/fileService.js';
import { localStorage } from '../src/services/storage/localStorage.js';
import { fileRepository } from '../src/db/fileRepository.js';
import { env } from '../src/config/env.js';

let httpServer;
let baseUrl;
let request;

describe('Phase 7 — Cleanup, Lifecycle & Reliability Hardening Tests', () => {
  before(async () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173';
    process.env.ROOM_TTL_MINUTES = '120';
    process.env.MAX_FILE_SIZE_MB = '100';
    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_DIR = './data/test_uploads_life';

    env.PENDING_FILE_TTL_MINUTES = 1;
    env.MAX_FILES_PER_ROOM = 3;
    env.MAX_ROOM_STORAGE_BYTES = 10485760; // 10 MB limit for test

    await initDb();
    const db = getDb();
    await db.query('DELETE FROM files');
    await db.query('DELETE FROM rooms');

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

  it('Stale Pending File Cleanup - should cleanup pending upload records older than TTL', async () => {
    const db = getDb();
    await db.query('DELETE FROM files');
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const socketToken = createRes.body.socketToken;

    // 1. Create a pending file record
    const uploadUrlRes = await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send({
        fileName: 'abandoned.txt',
        contentType: 'text/plain',
        sizeBytes: 500,
      })
      .expect(200);

    const fileId = uploadUrlRes.body.fileId;
    const objectKey = uploadUrlRes.body.objectKey;

    await request
      .put(uploadUrlRes.body.uploadUrl)
      .set('Content-Type', 'text/plain')
      .send(Buffer.alloc(500))
      .expect(200);

    // 2. Artificially age the pending file created_at to 10 minutes ago
    const tenMinsAgoIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await db.query(`UPDATE files SET created_at = $1 WHERE id = $2`, [tenMinsAgoIso, fileId]);

    // 3. Trigger pending file cleanup
    const cleanedCount = await fileService.cleanupPendingFiles();
    assert.strictEqual(cleanedCount, 1, 'Should cleanup 1 stale pending file');

    const existCheck = await localStorage.verifyObjectExists({ objectKey });
    assert.strictEqual(existCheck.exists, false, 'Abandoned file should be deleted from local storage');

    // Check DB status updated to expired
    const record = await fileRepository.findFileById(fileId, roomCode);
    assert.strictEqual(record.status, 'expired');
  });

  it('Limits - should enforce MAX_FILES_PER_ROOM limit', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const socketToken = createRes.body.socketToken;

    // Upload 3 files (max allowed in test env is 3)
    for (let i = 1; i <= 3; i++) {
      const uploadUrlRes = await request
        .post(`/api/rooms/${roomCode}/files/upload-url`)
        .set('Authorization', `Bearer ${socketToken}`)
        .send({
          fileName: `file${i}.txt`,
          contentType: 'text/plain',
          sizeBytes: 100,
        })
        .expect(200);

      await request
        .put(uploadUrlRes.body.uploadUrl)
        .set('Content-Type', 'text/plain')
        .send(Buffer.alloc(100))
        .expect(200);

      await request
        .post(`/api/rooms/${roomCode}/files/${uploadUrlRes.body.fileId}/complete`)
        .set('Authorization', `Bearer ${socketToken}`)
        .expect(200);
    }

    // 4th file should be rejected with 400 ROOM_FILE_LIMIT_EXCEEDED
    const errRes = await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send({
        fileName: 'file4.txt',
        contentType: 'text/plain',
        sizeBytes: 100,
      })
      .expect(400);

    assert.strictEqual(errRes.body.error.code, 'ROOM_FILE_LIMIT_EXCEEDED');
  });

  it('Limits - should enforce MAX_ROOM_STORAGE_BYTES limit', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const socketToken = createRes.body.socketToken;

    // Attempt file exceeding 10 MB limit (e.g. 11 MB = 11,534,336 bytes)
    const errRes = await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send({
        fileName: 'large.iso',
        contentType: 'application/octet-stream',
        sizeBytes: 11 * 1024 * 1024,
      })
      .expect(400);

    assert.strictEqual(errRes.body.error.code, 'ROOM_STORAGE_LIMIT_EXCEEDED');
  });

  it('Limits - should reject invalid file parameters', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const socketToken = createRes.body.socketToken;

    // 0 bytes file
    await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send({
        fileName: 'empty.txt',
        contentType: 'text/plain',
        sizeBytes: 0,
      })
      .expect(400);

    // Empty filename
    await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send({
        fileName: ' ',
        contentType: 'text/plain',
        sizeBytes: 100,
      })
      .expect(400);
  });

  it('Race Condition - /complete after room expiration should delete local object and reject with 410', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const socketToken = createRes.body.socketToken;

    // 1. Request upload URL
    const uploadUrlRes = await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send({
        fileName: 'race-test.txt',
        contentType: 'text/plain',
        sizeBytes: 200,
      })
      .expect(200);

    const fileId = uploadUrlRes.body.fileId;
    const objectKey = uploadUrlRes.body.objectKey;

    await request
      .put(uploadUrlRes.body.uploadUrl)
      .set('Content-Type', 'text/plain')
      .send(Buffer.alloc(200))
      .expect(200);

    // 2. Room expires mid-upload
    const db = getDb();
    const pastIso = new Date(Date.now() - 10000).toISOString();
    await db.query(`UPDATE rooms SET expires_at = $1 WHERE room_code = $2`, [pastIso, roomCode]);

    // 3. Call /complete
    await request
      .post(`/api/rooms/${roomCode}/files/${fileId}/complete`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(410);

    // Verify local object was cleaned up
    const checkExist = await localStorage.verifyObjectExists({ objectKey });
    assert.strictEqual(checkExist.exists, false, 'Uploaded object must be deleted if room expired mid-upload');
  });

  it('Idempotency & Resilience - repeated cleanup runs without crashing even on storage error', async () => {
    // Run cleanup when no expired files exist
    const count1 = await fileService.cleanupExpiredFiles();
    assert.strictEqual(typeof count1, 'number');

    // Run cleanup again
    const count2 = await fileService.cleanupExpiredFiles();
    assert.strictEqual(typeof count2, 'number');

    // Simulate delete throwing error for an object
    const originalDeleteObject = localStorage.deleteObject;
    localStorage.deleteObject = async () => {
      throw new Error('Simulated Storage Disruption');
    };

    // Attempt pending cleanup - should handle error gracefully without throwing
    const countAfterError = await fileService.cleanupPendingFiles();
    assert.strictEqual(typeof countAfterError, 'number');

    // Restore original deleteObject
    localStorage.deleteObject = originalDeleteObject;
  });
});
