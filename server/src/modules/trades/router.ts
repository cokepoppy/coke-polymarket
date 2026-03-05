import { Router } from 'express';
import { appStore } from '../../shared/store.js';

export const tradesRouter = Router();

tradesRouter.get('/fills', (req, res) => {
  const limit = Number(req.query.limit ?? '50');
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, limit)) : 50;

  res.json({
    success: true,
    data: appStore.getFills(safeLimit),
  });
});
