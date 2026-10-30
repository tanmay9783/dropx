# DropX — Permanent Project Knowledge Base & System Architecture Reference

> **Confidential Technical Reference & Developer Guide**  
> *Purpose*: This document acts as an exhaustive, definitive knowledge base for engineers and future AI agents working on DropX. It documents internal data structures, runtime lifecycles, cryptographic protocols, database schemas, and architectural trade-offs without requiring preliminary codebase explanation.

---

## A. Project Identity & Domain Model

- **Project Name**: DropX
- **Repository**: `https://github.com/tanmay9783/dropx`
- **Author**: Tanmay Agrawal (`tanmay9783`, `tanmayagrawal0412@gmail.com`)
- **Category**: Ephemeral Cross-Device Data Synchronization & Zero-Knowledge Sharing Platform
- **Current Status**: Production-ready core (v1.0.0). Fully functional streaming REST API, WebSocket real-time presence hub, local ephemeral file storage sink, and progressive web application.
- **Core Value Proposition**: Cross-ecosystem (iOS, Android, Windows, Mac, Linux) file and clipboard sync with zero user registration, zero cloud permanence, memory-bounded server streaming, and browser-native AES-256-GCM Zero-Knowledge end-to-end encryption.

---

## B. Technology Inventory

| Technology | Verified Version | Layer / Module | Primary File Locations | Architectural Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js** | `>=20.0.0` (ESM) | Backend Runtime | `backend/package.json`, `backend/src/*` | Asynchronous event-driven I/O engine running native ECMAScript Modules (`"type": "module"`). |
| **Express.js** | `4.19.2` | HTTP Application Server | `backend/src/app.js`, `backend/src/server.js` | REST endpoint routing, error propagation, middleware chain, and raw streaming body ingestion. |
| **Socket.IO** | `4.7.5` | Real-Time Engine | `backend/src/sockets/socketHandler.js` | WebSocket server managing room subscriptions, token handshake auth, and bidirectional broadcasting. |
| **@socket.io/redis-adapter**| `8.3.0` | Distributed Clustering | `backend/src/sockets/socketHandler.js` | Pub/Sub message broker distributing socket broadcast packets across horizontal server containers. |
| **ioredis** | `5.4.1` | Cache & Distributed Lock | `backend/src/config/redisClient.js` | Redis client providing distributed locks (`NX`, `PX`), rate limit storage, and presence maps. |
| **PostgreSQL (`pg`)** | `8.12.0` | Production Database | `backend/src/db/index.js` | Connection pool (`pg.Pool`) managing relational tables, constraints, and indexes in production. |
| **SQLite (`sqlite3`)** | `5.1.7` | Development Database | `backend/src/db/index.js` | Zero-configuration file database (`data/dropx.sqlite`) supporting identical schema queries for dev/test. |
| **Zod** | `3.23.8` | Config Validation | `backend/src/config/env.js` | Fail-fast schema validation of process environment variables on server bootstrap. |
| **Helmet** | `7.1.0` | HTTP Header Security | `backend/src/app.js` | Applies secure HTTP headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`). |
| **express-rate-limit** | `7.3.1` | Traffic Shaping | `backend/src/middleware/rateLimiterStore.js` | Tiered rate limiter preventing brute-force room probing and DoS attacks. |
| **Pino & Pino-Http** | `9.2.0` / `10.1.0` | Structured Observability | `backend/src/utils/logger.js`, `backend/src/app.js` | High-performance JSON logging with automatic redaction of sensitive credentials and bearer tokens. |
| **React** | `18.3.1` | Frontend UI Shell | `frontend/src/App.tsx`, `frontend/src/main.tsx` | Component hierarchy, client-side route state machine, and reactive UI viewports. |
| **TypeScript** | `5.2.2` | Frontend Type System | `frontend/tsconfig.json`, `frontend/src/*` | Enforces strong typing across REST response models, socket payloads, and device structures. |
| **Vite** | `5.3.1` | Build Pipeline | `frontend/vite.config.ts` | Development server with HMR and production roll-up packager outputting to `frontend/dist`. |
| **Tailwind CSS** | `3.4.4` | Styling Engine | `frontend/tailwind.config.js`, `frontend/src/index.css` | Utility-first OLED black dark theme, glassmorphic card styles, and animations. |
| **qrcode.react** | `3.1.0` | QR Generation | `frontend/src/components/CreateRoom.tsx` | Renders dynamic scalable vector graphics (SVG) QR codes containing joining URL strings. |
| **Lucide React** | `0.395.0` | Visual Icons | `frontend/src/components/*` | Consistent icon library for device types, file extensions, and network status badges. |

---

## C. Complete Architecture & Subsystem Interactions

```
                            +---------------------------------------+
                            |     Client Browser (React 18 SPA)     |
                            |  - E2EE AES-GCM (Web Crypto API)     |
                            |  - Service Worker (sw.js shell cache) |
                            |  - Socket.IO Client 4.7.5             |
                            +-------------------+-------------------+
                                                |
                              +-----------------+-----------------+
                              |                                   |
                       REST API Calls                      WebSocket Signaling
               (PUT raw stream, GET download)            (Room Events, Live State)
                              |                                   |
                              v                                   v
             +-----------------------------------------------------------------+
             |              Node.js Application Server (Express)               |
             |                                                                 |
             |  +-----------------------+  +--------------------------------+  |
             |  | Zod Parameter Guards  |  | Multi-Tier Rate Limiters       |  |
             |  +-----------------------+  +--------------------------------+  |
             |  | Token Auth Middleware |  | Constant-Time HMAC Verifier    |  |
             |  +-----------------------+  +--------------------------------+  |
             |                                                                 |
             |  +-----------------------------------------------------------+  |
             |  | Socket.IO Server Engine with Redis Pub/Sub Adapter        |  |
             |  +-----------------------------------------------------------+  |
             +----------------+-------------------------------+----------------+
                              |                               |
                              v                               v
             +--------------------------------+  +-----------------------------+
             | Local Ephemeral Storage Engine |  | Database Abstraction Layer  |
             |  - Stream sink: rooms/CODE/ID  |  |  - SQLite (Local Dev)       |
             |  - 100MB per-file hard cap     |  |  - PostgreSQL (Production)  |
             |  - 500MB room quota cap        |  |  - Dual query interface     |
             +----------------▲---------------+  +--------------▲--------------+
                              |                                 |
                              +----------------+----------------+
                                               |
                              +----------------+----------------+
                              | Background Sweeper Worker       |
                              |  - Redis Mutex: lock:room-clean |
                              |  - Hard Room TTL Eviction (120m)|
                              |  - Pending Upload Reaper (30m)  |
                              +---------------------------------+
```

### Module Breakdown
1. **HTTP Server & App (`backend/src/app.js`, `server.js`)**:
   - Configures trust proxy hops (`TRUST_PROXY_HOPS: 1`).
   - Sets security headers via `helmet`.
   - Restricts CORS origins against `ALLOWED_ORIGINS` (or permits wildcard / non-browser requests).
   - Serves built frontend static files from `../frontend/dist` when present.
   - Enforces a 100KB JSON payload limit to prevent body-parser memory exhaustion.
   - Registers graceful shutdown hooks (`SIGTERM`, `SIGINT`) closing the HTTP server, terminating the background cron worker, disconnecting Socket.IO clients, and closing Redis/DB pools within a 10-second timeout window.

2. **Storage Subsystem (`backend/src/services/storage/localStorage.js`)**:
   - Organizes temporary files inside `LOCAL_STORAGE_DIR/rooms/{ROOM_CODE}/{FILE_ID}`.
   - Provides methods: `saveFile({ objectKey, buffer })`, `verifyObjectExists({ objectKey })`, `deleteObject({ objectKey })`, and batch `deleteObjects({ objectKeys })`.
   - File paths are resolved safely via `path.resolve` to prevent traversal.

3. **Background Sweeper Job (`backend/src/jobs/roomCleanup.js`)**:
   - Runs on an interval of `ROOM_CLEANUP_INTERVAL_MS` (default 60,000 ms).
   - Uses `acquireCleanupLock()` against Redis (`SET lock:room-cleanup instanceId NX PX ttl`). If Redis is unavailable, single-instance local execution proceeds safely.
   - Coordinates `roomService.cleanupExpiredRooms()` to transition expired DB rows.
   - Coordinates `fileService.cleanupExpiredFiles()` to unlink physical disk files for expired rooms and stale pending uploads.

4. **Real-Time Engine (`backend/src/sockets/socketHandler.js`)**:
   - Authenticators verify HMAC socket tokens during handshake `io.use()`.
   - Disallows unauthorized connections, expired rooms, or mismatched room codes.
   - Implements hybrid presence: Redis Hash (`room:presence:{roomCode}`) when Redis is connected; in-memory `roomSocketsMap` when running standalone.
   - Emits events across horizontal nodes using `@socket.io/redis-adapter`.

---

## D. Feature Documentation

### 1. Room Creation & Ownership
- **Mechanics**: Invoked via `POST /api/rooms`.
- **Logic**:
  1. Generates a UUID v4 `id` via `crypto.randomUUID()`.
  2. Generates an owner cryptographic secret `ownerToken` (32 bytes = 64 hex chars).
  3. Generates a 6-character room code from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (excludes ambiguous characters `0`, `O`, `1`, `I`).
  4. Queries DB up to 5 times to prevent collision.
  5. Computes `expiresAt = now + (ROOM_TTL_MINUTES * 60 * 1000)`.
  6. Inserts record into `rooms` table.
  7. Generates signed HMAC `socketToken` with `{ roomCode, participantId: "owner-UUID[0..7]", role: "owner", exp }`.
  8. Returns `{ room: { id, roomCode, status, createdAt, expiresAt }, ownerToken, socketToken }`.

### 2. Room Joining & Peer Handshake
- **Mechanics**: Invoked via `POST /api/rooms/:roomCode/join` or direct URL `/join/:roomCode`.
- **Logic**:
  1. Validates 6-character uppercase alphanumeric code using regex `^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$`.
  2. Retrieves room metadata from DB. Evaluates lazy expiration: if `now >= expiresAt`, marks room status as `expired`, emits `room-expired` socket event, and rejects with HTTP 410.
  3. Generates a 16-byte hex `participantId` (32 hex characters).
  4. Signs a participant HMAC token `{ roomCode, participantId, role: "participant", exp }`.
  5. Returns `{ room, participantId, socketToken }`.

### 3. Direct Streaming File Upload
- **Mechanics**: Three-stage protocol (`upload-url` ➔ `upload` ➔ `complete`).
- **Internal Stages**:
  - **Stage 1 (Slot Negotiation)**: `POST /api/rooms/:roomCode/files/upload-url`
    - Checks room validity and active status.
    - Validates file constraints: `sizeBytes > 0`, `sizeBytes <= MAX_FILE_SIZE_MB * 1024 * 1024`.
    - Sanitizes filename: removes control characters and slashes, enforces `path.basename`, replaces `<>"'` with underscores, and truncates to 255 chars.
    - Validates room quotas: non-terminal file count `< MAX_FILES_PER_ROOM` (default 20); aggregate size `+ sizeBytes <= MAX_ROOM_STORAGE_BYTES` (default 500MB).
    - Writes `pending` status record in `files` table.
    - Returns `{ fileId, objectKey, uploadUrl, expiresIn }`.
  - **Stage 2 (Streaming Payload)**: `PUT /api/rooms/:roomCode/files/:fileId/upload`
    - Captured by `express.raw({ type: '*/*', limit: '100mb' })`.
    - Writes binary buffer directly to disk via `fs.promises.writeFile(filePath, buffer)`.
    - Memory footprint remains bounded at chunk read buffers.
  - **Stage 3 (Handshake Completion)**: `POST /api/rooms/:roomCode/files/:fileId/complete`
    - Validates uploader identity (`participantId` must match unless caller is `owner`).
    - Verifies object existence and physical byte count via `fs.promises.stat()`.
    - Updates database file status to `active` and records verified file size.
    - Broadcasts `file-uploaded` event with file metadata (name, size, mimeType, deviceName) to room sockets. Payloads are never broadcast over WebSockets.

