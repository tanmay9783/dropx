# DropX — Professional Career Assets, Resume Bullets & Technical Interview Guide

> **Career & Interview Portfolio Guide**  
> *Author*: Tanmay Agrawal  
> *Repository*: `https://github.com/tanmay9783/dropx`  
> *Technologies*: Node.js (ESM), Express.js, TypeScript, React 18, Socket.IO, Redis, PostgreSQL, SQLite, Tailwind CSS, Docker, Web Crypto API (AES-256-GCM).

---

## 1. Portfolio Project Descriptions

### One-Line Summary
An ephemeral, zero-knowledge cross-device file and clipboard sharing system with memory-bounded streaming I/O, dynamic QR pairing, and zero permanent cloud retention.

### Short Description (35 words)
DropX is an ephemeral, zero-knowledge cross-device synchronization platform. It pairs mobile and desktop devices via dynamic QR codes, enabling instantaneous file streaming (up to 100MB) and live clipboard sharing with zero accounts, zero logs, and automated memory purges.

### Medium Description (98 words)
DropX solves the friction of moving data across heterogeneous operating systems without proprietary ecosystem lock-in, cloud account logins, or permanent file retention. Built with Node.js, React 18, and Socket.IO, DropX pairs devices in seconds via dynamic QR codes and Crockford-style room keys. It implements memory-bounded streaming I/O via raw HTTP pipelines to eliminate V8 heap exhaustion during large transfers, integrates browser-native AES-256-GCM Zero-Knowledge encryption, coordinates real-time presence across nodes using Redis Pub/Sub, and deterministically purges all disk assets and database metadata upon session expiration.

### Detailed Description (184 words)
DropX is a production-engineered, ephemeral data transfer platform built for high-speed file and clipboard synchronization between iOS, Android, macOS, Linux, and Windows devices. Traditional sharing solutions force users to choose between ecosystem lock-in (AirDrop/Quick Share) or privacy-invasive cloud storage drives that leave permanent digital footprints. 

DropX eliminates these trade-offs by orchestrating direct peer sessions with zero user accounts or persistent storage. The backend is architected with Node.js (ESM), Express, and Socket.IO, utilizing raw HTTP stream pipes (`express.raw`) that bypass in-memory buffering to keep the server process footprint strictly bounded at ~64KB stream chunks even under concurrent 100MB file transfers. 

Security is reinforced with client-side Web Crypto AES-256-GCM Zero-Knowledge encryption, HMAC-SHA256 session tokens, timing-safe cryptographic comparisons, and multi-tier Redis-backed rate limiting. A Redis-locked background sweeper continuously reconciles active rooms, executing hard disk unlinks and database state transitions upon session expiration. The frontend is built with React 18, TypeScript, and Tailwind CSS, featuring device-aware presence detection, live upload speedometers, and a progressive web app architecture.

### Key Technical Highlights
- **Memory-Bounded Streaming Pipeline**: Raw stream ingestion bypasses multipart heap buffers, bounding memory usage during concurrent 100MB transfers.
- **Zero-Knowledge Encryption**: Browser-native AES-256-GCM payload encryption with keys derived via Web Crypto API SHA-256.
- **Horizontal Scalability**: Stateless Socket.IO architecture backed by `@socket.io/redis-adapter` and Redis atomic locks.
- **Deterministic Garbage Collection**: Automated multi-tier sweeper cleans up expired rooms (120m TTL) and abandoned upload slots (30m TTL).
- **Dual Database Engine**: Dynamic repository supporting zero-config SQLite locally and connection-pooled PostgreSQL in production.

### Core Tech Stack
`TypeScript`, `React 18`, `Node.js (ESM)`, `Express.js`, `Socket.IO`, `Redis`, `PostgreSQL`, `SQLite`, `Tailwind CSS`, `Docker`, `Web Crypto API`, `Pino`.

---

## 2. Resume & CV Content

### One-Line Resume Summary
- **DropX**: Architected an ephemeral cross-device file sharing platform featuring memory-bounded streaming I/O, Web Crypto AES-256-GCM encryption, and horizontal Redis WebSocket clustering.

