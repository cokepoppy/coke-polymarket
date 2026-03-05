import { createCipheriv, randomBytes, createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { appStore } from '../../shared/store.js';

export const settingsRouter = Router();

const credentialSchema = z.object({
  keyId: z.string().optional(),
  apiKey: z.string().min(8),
});

function encryptCredential(value: string): string {
  const iv = randomBytes(12);
  const key = createHash('sha256').update(env.appSecret).digest();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

settingsRouter.get('/credentials/polymarket', (_req, res) => {
  res.json({ success: true, data: appStore.getCredentialStatus() });
});

settingsRouter.put('/credentials/polymarket', async (req, res) => {
  const parsed = credentialSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid credential payload',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const ciphertext = encryptCredential(parsed.data.apiKey);
  const status = await appStore.saveCredential({ keyId: parsed.data.keyId, apiKey: ciphertext });

  res.json({
    success: true,
    data: {
      ...status,
      message: 'Credential stored successfully',
    },
  });
});