### 4. Direct Streaming File Download
- **Mechanics**: `GET /api/rooms/:roomCode/files/:fileId/download-url` and `GET .../download`.
- **Logic**:
  1. Client requests download URL; server verifies room is active and file status is `active`.
  2. Client fetches binary payload from `/api/rooms/:roomCode/files/:fileId/download`.
  3. Server sets `Content-Type: mimeType || 'application/octet-stream'` and uses `res.download(filePath, originalName)`.
  4. File streams directly from disk to client socket. If E2EE was active, client decrypts the buffer in memory before triggering browser save.

### 5. Live Clipboard / Text Snippets
- **Mechanics**: `GET/POST/DELETE /api/rooms/:roomCode/snippets`.
- **Logic**:
  1. `POST` receives `{ content }` (plaintext or client-encrypted base64url string).
  2. Inserts snippet record with UUID into `snippets` table.
  3. Emits `snippet:created` socket event with snippet record to all connected peers in room.
  4. `DELETE` removes snippet from DB and emits `snippet:deleted` event.

### 6. Dynamic Device Detection
- **Mechanics**: Executed client-side in `frontend/src/utils/device.ts`.
- **Logic**: Inspects `navigator.userAgent` to detect devices (*iPhone, iPad, Samsung Phone, Pixel Phone, OnePlus Phone, Xiaomi Phone, Windows PC, Mac, Linux PC*) and browsers (*Safari, Chrome, Firefox, Edge, Opera, Samsung Internet*). Transmits device name during WebSocket auth and file uploads so peers see human-readable source labels.