### Three Focused Resume Bullet Points
- **Architected a real-time, zero-knowledge cross-device file sharing platform** using Node.js, Express, React, and Socket.IO, enabling sub-3-second device pairing via dynamic QR codes without user accounts.
- **Engineered a memory-bounded streaming I/O pipeline** using raw HTTP pipes and local storage sinks, eliminating V8 heap exhaustion and supporting concurrent 100MB uploads with bounded memory overhead.
- **Implemented multi-tier security and distributed synchronization** using client-side AES-256-GCM encryption, timing-safe HMAC token validation, Redis distributed locks, and automated TTL garbage collection.

### Five Impact-Oriented Technical Bullet Points
1. **Architected an ephemeral data synchronization system** supporting heterogeneous environments (iOS, Android, desktop) via WebSockets and REST APIs, eliminating persistent cloud logging through automated TTL session eviction.
2. **Engineered a high-throughput binary transfer pipeline** bypassing traditional multipart heap buffering with raw stream sinks, bounding memory consumption to stream chunk buffers during concurrent 100MB transfers.
3. **Designed a Zero-Knowledge encryption module** using the native Web Crypto API (AES-256-GCM), deriving 256-bit keys client-side to ensure server storage sinks store only encrypted ciphertexts.
4. **Developed horizontal clustering infrastructure** using Socket.IO and `@socket.io/redis-adapter` for multi-node event broadcasting, reinforced with Redis atomic locks (`NX`, `PX`) for background cleanups.
5. **Constructed a dual-driver database layer** supporting PostgreSQL connection pooling in production and zero-setup SQLite in development, integrated with structured Pino JSON logging and automated health probes.

### ATS-Friendly Technical Keywords
`Distributed Systems`, `WebSocket Architecture`, `Socket.IO`, `Node.js`, `TypeScript`, `React.js`, `Express.js`, `Redis`, `PostgreSQL`, `SQLite`, `Web Crypto API`, `AES-256-GCM`, `Zero-Knowledge Encryption`, `Streaming I/O`, `Rate Limiting`, `Docker`, `RESTful APIs`, `PWA`, `Software Architecture`, `System Design`.

---

## 3. LinkedIn Content

### Post 1: Professional Project Announcement
Excited to share **DropX** — an open-source, ephemeral cross-device file and clipboard sharing platform! 🚀

Moving a raw photo, PDF, or code snippet between an iPhone, an Android phone, and a Linux laptop is still surprisingly painful. Existing solutions either force you into proprietary walled gardens (AirDrop / Quick Share), compress your files, or require logging into cloud storage drives that permanently retain your data.

I built DropX to eliminate that friction:
⚡ **Instant Pairing**: Scan a QR code or enter a 6-character room code to connect any device in seconds. No login, no accounts, no app downloads.
🔒 **Zero-Knowledge Encryption**: Files and clipboard text are encrypted client-side using browser-native AES-256-GCM before reaching the server.
🌊 **Memory-Bound Streaming**: Implemented raw streaming I/O pipelines in Node.js to stream 100MB files without exhausting V8 memory heap buffers.
🧹 **Automated Lifecycle**: When the session expires or the host exits, all files and metadata are unlinked and permanently purged.

Check out the code and architecture on GitHub:
👉 https://github.com/tanmay9783/dropx

Feedback and contributions are welcome!

---

### Post 2: Deep Technical Breakdown
**Why handling 100MB file uploads in Node.js requires rethinking multipart parsing:**

When building **DropX** (an ephemeral cross-device data sharing platform), one of the first architectural bottlenecks was handling simultaneous multi-device file transfers.

Traditional implementations rely on standard multipart body parsers that buffer incoming file chunks into memory until the entire payload is assembled. With multiple concurrent 100MB uploads, the V8 heap quickly climbs, triggering severe garbage collection pauses or out-of-memory crashes.

Here’s how we architected DropX to solve this:
1. **Decoupled Metadata Negotiation**: The client first requests an upload slot (`POST /upload-url`) passing sanitized file metadata, verifying room quotas and storage limits.
2. **Raw Stream Piping**: The actual upload endpoint uses `express.raw` and pipes the binary stream directly to disk, keeping process memory bounded at stream buffer sizes (~64KB).
3. **Atomic Completion Verification**: Upon upload completion, the client triggers a handshake where the server verifies disk byte counts via `fs.stat` before broadcasting availability to room peers.
4. **Zero-Knowledge AES-256-GCM**: The payload is encrypted in the client browser with Web Crypto API keys derived from the room code, meaning the server operates as an untrusted byte pipe.

