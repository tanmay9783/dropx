# DropX

Ephemeral, cross-device file and text sharing platform built for fast transfers between phones, laptops, and tablets. Pair devices in seconds via dynamic QR code with zero account creation and automated data destruction.

---

## Why DropX?

Transferring files or clipboard snippets between different operating systems (like iOS, Android, Linux, and Windows) usually means emailing yourself, using third-party messaging apps that compress media, or uploading to cloud storage services that permanently retain your data.

DropX is designed as a lightweight, zero-footprint alternative:

1. **Zero Setup**: Open the app, click create, scan the QR code from any camera-enabled device, and you're paired.
2. **Zero Permanent Persistence**: Files and clipboard text live strictly within temporary memory/ephemeral disk storage. When the room expires or is destroyed, all data is automatically unlinked and wiped.
3. **Real-Time Signaling**: WebSockets synchronize connection state, active peer lists, file uploads, and text snippets across all paired devices with sub-50ms latency.

---

## Architecture Overview

```
                      ┌─────────────────────────────────┐
                      │    Mobile & Desktop Clients     │
                      └────────────────┬────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
             HTTP / REST Calls                     WebSocket Stream
         (Auth, Upload, Download)               (Room State, Text, Events)
                    │                                     │
                    ▼                                     ▼
      ┌───────────────────────────────────────────────────────────┐
      │                   Express.js & Socket.IO                  │
      │   - Helmet & CORS Headers                                 │
      │   - IP & Route Rate Limiters (Redis-ready)                │
      │   - Zod Schema Validation & Auth Guards                   │
      └─────────────┬─────────────────────────────┬───────────────┘
                    │                             │
                    ▼                             ▼
      ┌───────────────────────────┐ ┌─────────────────────────────┐
      │     SQLite / Postgres     │ │  Ephemeral Disk Storage     │
      │  (Room & File Metadata)   │ │      (./data/uploads)       │
      └─────────────▲─────────────┘ └─────────────▲───────────────┘
                    │                             │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │  Automated Cleanup Worker   │
                    │   (TTL & Orphan File Purge) │
                    └─────────────────────────────┘
```

---

## Engineering Highlights & Design Decisions

### 1. Streaming Uploads with Bound Memory Usage
Handling concurrent 100MB file uploads in a Node.js process without blowing up the V8 heap requires avoiding in-memory multipart buffering. DropX uses streaming endpoints (`express.raw`) that pipe incoming binary payloads directly to disk, keeping Node.js memory consumption low regardless of file size.

### 2. Ephemeral Security & Scoped Tokens
* **Room Isolation**: Each session generates a random alphanumeric room code paired with an owner secret and a socket auth token.
* **Granular Roles**: Only the room creator holds owner permissions (e.g., immediate room destruction). Joined devices receive temporary participant credentials valid only for the room's lifespan.
* **Strict Payload Caps**: Standard 100MB upload limits, 100KB JSON payload caps, and parameterized request validation using **Zod**.

### 3. Self-Healing Lifecycle & Garbage Collection
To prevent disk exhaustion from abandoned or partial uploads, DropX implements a deterministic state machine:
* **Pending Uploads**: Marked as `pending` upon URL request. If not completed within `PENDING_FILE_TTL_MINUTES` (default 30m), background workers sweep the file and metadata.
* **Active Rooms**: Rooms remain active for `ROOM_TTL_MINUTES` (default 2h). A scheduled worker (`setInterval` / cron) evaluates expired rooms every 60s and hard-deletes all associated disk assets.

### 4. Real-Time Distributed Signaling
The Socket.IO layer manages room presence and broadcasts upload notifications in real time. It is architected with `@socket.io/redis-adapter` compatibility, allowing seamless horizontal scaling across multiple Node.js instances behind a load balancer.

---

## Repository Structure