### 7. Client-Side Zero-Knowledge E2EE (AES-256-GCM)
- **Mechanics**: Implemented in `frontend/src/utils/crypto.ts` using the Web Crypto API.
- **Logic**:
  1. `deriveRoomKey(roomCode)` computes `SHA-256('dropx-secure-salt-v1:' + roomCode.toUpperCase())` and exports a base64url key.
  2. When uploading, `encryptBlob()` generates a cryptographically random 12-byte IV (`window.crypto.getRandomValues(new Uint8Array(12))`).
  3. Payload is encrypted with `AES-GCM-256`. The 12-byte IV is prepended to the ciphertext.
  4. When downloading, `decryptBlob()` splits the first 12 bytes as the IV, decrypts the remaining ciphertext, and reconstructs the original File/Blob object.

---

## E. Database Knowledge Base

### Tables & Schemas

#### 1. `rooms`
| Column | PostgreSQL Type | SQLite Type | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | `PRIMARY KEY` | Unique room identifier |
| `room_code` | `VARCHAR(16)` | `TEXT` | `UNIQUE NOT NULL` | 6-character room code (Indexed) |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | `NOT NULL` | ISO 8601 creation timestamp |
| `expires_at` | `TIMESTAMPTZ` | `TEXT` | `NOT NULL` | ISO 8601 expiration timestamp (Indexed) |
| `status` | `VARCHAR(20)` | `TEXT` | `NOT NULL DEFAULT 'active'` | State: `'active'` or `'expired'` (Indexed) |
| `owner_token`| `VARCHAR(128)`| `TEXT` | `NOT NULL` | 64-char hexadecimal room admin secret |

