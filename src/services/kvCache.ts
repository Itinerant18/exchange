import type { Env } from '../types';

export async function getCachedJson<T>(kv: KVNamespace | undefined, key: string): Promise<T | null> {
  if (!kv) return null;
  try {
    return await kv.get<T>(key, 'json');
  } catch (err) {
    console.warn(`[KVCache] Error getting key "${key}":`, err);
    return null;
  }
}

export function setCachedJson(
  kv: KVNamespace | undefined,
  ctx: ExecutionContext,
  key: string,
  value: unknown,
  expirationTtl = 3600,
): void {
  if (!kv) return;
  ctx.waitUntil(
    kv.put(key, JSON.stringify(value), { expirationTtl }).catch((err) => {
      console.warn(`[KVCache] Error setting key "${key}":`, err);
    }),
  );
}

export function deleteCachedKey(
  kv: KVNamespace | undefined,
  ctx: ExecutionContext,
  key: string,
): void {
  if (!kv) return;
  ctx.waitUntil(
    kv.delete(key).catch((err) => {
      console.warn(`[KVCache] Error deleting key "${key}":`, err);
    }),
  );
}
