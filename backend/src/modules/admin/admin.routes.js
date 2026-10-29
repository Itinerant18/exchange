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

adminRouter.get('/reports/reconciliation', async (req, res, next) => {
  try {
    const [bookingsRes, paymentsRes, depositsRes, refundsRes, ledgerRes] = await Promise.all([
      pool.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'completed')::int AS completed FROM public.rental_bookings`),
      pool.query(`SELECT coalesce(sum(amount_paise), 0)::bigint AS total_collected FROM public.payments WHERE status = 'succeeded'`),
      pool.query(`SELECT coalesce(sum(collected_amount_paise), 0)::bigint AS total_held FROM public.security_deposits WHERE status = 'held'`),
      pool.query(`SELECT coalesce(sum(refund_amount_paise), 0)::bigint AS total_refunded FROM public.refunds WHERE status = 'succeeded'`),
      pool.query(`SELECT id, user_id, entry_direction, entry_type, amount_paise, memo, created_at FROM public.earnings_ledger ORDER BY created_at DESC LIMIT 10`),
    ]);

    const report = {
      bookings: {
        total: bookingsRes.rows[0]?.total ?? 0,
        completed: bookingsRes.rows[0]?.completed ?? 0,
      },
      financials: {
        totalCollectedPaise: Number(paymentsRes.rows[0]?.total_collected ?? 0),
        totalDepositsHeldPaise: Number(depositsRes.rows[0]?.total_held ?? 0),
        totalRefundedPaise: Number(refundsRes.rows[0]?.total_refunded ?? 0),
      },
      recentLedger: ledgerRes.rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        direction: r.entry_direction,
        type: r.entry_type,
        amountPaise: Number(r.amount_paise),
        memo: r.memo,
        createdAt: r.created_at,
      })),
      generatedAt: new Date().toISOString(),
    };

    res.status(200).json({ data: report });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Full Admin Dashboard & Role Access Endpoints
// ---------------------------------------------------------------------------

/**
 * 1. User Directory with Roles & Status
 * GET /admin/users
 */
adminRouter.get('/users', async (req, res, next) => {
  try {
    const query = req.query ?? {};
    const pagination = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
    const conditions = [];
    const params = [];
    const add = (template, value) => {
      params.push(value);
      conditions.push(template.replace('$#', `$${params.length}`));
    };

    if (query.q) {
      add('(u.email ILIKE $# OR p.display_name ILIKE $#)', `%${String(query.q).trim()}%`);
    }
    if (query.status) {
      add('u.status = $#', String(query.status).trim());
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    let havingSql = '';
    if (query.role) {
      params.push(String(query.role).trim());
      havingSql = `HAVING $${params.length} = ANY(array_agg(r.role_name))`;
    }

    const listSql = `
      SELECT u.id, u.email, u.status, u.created_at, u.last_login_at,
             p.display_name, p.phone_number,
             coalesce(array_remove(array_agg(r.role_name ORDER BY r.role_name), NULL), '{}') as roles
      FROM public.users u
      LEFT JOIN public.user_profiles p ON u.id = p.user_id
      LEFT JOIN public.user_roles r ON u.id = r.user_id
      ${whereSql}
      GROUP BY u.id, u.email, u.status, u.created_at, u.last_login_at, p.display_name, p.phone_number
      ${havingSql}
      ORDER BY u.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countSql = `
      SELECT count(*)::int as total FROM (
        SELECT u.id
        FROM public.users u
        LEFT JOIN public.user_profiles p ON u.id = p.user_id
        LEFT JOIN public.user_roles r ON u.id = r.user_id
        ${whereSql}
        GROUP BY u.id
        ${havingSql}
      ) sub
    `;

    const [listResult, countResult] = await Promise.all([
      pool.query(listSql, [...params, pagination.limit, pagination.offset]),
      pool.query(countSql, params),
    ]);

    const rows = listResult.rows.map((r) => ({
      id: r.id,
      email: r.email,
      status: r.status,
      displayName: r.display_name ?? null,
      phoneNumber: r.phone_number ?? null,
      roles: r.roles ?? [],
      lastLoginAt: r.last_login_at ?? null,
      createdAt: r.created_at,
    }));

    sendData(res, rows, { meta: paginationMeta(pagination, countResult.rows[0]?.total ?? 0) });
  } catch (error) {
    next(error);
  }
});

/**
 * 2. Update User Roles (Full Role Access Control)
 * PATCH /admin/users/:id/roles
 */
adminRouter.patch('/users/:id/roles', async (req, res, next) => {
  try {
    const userId = req.params.id;
    if (!isUuid(userId)) {
      throw new AppError('The user identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
    }
    const roles = req.body?.roles;
    if (!Array.isArray(roles)) {
      throw new AppError('roles must be an array of strings.', { statusCode: 400 });
    }
    const ALLOWED_ROLES = ['admin', 'customer', 'seller'];
    for (const r of roles) {
      if (!ALLOWED_ROLES.includes(r)) {
        throw new AppError(`Invalid role: ${r}. Allowed roles: ${ALLOWED_ROLES.join(', ')}`, { statusCode: 400 });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userRes = await client.query('SELECT id, email FROM public.users WHERE id = $1', [userId]);
      if (userRes.rows.length === 0) {
        throw new AppError('User not found.', { statusCode: 404, code: 'USER_NOT_FOUND' });
      }

      await client.query('DELETE FROM public.user_roles WHERE user_id = $1', [userId]);
      for (const roleName of roles) {
        await client.query(
          'INSERT INTO public.user_roles (user_id, role_name, assigned_by) VALUES ($1, $2, $3)',
          [userId, roleName, req.authUser.id]
        );
      }

      // Invalidate active sessions so token updates
      await client.query('UPDATE public.refresh_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);

      await client.query(
        `INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_value)
         VALUES ($1, 'ROLES_UPDATED', 'user', $2, $3::jsonb)`,
        [req.authUser.id, userId, JSON.stringify({ roles, targetEmail: userRes.rows[0].email })]
      );

      await client.query('COMMIT');
      res.status(200).json({ data: { id: userId, email: userRes.rows[0].email, roles } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * 3. User Status Update (Activate / Suspend)
 * PATCH /admin/users/:id/status
 */
adminRouter.patch('/users/:id/status', async (req, res, next) => {
  try {
    const userId = req.params.id;
    if (!isUuid(userId)) {
      throw new AppError('The user identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
    }
    const status = String(req.body?.status ?? '').trim().toLowerCase();
    if (!['active', 'suspended'].includes(status)) {
      throw new AppError('status must be active or suspended.', { statusCode: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userRes = await client.query(
        'UPDATE public.users SET status = $2, updated_at = now() WHERE id = $1 RETURNING id, email, status',
        [userId, status]
      );
      if (userRes.rows.length === 0) {
        throw new AppError('User not found.', { statusCode: 404, code: 'USER_NOT_FOUND' });
      }

      if (status === 'suspended') {
        await client.query('UPDATE public.refresh_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
      }

      await client.query(
        `INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_value)
         VALUES ($1, 'USER_STATUS_UPDATED', 'user', $2, $3::jsonb)`,
        [req.authUser.id, userId, JSON.stringify({ status, targetEmail: userRes.rows[0].email })]
      );

      await client.query('COMMIT');
      res.status(200).json({ data: userRes.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * 4. All Platform Bookings Directory
 * GET /admin/bookings
 */
adminRouter.get('/bookings', async (req, res, next) => {
  try {
    const query = req.query ?? {};
    const pagination = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
    const conditions = [];
    const params = [];
    const add = (template, value) => {
      params.push(value);
      conditions.push(template.replace('$#', `$${params.length}`));
    };

    if (query.status) add('b.status = $#', String(query.status).trim());

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [listResult, countResult] = await Promise.all([
      pool.query(
        `SELECT b.id, b.rental_listing_id, b.renter_user_id, b.status, b.start_date, b.end_date,
                b.subtotal_amount_paise, b.deposit_amount_paise, b.total_amount_paise, b.created_at,
                l.title as listing_title, u.email as renter_email,
                owner.email as owner_email
         FROM public.rental_bookings b
         JOIN public.listings l ON b.rental_listing_id = l.id
         JOIN public.users u ON b.renter_user_id = u.id
         LEFT JOIN public.users owner ON l.owner_user_id = owner.id
         ${whereSql}
         ORDER BY b.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT count(*)::int as total FROM public.rental_bookings b ${whereSql}`, params),
    ]);

    sendData(res, listResult.rows.map((r) => ({
      id: r.id,
      rentalListingId: r.rental_listing_id,
      listingTitle: r.listing_title,
      renterUserId: r.renter_user_id,
      renterEmail: r.renter_email,
      ownerEmail: r.owner_email,
      status: r.status,
      startDate: r.start_date,
      endDate: r.end_date,
      subtotalAmountPaise: Number(r.subtotal_amount_paise),
      depositAmountPaise: Number(r.deposit_amount_paise),
      totalAmountPaise: Number(r.total_amount_paise),
      createdAt: r.created_at,
    })), { meta: paginationMeta(pagination, countResult.rows[0]?.total ?? 0) });
  } catch (error) {
    next(error);
  }
});

/**
 * 5. Rental Extensions Directory
 * GET /admin/extensions
 */
adminRouter.get('/extensions', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.rental_booking_id, e.requested_by_type, e.new_end_date,
              e.additional_days, e.additional_amount_paise, e.status, e.rejection_reason,
              e.decided_at, e.created_at,
              b.start_date, b.end_date as original_end_date,
              l.title as listing_title, u.email as renter_email
       FROM public.booking_extensions e
       JOIN public.rental_bookings b ON e.rental_booking_id = b.id
       JOIN public.listings l ON b.rental_listing_id = l.id
       JOIN public.users u ON b.renter_user_id = u.id
       ORDER BY e.created_at DESC`
    );
    sendData(res, rows.map((r) => ({
      id: r.id,
      rentalBookingId: r.rental_booking_id,
      requestedByType: r.requested_by_type,
      newEndDate: r.new_end_date,
      additionalDays: r.additional_days,
      additionalAmountPaise: Number(r.additional_amount_paise),
      status: r.status,
      rejectionReason: r.rejection_reason,
      decidedAt: r.decided_at,
      createdAt: r.created_at,
      startDate: r.start_date,
      originalEndDate: r.original_end_date,
      listingTitle: r.listing_title,
      renterEmail: r.renter_email,
    })));
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/extensions/:id/decision', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) throw new AppError('The extension identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
    const { decideBookingExtension } = await import('../rentals/rentals.service.js');
    const { auditContext } = await import('../../services/auditLogService.js');
    sendData(res, await decideBookingExtension(req.authUser, auditContext(req), req.params.id, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

/**
 * 6. All Platform Payments Directory
 * GET /admin/payments
 */
adminRouter.get('/payments', async (req, res, next) => {
  try {
    const query = req.query ?? {};
    const pagination = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
    const conditions = [];
    const params = [];
    const add = (template, value) => {
      params.push(value);
      conditions.push(template.replace('$#', `$${params.length}`));
    };
    if (query.status) add('p.status = $#', String(query.status).trim());
    if (query.paymentType) add('p.payment_type = $#', String(query.paymentType).trim());

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [listResult, countResult] = await Promise.all([
      pool.query(
        `SELECT p.id, p.rental_booking_id, p.order_id, p.payment_type, p.direction,
                p.amount_paise, p.status, p.provider, p.provider_transaction_id,
                p.idempotency_key, p.created_at, p.updated_at
         FROM public.payments p
         ${whereSql}
         ORDER BY p.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT count(*)::int as total FROM public.payments p ${whereSql}`, params),
    ]);

    sendData(res, listResult.rows.map((r) => ({
      id: r.id,
      rentalBookingId: r.rental_booking_id,
      orderId: r.order_id,
      paymentType: r.payment_type,
      direction: r.direction,
      amountPaise: Number(r.amount_paise),
      status: r.status,
      provider: r.provider,
      providerTransactionId: r.provider_transaction_id,
      idempotencyKey: r.idempotency_key,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })), { meta: paginationMeta(pagination, countResult.rows[0]?.total ?? 0) });
  } catch (error) {
    next(error);
  }
});

/**
 * 7. Security Deposits Directory
 * GET /admin/deposits
 */
adminRouter.get('/deposits', async (req, res, next) => {
  try {
    const query = req.query ?? {};
    const pagination = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
    const conditions = [];
    const params = [];
    const add = (template, value) => {
      params.push(value);
      conditions.push(template.replace('$#', `$${params.length}`));
    };
    if (query.status) add('d.status = $#', String(query.status).trim());

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [listResult, countResult] = await Promise.all([
      pool.query(
        `SELECT d.id, d.rental_booking_id, d.status, d.collected_amount_paise,
                d.deduction_amount_paise, d.deduction_reason, d.released_at,
                d.created_at, d.updated_at,
                b.renter_user_id, u.email as renter_email, l.title as listing_title
         FROM public.security_deposits d
         JOIN public.rental_bookings b ON d.rental_booking_id = b.id
         JOIN public.listings l ON b.rental_listing_id = l.id
         JOIN public.users u ON b.renter_user_id = u.id
         ${whereSql}
         ORDER BY d.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT count(*)::int as total FROM public.security_deposits d ${whereSql}`, params),
    ]);

    sendData(res, listResult.rows.map((r) => ({
      id: r.id,
      rentalBookingId: r.rental_booking_id,
      renterUserId: r.renter_user_id,
      renterEmail: r.renter_email,
      listingTitle: r.listing_title,
      status: r.status,
      collectedAmountPaise: Number(r.collected_amount_paise),
      deductionAmountPaise: Number(r.deduction_amount_paise),
      deductionReason: r.deduction_reason,
      releasedAt: r.released_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })), { meta: paginationMeta(pagination, countResult.rows[0]?.total ?? 0) });
  } catch (error) {
    next(error);
  }
});
