import { createDecipheriv, createHash } from 'node:crypto';
import {
  ClobClient,
  Chain,
  OrderType,
  Side,
  SignatureType,
  type ApiKeyCreds,
  type UserOrder,
  type ClobSigner,
} from '@polymarket/clob-client';
import { Wallet } from 'ethers';
import { env } from '../../config/env.js';
import { appStore } from '../../shared/store.js';

type DecryptedCredentialBundle = {
  version: number;
  apiKey: string;
  secret: string;
  passphrase: string;
  savedAt?: number;
};

export type PolymarketRuntimeStatus = {
  configured: boolean;
  hasCredentials: boolean;
  hasPrivateKey: boolean;
  hasFunderAddress: boolean;
  canTrade: boolean;
  host: string;
  chainId: number;
  signatureType: number;
};

function decryptValue(value: string): string {
  const payload = Buffer.from(value, 'base64');
  if (payload.length < 29) {
    throw new Error('Invalid encrypted credential payload');
  }

  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const key = createHash('sha256').update(env.appSecret).digest();

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

function toChain(chainId: number): Chain {
  if (chainId === Chain.POLYGON) return Chain.POLYGON;
  if (chainId === Chain.AMOY) return Chain.AMOY;
  throw new Error(`Unsupported POLY_CHAIN_ID: ${chainId}`);
}

function toSignatureType(signatureType: number): SignatureType {
  if (signatureType === SignatureType.EOA) return SignatureType.EOA;
  if (signatureType === SignatureType.POLY_PROXY) return SignatureType.POLY_PROXY;
  if (signatureType === SignatureType.POLY_GNOSIS_SAFE) return SignatureType.POLY_GNOSIS_SAFE;
  throw new Error(`Unsupported POLY_SIGNATURE_TYPE: ${signatureType}`);
}

async function resolveApiCreds(): Promise<ApiKeyCreds> {
  const stored = await appStore.getCredentialPayload();
  if (!stored) {
    throw new Error('No stored Polymarket credentials found');
  }

  let parsed: DecryptedCredentialBundle;
  try {
    parsed = JSON.parse(stored.ciphertext) as DecryptedCredentialBundle;
  } catch {
    throw new Error('Legacy credential format found. Please re-save apiKey+secret+passphrase in Settings');
  }

  if (!parsed.apiKey || !parsed.secret || !parsed.passphrase) {
    throw new Error('Incomplete encrypted credential payload');
  }

  return {
    key: decryptValue(parsed.apiKey),
    secret: decryptValue(parsed.secret),
    passphrase: decryptValue(parsed.passphrase),
  };
}

export async function getPolymarketRuntimeStatus(): Promise<PolymarketRuntimeStatus> {
  const status = await appStore.getCredentialStatusResolved();
  const hasPrivateKey = env.polyPrivateKey.trim().length > 0;
  const hasFunderAddress = env.polyFunderAddress.trim().length > 0 || hasPrivateKey;

  return {
    configured: status.configured,
    hasCredentials: status.configured,
    hasPrivateKey,
    hasFunderAddress,
    canTrade: status.configured && hasPrivateKey && hasFunderAddress,
    host: env.polyClobHost,
    chainId: env.polyChainId,
    signatureType: env.polySignatureType,
  };
}

export async function createPolymarketClient(options?: { requireSigning?: boolean }): Promise<ClobClient> {
  const creds = await resolveApiCreds();

  const hasPrivateKey = env.polyPrivateKey.trim().length > 0;
  if (options?.requireSigning && !hasPrivateKey) {
    throw new Error('POLY_PRIVATE_KEY is required for signed trading operations');
  }

  const wallet = hasPrivateKey ? new Wallet(env.polyPrivateKey) : null;
  const signer: ClobSigner | undefined = wallet
    ? {
        _signTypedData: (domain, types, value) =>
          wallet.signTypedData(domain as Record<string, unknown>, types as Record<string, Array<{ name: string; type: string }>>, value as Record<string, unknown>),
        getAddress: () => wallet.getAddress(),
      }
    : undefined;

  const funderAddress = env.polyFunderAddress || wallet?.address;

  if (options?.requireSigning && !funderAddress) {
    throw new Error('POLY_FUNDER_ADDRESS is required when signer address is unavailable');
  }

  const chain = toChain(env.polyChainId);
  const signatureType = toSignatureType(env.polySignatureType);

  return new ClobClient(
    env.polyClobHost,
    chain,
    signer,
    creds,
    signatureType,
    funderAddress,
    undefined,
    true,
  );
}

export async function testPolymarketAuth(): Promise<{ keyCount: number }> {
  const client = await createPolymarketClient();
  const response = await client.getApiKeys();
  return { keyCount: response.apiKeys.length };
}

export async function fetchPolymarketOpenOrders(params?: {
  market?: string;
  asset_id?: string;
}): Promise<unknown> {
  const client = await createPolymarketClient();
  return client.getOpenOrders({ market: params?.market, asset_id: params?.asset_id });
}

export async function placePolymarketLimitOrder(input: {
  tokenId: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  orderType: 'GTC' | 'GTD';
  postOnly?: boolean;
  deferExec?: boolean;
}): Promise<unknown> {
  const client = await createPolymarketClient({ requireSigning: true });

  const userOrder: UserOrder = {
    tokenID: input.tokenId,
    side: input.side === 'BUY' ? Side.BUY : Side.SELL,
    price: input.price,
    size: input.size,
  };

  const type = input.orderType === 'GTD' ? OrderType.GTD : OrderType.GTC;
  return client.createAndPostOrder(userOrder, {}, type, input.deferExec ?? false, input.postOnly ?? false);
}

export async function cancelAllPolymarketOrders(): Promise<unknown> {
  const client = await createPolymarketClient();
  return client.cancelAll();
}