```
dropx/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment variables & runtime configuration
│   │   ├── controllers/     # Request handlers (Room, File, Snippet)
│   │   ├── db/              # Database connection & repository abstraction (SQLite / PG)
│   │   ├── jobs/            # Scheduled cleanup workers & TTL sweepers
│   │   ├── middleware/      # Rate limiting, auth, Zod validation, error handling
│   │   ├── routes/          # REST route definitions
│   │   ├── services/        # Business logic (File streaming, room lifecycle)
│   │   ├── sockets/         # Socket.IO connection handling & room events
│   │   └── server.js        # Application entrypoint & HTTP server
│   └── tests/               # Automated integration test suites
│
├── frontend/
│   ├── src/
│   │   ├── components/      # UI Views (ActiveRoom, JoinPage, TextSnippets, etc.)
│   │   ├── hooks/           # Custom React hooks (useRoomSocket, useFileUpload)
│   │   ├── services/        # API client & upload handlers
│   │   ├── utils/           # Device detection, formatting & helpers
│   │   └── App.tsx          # Main state router & UI shell
│   └── vite.config.ts       # Vite build configuration
│
└── docker-compose.yml       # Production container orchestration
```

---

## Tech Stack

* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Socket.IO Client.
* **Backend**: Node.js (ESM), Express 4, Socket.IO 4, Zod, Helmet, Pino, Rate-Limit.
* **Storage & DB**: Local filesystem storage (with S3 adapter interface), SQLite (development) / PostgreSQL (production).
* **Testing**: Node.js native test runner (`node --test`), Supertest, Socket.IO Client.

---

## Getting Started

### Prerequisites
* Node.js `>= 18.0.0`
* npm `>= 9.0.0`

### 1. Local Development

#### Start Backend
```bash
cd backend
npm install
npm run dev
```
The server will start on `http://localhost:3000`. Health check available at `http://localhost:3000/api/health`.

#### Start Frontend
```bash
cd frontend
npm install
npm run dev
```
The Vite development server will start on `http://localhost:5173`.

---

### 2. Docker Deployment

Run the complete multi-container stack with Docker Compose:

```bash
docker-compose up --build -d
```

---

## Configuration Reference

Key environment variables configurable in `backend/.env`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP & WebSocket server port |
| `STORAGE_PROVIDER` | `local` | Storage driver (`local` or `s3`) |
| `LOCAL_STORAGE_DIR` | `./data/uploads` | Directory for temporary file storage |
| `MAX_FILE_SIZE_MB` | `100` | Maximum allowed file size per upload |
| `MAX_FILES_PER_ROOM` | `20` | File quota per room |
| `ROOM_TTL_MINUTES` | `120` | Lifetime before a room and its files are destroyed |
| `PENDING_FILE_TTL_MINUTES` | `30` | Expiration window for unconfirmed uploads |
| `ROOM_CLEANUP_INTERVAL_MS`| `60000` | Frequency of background cleanup job (ms) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed origins for cross-origin requests |

---

## API & WebSocket Protocol

### REST Endpoints

* `POST /api/rooms` — Create an ephemeral room and receive owner token.
* `POST /api/rooms/:roomCode/join` — Join an active room with code validation.
* `GET  /api/rooms/:roomCode` — Fetch current room metadata and file list.
* `POST /api/rooms/:roomCode/files/upload-url` — Request authorization for a file upload.
* `PUT  /api/rooms/:roomCode/files/:fileId/upload` — Direct binary stream upload.
* `POST /api/rooms/:roomCode/files/:fileId/complete` — Verify size/stat and mark file active.
* `GET  /api/rooms/:roomCode/files/:fileId/download` — Stream file content to client.
* `DELETE /api/rooms/:roomCode/files/:fileId` — Delete a file from room and unlink from disk.
* `GET  /api/rooms/:roomCode/snippets` — Retrieve shared text snippets.
* `POST /api/rooms/:roomCode/snippets` — Broadcast a new clipboard note.

### Real-Time Socket Events

* `join-room` (`Client -> Server`): Authenticate and join room channel with `{ roomCode, socketToken }`.
* `peer-joined` (`Server -> Client`): Broadcast updated peer count to room members.
* `file-uploaded` (`Server -> Client`): Push new file metadata when an upload completes.
* `file-deleted` (`Server -> Client`): Notify connected clients to remove file from state.
* `text-created` (`Server -> Client`): Broadcast newly pasted text snippet instantly.

---

## Test Suite

The project includes an integration test suite covering security headers, rate limiting, room lifecycle, streaming file uploads, and Socket.IO real-time events.

```bash
cd backend
npm test
```

All 32 tests execute with zero dependencies on external test runners using Node's native test harness.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
