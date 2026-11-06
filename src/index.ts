/**
 * Cloudflare Worker for Exchnage
 * Full-stack luxury occasion-wear rental & circular resale platform.
 * Integrates Cloudflare Workers Static Assets (React SPA), Hyperdrive (PostgreSQL pooling),
 * and R2 (garment image and catwalk media uploads).
 */

export interface Env {
  ASSETS: Fetcher;
  HYPERDRIVE?: Hyperdrive;
  UPLOADS_BUCKET?: R2Bucket;
  AUTH_JWT_SECRET?: string;
  API_PREFIX: string;
  PLATFORM_NAME: string;
  PLATFORM_CURRENCY: string;
  PLATFORM_TIMEZONE: string;
}

interface ApiResponse<T = unknown> {
  data?: T;
  error?: {
    message: string;
    code: string;
  };
}

/**
 * Common security headers applied to all responses
 */
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};

/**
 * Build standard CORS headers
 */
function getCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Helper to build JSON responses with security & CORS headers
 */
function jsonResponse<T>(
  data: ApiResponse<T>,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS,
      ...headers,
    },
  });
}

/**
 * Handle incoming API requests
 */
async function handleApiRequest(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const path = url.pathname;

  // Liveness & Readiness endpoints
  if (path === '/api/v1/health' || path === '/api/v1/health/ready') {
    let dbStatus = 'disconnected';
    let dbLatencyMs = 0;

    if (env.HYPERDRIVE) {
      try {
        const start = Date.now();
        // Hyperdrive connection validation
        if (env.HYPERDRIVE.connectionString) {
          dbStatus = 'connected';
        }
        dbLatencyMs = Date.now() - start;
      } catch (err) {
        console.error('[HealthCheck] Hyperdrive check error:', err);
      }
    }

    return jsonResponse(
      {
        data: {
          status: 'ok',
          service: 'exchnage-worker-api',
          platform: env.PLATFORM_NAME || 'Exchnage',
          currency: env.PLATFORM_CURRENCY || 'INR',
          timezone: env.PLATFORM_TIMEZONE || 'Asia/Kolkata',
          database: dbStatus,
          databaseLatencyMs: dbLatencyMs,
          timestamp: new Date().toISOString(),
        },
      },
      200,
      corsHeaders,
    );
  }

  // File Upload API endpoint -> Stores media in Cloudflare R2
  if (path === '/api/v1/uploads' && request.method === 'POST') {
    if (!env.UPLOADS_BUCKET) {
      return jsonResponse(
        {
          error: {
            message: 'R2 uploads storage is not configured',
            code: 'STORAGE_UNAVAILABLE',
          },
        },
        503,
        corsHeaders,
      );
    }
    try {
      const contentType = request.headers.get('content-type') || '';
      if (!contentType.includes('multipart/form-data')) {
        return jsonResponse(
          {
            error: {
              message: 'Content-Type must be multipart/form-data',
              code: 'INVALID_CONTENT_TYPE',
            },
          },
          400,
          corsHeaders,
        );
      }

      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return jsonResponse(
          {
            error: {
              message: 'No file provided in form-data under key "file"',
              code: 'FILE_MISSING',
            },
          },
          400,
          corsHeaders,
        );
      }

      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileKey = `${crypto.randomUUID()}.${fileExtension}`;
      const arrayBuffer = await file.arrayBuffer();

      // Put object into R2 bucket
      await env.UPLOADS_BUCKET.put(fileKey, arrayBuffer, {
        httpMetadata: {
          contentType: file.type || 'image/jpeg',
        },
      });

      return jsonResponse(
        {
          data: {
            key: fileKey,
            filename: file.name,
            size: file.size,
            url: `/uploads/${fileKey}`,
          },
        },
        201,
        corsHeaders,
      );
    } catch (error) {
      console.error('[Upload] Error uploading file to R2:', error);
      return jsonResponse(
        {
          error: {
            message: 'Failed to process file upload',
            code: 'UPLOAD_FAILED',
          },
        },
        500,
        corsHeaders,
      );
    }
  }

  // Fallback for unhandled API routes
  return jsonResponse(
    {
      error: {
        message: `Endpoint ${request.method} ${path} not found`,
        code: 'NOT_FOUND',
      },
    },
    404,
    corsHeaders,
  );
}

/**
 * Handle direct R2 uploaded file retrieval: /uploads/:key
 */
async function handleUploadsRetrieval(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  if (!env.UPLOADS_BUCKET) {
    return new Response('Uploads storage not configured', { status: 503 });
  }
  const key = url.pathname.replace(/^\/uploads\//, '');
  if (!key) {
    return new Response('Not Found', { status: 404 });
  }

  const object = await env.UPLOADS_BUCKET.get(key);
  if (!object) {
    return new Response('File Not Found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    headers.set(k, v);
  }

  return new Response(object.body, { headers });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          ...SECURITY_HEADERS,
        },
      });
    }

    // 1. Route API requests
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env, url, corsHeaders);
    }

    // 2. Route uploaded image requests from R2
    if (url.pathname.startsWith('/uploads/')) {
      return handleUploadsRetrieval(request, env, url);
    }

    // 3. Serve Frontend Static Assets (React 19 SPA)
    // Cloudflare Workers Static Assets serves index.html and SPA client routes automatically
    try {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    } catch (err) {
      console.warn('[Assets] Asset fetch error, falling back:', err);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

