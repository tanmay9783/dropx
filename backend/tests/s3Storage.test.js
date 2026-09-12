import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import supertest from 'supertest';
import { io as ClientIo } from 'socket.io-client';
import app from '../src/app.js';
import { initDb, getDb } from '../src/db/index.js';
import { initSocketIo } from '../src/sockets/socketHandler.js';
import { s3Storage } from '../src/services/storage/s3Storage.js';
import { fileService } from '../src/services/fileService.js';

let httpServer;
let baseUrl;
let request;

// Mock S3 in-memory object store for deterministic testing without live AWS credentials
const mockS3Objects = new Map();

describe('Amazon S3 Storage & Presigned URL Integration Tests', () => {
  before(async () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173';
    process.env.ROOM_TTL_MINUTES = '120';
    process.env.MAX_FILE_SIZE_MB = '100';
    process.env.STORAGE_PROVIDER = 's3';
    process.env.S3_BUCKET_NAME = 'dropx-files-dev';
    process.env.AWS_REGION = 'ap-south-1';

    await initDb();

    // Mock S3 Storage methods to return deterministic presigned URLs and simulate HeadObject / DeleteObject
    s3Storage.createUploadPresignedUrl = async ({ roomCode, fileId, contentType }) => {
      const objectKey = s3Storage.getObjectKey(roomCode, fileId);
      const uploadUrl = `https://dropx-files-dev.s3.ap-south-1.amazonaws.com/${objectKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=300`;
      return {
        uploadUrl,
        objectKey,
        expiresIn: 300,
      };
    };

    s3Storage.verifyObjectExists = async ({ objectKey }) => {
      if (mockS3Objects.has(objectKey)) {
        const item = mockS3Objects.get(objectKey);
        return { exists: true, sizeBytes: item.sizeBytes, mimeType: item.contentType };
      }
      return { exists: false, sizeBytes: 0 };
    };

    s3Storage.createDownloadPresignedUrl = async ({ objectKey, originalName, contentType }) => {
      const downloadUrl = `https://dropx-files-dev.s3.ap-south-1.amazonaws.com/${objectKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&response-content-disposition=attachment&X-Amz-Expires=300`;
      return {
        downloadUrl,
        expiresIn: 300,
      };
    };

    s3Storage.deleteObject = async ({ objectKey }) => {
      mockS3Objects.delete(objectKey);
      return { success: true };
    };

    s3Storage.deleteObjects = async ({ objectKeys }) => {
      for (const key of objectKeys) {
        mockS3Objects.delete(key);
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

  it('POST /upload-url - should generate presigned upload URL and object key', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const socketToken = createRes.body.socketToken;

    const res = await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send({
        fileName: 'report.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      })
      .expect(200);

    assert.ok(res.body.fileId, 'Should return fileId');
    assert.ok(res.body.uploadUrl, 'Should return uploadUrl');
    assert.ok(res.body.objectKey.startsWith(`rooms/${roomCode}/`), 'Object key should be rooms/<roomCode>/<fileId>');
    assert.strictEqual(res.body.expiresIn, 300);
  });

  it('S3 Presigned Flow - Complete Upload via HeadObject verification & GET presigned download URL', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const socketToken = createRes.body.socketToken;

    // 1. Request presigned upload URL
    const uploadUrlRes = await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send({
        fileName: 'photo.png',
        contentType: 'image/png',
        sizeBytes: 2048,
      })
      .expect(200);

    const fileId = uploadUrlRes.body.fileId;
    const objectKey = uploadUrlRes.body.objectKey;

    // Simulate direct browser upload to S3 by adding to mock S3 objects
    mockS3Objects.set(objectKey, { sizeBytes: 2048, contentType: 'image/png' });

    // Connect socket client for real-time metadata verification
    const socketClient = ClientIo(baseUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token: socketToken, roomCode },
    });

    const fileUploadedPromise = new Promise((resolve) => {
      socketClient.on('file-uploaded', (data) => resolve(data));
    });

    // 2. Complete upload (triggers HeadObject verification)
    const completeRes = await request
      .post(`/api/rooms/${roomCode}/files/${fileId}/complete`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(200);

    assert.ok(completeRes.body.file);
    assert.strictEqual(completeRes.body.file.id, fileId);
    assert.strictEqual(completeRes.body.file.originalName, 'photo.png');
    assert.strictEqual(completeRes.body.file.sizeBytes, 2048);

    // Verify Socket.IO event received metadata only
    const socketEventData = await fileUploadedPromise;
    assert.strictEqual(socketEventData.id, fileId);
    assert.strictEqual(socketEventData.uploadUrl, undefined, 'Socket event MUST NOT include presigned upload URL');

    // 3. Request presigned download URL
    const downloadUrlRes = await request
      .get(`/api/rooms/${roomCode}/files/${fileId}/download-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(200);

    assert.ok(downloadUrlRes.body.downloadUrl, 'Should return downloadUrl');
    assert.strictEqual(downloadUrlRes.body.expiresIn, 300);
    assert.strictEqual(downloadUrlRes.body.fileName, 'photo.png');

    // 4. Delete file
    await request
      .delete(`/api/rooms/${roomCode}/files/${fileId}`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(200);

    assert.strictEqual(mockS3Objects.has(objectKey), false, 'File should be removed from S3 mock on delete');

    socketClient.close();
  });

  it('Security - should reject oversized file uploads and uncompleted uploads', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const socketToken = createRes.body.socketToken;

    // Oversized request (150MB > 100MB max limit)
    await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send({
        fileName: 'huge-video.mp4',
        contentType: 'video/mp4',
        sizeBytes: 150 * 1024 * 1024,
      })
      .expect(413);

    // Uncompleted upload verification failure
    const uploadUrlRes = await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send({
        fileName: 'never-uploaded.txt',
        contentType: 'text/plain',
        sizeBytes: 100,
      })
      .expect(200);

    // Do NOT add to mockS3Objects (simulating failed/abandoned direct browser upload)
    await request
      .post(`/api/rooms/${roomCode}/files/${uploadUrlRes.body.fileId}/complete`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(404);
  });
});
