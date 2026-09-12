import { getDb } from './index.js';

export const roomRepository = {
  /**
   * Insert a new room record.
   */
  async createRoom({ id, roomCode, createdAt, expiresAt, status, ownerToken }) {
    const db = getDb();
    const sql = `
      INSERT INTO rooms (id, room_code, created_at, expires_at, status, owner_token)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await db.query(sql, [id, roomCode, createdAt, expiresAt, status, ownerToken]);
    return {
      id,
      roomCode,
      createdAt,
      expiresAt,
      status,
      ownerToken,
    };
  },

  /**
   * Find room by room_code.
   */
  async findRoomByCode(roomCode) {
    const db = getDb();
    const sql = `
      SELECT id, room_code AS "roomCode", created_at AS "createdAt", expires_at AS "expiresAt", status, owner_token AS "ownerToken"
      FROM rooms
      WHERE room_code = $1
    `;
    const rows = await db.query(sql, [roomCode]);
    if (!rows || rows.length === 0) return null;
    return rows[0];
  },

  /**
   * Update room status ('active' | 'expired').
   */
  async updateRoomStatus(roomCode, status) {
    const db = getDb();
    const sql = `
      UPDATE rooms
      SET status = $1
      WHERE room_code = $2
    `;
    await db.query(sql, [status, roomCode]);
  },

  /**
   * Expire all active rooms where expires_at <= NOW().
   * Returns count of updated rooms.
   */
  async expireOldRooms(nowIsoString) {
    const db = getDb();
    const sqlSelect = `
      SELECT room_code
      FROM rooms
      WHERE status = 'active' AND expires_at <= $1
    `;
    const rows = await db.query(sqlSelect, [nowIsoString]);
    if (!rows || rows.length === 0) return 0;

    const sqlUpdate = `
      UPDATE rooms
      SET status = 'expired'
      WHERE status = 'active' AND expires_at <= $1
    `;
    await db.query(sqlUpdate, [nowIsoString]);
    return rows.length;
  },
};
