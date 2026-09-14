import { snippetRepository } from '../db/snippetRepository.js';
import { generateUuid } from '../utils/crypto.js';
import { getSocketIo } from '../sockets/socketHandler.js';

export const snippetService = {
  /**
   * Create a new text snippet in a room and broadcast to socket listeners.
   */
  async createSnippet(roomCode, content) {
    const cleanRoomCode = String(roomCode).trim().toUpperCase();
    const id = generateUuid();
    const createdAt = new Date().toISOString();
    const snippet = await snippetRepository.createSnippet({
      id,
      roomCode: cleanRoomCode,
      content,
      createdAt,
    });

    const io = getSocketIo();
    if (io) {
      io.to(cleanRoomCode).emit('snippet:created', snippet);
    }

    return snippet;
  },

  /**
   * Get all snippets in a room.
   */
  async getSnippets(roomCode) {
    return snippetRepository.getSnippetsByRoom(String(roomCode).trim().toUpperCase());
  },

  /**
   * Delete a snippet in a room.
   */
  async deleteSnippet(roomCode, snippetId) {
    const cleanRoomCode = String(roomCode).trim().toUpperCase();
    await snippetRepository.deleteSnippet(snippetId, cleanRoomCode);

    const io = getSocketIo();
    if (io) {
      io.to(cleanRoomCode).emit('snippet:deleted', { id: snippetId, roomCode: cleanRoomCode });
    }

    return { success: true };
  },
};
