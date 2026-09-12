import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import supertest from 'supertest';
import { io as ClientIo } from 'socket.io-client';
import app from '../src/app.js';
import { initDb, getDb } from '../src/db/index.js';
import { initSocketIo } from '../src/sockets/socketHandler.js';
import { fileService } from '../src/services/fileService.js';
import { s3Storage } from '../src/services/storage/s3Storage.js';

let httpServer;
let baseUrl;
let request;

// Mock S3 in-memory store for integration test
const mockS3Store = new Map();

describe('S3 File Transfer Integration Tests', () => {
  before(async () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173';
    process.env.ROOM_TTL_MINUTES = '120';
    process.env.MAX_FILE_SIZE_MB = '100';
    process.env.STORAGE_PROVIDER = 's3';
    process.env.S3_BUCKET_NAME = 'dropx-files-dev';
    process.env.AWS_REGION = 'ap-south-1';

    await initDb();

    // Mock s3Storage methods for testing
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

  it('File Presigned Upload & Download Flow - Request upload URL, complete upload, fetch download URL, and delete', async () => {
    // 1. Create Room
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const socketToken = createRes.body.socketToken;

    // Connect socket to listen to file-uploaded event
    const socketClient = ClientIo(baseUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token: socketToken, roomCode },
    });

    const fileUploadedPromise = new Promise((resolve) => {
      socketClient.on('file-uploaded', (data) => resolve(data));
    });

    // 2. Request Upload URL
    const testContent = 'DropX Phase 6 S3 presigned URL test content';
    const uploadUrlRes = await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send({
        fileName: 'test-document.txt',
        contentType: 'text/plain',
        sizeBytes: Buffer.from(testContent).length,
      })
      .expect(200);

    assert.ok(uploadUrlRes.body.uploadUrl);
    assert.ok(uploadUrlRes.body.fileId);
    const fileId = uploadUrlRes.body.fileId;
    const objectKey = uploadUrlRes.body.objectKey;

    // Simulate direct browser S3 PUT upload
    mockS3Store.set(objectKey, {
      sizeBytes: Buffer.from(testContent).length,
      contentType: 'text/plain',
    });

    // 3. Complete Upload
    const completeRes = await request
      .post(`/api/rooms/${roomCode}/files/${fileId}/complete`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(200);

    assert.ok(completeRes.body.file);
    assert.strictEqual(completeRes.body.file.id, fileId);
    assert.strictEqual(completeRes.body.file.originalName, 'test-document.txt');

    // Verify Socket.IO event received
    const socketEventData = await fileUploadedPromise;
    assert.strictEqual(socketEventData.id, fileId);
    assert.strictEqual(socketEventData.originalName, 'test-document.txt');

    // 4. Fetch shared files list
    const getRes = await request
      .get(`/api/rooms/${roomCode}/files`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(200);

    assert.strictEqual(getRes.body.files.length, 1);
    assert.strictEqual(getRes.body.files[0].id, fileId);

    // 5. Request Download Presigned URL
    const downloadRes = await request
      .get(`/api/rooms/${roomCode}/files/${fileId}/download-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(200);

    assert.ok(downloadRes.body.downloadUrl);
    assert.strictEqual(downloadRes.body.fileName, 'test-document.txt');

    // 6. Delete file
    const fileDeletedPromise = new Promise((resolve) => {
      socketClient.on('file-deleted', (data) => resolve(data));
    });

    await request
      .delete(`/api/rooms/${roomCode}/files/${fileId}`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(200);

    const deleteEventData = await fileDeletedPromise;
    assert.strictEqual(deleteEventData.fileId, fileId);

    // Verify file is no longer in list
    const getAfterDelete = await request
      .get(`/api/rooms/${roomCode}/files`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(200);
    assert.strictEqual(getAfterDelete.body.files.length, 0);

    socketClient.close();
  });

  it('File Security - should reject unauthorized upload/download requests and bad room access', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const socketToken = createRes.body.socketToken;

    // 1. Upload URL request without authorization header
    await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .send({ fileName: 'sample.txt' })
      .expect(401);

    // 2. Upload URL request with invalid token
    await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', 'Bearer invalidtoken')
      .send({ fileName: 'sample.txt' })
      .expect(401);

    // 3. Upload URL request to non-existent room
    await request
      .post('/api/rooms/ZZZZZZ/files/upload-url')
      .set('Authorization', `Bearer ${socketToken}`)
      .send({ fileName: 'sample.txt' })
      .expect(403);
  });

  it('Room Expiration Cleanup - should remove S3 objects when room expires', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const socketToken = createRes.body.socketToken;

    // Request upload URL
    const uploadUrlRes = await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send({
        fileName: 'expire-test.txt',
        contentType: 'text/plain',
        sizeBytes: 100,
      })
      .expect(200);

    const fileId = uploadUrlRes.body.fileId;
    const objectKey = uploadUrlRes.body.objectKey;

    mockS3Store.set(objectKey, { sizeBytes: 100, contentType: 'text/plain' });

    // Complete upload
    await request
      .post(`/api/rooms/${roomCode}/files/${fileId}/complete`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(200);

    assert.ok(mockS3Store.has(objectKey), 'S3 object should exist after upload completion');

    // Expire room in DB
    const pastIso = new Date(Date.now() - 10000).toISOString();
    const db = getDb();
    await db.query(`UPDATE rooms SET expires_at = $1 WHERE room_code = $2`, [pastIso, roomCode]);

    // Run file cleanup
    const cleanedCount = await fileService.cleanupExpiredFiles();
    assert.ok(cleanedCount >= 1, 'Cleanup should delete expired S3 object');

    assert.strictEqual(mockS3Store.has(objectKey), false, 'S3 object should be removed from storage');

    // Request download URL attempt should fail with 410 ROOM_EXPIRED
    await request
      .get(`/api/rooms/${roomCode}/files/${fileId}/download-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(410);
  });
});
