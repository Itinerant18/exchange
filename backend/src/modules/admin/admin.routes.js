import { Router } from 'express';
import { pool } from '../../config/database.js';
import { authenticate, requireRole } from '../../middleware/authenticate.js';
import { paginationMeta, sendData } from '../../utils/http.js';
import { parsePagination } from '../../utils/http.js';
import { isUuid } from '../../utils/validators.js';
import { AppError } from '../../appErrors/AppError.js';

/**
 * Read-only audit trail. Audit rows are created only by workflows; there is no
 * create endpoint by design (append-only enforcement lives server-side).
 */
export const adminRouter = Router();
adminRouter.use(authenticate, requireRole('admin'));

const ENTITY_TYPES = [
  'user', 'listing', 'inventory_item', 'category', 'rental_booking', 'order',
  'payment', 'security_deposit', 'refund', 'review', 'kyc_verification', 'refresh_session',
];

adminRouter.get('/audit-logs', async (req, res, next) => {
  try {
    const query = req.query ?? {};
    const pagination = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });

    const conditions = [];
    const params = [];
    const add = (template, value) => {
      params.push(value);
      conditions.push(template.replace('$#', `$${params.length}`));
    };

    if (query.userId !== undefined) {
      if (!isUuid(query.userId)) {
        throw new AppError('userId is not valid.', { statusCode: 400, code: 'INVALID_ID' });
      }
      add('user_id = $#', query.userId);
    }
    if (query.entityType !== undefined) {
      if (!ENTITY_TYPES.includes(String(query.entityType))) {
        throw new AppError(`entityType must be one of: ${ENTITY_TYPES.join(', ')}.`, { statusCode: 400 });
      }
      add('entity_type = $#', String(query.entityType));
    }
    if (query.entityId !== undefined) {
      if (!isUuid(query.entityId)) {
        throw new AppError('entityId is not valid.', { statusCode: 400, code: 'INVALID_ID' });
      }
      add('entity_id = $#', query.entityId);
    }
    if (query.action !== undefined) {
      const action = String(query.action).trim();
      if (!action || action.length > 100) {
        throw new AppError('action is not valid.', { statusCode: 400 });
      }
      add('action = $#', action.toUpperCase());
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [listResult, countResult] = await Promise.all([
      pool.query(
        `SELECT a.id, a.user_id, a.action, a.entity_type, a.entity_id,
                a.previous_value, a.new_value, a.ip_address, a.user_agent, a.created_at
         FROM public.audit_logs a
         ${whereSql}
         ORDER BY a.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pagination.limit, pagination.offset],
      ),
      pool.query(
        `SELECT count(*)::int AS total FROM public.audit_logs a ${whereSql}`,
        params,
      ),
    ]);

    const rows = listResult.rows.map((row) => ({
      id: row.id,
      userId: row.user_id ?? null,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id ?? null,
      previousValue: row.previous_value ?? null,
      newValue: row.new_value ?? null,
      ipAddress: row.ip_address ?? null,
      createdAt: row.created_at,
    }));
    sendData(res, rows, { meta: paginationMeta(pagination, countResult.rows[0].total) });
  } catch (error) {
    next(error);
  }
});
