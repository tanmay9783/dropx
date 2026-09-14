# DropX

**DropX** is an ephemeral, cross-device file and clipboard synchronization system designed for high-speed transfers across heterogeneous environments (iOS, Android, Linux, macOS, Windows). 

It pairs devices via dynamic QR codes or short-lived room keys without requiring user registration, authentication accounts, or permanent cloud persistence. Once a session expires or is closed, all associated memory buffers and disk assets are automatically unlinked and permanently destroyed.

---

## The Problem

Sharing files, photos, or text snippets between devices across different operating systems usually presents a compromise:
- **Ecosystem lock-in**: Apple AirDrop and Android Quick Share do not interoperate natively.
- **Privacy & Persistence**: Cloud storage drives (Google Drive, Dropbox) require logins and leave permanent file logs.
- **Compression & Bloat**: Messaging platforms (WhatsApp, Slack) degrade original asset resolution and clutter chat history.

DropX solves this by providing a lightweight, peer-coordinated sharing runtime where files stream directly over WebSockets and temporary storage with zero long-term retention.

---

## Architecture & System Topology

```
                   +---------------------------------------+
                   |       Client Devices (Browsers)       |
                   |  (Mobile Safari, Chrome, Firefox, etc)|
                   +-------------------+-------------------+
                                       |
                     +-----------------+-----------------+
                     |                                   |
              HTTP / REST API                     WebSocket Stream
         (Auth, Upload, Download)               (Signaling, Events, Text)
                     |                                   |
                     v                                   v
    +-----------------------------------------------------------------+
    |                 Node.js / Express Application Server            |
    |                                                                 |
    |  +---------------------+  +------------------+  +------------+  |
    |  | Helmet / CORS Guard |  | Multi-Tier Rate  |  | Zod Schema |  |
    |  | (Security Headers)  |  | Limiters (Redis) |  | Validation |  |
    |  +---------------------+  +------------------+  +------------+  |
    |                                                                 |
    |  +-----------------------------------------------------------+  |
    |  | Socket.IO Server Engine with Redis Pub/Sub Adapter        |  |
    |  +-----------------------------------------------------------+  |
    +----------------+-------------------------------+----------------+
                     |                               |
                     v                               v
    +--------------------------------+  +-----------------------------+
    | Ephemeral Storage (Local / S3) |  | Database Layer              |
    |  - Direct stream disk pipes    |  |  - SQLite (Local Dev)       |
    |  - Automatic unlink on expiry  |  |  - PostgreSQL (Production)  |
    +----------------▲---------------+  +--------------▲--------------+
                     |                                 |
                     +----------------+----------------+
                                      |
                     +----------------+----------------+
                     | Background Sweeper Worker       |
                     |  - Cron TTL Room Eviction       |
                     |  - Orphaned Upload Cleanup      |
                     +---------------------------------+
```

---

## Core System Design & Engineering Decisions

### 1. Memory-Bound Streaming I/O Pipeline
Buffering high-volume uploads (up to 100MB per file) directly into Node.js application memory quickly exhausts the V8 heap and triggers severe garbage collection pauses under concurrent load.

DropX implements raw stream piping via `express.raw` and non-buffering storage sinks:
- Incoming byte streams bypass in-memory multipart parsers and write directly to disk or temporary blob storage.
- File integrity and MIME headers are validated asynchronously during the completion handshake.
- Memory consumption per transfer remains bounded at stream chunk sizes (~64KB), keeping the Node.js process memory footprint minimal under high concurrency.

### 2. Ephemeral Security & Scoped Token Hierarchy
DropX enforces a zero-trust, room-scoped access model:
- **Owner Cryptographic Tokens**: When a room is created, the client receives an HMAC-signed owner token granting administrative capabilities (e.g., immediate session teardown).
- **Participant Handshakes**: Joining devices receive temporary participant tokens validated against active room state during Socket.IO connection handshakes.
- **Defense in Depth**: Tiered rate limiters protect sensitive endpoints (room creation, join attempts, and upload URL signing), backed by Redis in multi-node clusters.

### 3. Deterministic Lifecycle & Automated Garbage Collection
To prevent resource leaks from abandoned uploads or idle sessions, the system implements a strict state machine:

```
[ Request Upload URL ] ---> (pending) ---[ Completed & Verified ]---> (active)
                                |                                        |
                      [ TTL Exceeded: 30m ]                +-------------+-------------+
                                |                          |                           |
                                v                          v                           v
                        [ File Unlinked ]          [ User Deletes ]            [ Room Expires ]
                                                           |                           |
                                                           +-------------+-------------+
                                                                         |
                                                                         v
                                                                 [ Hard Purge: Disk + DB ]
```

- **Pending Sweep**: Uncompleted uploads older than `PENDING_FILE_TTL_MINUTES` (30m) are automatically pruned by background cron tasks.
- **Session Eviction**: Active rooms self-destruct upon reaching `ROOM_TTL_MINUTES` (120m) or when explicitly terminated by the creator, unlinking all physical files and purging database references.

### 4. Horizontal Scalability & Distributed Pub/Sub
The real-time layer is decoupled from single-server memory:
- Built-in `@socket.io/redis-adapter` support enables broadcast synchronization across horizontally scaled backend containers behind a reverse proxy (e.g., Nginx or AWS ALB).
- Distributed presence tracking coordinates connected participant counts and live events across instances.

### 5. Production Observability & Graceful Shutdown
- **Structured JSON Logging**: Powered by `pino` and `pino-http` with request correlation IDs and customizable log levels.
- **Health Probes**: Liveness (`/api/health`) and readiness (`/api/ready`) endpoints for orchestrators (Kubernetes / Docker Swarm).
- **Graceful Teardown**: Listens for `SIGTERM` and `SIGINT`, halts the background cleanup scheduler, closes active WebSockets with disconnect frames, cleanly closes Redis/database connection pools, and forces termination if tasks exceed 10s.

---

## Repository Structure

```
dropx/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment schema (dotenv + zod), Redis client
│   │   ├── controllers/     # HTTP route controllers (Room, File, Snippet, Health)
│   │   ├── db/              # Repository layer supporting SQLite & PostgreSQL
│   │   ├── jobs/            # Background schedulers for room and file TTL eviction
│   │   ├── middleware/      # Rate limiters, CORS, Helmet, auth guards, Zod validators
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # Storage abstraction and file lifecycle business logic
│   │   ├── sockets/         # Socket.IO connection handling, rooms, and event routing
│   │   ├── utils/           # Structured logger, crypto token generation
│   │   ├── app.js           # Express application configuration
│   │   └── server.js        # Server bootstrapping & graceful shutdown lifecycle
│   └── tests/               # Integration & unit test suites (node:test + supertest)
│
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components (ActiveRoom, CreateRoom, JoinPage, TextSnippets)
│   │   ├── hooks/           # State management & WebSocket hooks (useRoomSocket)
│   │   ├── services/        # HTTP API clients & streaming upload helpers
│   │   ├── utils/           # Device detection & formatting helpers
│   │   ├── App.tsx          # Application shell & routing state machine
│   │   └── main.tsx         # React DOM entrypoint
│   ├── index.html
│   └── vite.config.ts
│
├── docker-compose.yml       # Production multi-service deployment spec
└── Dockerfile               # Production container image definition
```

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Socket.IO Client |
| **Backend** | Node.js (ESM), Express.js, Socket.IO, `@socket.io/redis-adapter`, Zod, Helmet, Pino |
| **Data & Storage** | Local Storage Engine (S3-compatible interface), SQLite (Development), PostgreSQL (Production) |
| **Infrastructure** | Docker, Docker Compose, Redis (Cluster rate limiting & WebSocket Pub/Sub) |
| **Test Suite** | Native Node Test Runner (`node:test`), Supertest, Socket.IO Client |

---

## Local Development Setup

### Prerequisites
- **Node.js**: `>= 18.0.0`
- **npm**: `>= 9.0.0`

### 1. Backend Service
```bash
cd backend
npm install
npm run dev
```
- Server starts on `http://localhost:3000`
- Liveness Probe: `http://localhost:3000/api/health`

### 2. Frontend Application
```bash
cd frontend
npm install
npm run dev
```
- Web interface accessible at `http://localhost:5173`

---

## Docker Deployment

To spin up the entire application stack in isolated containers:

```bash
docker-compose up --build -d
```

---

## Configuration Reference

Key runtime parameters configurable via `.env`:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `3000` | Application HTTP/WebSocket port |
| `STORAGE_PROVIDER` | `local` | Storage driver (`local` or `s3`) |
| `LOCAL_STORAGE_DIR` | `./data/uploads` | Path for temporary physical files |
| `MAX_FILE_SIZE_MB` | `100` | Hard cap on individual upload size |
| `MAX_FILES_PER_ROOM` | `20` | Maximum simultaneous files allowed in a single session |
| `MAX_ROOM_STORAGE_BYTES` | `524288000` | Total storage quota allocated per room (500MB) |
| `ROOM_TTL_MINUTES` | `120` | Session lifetime before automated purge |
| `PENDING_FILE_TTL_MINUTES`| `30` | Expiration window for uncompleted file uploads |
| `ROOM_CLEANUP_INTERVAL_MS`| `60000` | Background cleanup worker cycle frequency |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed origins for browser CORS policy |
| `TRUST_PROXY_HOPS` | `1` | Number of reverse proxy hops to trust for IP resolution |

---

## Protocol & API Specifications

### REST Endpoints

| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/rooms` | Initialize room; returns 6-character room code & owner token |
| `POST` | `/api/rooms/:roomCode/join` | Validate room code and register participant session |
| `GET` | `/api/rooms/:roomCode` | Retrieve active room metadata and shared files list |
| `DELETE` | `/api/rooms/:roomCode` | Administrative teardown (requires owner token) |
| `POST` | `/api/rooms/:roomCode/files/upload-url` | Obtain upload authorization & temporary file slot |
| `PUT` | `/api/rooms/:roomCode/files/:fileId/upload` | Stream raw binary payload to storage |
| `POST` | `/api/rooms/:roomCode/files/:fileId/complete`| Confirm upload completion and trigger room broadcast |
| `GET` | `/api/rooms/:roomCode/files/:fileId/download`| Stream downloaded file to client |
| `DELETE` | `/api/rooms/:roomCode/files/:fileId` | Unlink file and notify room |
| `GET` | `/api/rooms/:roomCode/snippets` | Fetch shared clipboard text history |
| `POST` | `/api/rooms/:roomCode/snippets` | Broadcast new text snippet to room |
| `GET` | `/api/health` | Liveness check (status, uptime, timestamp) |
| `GET` | `/api/ready` | Readiness check verifying database and storage subsystems |

### WebSocket Event Protocol

| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `join-room` | Client ➔ Server | `{ roomCode, socketToken }` | Authenticates socket and binds to room channel |
| `room-state` | Server ➔ Client | `{ roomCode, participantCount, participants }` | Initial synchronization payload |
| `user-joined` | Server ➔ Client | `{ participantId, role, deviceName }` | Dispatched to room when a peer connects |
| `user-left` | Server ➔ Client | `{ participantId, participantCount }` | Dispatched when a peer disconnects |
| `file-uploaded`| Server ➔ Client | `{ id, originalName, sizeBytes, mimeType }` | Broadcast upon upload verification |
| `file-deleted` | Server ➔ Client | `{ fileId }` | Broadcast when a file is removed |
| `text-created` | Server ➔ Client | `{ id, content, deviceName, createdAt }` | Broadcast when a text snippet is shared |
| `room-expired` | Server ➔ Client | `{ roomCode, message }` | Dispatches session termination notice to clients |

---

## Test Automation

DropX includes a comprehensive integration test suite utilizing Node.js's native test runner (`node:test`) and Supertest.

```bash
cd backend
npm test
```

### Coverage Highlights:
- **Security & Headers**: Validates CSP, CORS, and Helmet headers across all responses.
- **Rate Limiting**: Tests rate limit thresholds on room creation, joining, and upload attempts.
- **File Lifecycle & Streaming**: Validates binary streaming, MIME validation, and disk space limits.
- **Background Sweeper**: Tests automatic eviction of expired rooms and orphan pending files.
- **WebSocket Synchronization**: Verifies token handshake authorization and real-time room broadcasting.

---

## License

This project is open-source and licensed under the [MIT License](LICENSE).
