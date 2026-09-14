import { getDb } from './index.js';

export const fileRepository = {
  /**
   * Insert a new file metadata record (defaults to 'pending' status).
   */
  async createFileRecord({
    id,
    roomCode,
    participantId,
    originalName,
    objectKey,
    mimeType,
    sizeBytes,
    createdAt,
    status = 'pending',
    storageProvider = 'local',
  }) {
    const db = getDb();
    const sql = `
      INSERT INTO files (id, room_code, participant_id, original_name, object_key, mime_type, size_bytes, created_at, status, storage_provider)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    await db.query(sql, [
      id,
      roomCode,
      participantId,
      originalName,
      objectKey,
      mimeType,
      sizeBytes,
      createdAt,
      status,
      storageProvider,
    ]);
    return {
      id,
      roomCode,
      participantId,
      originalName,
      objectKey,
      mimeType,
      sizeBytes,
      createdAt,
      status,
      storageProvider,
    };
  },

  /**
   * Find file by ID and room code.
   */
  async findFileById(fileId, roomCode) {
    const db = getDb();
    const sql = `
      SELECT id, room_code AS "roomCode", participant_id AS "participantId", original_name AS "originalName",
             object_key AS "objectKey", mime_type AS "mimeType", size_bytes AS "sizeBytes",
             created_at AS "createdAt", status, storage_provider AS "storageProvider"
      FROM files
      WHERE id = $1 AND room_code = $2
    `;
    const rows = await db.query(sql, [fileId, roomCode]);
    if (!rows || rows.length === 0) return null;
    return rows[0];
  },

  /**
   * Find all active files for a room code.
   */
  async findFilesByRoomCode(roomCode) {
    const db = getDb();
    const sql = `
      SELECT id, room_code AS "roomCode", participant_id AS "participantId", original_name AS "originalName",
             object_key AS "objectKey", mime_type AS "mimeType", size_bytes AS "sizeBytes",
             created_at AS "createdAt", status, storage_provider AS "storageProvider"
      FROM files
      WHERE room_code = $1 AND status = 'active'
      ORDER BY created_at ASC
    `;
    const rows = await db.query(sql, [roomCode]);
    return rows || [];
  },

  /**
   * Update file status ('pending' | 'active' | 'deleted' | 'expired').
   */
  async updateFileStatus(fileId, status, sizeBytes = null) {
    const db = getDb();
    if (sizeBytes !== null && sizeBytes !== undefined) {
      const sql = `
        UPDATE files
        SET status = $1, size_bytes = $2
        WHERE id = $3
      `;
      await db.query(sql, [status, sizeBytes, fileId]);
    } else {
      const sql = `
        UPDATE files
        SET status = $1
        WHERE id = $2
      `;
      await db.query(sql, [status, fileId]);
    }
  },

  /**
   * Find active or pending files belonging to expired rooms.
   */
  async findActiveFilesForExpiredRooms() {
    const db = getDb();
    const sql = `
      SELECT f.id, f.object_key AS "objectKey", f.room_code AS "roomCode", f.status
      FROM files f
      JOIN rooms r ON f.room_code = r.room_code
      WHERE f.status IN ('active', 'pending') AND (r.status = 'expired' OR r.expires_at <= $1)
    `;
    const rows = await db.query(sql, [new Date().toISOString()]);
    return rows || [];
  },

  /**
   * Find stale pending files created before cutoffIso timestamp.
   */
  async findStalePendingFiles(cutoffIso) {
    const db = getDb();
    const sql = `
      SELECT id, object_key AS "objectKey", room_code AS "roomCode", created_at AS "createdAt"
      FROM files
      WHERE status = 'pending' AND created_at <= $1
    `;
    const rows = await db.query(sql, [cutoffIso]);
    return rows || [];
  },

  /**
   * Count active and pending files for a given room.
   */
  async countNonTerminalFilesByRoom(roomCode) {
    const db = getDb();
    const sql = `
      SELECT COUNT(*) AS count
      FROM files
      WHERE room_code = $1 AND status IN ('active', 'pending')
    `;
    const rows = await db.query(sql, [roomCode]);
    if (!rows || rows.length === 0) return 0;
    return Number(rows[0].count || rows[0].COUNT || 0);
  },

  /**
   * Sum total size in bytes of active and pending files for a given room.
   */
  async getRoomStorageUsageBytes(roomCode) {
    const db = getDb();
    const sql = `
      SELECT COALESCE(SUM(size_bytes), 0) AS total_bytes
      FROM files
      WHERE room_code = $1 AND status IN ('active', 'pending')
    `;
    const rows = await db.query(sql, [roomCode]);
    if (!rows || rows.length === 0) return 0;
    return Number(rows[0].total_bytes || rows[0].TOTAL_BYTES || 0);
  },
};
