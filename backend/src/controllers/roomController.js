import { roomService } from '../services/roomService.js';

export const roomController = {
  async createRoom(req, res, next) {
    try {
      const result = await roomService.createRoom();
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async getRoom(req, res, next) {
    try {
      const { roomCode } = req.params;
      const result = await roomService.getRoom(roomCode);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async joinRoom(req, res, next) {
    try {
      const { roomCode } = req.params;
      const result = await roomService.joinRoom(roomCode);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async destroyRoom(req, res, next) {
    try {
      const { roomCode } = req.params;
      const ownerToken = req.ownerToken;
      const result = await roomService.destroyRoom(roomCode, ownerToken);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
};
