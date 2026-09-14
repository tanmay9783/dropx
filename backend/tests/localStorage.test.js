import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import supertest from 'supertest';
import { io as ClientIo } from 'socket.io-client';
import app from '../src/app.js';
import { initDb } from '../src/db/index.js';
import { initSocketIo } from '../src/sockets/socketHandler.js';
import { localStorage } from '../src/services/storage/localStorage.js';

let httpServer;
let baseUrl;
let request;

describe('Local File Storage & Upload/Download Integration Tests', () => {
  before(async () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173';
    process.env.ROOM_TTL_MINUTES = '120';
    process.env.MAX_FILE_SIZE_MB = '100';
    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_DIR = './data/test_uploads';

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

  it('POST /upload-url - should generate upload URL and object key', async () => {
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

  it('Local Storage Upload Flow - Upload file content, Complete upload & Download file', async () => {
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const socketToken = createRes.body.socketToken;

    // 1. Request upload URL
    const uploadUrlRes = await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send({
        fileName: 'hello.txt',
        contentType: 'text/plain',
        sizeBytes: 12,
      })
      .expect(200);

    const fileId = uploadUrlRes.body.fileId;
    const uploadUrl = uploadUrlRes.body.uploadUrl;

    // 2. Upload file content via PUT
    await request
      .put(uploadUrl)
      .set('Content-Type', 'text/plain')
      .send(Buffer.from('Hello World!'))
      .expect(200);

    // Connect socket client for real-time metadata verification
    const socketClient = ClientIo(baseUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token: socketToken, roomCode },
    });

    const fileUploadedPromise = new Promise((resolve) => {
      socketClient.on('file-uploaded', (data) => resolve(data));
    });

    // 3. Complete upload
    const completeRes = await request
      .post(`/api/rooms/${roomCode}/files/${fileId}/complete`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(200);

    assert.ok(completeRes.body.file);
    assert.strictEqual(completeRes.body.file.id, fileId);
    assert.strictEqual(completeRes.body.file.originalName, 'hello.txt');
    assert.strictEqual(completeRes.body.file.sizeBytes, 12);

    // Verify Socket.IO event received metadata only
    const socketEventData = await fileUploadedPromise;
    assert.strictEqual(socketEventData.id, fileId);

    // 4. Request download URL
    const downloadUrlRes = await request
      .get(`/api/rooms/${roomCode}/files/${fileId}/download-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(200);

    assert.ok(downloadUrlRes.body.downloadUrl, 'Should return downloadUrl');
    assert.strictEqual(downloadUrlRes.body.fileName, 'hello.txt');

    // 5. Download file content
    const downloadContentRes = await request
      .get(downloadUrlRes.body.downloadUrl)
      .expect(200);

    assert.strictEqual(downloadContentRes.text, 'Hello World!');

    // 6. Delete file
    await request
      .delete(`/api/rooms/${roomCode}/files/${fileId}`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(200);

    const existsAfterDelete = await localStorage.verifyObjectExists({ objectKey: uploadUrlRes.body.objectKey });
    assert.strictEqual(existsAfterDelete.exists, false, 'File should be removed from local storage on delete');

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

    // Do NOT upload content, call complete directly
    await request
      .post(`/api/rooms/${roomCode}/files/${uploadUrlRes.body.fileId}/complete`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(404);
  });
});