**Indexes**:
- `idx_rooms_room_code` ON `rooms(room_code)`
- `idx_rooms_expires_at` ON `rooms(expires_at)`
- `idx_rooms_status` ON `rooms(status)`

#### 2. `files`
| Column | PostgreSQL Type | SQLite Type | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | `PRIMARY KEY` | Unique file identifier |
| `room_code` | `VARCHAR(16)` | `TEXT` | `NOT NULL` | Parent room code (Indexed) |
| `participant_id`| `VARCHAR(64)` | `TEXT` | `NOT NULL` | Identifier of uploading participant |
| `original_name`| `VARCHAR(255)` | `TEXT` | `NOT NULL` | Sanitized original filename |
| `object_key` | `VARCHAR(255)` | `TEXT` | `NOT NULL` | Disk path: `rooms/{code}/{fileId}` |
| `mime_type` | `VARCHAR(128)` | `TEXT` | `NOT NULL` | Content-Type header |
| `size_bytes` | `BIGINT` | `INTEGER` | `NOT NULL` | Size in bytes (verified on completion) |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | `NOT NULL` | ISO 8601 upload initialization timestamp |
| `status` | `VARCHAR(20)` | `TEXT` | `NOT NULL DEFAULT 'pending'` | State: `'pending'`, `'active'`, `'deleted'`, `'expired'` (Indexed) |
| `storage_provider`| `VARCHAR(20)`| `TEXT`| `NOT NULL DEFAULT 'local'` | Storage sink driver |
| `device_name` | `VARCHAR(128)` | `TEXT` | `DEFAULT 'Unknown Device'` | Device description of uploader |

**Indexes**:
- `idx_files_room_code` ON `files(room_code)`
- `idx_files_status` ON `files(status)`

