import { Router } from 'express';
import { z } from 'zod';
import { appStore } from '../../shared/store.js';
import type { RiskRule } from '../../types/domain.js';

export const riskRouter = Router();

const updateRuleSchema = z.object({
  name: z.enum(['max_position_usdc', 'global_stop_loss_pct', 'max_orders_per_min', 'daily_loss_limit']),
  value: z.number(),
  enabled: z.boolean().default(true),
});

riskRouter.get('/rules', (_req, res) => {
  res.json({ success: true, data: appStore.getRiskRules() });
});

riskRouter.put('/rules', async (req, res) => {
  const payload = Array.isArray(req.body) ? req.body : [req.body];
  const parsed = z.array(updateRuleSchema).safeParse(payload);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid risk rule payload',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const updates: RiskRule[] = [];
  for (const item of parsed.data) {
    const updated = await appStore.updateRiskRule(item.name, item.value, item.enabled);
    if (updated) {
      updates.push(updated);
    }
  }

  res.json({ success: true, data: updates });
});

riskRouter.get('/events', (req, res) => {
  const limit = Number(req.query.limit ?? '100');
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, limit)) : 100;

  res.json({ success: true, data: appStore.getRiskEvents(safeLimit) });
});
