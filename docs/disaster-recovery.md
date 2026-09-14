# DropX Operational Disaster Recovery & Incident Response Runbook

This runbook outlines operational procedures, detection mechanisms, and recovery steps for failure domains across DropX's self-hosted architecture.

---

## 1. Application Server Process Crash

- **Symptoms**: Backend service stops responding to HTTP/WebSocket requests.
- **Detection**: `/api/health` check fails or PM2/systemd logs report process exit.
- **Immediate Impact**: Active room connections drop.
- **Recovery Steps**:
  1. `systemd` / `pm2` process manager automatically restarts `dropx-backend` within seconds.
  2. Database connections (SQLite or PostgreSQL) are re-established on boot.
- **Verification**: `curl http://localhost:3000/api/health` returns HTTP 200 OK.

---

## 2. Storage System Recovery

- **Symptoms**: Uploads fail or file access returns `FILE_NOT_FOUND`.
- **Detection**: Backend logs show disk write/stat errors (`ENOENT`, `EACCES`, `ENOSPC`).
- **Recovery Steps**:
  1. Verify filesystem permissions on `LOCAL_STORAGE_DIR` (e.g. `chmod 755 ./data/uploads`).
  2. Verify available disk space using `df -h`.
  3. Run backend cleanup worker to purge expired files: `node -e "import('./src/services/fileService.js').then(m => m.fileService.cleanupExpiredFiles())"`.

---

## 3. Database Recovery & Data Maintenance

- **Symptoms**: API requests fail with database connection errors.
- **Recovery Steps**:
  1. For SQLite: Verify database file `data/dropx.sqlite` exists and has read/write permissions.
  2. For PostgreSQL: Restart PostgreSQL server service (`sudo systemctl restart postgresql`).
  3. If database file is corrupted, restore from latest backup snapshot.

---

## 4. Accidental File Deletion Policy

- **Policy**:
  - DropX files are intentionally **ephemeral** with a strict room TTL (default 2 hours).
  - Expired or deleted files are purged permanently from local storage by design.
