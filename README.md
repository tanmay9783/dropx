# DropX — Highly Available, Secure & Self-Hosted QR File Sharing Platform

DropX is a production-grade, temporary QR-based file sharing platform designed for seamless cross-device file transfers without needing user accounts or sign-ups.

---

## 🚀 Features
- ⚡ **No Accounts Required**: Instant temporary rooms with zero friction.
- 📱 **QR Code Sharing**: Scan & join rooms instantly on secondary devices.
- 🔄 **Real-Time Synchronization**: Live presence and transfer signaling via Socket.IO.
- 🔒 **Security First**: Helmet headers, CORS policies, rate limiting, and strict input validations.
- 💾 **High-Speed Local Storage**: Zero reliance on third-party cloud services. Files are saved directly to encrypted local storage.
- ⏳ **Automated Cleanup**: Real-time room expiration and automated background file purges.

---

## 🛠️ Tech Stack
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Socket.IO client.
- **Backend**: Node.js, Express.js, Socket.IO, Zod, Helmet, CORS, Pino.
- **Database**: SQLite (local development) / PostgreSQL (production).
- **Storage**: High-Speed Local Disk Storage (saved under `./data/uploads/`).

---

## 💻 Local Development Setup

### Prerequisites
- Node.js >= 18.x
- npm / yarn / pnpm

### 1. Backend Setup
```bash
cd backend
npm install
npm run dev
# Server running at http://localhost:3000
# Health check: http://localhost:3000/api/health
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Vite app running at http://localhost:5173
```

---

## 🔄 File Lifecycle & Cleanup

DropX implements an automated, self-healing temporary file lifecycle:

```text
                 upload-url
                     │
                     ▼
                  pending
                     │
              Local PUT succeeds
                     │
                     ▼
                  complete()
                     │
              Local Stat succeeds
                     │
                     ▼
                  active
                  /     \
                 /       \
             delete     room expires
               │            │
               ▼            ▼
            deleted       expired
```

### Lifecycle Phases
1. **`pending` state**: Created when a browser requests an upload URL (`POST /upload-url`). Uncompleted uploads older than `PENDING_FILE_TTL_MINUTES` (default: 30m) are automatically cleaned.
2. **Local Storage Upload**: File bytes pass directly to local disk storage via streaming PUT endpoints.
3. **`/complete` & Local Stat**: Upon upload completion, browser calls `POST /complete`. The backend verifies file existence and size on local disk, updates state to `active`, and emits Socket.IO metadata events.
4. **`active` state**: Shared files are visible and downloadable via secure local download URLs (`GET /download-url`).
5. **Room Expiration & Storage Deletion**: When a room expires, background cleanup workers (`fileService.js`) delete associated local storage files and mark file DB records as `expired`.

### Configurable Lifecycle & Limit Environment Variables

```env
ROOM_TTL_MINUTES=120
ROOM_CLEANUP_INTERVAL_MS=60000
PENDING_FILE_TTL_MINUTES=30
UPLOAD_URL_EXPIRY_SECONDS=300
DOWNLOAD_URL_EXPIRY_SECONDS=300
MAX_FILE_SIZE_MB=100
MAX_FILES_PER_ROOM=20
MAX_ROOM_STORAGE_BYTES=524288000
STORAGE_PROVIDER=local
LOCAL_STORAGE_DIR=./data/uploads
```

---

## 🧪 Testing

To run the complete backend integration and security test suite:

```bash
cd backend
npm test
```
