import { Router } from 'express';
import { appStore } from '../../shared/store.js';

export const portfolioRouter = Router();

portfolioRouter.get('/summary', (_req, res) => {
  res.json({ success: true, data: appStore.getPortfolioSummary() });
});

portfolioRouter.get('/positions', (_req, res) => {
  res.json({ success: true, data: appStore.getPositions() });
});
