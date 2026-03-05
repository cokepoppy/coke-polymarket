import { Router } from 'express';
import { appStore } from '../../shared/store.js';

export const marketsRouter = Router();

marketsRouter.get('/', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const strategy = typeof req.query.strategy === 'string' ? req.query.strategy : undefined;
  const page = Number(req.query.page ?? '1');
  const pageSize = Number(req.query.pageSize ?? '20');

  const data = appStore.getMarkets({
    q,
    strategy,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
  });

  res.json({ success: true, data });
});

marketsRouter.get('/:marketId/orderbook', (req, res) => {
  const marketId = req.params.marketId;
  const orderbook = appStore.getOrderbook(marketId);

  if (!orderbook) {
    res.status(404).json({ success: false, error: { code: 'MARKET_NOT_FOUND', message: 'Market not found' } });
    return;
  }

  res.json({ success: true, data: orderbook });
});