#### 3. `snippets`
| Column | PostgreSQL Type | SQLite Type | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(64)` | `TEXT` | `PRIMARY KEY` | Snippet UUID identifier |
| `room_code` | `VARCHAR(16)` | `TEXT` | `NOT NULL` | Parent room code (Indexed) |
| `content` | `TEXT` | `TEXT` | `NOT NULL` | Plaintext or base64url ciphertext |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | `NOT NULL` | ISO 8601 creation timestamp |

**Indexes**:
- `idx_snippets_room_code` ON `snippets(room_code)`

---

## F. Complete Verified API Knowledge

### 1. Room Endpoints

#### `POST /api/rooms`
- **Rate Limit**: 20 requests per 15 minutes per IP.
- **Request Body**: None.
- **Response `201 Created`**:
```json
{
  "room": {
    "id": "e2c3b8b1-4776-4dc5-b467-bc7e35b7e9b4",
    "roomCode": "P4K8M9",
    "status": "active",
    "createdAt": "2026-10-30T15:00:00.000Z",
    "expiresAt": "2026-10-30T17:00:00.000Z"
  },
  "ownerToken": "7b8f9a2b5e3c8d1a4f6e0b2d5a8c9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d",
  "socketToken": "eyJyb29tQ29kZSI6IlA0SzhNOSIsInBhcnRpY2lwYW50SWQiOiJvd25lci1lMmMzYjhiMSIsInJvbGUiOiJvd25lciIsImV4cCI6MTc2MTgzNjQwMDAwMH0.signature"
}
```

#### `GET /api/rooms/:roomCode`
- **Parameter**: `roomCode` (6 chars, case-insensitive).
- **Response `200 OK`**:
```json
{
  "room": {
    "id": "e2c3b8b1-4776-4dc5-b467-bc7e35b7e9b4",
    "roomCode": "P4K8M9",
    "status": "active",
    "createdAt": "2026-10-30T15:00:00.000Z",
    "expiresAt": "2026-10-30T17:00:00.000Z"
  }
}
```
*(Notice: `ownerToken` is intentionally omitted to prevent credential disclosure).*

#### `POST /api/rooms/:roomCode/join`
- **Rate Limit**: 30 requests per 15 minutes per IP.
- **Response `200 OK`**:
```json
{
  "room": { ... },
  "participantId": "3f9a1c2e4b5d6e7f8a9b0c1d2e3f4a5b",
  "socketToken": "eyJyb29tQ29kZSI6...signature"
}
```

#### `DELETE /api/rooms/:roomCode`
- **Header**: `Authorization: Bearer <ownerToken>` (64 hex characters).
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Room destroyed successfully"
}
```

### 2. File Endpoints

#### `POST /api/rooms/:roomCode/files/upload-url`
- **Header**: `Authorization: Bearer <socketToken>`
- **Request Body**:
```json
{
  "fileName": "presentation.pdf",
  "contentType": "application/pdf",
  "sizeBytes": 1048576,
  "deviceName": "Chrome on Linux PC"
}
```
- **Response `200 OK`**:
```json
{
  "fileId": "8f1a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "objectKey": "rooms/P4K8M9/8f1a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "uploadUrl": "/api/rooms/P4K8M9/files/8f1a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c/upload",
  "expiresIn": 300
}
```

#### `PUT /api/rooms/:roomCode/files/:fileId/upload`
- **Header**: `Content-Type: <mimeType>`
- **Body**: Raw binary byte stream.
- **Response**: `200 OK` (empty body).

#### `POST /api/rooms/:roomCode/files/:fileId/complete`
- **Header**: `Authorization: Bearer <socketToken>`
- **Response `200 OK`**:
```json
{
  "file": {
    "id": "8f1a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
    "roomCode": "P4K8M9",
    "participantId": "3f9a1c2e4b5d6e7f8a9b0c1d2e3f4a5b",
    "originalName": "presentation.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 1048576,
    "createdAt": "2026-10-30T15:05:00.000Z",
    "deviceName": "Chrome on Linux PC"
  }
}
```

#### `GET /api/rooms/:roomCode/files`
- **Header**: `Authorization: Bearer <socketToken>`
- **Response `200 OK`**:
```json
{
  "files": [
    {
      "id": "8f1a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
      "roomCode": "P4K8M9",
      "participantId": "3f9a1c2e4b5d6e7f8a9b0c1d2e3f4a5b",
      "originalName": "presentation.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 1048576,
      "createdAt": "2026-10-30T15:05:00.000Z",
      "deviceName": "Chrome on Linux PC"
    }
  ]
}
```

