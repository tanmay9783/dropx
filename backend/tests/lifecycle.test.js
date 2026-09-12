import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import supertest from 'supertest';
import app from '../src/app.js';
import { initDb, getDb } from '../src/db/index.js';
import { initSocketIo } from '../src/sockets/socketHandler.js';
import { fileService } from '../src/services/fileService.js';
import { s3Storage } from '../src/services/storage/s3Storage.js';
import { fileRepository } from '../src/db/fileRepository.js';

import { env } from '../src/config/env.js';

let httpServer;
let baseUrl;
let request;

// Mock in-memory S3 store
const mockS3Store = new Map();

describe('Phase 7 — Cleanup, Lifecycle & Reliability Hardening Tests', () => {
  before(async () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173';
    process.env.ROOM_TTL_MINUTES = '120';
    process.env.MAX_FILE_SIZE_MB = '100';
    process.env.STORAGE_PROVIDER = 's3';
    process.env.S3_BUCKET_NAME = 'dropx-files-dev';
    process.env.AWS_REGION = 'ap-south-1';

    env.PENDING_FILE_TTL_MINUTES = 1;
    env.MAX_FILES_PER_ROOM = 3;
    env.MAX_ROOM_STORAGE_BYTES = 10485760; // 10 MB limit for test

    await initDb();

    s3Storage.createUploadPresignedUrl = async ({ roomCode, fileId, contentType }) => {
      const objectKey = s3Storage.getObjectKey(roomCode, fileId);
      return {
        uploadUrl: `https://dropx-files-dev.s3.ap-south-1.amazonaws.com/${objectKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=300`,
        objectKey,
        expiresIn: 300,
      };
    };

    s3Storage.verifyObjectExists = async ({ objectKey }) => {
      if (mockS3Store.has(objectKey)) {
        const item = mockS3Store.get(objectKey);
        return { exists: true, sizeBytes: item.sizeBytes, mimeType: item.contentType };
      }
      return { exists: false, sizeBytes: 0 };
    };

    s3Storage.createDownloadPresignedUrl = async ({ objectKey, originalName, contentType }) => {
      return {
        downloadUrl: `https://dropx-files-dev.s3.ap-south-1.amazonaws.com/${objectKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&response-content-disposition=attachment&X-Amz-Expires=300`,
        expiresIn: 300,
      };
    };

    s3Storage.deleteObject = async ({ objectKey }) => {
      mockS3Store.delete(objectKey);
      return { success: true };
    };

    s3Storage.deleteObjects = async ({ objectKeys }) => {
      for (const key of objectKeys) {
        mockS3Store.delete(key);
      }
      return { success: true };
    };

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

  it('Stale Pending Upload Cleanup - should clean up abandoned pending files after PENDING_FILE_TTL_MINUTES', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const socketToken = createRes.body.socketToken;

    // 1. Request presigned upload URL
    const uploadUrlRes = await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send({
        fileName: 'abandoned-file.txt',
        contentType: 'text/plain',
        sizeBytes: 500,
      })
      .expect(200);

    const fileId = uploadUrlRes.body.fileId;
    const objectKey = uploadUrlRes.body.objectKey;

    // Simulate file in S3, but /complete is NEVER called by browser
    mockS3Store.set(objectKey, { sizeBytes: 500, contentType: 'text/plain' });

    // Verify pending file is NOT in GET /files
    const listRes = await request
      .get(`/api/rooms/${roomCode}/files`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(200);
    assert.strictEqual(listRes.body.files.length, 0, 'Pending files must not appear in active file listing');

    // Manually backdate created_at in DB to simulate stale pending file (> 1 hour old)
    const oldTimestamp = new Date(Date.now() - 3600000).toISOString();
    const db = getDb();
    await db.query(`UPDATE files SET created_at = $1 WHERE id = $2`, [oldTimestamp, fileId]);

    // Run cleanup
    const cleanedCount = await fileService.cleanupPendingFiles();
    assert.ok(cleanedCount >= 1, 'Should clean at least 1 stale pending file');
    assert.strictEqual(mockS3Store.has(objectKey), false, 'Abandoned S3 object should be deleted');

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

      mockS3Store.set(uploadUrlRes.body.objectKey, { sizeBytes: 100, contentType: 'text/plain' });
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

  it('Race Condition - /complete after room expiration should delete S3 object and reject with 410', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const socketToken = createRes.body.socketToken;

    // 1. Request presigned upload URL
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

    mockS3Store.set(objectKey, { sizeBytes: 200, contentType: 'text/plain' });

    // 2. Room expires mid-upload
    const db = getDb();
    const pastIso = new Date(Date.now() - 10000).toISOString();
    await db.query(`UPDATE rooms SET expires_at = $1 WHERE room_code = $2`, [pastIso, roomCode]);

    // 3. Call /complete
    await request
      .post(`/api/rooms/${roomCode}/files/${fileId}/complete`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(410);

    // Verify S3 object was cleaned up
    assert.strictEqual(mockS3Store.has(objectKey), false, 'Uploaded S3 object must be deleted if room expired mid-upload');
  });

  it('Idempotency & Resilience - repeated cleanup runs without crashing even on S3 error', async () => {
    // Run cleanup when no expired files exist
    const count1 = await fileService.cleanupExpiredFiles();
    assert.strictEqual(typeof count1, 'number');

    // Run cleanup again
    const count2 = await fileService.cleanupExpiredFiles();
    assert.strictEqual(typeof count2, 'number');

    // Simulate S3 delete throwing error for an object
    const originalDeleteObject = s3Storage.deleteObject;
    s3Storage.deleteObject = async () => {
      throw new Error('Simulated S3 Network Disruption');
    };

    // Attempt pending cleanup - should handle error gracefully without throwing
    const countAfterError = await fileService.cleanupPendingFiles();
    assert.strictEqual(typeof countAfterError, 'number');

    // Restore original deleteObject
    s3Storage.deleteObject = originalDeleteObject;
  });
});
