import { Router } from 'express';
import { z } from 'zod';
import {
  cancelAllPolymarketOrders,
  fetchPolymarketOpenOrders,
  getPolymarketRuntimeStatus,
  placePolymarketLimitOrder,
  testPolymarketAuth,
} from '../../connectors/polymarket/client.js';

export const tradingRouter = Router();

const placeOrderSchema = z.object({
  tokenId: z.string().min(1),
  side: z.enum(['BUY', 'SELL']),
  price: z.number().positive(),
  size: z.number().positive(),
  orderType: z.enum(['GTC', 'GTD']).default('GTC'),
  postOnly: z.boolean().optional(),
  deferExec: z.boolean().optional(),
});

tradingRouter.get('/status', async (_req, res) => {
  const status = await getPolymarketRuntimeStatus();
  res.json({ success: true, data: status });
});

tradingRouter.post('/auth/test', async (_req, res) => {
  try {
    const data = await testPolymarketAuth();
    res.json({ success: true, data: { ...data, testedAt: Date.now() } });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'POLY_AUTH_TEST_FAILED',
        message: error instanceof Error ? error.message : 'Failed to test Polymarket auth',
      },
    });
  }
});

tradingRouter.get('/open-orders', async (req, res) => {
  try {
    const market = typeof req.query.market === 'string' ? req.query.market : undefined;
    const asset_id = typeof req.query.asset_id === 'string' ? req.query.asset_id : undefined;
    const data = await fetchPolymarketOpenOrders({ market, asset_id });
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'POLY_OPEN_ORDERS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to fetch open orders',
      },
    });
  }
});

tradingRouter.post('/order', async (req, res) => {
  const parsed = placeOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid order payload',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  try {
    const data = await placePolymarketLimitOrder(parsed.data);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'POLY_PLACE_ORDER_FAILED',
        message: error instanceof Error ? error.message : 'Failed to place order',
      },
    });
  }
});

tradingRouter.delete('/orders/all', async (_req, res) => {
  try {
    const data = await cancelAllPolymarketOrders();
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'POLY_CANCEL_ALL_FAILED',
        message: error instanceof Error ? error.message : 'Failed to cancel all orders',
      },
    });
  }
});