#### `GET /api/rooms/:roomCode/files/:fileId/download-url`
- **Header**: `Authorization: Bearer <socketToken>`
- **Response `200 OK`**:
```json
{
  "downloadUrl": "/api/rooms/P4K8M9/files/8f1a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c/download",
  "expiresIn": 300,
  "fileName": "presentation.pdf"
}
```

#### `DELETE /api/rooms/:roomCode/files/:fileId`
- **Header**: `Authorization: Bearer <socketToken>`
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

### 3. Text Snippets Endpoints

#### `GET /api/rooms/:roomCode/snippets`
- **Header**: `Authorization: Bearer <socketToken>`
- **Response `200 OK`**: `{ "snippets": [ { "id": "...", "roomCode": "...", "content": "...", "createdAt": "..." } ] }`

#### `POST /api/rooms/:roomCode/snippets`
- **Header**: `Authorization: Bearer <socketToken>`
- **Request Body**: `{ "content": "https://example.com" }`
- **Response `201 Created`**: `{ "snippet": { "id": "...", "roomCode": "...", "content": "...", "createdAt": "..." } }`

#### `DELETE /api/rooms/:roomCode/snippets/:snippetId`
- **Header**: `Authorization: Bearer <socketToken>`
- **Response `200 OK`**: `{ "success": true }`

---

## G. Critical Files & Architecture Map

When extending or maintaining DropX, consult these key files:

```
dropx/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js                # Zod environment schema. Edit here to add new environment variables.
│   │   │   └── redisClient.js        # Redis connection singleton (main, pub, sub).
│   │   ├── controllers/
│   │   │   ├── fileController.js     # HTTP request/response handlers for uploads and downloads.
│   │   │   ├── roomController.js     # Handlers for room creation, joining, status, and deletion.
│   │   │   └── snippetController.js  # Handlers for clipboard snippets.
│   │   ├── db/
│   │   │   ├── index.js              # Database abstraction supporting Postgres (pg.Pool) and SQLite.
│   │   │   ├── roomRepository.js     # Data access layer for rooms table.
│   │   │   ├── fileRepository.js     # Data access layer for files table (queries, quotas, stats).
│   │   │   └── snippetRepository.js  # Data access layer for snippets table.
│   │   ├── jobs/
│   │   │   └── roomCleanup.js        # Background TTL eviction worker using Redis distributed lock.
│   │   ├── middleware/
│   │   │   ├── auth.js               # Scoped token validator (verifies HMAC socketToken and ownerToken).
│   │   │   ├── errorHandler.js       # Global Express error handler returning structured JSON.
│   │   │   ├── rateLimiterStore.js   # Tiered rate limit factories backed by RedisStore.
│   │   │   └── validation.js         # Room code regex validation and Bearer header extraction.
│   │   ├── routes/
│   │   │   ├── file.js               # Express route definitions for files.
│   │   │   ├── health.js             # Liveness (/health) and readiness (/ready) probes.
│   │   │   └── room.js               # Express route definitions for rooms and snippets.
│   │   ├── services/
│   │   │   ├── fileService.js        # Core upload validation, quota limits, file cleanup logic.
│   │   │   ├── roomService.js        # Room code generator, token signing, lazy expiration logic.
│   │   │   ├── snippetService.js     # Snippet persistence and real-time socket emit logic.
│   │   │   └── storage/
│   │   │       └── localStorage.js   # Disk I/O driver (stream writing, stat checks, unlink).
│   │   ├── sockets/
│   │   │   └── socketHandler.js      # Socket.IO connection handling, auth guard, presence tracking.
│   │   ├── utils/
│   │   │   ├── crypto.js             # Room code generator, timingSafeEqual, random UUID/tokens.
│   │   │   ├── errors.js             # AppError operational error class.
│   │   │   ├── logger.js             # Structured Pino logger with field redaction.
│   │   │   └── token.js              # HMAC-SHA256 socket token signer and timing-safe verifier.
│   │   ├── app.js                    # Express app configuration (CORS, Helmet, raw body parser).
│   │   └── server.js                 # HTTP server bootstrap and graceful shutdown hooks.
│   └── tests/                        # Native Node.js test runner test suites.
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ActiveRoom.tsx        # Guest active session view (file transfers, timer, presence).
│   │   │   ├── ConnectedDevices.tsx  # Dynamic device presence grid with OS/browser avatars.
│   │   │   ├── CreateRoom.tsx        # Host session view (QR code, share links, destroy button).
│   │   │   ├── ExpiredRoom.tsx       # Session termination and purge explanation screen.
│   │   │   ├── JoinPage.tsx          # QR scan landing page (/join/:roomCode).
│   │   │   ├── JoinRoom.tsx          # Manual 6-character room code entry form.
│   │   │   ├── SharedFiles.tsx       # Drag-and-drop dropzone, upload progress bar, files list.
│   │   │   ├── TextSnippets.tsx      # Live clipboard text sharing component.
│   │   │   └── ThemeToggle.tsx       # Dark/light mode switcher.
│   │   ├── hooks/
│   │   │   ├── useCountdownTimer.ts  # Synchronized countdown timer with visibility change recalcs.
│   │   │   ├── useRoomFiles.ts       # File upload progress, speed calculation, download, and delete.
│   │   │   └── useRoomSocket.ts      # Socket connection, reconnect logic, and event dispatchers.
│   │   ├── services/
│   │   │   └── api.ts                # Typed HTTP API client and streaming XHR upload helpers.
│   │   ├── utils/
│   │   │   ├── crypto.ts             # Web Crypto API AES-256-GCM encryption/decryption routines.
│   │   │   ├── device.ts             # Browser & OS user agent heuristics.
│   │   │   ├── format.ts             # Byte and time formatting utilities.
│   │   │   └── validation.ts         # Room code regex checker and join URL generator.
│   │   ├── App.tsx                   # Top-level state machine (HOME, ACTIVE_OWNER, JOIN_URL, etc.).
│   │   ├── main.tsx                  # React DOM mount point and Service Worker registration.
│   │   └── index.css                 # Custom CSS variables, glassmorphism, and scanning animations.
│   └── public/
│       ├── manifest.json             # PWA web app manifest with Web Share Target spec.
│       └── sw.js                     # Progressive Web App offline caching service worker.
│
├── docker-compose.yml                # Production multi-container orchestration.
├── Dockerfile                        # Multi-stage container build (Node 20 Alpine).
└── docs/disaster-recovery.md         # Operational incident response runbook.
```

