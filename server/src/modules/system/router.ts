import { Router } from 'express';
import { appStore } from '../../shared/store.js';

export const systemRouter = Router();

systemRouter.get('/metrics', (req, res) => {
  const windowText = typeof req.query.window === 'string' ? req.query.window : '5m';
  const minutes = windowText.endsWith('m') ? Number(windowText.slice(0, -1)) : 5;
  const points = Number.isFinite(minutes) ? Math.max(1, Math.min(60, minutes)) * 60 : 300;

  res.json({
    success: true,
    data: appStore.getMetrics(points),
  });
});

systemRouter.get('/logs', (req, res) => {
  const limit = Number(req.query.limit ?? '200');
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, limit)) : 200;

  res.json({ success: true, data: appStore.getLogs(safeLimit) });
});
