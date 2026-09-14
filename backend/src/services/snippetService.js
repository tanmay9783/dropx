import { snippetRepository } from '../db/snippetRepository.js';
import { generateUuid } from '../utils/crypto.js';
import { getSocketIo } from '../sockets/socketHandler.js';

export const snippetService = {
  /**
   * Create a new text snippet in a room and broadcast to socket listeners.
   */
  async createSnippet(roomCode, content) {
    const id = generateUuid();
    const createdAt = new Date().toISOString();
    const snippet = await snippetRepository.createSnippet({
      id,
      roomCode,
      content,
      createdAt,
    });

    const io = getSocketIo();
    if (io) {
      io.to(roomCode).emit('snippet:created', snippet);
    }

    return snippet;
  },

  /**
   * Get all snippets in a room.
   */
  async getSnippets(roomCode) {
    return snippetRepository.getSnippetsByRoom(roomCode);
  },

  /**
   * Delete a snippet in a room.
   */
  async deleteSnippet(roomCode, snippetId) {
    await snippetRepository.deleteSnippet(snippetId, roomCode);

    const io = getSocketIo();
    if (io) {
      io.to(roomCode).emit('snippet:deleted', { id: snippetId, roomCode });
    }

    return { success: true };
  },
};