---

## H. Engineering Decisions & Architectural Trade-Offs

### 1. Raw Stream Parsing vs. Multer Multipart Buffering
- **Decision**: DropX processes file uploads via `express.raw({ type: '*/*', limit: '100mb' })` rather than traditional multipart form parsing libraries.
- **Reasoning**: Multipart parsing stores incoming boundary chunks in V8 heap memory until parsing completes. Under concurrent uploads, this triggers high RAM usage and Node.js garbage collection freezes. By negotiating filename and MIME metadata in Step 1 (`POST /upload-url`), the payload endpoint can treat the body as a raw stream, pipe it directly to disk, and verify size and integrity in Step 3 (`POST /complete`).
- **Trade-Off**: The client must perform a two-step upload handshake instead of a single multipart `POST`. However, this mirrors cloud storage architectures (AWS S3 pre-signed URLs) and preserves predictable memory usage.

### 2. Dual Database Driver: SQLite in Development, PostgreSQL in Production
- **Decision**: Avoid heavyweight ORMs (e.g. Prisma or TypeORM) and use a lightweight repository pattern supporting both `sqlite3` and `pg`.
- **Reasoning**: DropX requires zero-barrier local onboarding. Developers can clone the repository and run `npm run dev` immediately without starting Docker or configuring local PostgreSQL instances. In production, setting `DATABASE_URL` activates the PostgreSQL pool (`pg.Pool`) without any code changes.
- **Trade-Off**: SQL queries must adhere to standard SQL syntax compatible with both SQLite and PostgreSQL parameter replacement (`$1` converted to `?` for SQLite).

