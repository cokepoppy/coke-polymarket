import { env } from '../config/env.js';
import { appStore } from './store.js';

let timer: NodeJS.Timeout | null = null;

export function startSimulator(): void {
  if (timer) {
    return;
  }

  timer = setInterval(() => {
    appStore.tick();
  }, env.tickIntervalMs);
}

export function stopSimulator(): void {
  if (!timer) {
    return;
  }

  clearInterval(timer);
  timer = null;
}
