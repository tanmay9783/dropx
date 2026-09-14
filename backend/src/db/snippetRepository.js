import { getDb } from './index.js';

export const snippetRepository = {
  /**
   * Insert a new text snippet.
   */
  async createSnippet({ id, roomCode, content, createdAt }) {
    const db = getDb();
    const sql = `
      INSERT INTO snippets (id, room_code, content, created_at)
      VALUES ($1, $2, $3, $4)
    `;
    await db.query(sql, [id, roomCode, content, createdAt]);
    return { id, roomCode, content, createdAt };
  },

  /**
   * Get all active snippets for a room.
   */
  async getSnippetsByRoom(roomCode) {
    const db = getDb();
    const sql = `
      SELECT id, room_code AS "roomCode", content, created_at AS "createdAt"
      FROM snippets
      WHERE room_code = $1
      ORDER BY created_at ASC
    `;
    return db.query(sql, [roomCode]);
  },

  /**
   * Delete a snippet by ID.
   */
  async deleteSnippet(id, roomCode) {
    const db = getDb();
    const sql = `
      DELETE FROM snippets
      WHERE id = $1 AND room_code = $2
    `;
    await db.query(sql, [id, roomCode]);
  },

  /**
   * Delete all snippets for a room.
   */
  async deleteSnippetsByRoom(roomCode) {
    const db = getDb();
    const sql = `
      DELETE FROM snippets
      WHERE room_code = $1
    `;
    await db.query(sql, [roomCode]);
  },
};