### 3. Signed HMAC Socket Tokens vs. Stateful Database Sessions
- **Decision**: Issue stateless HMAC-SHA256 tokens (`payload.signature`) for participant socket authorization rather than querying the database on every WebSocket event.
- **Reasoning**: WebSocket signaling events (typing, snippet sharing, presence updates) fire frequently. Validating a stateless HMAC signature in memory takes microseconds and prevents database connection saturation.
- **Trade-Off**: Token revocation requires checking room expiration or explicit room teardown. DropX solves this by validating room status during the initial connection handshake (`io.use`) and disconnecting all sockets in the room when `destroyRoom` or `room-expired` fires.

### 4. Deterministic Room Key E2EE Derivation
- **Decision**: The browser derives an AES-256-GCM encryption key from the room code (`SHA-256('dropx-secure-salt-v1:' + code)`).
- **Reasoning**: This provides Zero-Knowledge encryption without forcing users to type a secondary passphrase or pass a URL hash fragment (`#key=...`) that might get lost during manual code entry on mobile devices.
- **Trade-Off**: Anyone with access to the 6-character room code can decrypt the room's files. The security model relies on the unpredictability of the cryptographically random 6-character code (over 1 billion permutations) and the strict 2-hour room TTL.

---

## I. Known Limitations & Technical Debt

1. **Storage Sink Implementation**:
   - Currently, `STORAGE_PROVIDER` supports `'local'` disk storage. While the service interface is structured like S3 (pre-signed upload URLs and object keys), native AWS S3 or MinIO S3 SDK bindings are not yet implemented.
2. **Relayed Transfers vs. WebRTC DataChannels**:
   - Transfers currently stream through the Node.js server to temporary disk storage. A true peer-to-peer WebRTC DataChannel implementation would eliminate server bandwidth consumption for devices on the same local network subnet.
3. **In-Memory Fallback Cluster Limitation**:
   - If `REDIS_URL` is omitted in a multi-instance deployment behind a load balancer, instances fall back to in-memory presence tracking (`roomSocketsMap`). In this mode, clients connected to different backend instances will not receive real-time events from each other. Production deployments must configure Redis.

---

## J. Confirmed Future Roadmap

- [ ] **Native S3 & MinIO Driver**: Add an AWS SDK v3 driver to `backend/src/services/storage/` so storage sinks can point directly to S3-compatible buckets.
- [ ] **WebRTC DataChannel Mesh**: Implement direct P2P data channel transfers with automatic fallback to server streaming when NAT traversal fails.
- [ ] **Folder & Multi-File Zip Bundling**: Enable client-side streaming zip archiving for bulk multi-file downloads.
- [ ] **Custom Expiration Timers**: Allow room hosts to configure custom TTLs (e.g. 5 minutes, 30 minutes, 2 hours, 6 hours).

---

## K. AI AGENT OPERATIONAL INSTRUCTIONS

Any AI coding assistant or automated tool modifying this repository MUST strictly abide by the following twelve operational rules:

1. **Read Before Modifying**: Read `PROJECT_KNOWLEDGE_BASE.md` and related source files before proposing or applying code changes.
2. **Preserve Architecture**: Maintain the separation of concerns: routes ➔ controllers ➔ services ➔ repositories ➔ storage/sockets.
3. **Never Buffer Uploads in Heap**: Never replace the raw stream upload pipeline with unbounded in-memory buffers or unconstrained multipart parsers.
4. **Preserve Ephemeral Invariants**: Ensure all new assets, records, or caches implement deterministic TTL eviction and automated garbage collection.
5. **No Secret Leaks**: Never log tokens, passwords, authorization headers, or cryptographic secrets. Maintain Pino redaction rules.
6. **Maintain Timing Attack Protections**: Always use `crypto.timingSafeEqual` when comparing hashes, HMAC tokens, or owner credentials.
7. **Maintain Dual-Database Compatibility**: Any schema modification must be applied to both PostgreSQL and SQLite initialization statements in `backend/src/db/index.js`.
8. **Enforce Rate Limits**: New public endpoints must have appropriate rate limiter middleware configured via `createLimiter()`.
9. **Never Delete Existing Tests**: Preserve existing unit and integration test coverage (`backend/tests/*.test.js`). Add regression tests for any bug fixes.
10. **Sanitize User Inputs**: Enforce `path.basename` and character stripping on any client-provided filenames.
11. **Document Contract Changes**: If modifying REST request/response schemas or WebSocket event names, update `README.md` and `PROJECT_KNOWLEDGE_BASE.md`.
12. **Verify Claims Factually**: Never document or claim a feature is implemented without verifying its source code implementation first.

