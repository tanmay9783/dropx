import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import supertest from 'supertest';
import app from '../src/app.js';
import { initDb } from '../src/db/index.js';
import { initSocketIo } from '../src/sockets/socketHandler.js';

let httpServer;
let baseUrl;
let request;

describe('Resumable / Chunked Upload Integration Tests', () => {
  before(async () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173';
    process.env.ROOM_TTL_MINUTES = '120';
    process.env.MAX_FILE_SIZE_MB = '100';
    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_DIR = './data/test_uploads_chunk';

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

  it('Chunked Upload Flow - Inits, uploads chunks in pieces, queries status, and completes assembly', async () => {
    // 1. Create Room
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const socketToken = createRes.body.socketToken;

    // 2. Request Upload Slot
    const fileContent = 'A'.repeat(500) + 'B'.repeat(500) + 'C'.repeat(500); // 1500 bytes total
    const uploadSlot = await request
      .post(`/api/rooms/${roomCode}/files/upload-url`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send({
        fileName: 'chunked-data.txt',
        contentType: 'text/plain',
        sizeBytes: 1500,
      })
      .expect(200);

    const fileId = uploadSlot.body.fileId;

    // 3. Upload 3 Chunks of 500 bytes each
    const chunk0 = Buffer.from('A'.repeat(500));
    const chunk1 = Buffer.from('B'.repeat(500));
    const chunk2 = Buffer.from('C'.repeat(500));

    // Upload chunk 0
    await request
      .put(`/api/rooms/${roomCode}/files/${fileId}/chunk?index=0`)
      .set('Content-Type', 'application/octet-stream')
      .send(chunk0)
      .expect(200);

    // Query chunks status - should have [0]
    const status1 = await request
      .get(`/api/rooms/${roomCode}/files/${fileId}/chunks`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(200);
    assert.deepStrictEqual(status1.body.uploadedChunks, [0]);

    // Upload chunk 1
    await request
      .put(`/api/rooms/${roomCode}/files/${fileId}/chunk?index=1`)
      .set('Content-Type', 'application/octet-stream')
      .send(chunk1)
      .expect(200);

    // Upload chunk 2
    await request
      .put(`/api/rooms/${roomCode}/files/${fileId}/chunk?index=2`)
      .set('Content-Type', 'application/octet-stream')
      .send(chunk2)
      .expect(200);

    // Query chunks status - should have [0, 1, 2]
    const status2 = await request
      .get(`/api/rooms/${roomCode}/files/${fileId}/chunks`)
      .set('Authorization', `Bearer ${socketToken}`)
      .expect(200);
    assert.deepStrictEqual(status2.body.uploadedChunks, [0, 1, 2]);

    // 4. Complete Chunked Assembly
    const completeRes = await request
      .post(`/api/rooms/${roomCode}/files/${fileId}/chunked/complete`)
      .set('Authorization', `Bearer ${socketToken}`)
      .send({ totalChunks: 3 })
      .expect(200);

    assert.strictEqual(completeRes.body.file.id, fileId);
    assert.strictEqual(completeRes.body.file.sizeBytes, 1500);

    // 5. Download and verify assembled payload matches original bytes
    const dlRes = await request
      .get(`/api/rooms/${roomCode}/files/${fileId}/download`)
      .expect(200);

    assert.strictEqual(dlRes.text, fileContent);
  });
});

