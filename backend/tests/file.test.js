import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import supertest from 'supertest';
import { io as ClientIo } from 'socket.io-client';
import app from '../src/app.js';
import { initDb, getDb } from '../src/db/index.js';
import { initSocketIo } from '../src/sockets/socketHandler.js';
import { fileService } from '../src/services/fileService.js';
import { localStorage } from '../src/services/storage/localStorage.js';

let httpServer;
let baseUrl;
let request;

describe('Local Storage File Transfer Integration Tests', () => {
  before(async () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173';
    process.env.ROOM_TTL_MINUTES = '120';
    process.env.MAX_FILE_SIZE_MB = '100';
    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_DIR = './data/test_uploads_file';

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

  it('File Upload & Download Flow - Request upload URL, PUT upload content, complete upload, fetch download URL, and delete', async () => {
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
    const testContent = 'DropX Local Storage test content';
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
    const uploadUrl = uploadUrlRes.body.uploadUrl;
    const objectKey = uploadUrlRes.body.objectKey;

    // Direct local PUT upload
    await request
      .put(uploadUrl)
      .set('Content-Type', 'text/plain')
      .send(Buffer.from(testContent))
      .expect(200);

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

  it('Room Expiration Cleanup - should remove local files when room expires', async () => {
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
    const uploadUrl = uploadUrlRes.body.uploadUrl;
    const objectKey = uploadUrlRes.body.objectKey;

    await request
      .put(uploadUrl)
      .set('Content-Type', 'text/plain')
      .send(Buffer.alloc(100))
      .expect(200);

    // Complete upload
    await request
      .post(`/api/rooms/${roomCode}/files/${fileId}/complete`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(200);

    const checkExistBefore = await localStorage.verifyObjectExists({ objectKey });
    assert.strictEqual(checkExistBefore.exists, true, 'Local object should exist after upload completion');

    // Expire room in DB
    const pastIso = new Date(Date.now() - 10000).toISOString();
    const db = getDb();
    await db.query(`UPDATE rooms SET expires_at = $1 WHERE room_code = $2`, [pastIso, roomCode]);

    // Run file cleanup
    const cleanedCount = await fileService.cleanupExpiredFiles();
    assert.ok(cleanedCount >= 1, 'Cleanup should delete expired local object');

    const checkExistAfter = await localStorage.verifyObjectExists({ objectKey });
    assert.strictEqual(checkExistAfter.exists, false, 'Local object should be removed from storage');

    // Request download URL attempt should fail with 410 ROOM_EXPIRED
    await request
      .get(`/api/rooms/${roomCode}/files/${fileId}/download-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(410);
  });
});
