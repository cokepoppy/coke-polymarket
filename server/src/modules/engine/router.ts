import { Router } from 'express';
import { appStore } from '../../shared/store.js';

export const engineRouter = Router();

engineRouter.get('/state', (_req, res) => {
  res.json({
    success: true,
    data: {
      state: appStore.getEngineState(),
      ts: Date.now(),
    },
  });
});

engineRouter.post('/start', (_req, res) => {
  const state = appStore.startEngine();
  res.json({ success: true, data: { state, ts: Date.now() } });
});

engineRouter.post('/stop', (_req, res) => {
  const state = appStore.stopEngine();
  res.json({ success: true, data: { state, ts: Date.now() } });
});

engineRouter.post('/kill-switch', (_req, res) => {
  const state = appStore.killSwitch();
  res.json({ success: true, data: { state, ts: Date.now() } });
});
