import { Router } from 'express';
import { z } from 'zod';
import { appStore } from '../../shared/store.js';
import type { StrategyTag } from '../../types/domain.js';

export const strategiesRouter = Router();

const strategySchema = z.object({
  enabled: z.boolean(),
  params: z.record(z.unknown()).default({}),
});

strategiesRouter.get('/', (_req, res) => {
  res.json({ success: true, data: appStore.getStrategies() });
});

strategiesRouter.put('/:strategyName/config', async (req, res) => {
  const parsed = strategySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid strategy config payload',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const strategyName = decodeURIComponent(req.params.strategyName) as StrategyTag;
  const updated = await appStore.updateStrategy(strategyName, parsed.data.enabled, parsed.data.params);
  if (!updated) {
    res.status(404).json({ success: false, error: { code: 'STRATEGY_NOT_FOUND', message: 'Strategy not found' } });
    return;
  }

  res.json({ success: true, data: updated });
});