Curious to hear how other engineers handle high-volume streaming I/O in Node.js!

Read the full system architecture in the repo: https://github.com/tanmay9783/dropx

---

### Post 3: Short Project Update
Sharing files between mobile and desktop shouldn't require sending messages to yourself on Slack or uploading to Google Drive.

Built **DropX**:
- 📱 Connect devices via QR code
- 💬 Live clipboard sync for text & links
- 📁 Encrypted streaming file transfers
- ⏱️ Auto-purged after 2 hours. Zero trace.

Built with Node.js, React 18, TypeScript, Socket.IO, and Redis.

GitHub: https://github.com/tanmay9783/dropx

---

## 4. Technical Interview Preparation & Talking Points

### 30-Second Elevator Pitch
"DropX is an ephemeral, zero-knowledge file and clipboard sharing system. It connects any smartphone, tablet, or desktop in seconds via dynamic QR codes without accounts or app installs. It uses memory-bounded Node.js streaming to transfer up to 100MB files with minimal heap footprint, encrypts data client-side with AES-256-GCM, coordinates real-time state with Socket.IO and Redis Pub/Sub, and automatically purges all disk and database records when a room expires."

### 1-Minute Technical Overview
"DropX was engineered to solve cross-ecosystem file sharing between iOS, Android, and desktop operating systems without leaving data trails on third-party cloud storage. 

Architecturally, it pairs devices through a temporary room model using Crockford-style ambiguous-character-free codes. To solve Node.js memory exhaustion under concurrent 100MB uploads, I designed a three-stage streaming protocol that decouples metadata negotiation from raw binary stream piping, keeping heap utilization constant. 

For privacy, files and clipboard snippets undergo client-side AES-256-GCM Zero-Knowledge encryption using the native Web Crypto API. On the infrastructure side, real-time presence is synchronized across nodes via Socket.IO and Redis Pub/Sub, backed by atomic Redis distributed locks that coordinate periodic garbage collection to ensure zero permanent storage retention."

### 3-Minute System Design Walkthrough
"When designing DropX, I focused on three key engineering challenges: streaming scalability, zero-trust security, and deterministic ephemerality.

First, **Streaming Scalability**: Traditional multipart parsers buffer files into server memory, which doesn't scale for concurrent 100MB transfers in Node.js. In DropX, the client requests an upload authorization slot via REST, where the server validates room file quotas (max 20 files, 500MB total) and creates an uncompleted 'pending' record. The client then streams raw binary data directly to disk via HTTP PUT. Finally, a completion request verifies physical disk size via asynchronous `stat` calls and promotes the database record to 'active' before broadcasting metadata over Socket.IO.

Second, **Zero-Knowledge Security**: The platform assumes the server could be compromised. We implement client-side AES-256-GCM encryption using `window.crypto.subtle`. The room key is derived deterministically from the room code with a cryptographic salt. Payloads are encrypted with random 12-byte initialization vectors prepended to the ciphertext. The server only sees encrypted blobs. For authentication, participant sessions are validated via signed HMAC-SHA256 tokens checked with `crypto.timingSafeEqual`.

Third, **Deterministic Ephemerality & Clustering**: Active sessions expire after a strict TTL. To avoid race conditions in multi-container setups, a background cleanup worker uses Redis mutex locks (`SET NX PX`) so that only one worker instance unlinks physical files and updates database statuses. If Redis is unavailable, the system safely falls back to local in-memory presence and SQLite storage, providing seamless local development with zero external dependencies."

---

## 5. 20 In-Depth Technical Interview Questions & Answers

### Architecture & System Design

#### Q1: Why did you decouple file upload into a three-step protocol instead of using a standard multipart form POST?
**Answer**:  
Multipart form parsers (like standard Multer or Busboy) parse multipart boundaries and hold payload buffers in the Node.js V8 heap. Under concurrent uploads of 100MB files, process memory spikes rapidly, leading to aggressive garbage collection pauses and potential out-of-memory crashes. 

By separating the lifecycle into `POST /upload-url`, `PUT /upload`, and `POST /complete`:
1. Metadata (filename, MIME type, size) is validated upfront against room storage quotas before accepting any bytes.
2. The payload endpoint accepts raw binary streams (`express.raw`), piping chunks directly to disk with minimal memory overhead (~64KB buffers).
3. The completion endpoint verifies physical file size against filesystem metadata, preventing client-side size spoofing before notifying peers over WebSockets.

