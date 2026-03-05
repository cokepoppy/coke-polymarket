import { Router } from 'express';
import { appStore } from '../../shared/store.js';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', (_req, res) => {
  res.json({
    success: true,
    data: appStore.getDashboardSummary(),
  });
});

dashboardRouter.get('/profit-curve', (req, res) => {
  const days = Number(req.query.days ?? '50');
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(365, days)) : 50;

  res.json({
    success: true,
    data: appStore.getProfitCurve(safeDays),
  });
});
