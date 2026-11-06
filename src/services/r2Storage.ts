import type { Env } from '../types';

export const ALLOWED_MEDIA_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/ogg': '.ogv',
};

export async function putMediaObject(
  env: Env,
  key: string,
  buffer: Uint8Array,
  mime: string,
  metadata: { originalName: string; uploadedBy: string; sizeBytes: number },
): Promise<{ storageProvider: string }> {
  const bucket = env.EXCHANGE_R2 || env.UPLOADS_BUCKET;
  if (bucket) {
    try {
      await bucket.put(key, buffer, {
        httpMetadata: {
          contentType: mime,
          cacheControl: 'public, max-age=31536000, immutable',
        },
        customMetadata: {
          originalName: metadata.originalName,
          uploadedBy: metadata.uploadedBy,
          sizeBytes: String(metadata.sizeBytes),
          uploadedAt: new Date().toISOString(),
        },
      });
      return { storageProvider: 'cloudflare-r2' };
    } catch (r2Err) {
      console.warn('[R2] put failed, falling back to KV edge cache:', r2Err);
      if (env.EXCHANGE_KV) {
        await env.EXCHANGE_KV.put(`r2_cache:${key}`, buffer, {
          metadata: { mimeType: mime, originalName: metadata.originalName, sizeBytes: metadata.sizeBytes },
        });
        return { storageProvider: 'cloudflare-kv-fallback' };
      }
      throw r2Err;
    }
  }

  if (env.EXCHANGE_KV) {
    await env.EXCHANGE_KV.put(`r2_cache:${key}`, buffer, {
      metadata: { mimeType: mime, originalName: metadata.originalName, sizeBytes: metadata.sizeBytes },
    });
    return { storageProvider: 'cloudflare-kv-fallback' };
  }

  throw new Error('Storage backend not configured. Enable R2 in Cloudflare Dashboard.');
}

export async function getMediaObject(
  env: Env,
  key: string,
): Promise<{ body: ReadableStream | ArrayBuffer; contentType: string; etag?: string; source: string } | null> {
  const bucket = env.EXCHANGE_R2 || env.UPLOADS_BUCKET;
  if (bucket) {
    try {
      const object = await bucket.get(key);
      if (object) {
        return {
          body: object.body,
          contentType: object.httpMetadata?.contentType || 'image/jpeg',
          etag: object.httpEtag,
          source: 'cloudflare-r2',
        };
      }
    } catch (err) {
      console.warn('[R2] Object retrieval error:', err);
    }
  }

  if (env.EXCHANGE_KV) {
    try {
      const { value, metadata } = await env.EXCHANGE_KV.getWithMetadata<{ mimeType?: string }>(
        `r2_cache:${key}`,
        { type: 'arrayBuffer' },
      );
      if (value) {
        return {
          body: value,
          contentType: metadata?.mimeType || 'image/jpeg',
          source: 'cloudflare-kv-fallback',
        };
      }
    } catch (err) {
      console.warn('[KV] Media retrieval error:', err);
    }
  }

  return null;
}

export async function deleteMediaObject(env: Env, key: string): Promise<void> {
  const bucket = env.EXCHANGE_R2 || env.UPLOADS_BUCKET;
  if (bucket) {
    await bucket.delete(key);
  }
  if (env.EXCHANGE_KV) {
    await env.EXCHANGE_KV.delete(`r2_cache:${key}`);
  }
}