#### Q2: How does DropX scale horizontally across multiple application server instances?
**Answer**:  
The backend is stateless with externalized distributed coordination:
1. **WebSocket Synchronization**: Sockets use `@socket.io/redis-adapter`. When a file is uploaded or a participant joins, the broadcast event is published to Redis Pub/Sub, fanning out to connected sockets across all application containers.
2. **Distributed Presence**: Connected peer states are tracked in a Redis Hash (`room:presence:{roomCode}`) rather than local instance memory.
3. **Distributed Rate Limiting**: Endpoint rate limiters use `rate-limit-redis` so IP thresholds are enforced across all cluster nodes.
4. **Distributed Cleaner Locking**: Periodic background cleanup jobs compete for an atomic Redis mutex (`lock:room-cleanup` with `NX` and `PX` TTL), ensuring only one instance runs file unlinking and database sweep cycles.

#### Q3: How do you handle database abstraction without introducing heavyweight ORM overhead?
**Answer**:  
DropX uses a repository pattern with dynamic driver injection in `backend/src/db/index.js`. At boot time, if `DATABASE_URL` is detected, it initializes a PostgreSQL connection pool (`pg.Pool`) with configured pool sizes and timeouts. If unset, it automatically provisions an SQLite file database in `./data/dropx.sqlite`. 

The repository functions (`roomRepository.js`, `fileRepository.js`, `snippetRepository.js`) write standard SQL queries. In SQLite mode, parameter placeholders (`$1`, `$2`) are translated to `?` dynamically, allowing identical data access logic to run seamlessly across both engines without heavy ORM runtime overhead.

#### Q4: What happens if a client disconnects mid-upload, leaving an orphaned file slot?
**Answer**:  
DropX uses a deterministic state machine: `pending` ➔ `active` ➔ `expired` / `deleted`. When an upload slot is requested, it is recorded as `pending`. If the client crashes or disconnects during the raw PUT stream:
1. The file never completes the handshake, so peers are never notified and it cannot be downloaded.
2. The background cleanup sweeper runs every 60 seconds and queries `findStalePendingFiles(cutoffIso)`, identifying any `pending` files created more than `PENDING_FILE_TTL_MINUTES` (30 minutes) ago.
3. The sweeper unlinks any partial physical disk bytes and marks the database record as `expired`.

---

### Cryptography & Security

#### Q5: Explain the client-side Zero-Knowledge encryption implementation.
**Answer**:  
DropX utilizes the browser's native Web Crypto API (`window.crypto.subtle`):
1. **Key Derivation**: `deriveRoomKey(roomCode)` takes the uppercase 6-character room code, combines it with a high-entropy salt (`dropx-secure-salt-v1:`), and hashes it via `SHA-256` to derive a 256-bit AES-GCM CryptoKey.
2. **Encryption**: `encryptBlob()` generates a cryptographically secure random 12-byte initialization vector (IV) via `window.crypto.getRandomValues(new Uint8Array(12))`. It encrypts the plaintext using `AES-GCM-256`, prepends the 12-byte IV to the ciphertext, and uploads the combined blob.
3. **Decryption**: `decryptBlob()` reads the first 12 bytes as the IV, decrypts the remaining ciphertext using the room key, and reconstructs the decrypted File/Blob with its original MIME type. The server never has access to unencrypted file content or clipboard text.

#### Q6: How are participant and owner authorizations validated without persistent user accounts?
**Answer**:  
DropX uses a tiered, room-scoped token hierarchy:
1. **Room Creator**: When a room is created, the server generates a 64-character hexadecimal `ownerToken` (32 bytes of secure random entropy) stored in the database. Administrative operations (like `DELETE /api/rooms/:roomCode`) require this bearer token, which is validated using constant-time comparison (`crypto.timingSafeEqual`).
2. **Participants**: Joining participants receive an HMAC-SHA256 signed `socketToken` containing `{ roomCode, participantId, role, exp }`.
3. **Authorization Middleware**: `authenticateRoomAccess` validates the token's HMAC signature and verifies that `token.roomCode === req.params.roomCode`, preventing cross-room token reuse (IDOR protection).

