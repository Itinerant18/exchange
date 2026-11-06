import type { Env } from '../../types';
import { jsonResponse } from '../../types';
import { ALLOWED_MEDIA_TYPES, putMediaObject, deleteMediaObject } from '../../services/r2Storage';
import { extractBearerUser } from '../../middleware/auth';

export async function handleMediaRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
  method: string,
  cors: Record<string, string>,
  url: URL,
): Promise<Response | null> {
  const jwtSecret = env.AUTH_JWT_SECRET || 'exchnage_default_production_jwt_secret_min32';

  // 1. Upload endpoint (POST /uploads or POST /media/upload)
  if ((path === '/uploads' || path === '/media/upload') && method === 'POST') {
    try {
      const auth = extractBearerUser(request, jwtSecret);
      const contentTypeHeader = (request.headers.get('content-type') || '').toLowerCase();
      let buffer: Uint8Array;
      let mime = '';
      let originalName = 'upload';

      if (contentTypeHeader.includes('application/json')) {
        const body = (await request.json().catch(() => ({}))) as any;
        const { fileData, fileName, mimeType: providedMime } = body || {};
        if (!fileData || typeof fileData !== 'string') {
          return jsonResponse(
            { error: { message: 'fileData (base64 string or data URL) is required', code: 'INVALID_INPUT' } },
            400,
            cors,
          );
        }
        originalName = fileName || 'upload';
        mime = (providedMime || '').trim().toLowerCase();
        let base64Payload = fileData;
        const dataUrlMatch = fileData.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (dataUrlMatch) {
          mime = dataUrlMatch[1].toLowerCase();
          base64Payload = dataUrlMatch[2];
        }

        const binaryString = atob(base64Payload);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        buffer = bytes;
      } else if (contentTypeHeader.includes('multipart/form-data')) {
        const formData = await request.formData();
        const file = formData.get('file') || formData.get('image') || formData.get('media');
        if (!file || typeof file === 'string') {
          return jsonResponse({ error: { message: 'No file found in multipart upload', code: 'INVALID_INPUT' } }, 400, cors);
        }
        const fileBlob = file as File;
        originalName = fileBlob.name || 'upload';
        mime = fileBlob.type.toLowerCase();
        buffer = new Uint8Array(await fileBlob.arrayBuffer());
      } else {
        // Raw binary payload
        mime = contentTypeHeader.split(';')[0].trim().toLowerCase();
        buffer = new Uint8Array(await request.arrayBuffer());
      }

      if (!mime || !ALLOWED_MEDIA_TYPES[mime]) {
        return jsonResponse(
          {
            error: {
              message: `Unsupported file type "${mime}". Allowed types: ${Object.keys(ALLOWED_MEDIA_TYPES).join(', ')}`,
              code: 'UNSUPPORTED_MEDIA_TYPE',
            },
          },
          400,
          cors,
        );
      }

      const isVideo = mime.startsWith('video/');
      const maxSizeBytes = isVideo ? 60 * 1024 * 1024 : 15 * 1024 * 1024;
      if (buffer.byteLength > maxSizeBytes) {
        return jsonResponse(
          {
            error: {
              message: `File size ${buffer.byteLength} bytes exceeds the ${isVideo ? '60MB' : '15MB'} limit`,
              code: 'FILE_TOO_LARGE',
            },
          },
          400,
          cors,
        );
      }

      const ext = ALLOWED_MEDIA_TYPES[mime] || (isVideo ? '.mp4' : '.jpg');
      const uniqueFileName = `${crypto.randomUUID()}${ext}`;

      const { storageProvider } = await putMediaObject(env, uniqueFileName, buffer, mime, {
        originalName,
        uploadedBy: auth?.userId || 'anonymous',
        sizeBytes: buffer.byteLength,
      });

      const host = request.headers.get('host') || 'exchnage-souvik.souvikmn55.workers.dev';
      const protocol = url.protocol || 'https:';
      const publicUrl = `${protocol}//${host}/uploads/${uniqueFileName}`;

      return jsonResponse(
        {
          data: {
            url: publicUrl,
            fileName: uniqueFileName,
            objectKey: uniqueFileName,
            mimeType: mime,
            sizeBytes: buffer.byteLength,
            mediaType: isVideo ? 'video' : 'image',
            storageProvider,
          },
        },
        201,
        cors,
      );
    } catch (err: any) {
      console.error('[Uploads] Error:', err);
      return jsonResponse({ error: { message: err.message, code: 'UPLOAD_FAILED' } }, 500, cors);
    }
  }

  // 2. Media listing endpoint (GET /media)
  if (path === '/media' && method === 'GET') {
    const bucket = env.EXCHANGE_R2 || env.UPLOADS_BUCKET;
    if (bucket) {
      const prefix = url.searchParams.get('prefix') || undefined;
      const cursor = url.searchParams.get('cursor') || undefined;
      const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);
      const listed = await bucket.list({ prefix, cursor, limit });
      return jsonResponse(
        {
          data: listed.objects.map((o) => ({
            key: o.key,
            sizeBytes: o.size,
            etag: o.etag,
            uploadedAt: o.uploaded.toISOString(),
            httpMetadata: o.httpMetadata,
            customMetadata: o.customMetadata,
            url: `${url.protocol}//${request.headers.get('host') || ''}/uploads/${o.key}`,
          })),
          pagination: {
            cursor: listed.truncated ? (listed as any).cursor : null,
            truncated: listed.truncated,
          },
        },
        200,
        cors,
      );
    } else if (env.EXCHANGE_KV) {
      const listed = await env.EXCHANGE_KV.list({ prefix: 'r2_cache:', limit: 20 });
      return jsonResponse(
        {
          data: listed.keys.map((k) => ({
            key: k.name.replace(/^r2_cache:/, ''),
            metadata: k.metadata,
            storageProvider: 'cloudflare-kv-fallback',
            url: `${url.protocol}//${request.headers.get('host') || ''}/uploads/${k.name.replace(/^r2_cache:/, '')}`,
          })),
          pagination: {
            cursor: listed.list_complete ? null : (listed as any).cursor,
            truncated: !listed.list_complete,
          },
        },
        200,
        cors,
      );
    }
    return jsonResponse({ data: [], message: 'Storage not yet provisioned' }, 200, cors);
  }

  // 3. Media single object retrieval (GET /media/:key or GET /uploads/:key)
  if ((path.startsWith('/media/') || path.startsWith('/uploads/')) && method === 'GET') {
    const key = path.replace(/^\/(media|uploads)\//, '');
    const bucket = env.EXCHANGE_R2 || env.UPLOADS_BUCKET;
    if (bucket) {
      try {
        const object = await bucket.get(key);
        if (object) {
          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set('etag', object.httpEtag);
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
          headers.set('X-Media-Source', 'cloudflare-r2');
          return new Response(object.body, { headers });
        }
      } catch (err) {
        console.warn('[Media] R2 get error:', err);
      }
    }
    if (env.EXCHANGE_KV) {
      const { value, metadata } = await env.EXCHANGE_KV.getWithMetadata<{ mimeType?: string }>(
        `r2_cache:${key}`,
        { type: 'arrayBuffer' },
      );
      if (value) {
        const headers = new Headers();
        headers.set('Content-Type', metadata?.mimeType || 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('X-Media-Source', 'cloudflare-kv-fallback');
        return new Response(value, { headers });
      }
    }
    return jsonResponse({ error: { message: `Media object "${key}" not found`, code: 'NOT_FOUND' } }, 404, cors);
  }

  // 4. Media deletion endpoint (DELETE /media/:key or DELETE /uploads/:key)
  if ((path.startsWith('/media/') || path.startsWith('/uploads/')) && method === 'DELETE') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }
    const key = path.replace(/^\/(media|uploads)\//, '');
    await deleteMediaObject(env, key);
    return new Response(null, { status: 204, headers: cors });
  }

  return null;
}
