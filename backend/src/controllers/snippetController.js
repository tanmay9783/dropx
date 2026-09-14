import { snippetService } from '../services/snippetService.js';

export const snippetController = {
  async getSnippets(req, res, next) {
    try {
      const { roomCode } = req.params;
      const snippets = await snippetService.getSnippets(roomCode);
      res.status(200).json({ snippets });
    } catch (err) {
      next(err);
    }
  },

  async createSnippet(req, res, next) {
    try {
      const { roomCode } = req.params;
      const { content } = req.body;
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Snippet content is required' } });
      }
      const snippet = await snippetService.createSnippet(roomCode, content.trim());
      res.status(201).json({ snippet });
    } catch (err) {
      next(err);
    }
  },

  async deleteSnippet(req, res, next) {
    try {
      const { roomCode, snippetId } = req.params;
      const result = await snippetService.deleteSnippet(roomCode, snippetId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
};