#### Q7: Why is `crypto.timingSafeEqual` used instead of a standard string equality operator (`===`)?
**Answer**:  
Standard string comparisons (`a === b`) evaluate characters sequentially and terminate at the first non-matching character. This exposes a side-channel timing attack where an attacker measures response times to deduce valid characters of a token byte-by-byte. `crypto.timingSafeEqual` executes in constant time regardless of where discrepancies occur, neutralizing timing side-channel vulnerabilities.

#### Q8: How does DropX protect against Path Traversal vulnerabilities in file uploads?
**Answer**:  
DropX implements defense-in-depth sanitization in `fileService.js` and `localStorage.js`:
1. Strips carriage returns, null bytes (`\0`), and path separators (`/`, `\`).
2. Enforces `path.basename()` to strip any directory traversal sequences (e.g., `../../etc/passwd`).
3. Replaces HTML and shell control characters (`<`, `>`, `"`, `'`) with underscores.
4. Server disk storage organizes files under synthetic object keys formatted as `rooms/${roomCode}/${fileId}` where `fileId` is an internally generated UUID v4. The original user filename is stored only as metadata and is never used as the filesystem path.

#### Q9: What protects the public room creation and join endpoints from brute-force scanning?
**Answer**:  
1. **Ambiguity-Free Crockford Alphabet**: Room codes are 6 characters long and drawn from a 32-character set (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`), yielding $32^6 \approx 1.07 \times 10^9$ possible combinations.
2. **Multi-Tier Rate Limiting**: The room join endpoint is constrained to a maximum of 30 requests per 15 minutes per IP via Redis-backed rate limiting. Room creation is capped at 20 requests per 15 minutes.
3. **Lazy Expiration**: Inactive codes quickly expire (default 2 hours), drastically shrinking the active search space.

---

### Concurrency & Real-Time Engineering

#### Q10: How does DropX handle race conditions where a room expires while a file is actively uploading?
**Answer**:  
In `completeUpload()` (`fileService.js`), before marking the file as active, the service executes a secondary check on room status:
```javascript
try {
  await roomService.getRoom(roomCode);
} catch (roomErr) {
  const record = await fileRepository.findFileById(fileId, roomCode);
  if (record) {
    await localStorage.deleteObject({ objectKey: record.objectKey });
    await fileRepository.updateFileStatus(fileId, 'expired');
  }
  throw roomErr;
}
```
If the room expired mid-upload, the completion call catches the expiration error, immediately unlinks the newly uploaded disk file, marks the database record as `expired`, and returns HTTP 410.

#### Q11: Why is metadata broadcast over WebSockets rather than streaming the file payload directly over the socket?
**Answer**:  
Socket.IO runs over WebSocket frames that share the Node.js event loop thread. Streaming large binary files (e.g., 50MB–100MB) directly across WebSocket channels causes frame interleaving, head-of-line blocking, high socket buffer memory pressure, and degraded heartbeat latency for other room peers. 

DropX uses WebSockets strictly as a **control and signaling plane** (broadcasting presence, clipboard text, and file availability metadata), while delegating high-volume binary data to the **HTTP streaming plane** (`PUT /upload` and `GET /download`).

#### Q12: How does the client-side countdown timer stay synchronized when a mobile browser tab is backgrounded?
**Answer**:  
JavaScript `setInterval` is heavily throttled or suspended by mobile operating systems (iOS Safari and Android Chrome) when tabs are backgrounded. In `useCountdownTimer.ts`, DropX listens to the `document.visibilitychange` event. When the user returns to the tab (`document.visibilityState === 'visible'`), the hook immediately recalculates the difference between the target `expiresAt` ISO timestamp and `Date.now()`, resynchronizing the display without relying on missed interval ticks.

---

### Reliability, Observability & Performance

#### Q13: How is structured logging implemented without leaking sensitive participant data?
**Answer**:  
DropX uses **Pino** and **Pino-Http** (`backend/src/utils/logger.js`). Pino outputs low-overhead structured JSON logs. To prevent accidental leakage of sensitive tokens and credentials in server logs or log aggregators (e.g., Datadog, CloudWatch), the logger is configured with strict redaction paths:
```javascript
redact: {
  paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token', 'presignedUrl'],
  censor: '[REDACTED]'
}
```

#### Q14: How does DropX ensure zero downtime and clean termination during container orchestrator rolling updates?
**Answer**:  
`backend/src/server.js` registers handlers for `SIGTERM` and `SIGINT`:
1. Halts the periodic background cleanup job interval.
2. Stops accepting new HTTP connections via `httpServer.close()`.
3. Cleanly closes Redis client connections and drains the PostgreSQL pool (`pool.end()`) or SQLite handle.
4. Sets an unref'd 10-second watchdog timer: if lingering network connections do not terminate within 10 seconds, `process.exit(1)` forces shutdown to prevent hanging container deployments.

#### Q15: How does the frontend handle file upload progress and speed measurement?
**Answer**:  
`frontend/src/services/api.ts` implements upload streaming via `XMLHttpRequest` (XHR) because the native `fetch` API does not provide a standard `upload.onprogress` listener across all mobile browsers. The `xhr.upload.onprogress` callback computes:
- Percentage: `Math.round((loaded / total) * 100)`
- Bandwidth Speed: `loadedBytes / elapsedSeconds` formatted into human-readable `formatBytes(bps) + '/s'`
- ETA: `remainingBytes / bps` displayed in real time on the upload card.

#### Q16: How are room storage quotas enforced?
**Answer**:  
Storage limits are checked atomically during the upload URL request (`fileService.js`):
1. **Per-file limit**: `sizeBytes <= MAX_FILE_SIZE_MB * 1024 * 1024` (default 100MB).
2. **Room count limit**: `countNonTerminalFilesByRoom(roomCode) < MAX_FILES_PER_ROOM` (default 20).
3. **Aggregate room quota**: `getRoomStorageUsageBytes(roomCode) + sizeBytes <= MAX_ROOM_STORAGE_BYTES` (default 500MB).  
Non-terminal files include both `active` and in-flight `pending` files, preventing concurrent requests from exceeding room allocations.

---

### Trade-Offs & Edge Cases

#### Q17: What was the trade-off in using deterministic room key derivation rather than a URL fragment key?
**Answer**:  
In traditional Zero-Knowledge web tools, encryption keys are placed in the URL hash fragment (`https://example.com/join/CODE#key=...`) so the server never receives the key. 

However, users frequently join DropX rooms by manually typing the 6-character room code on another device. Forcing users to manually retype a 32-character base64 encryption key creates severe friction. DropX derives the AES-GCM key directly from the 6-character room code using salted `SHA-256`. 

The trade-off is that anyone with the 6-character room code can decrypt room files. The security model relies on the entropy of the code ($>10^9$ combinations), rate limiting on room joins, and the short 2-hour room TTL.

#### Q18: Why did you not implement WebRTC DataChannels for file transfers?
**Answer**:  
While WebRTC DataChannels enable true peer-to-peer transfers, they introduce significant real-world operational friction:
1. They require STUN/TURN infrastructure; symmetric NATs on mobile cellular networks frequently block direct P2P connections without expensive TURN relays.
2. Both devices must remain active and connected simultaneously; if the sender closes their tab before the receiver downloads, the transfer fails.
3. By using ephemeral server storage sinks, a mobile user can upload a file, lock their phone, and allow desktop peers to download the file at their convenience during the 2-hour window.

#### Q19: What happens if the Redis instance crashes in production?
**Answer**:  
1. Socket.IO connection handling catches the Redis pub/sub failure and logs an error, continuing to route local events to sockets connected to the same container instance.
2. The rate limiter and cleanup job gracefully fall back to local in-memory operation if Redis connection handles fail.
3. The database (PostgreSQL) remains the authoritative source of truth for rooms, files, and snippets, preventing data corruption.

#### Q20: What are the primary scalability limitations of the current architecture, and how would you address them?
**Answer**:  
1. **Local Storage Bound**: Files are saved to the container host's local filesystem (`LOCAL_STORAGE_DIR`). In a multi-node deployment, clients must either use sticky sessions to reach the node where the file was saved, or use a shared distributed volume (e.g., NFS, AWS EFS). **Solution**: Implement the S3 storage driver interface with AWS S3 or Cloudflare R2 pre-signed URLs.
2. **Server Bandwidth**: Server bandwidth scales linearly with transfer volume. **Solution**: With S3 pre-signed URLs, clients upload and download directly to and from object storage buckets, reducing application server bandwidth to near zero.

