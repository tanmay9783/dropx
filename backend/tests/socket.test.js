import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import supertest from 'supertest';
import { io as ClientIo } from 'socket.io-client';
import app from '../src/app.js';
import { initDb, getDb } from '../src/db/index.js';
import { initSocketIo } from '../src/sockets/socketHandler.js';

let httpServer;
let serverPort;
let baseUrl;
let request;

describe('Socket.IO Real-Time Integration Tests', () => {
  before(async () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173';
    process.env.ROOM_TTL_MINUTES = '120';
    await initDb();

    httpServer = http.createServer(app);
    initSocketIo(httpServer);

    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        serverPort = httpServer.address().port;
        baseUrl = `http://127.0.0.1:${serverPort}`;
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

  it('Socket Auth - should reject connection without auth tokens', async () => {
    const client = ClientIo(baseUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: false,
    });

    const error = await new Promise((resolve) => {
      client.on('connect_error', (err) => resolve(err));
    });

    assert.ok(error, 'Connection error should be triggered');
    assert.strictEqual(error.message, 'Authentication failed: Missing token or roomCode');
    client.close();
  });

  it('Socket Auth - should reject invalid socket token', async () => {
    const client = ClientIo(baseUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token: 'invalid.token.str', roomCode: 'X7K9P2' },
      reconnection: false,
    });

    const error = await new Promise((resolve) => {
      client.on('connect_error', (err) => resolve(err));
    });

    assert.ok(error);
    assert.strictEqual(error.message, 'Authentication failed: Invalid or expired socket token');
    client.close();
  });

  it('Socket Flow - authorized owner and participant join, exchange state & events', async () => {
    // 1. Create Room via REST
    const createRes = await request.post('/api/rooms').expect(201);
    const roomCode = createRes.body.room.roomCode;
    const ownerToken = createRes.body.ownerToken;
    const ownerSocketToken = createRes.body.socketToken;

    assert.ok(ownerSocketToken, 'createRoom should return socketToken');

    // 2. Owner connects via Socket.IO
    const ownerClient = ClientIo(baseUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token: ownerSocketToken, roomCode },
    });

    const ownerState = await new Promise((resolve) => {
      ownerClient.on('room-state', (state) => resolve(state));
    });

    assert.strictEqual(ownerState.roomCode, roomCode);
    assert.strictEqual(ownerState.participantCount, 1);

    // 3. Participant joins via REST
    const joinRes = await request.post(`/api/rooms/${roomCode}/join`).expect(200);
    const participantSocketToken = joinRes.body.socketToken;

    assert.ok(participantSocketToken, 'joinRoom should return socketToken');

    // Setup listener on owner for user-joined event
    const userJoinedPromise = new Promise((resolve) => {
      ownerClient.on('user-joined', (data) => resolve(data));
    });

    // 4. Participant connects via Socket.IO
    const participantClient = ClientIo(baseUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token: participantSocketToken, roomCode },
    });

    const userJoinedEvent = await userJoinedPromise;
    assert.strictEqual(userJoinedEvent.participantCount, 2);

    // Setup listener on owner for user-left event
    const userLeftPromise = new Promise((resolve) => {
      ownerClient.on('user-left', (data) => resolve(data));
    });

    // 5. Participant disconnects
    participantClient.close();

    const userLeftEvent = await userLeftPromise;
    assert.strictEqual(userLeftEvent.participantCount, 1);

    // 6. Test room-expired event on Destroy Room
    const roomExpiredPromise = new Promise((resolve) => {
      ownerClient.on('room-expired', (data) => resolve(data));
    });

    await request
      .delete(`/api/rooms/${roomCode}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const expiredEvent = await roomExpiredPromise;
    assert.strictEqual(expiredEvent.roomCode, roomCode);

    ownerClient.close();
  });
});
