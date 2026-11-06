import type { Env } from '../../types';
import { jsonResponse } from '../../types';
import { withDb } from '../../services/db';

export async function handleCategoriesRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
  method: string,
  cors: Record<string, string>,
): Promise<Response | null> {
  if (path === '/categories' || path === '/categories/tree') {
    try {
      if (env.EXCHANGE_KV) {
        const cached = await env.EXCHANGE_KV.get('cache:categories:tree', 'json');
        if (cached) {
          return jsonResponse({ data: cached }, 200, { ...cors, 'X-Cache': 'HIT' });
        }
      }

      const categories = await withDb(env, ctx, async (client) => {
        const res = await client.query(
          `SELECT id, name, slug, is_active
           FROM categories
           WHERE is_active = true
           ORDER BY name ASC`,
        );
        return res.rows;
      });

      if (env.EXCHANGE_KV) {
        ctx.waitUntil(
          env.EXCHANGE_KV.put('cache:categories:tree', JSON.stringify(categories), {
            expirationTtl: 3600,
          }),
        );
      }

      return jsonResponse({ data: categories }, 200, { ...cors, 'X-Cache': 'MISS' });
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'DB_ERROR' } }, 500, cors);
    }
  }

  if (path.startsWith('/categories/')) {
    const slugOrId = path.replace('/categories/', '');
    try {
      const category = await withDb(env, ctx, async (client) => {
        const res = await client.query(
          `SELECT id, name, slug, is_active
           FROM categories
           WHERE (slug = $1 OR id::text = $1) AND is_active = true
           LIMIT 1`,
          [slugOrId],
        );
        return res.rows[0];
      });
      if (!category) {
        return jsonResponse({ error: { message: 'Category not found', code: 'NOT_FOUND' } }, 404, cors);
      }
      return jsonResponse({ data: category }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'DB_ERROR' } }, 500, cors);
    }
  }

  return null;
}
