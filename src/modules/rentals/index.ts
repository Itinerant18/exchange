import { requireJwtSecret } from '../../types';
import type { Env } from '../../types';
import { jsonResponse, emitQueueEvent } from '../../types';
import { withDb } from '../../services/db';
import { recordEdgeAudit } from '../../services/d1Client';
import { extractBearerUser } from '../../middleware/auth';
import { extractTurnstileToken, verifyTurnstileToken } from '../../middleware/turnstile';

export async function handleRentalsRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
  method: string,
  cors: Record<string, string>,
  url: URL,
): Promise<Response | null> {
  const jwtSecret = requireJwtSecret(env);

  // 1. Availability Check
  if (path === '/rentals/availability' && method === 'GET') {
    const listingId = url.searchParams.get('listingId');
    if (!listingId) {
      return jsonResponse({ error: { message: 'listingId is required', code: 'INVALID_INPUT' } }, 400, cors);
    }
    const startDate = url.searchParams.get('startDate') || new Date().toISOString().split('T')[0];
    const endDefault = new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0];
    const endDate = url.searchParams.get('endDate') || endDefault;

    try {
      const result = await withDb(env, ctx, async (client) => {
        const res = await client.query(
          `SELECT inv.id, inv.serial_or_sku AS "serialOrSku", inv.condition, inv.operational_status AS "operationalStatus"
           FROM inventory_items inv
           WHERE inv.listing_id::text = $1
             AND inv.operational_status = 'AVAILABLE'
             AND NOT EXISTS (
               SELECT 1 FROM rental_booking_items rbi
               WHERE rbi.inventory_item_id = inv.id
                 AND rbi.item_status IN ('pending', 'confirmed', 'active')
                 AND daterange(rbi.start_date, rbi.end_date, '[)') && daterange($2::date, $3::date, '[)')
             )`,
          [listingId, startDate, endDate],
        );
        return res.rows;
      });

      return jsonResponse(
        {
          data: {
            listingId,
            startDate,
            endDate,
            isAvailable: result.length > 0,
            availableCount: result.length,
            availableUnits: result,
          },
        },
        200,
        cors,
      );
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  // 2. Bookings - Creation
  if (path === '/rentals/bookings' && method === 'POST') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';

    try {
      const body = (await request.json()) as any;
      const { listingId, startDate, endDate, damageWaiver, backupSize } = body;
      if (!listingId || !startDate || !endDate) {
        return jsonResponse(
          { error: { message: 'listingId, startDate, and endDate are required', code: 'INVALID_INPUT' } },
          400,
          cors,
        );
      }

      const turnstileToken = extractTurnstileToken(request, body);
      if (turnstileToken || env.REQUIRE_TURNSTILE === 'true') {
        const turnstile = await verifyTurnstileToken(turnstileToken, clientIp, env.TURNSTILE_SECRET, 'booking');
        if (!turnstile.success) {
          recordEdgeAudit(env, ctx, 'RENTAL_BOOKING_TURNSTILE_BLOCKED', auth.userId, clientIp, { error: turnstile.error });
          return jsonResponse(
            { error: { message: 'Bot verification challenge failed for booking checkout.', code: 'TURNSTILE_FAILED' } },
            403,
            cors,
          );
        }
      }

      if (endDate <= startDate) {
        return jsonResponse(
          { error: { message: 'endDate must be after startDate', code: 'INVALID_DATE_RANGE' } },
          400,
          cors,
        );
      }

      const startMs = Date.parse(`${startDate}T00:00:00Z`);
      const endMs = Date.parse(`${endDate}T00:00:00Z`);
      const days = Math.round((endMs - startMs) / 86400000);
      if (days < 1 || days > 30) {
        return jsonResponse(
          { error: { message: 'Rental duration must be between 1 and 30 days', code: 'INVALID_DURATION' } },
          400,
          cors,
        );
      }

      const bookingResult = await withDb(env, ctx, async (client) => {
        await client.query('BEGIN');
        try {
          const listingRes = await client.query(
            `SELECT id, is_rental, rental_price_paise, deposit_paise, listing_status, owner_user_id
             FROM listings
             WHERE id::text = $1
             FOR SHARE`,
            [listingId],
          );
          const listing = listingRes.rows[0];
          if (!listing || listing.listing_status !== 'active' || !listing.is_rental) {
            throw new Error('Listing is not available for rental');
          }

          if (listing.owner_user_id === auth.userId) {
            throw new Error('You cannot rent your own listing');
          }

          // Concurrency safe unit allocation with row-level lock
          const unitRes = await client.query(
            `SELECT inv.id
             FROM inventory_items inv
             WHERE inv.listing_id = $1
               AND inv.operational_status = 'AVAILABLE'
               AND NOT EXISTS (
                 SELECT 1 FROM rental_booking_items rbi
                 WHERE rbi.inventory_item_id = inv.id
                   AND rbi.item_status IN ('pending', 'confirmed', 'active')
                   AND daterange(rbi.start_date, rbi.end_date, '[)') && daterange($2::date, $3::date, '[)')
               )
             LIMIT 1
             FOR UPDATE OF inv SKIP LOCKED`,
            [listing.id, startDate, endDate],
          );

          if (unitRes.rows.length === 0) {
            throw new Error('Selected dates are no longer available for this garment');
          }
          const unitId = unitRes.rows[0].id;

          // Edge coordination check: acquire distributed hold in Durable Object
          if (env.INVENTORY_LOCK) {
            const doId = env.INVENTORY_LOCK.idFromName(unitId);
            const stub = env.INVENTORY_LOCK.get(doId);
            const lockCheck = await stub.acquireHold(auth.userId, startDate, endDate);
            if (!lockCheck.success) {
              throw new Error(lockCheck.reason || 'Unit is temporarily reserved in another checkout');
            }
          }

          const ratePaise = Number(listing.rental_price_paise);
          const subtotalPaise = ratePaise * days;
          const depositPaise = Number(listing.deposit_paise ?? 0);
          const wantsWaiver = Boolean(damageWaiver);
          const waiverFeePaise = wantsWaiver ? 1250 : 0;
          const totalPaise = subtotalPaise + depositPaise + waiverFeePaise;

          const headerRes = await client.query(
            `INSERT INTO rental_bookings (
               renter_user_id, rental_listing_id, status, start_date, end_date,
               subtotal_amount_paise, deposit_amount_paise, total_amount_paise, deposit_paid,
               damage_waiver_selected, damage_waiver_fee_paise, backup_size
             )
             VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, false, $8, $9, $10)
             RETURNING id, status, created_at AS "createdAt"`,
            [
              auth.userId,
              listing.id,
              startDate,
              endDate,
              subtotalPaise,
              depositPaise,
              totalPaise,
              wantsWaiver,
              waiverFeePaise,
              backupSize || null,
            ],
          );
          const header = headerRes.rows[0];

          await client.query(
            `INSERT INTO rental_booking_items (
               rental_booking_id, inventory_item_id, item_status, start_date, end_date,
               daily_rate_paise, line_total_paise, is_backup_size
             )
             VALUES ($1, $2, 'pending', $3, $4, $5, $6, false)`,
            [header.id, unitId, startDate, endDate, ratePaise, subtotalPaise],
          );

          await client.query(
            `INSERT INTO rental_booking_status_history (
               rental_booking_id, from_status, to_status, changed_by_user_id, reason
             )
             VALUES ($1, NULL, 'pending', $2, 'Booking created')`,
            [header.id, auth.userId],
          );

          await client.query('COMMIT');

          if (env.INVENTORY_LOCK) {
            const doId = env.INVENTORY_LOCK.idFromName(unitId);
            const stub = env.INVENTORY_LOCK.get(doId);
            ctx.waitUntil(stub.releaseHold(auth.userId));
          }
          return {
            id: header.id,
            status: header.status,
            listingId: listing.id,
            startDate,
            endDate,
            days,
            subtotalPaise,
            depositPaise,
            damageWaiverFeePaise: waiverFeePaise,
            totalPaise,
            createdAt: header.createdAt,
          };
        } catch (txErr) {
          await client.query('ROLLBACK');
          throw txErr;
        }
      });

      recordEdgeAudit(env, ctx, 'RENTAL_BOOKING_CREATED', auth.userId, clientIp, {
        bookingId: bookingResult.id,
        listingId,
        totalPaise: bookingResult.totalPaise,
      });

      emitQueueEvent(env, ctx, 'RENTAL_BOOKING_CREATED', {
        bookingId: bookingResult.id,
        listingId,
        userId: auth.userId,
        startDate,
        endDate,
        totalPaise: bookingResult.totalPaise,
      });

      return jsonResponse({ data: bookingResult }, 201, cors);
    } catch (err: any) {
      console.error('[Rentals] Create error:', err);
      return jsonResponse({ error: { message: err.message, code: 'BOOKING_FAILED' } }, 409, cors);
    }
  }

  // 3. Bookings - List
  if (path === '/rentals/bookings' && method === 'GET') {
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;
    const statusFilter = url.searchParams.get('status');

    try {
      const result = await withDb(env, ctx, async (client) => {
        let sql = `
          SELECT 
            b.id, b.status, b.start_date AS "startDate", b.end_date AS "endDate",
            b.subtotal_amount_paise AS "subtotalPaise",
            b.deposit_amount_paise AS "depositPaise",
            b.total_amount_paise AS "totalPaise",
            b.damage_waiver_selected AS "damageWaiverSelected",
            b.created_at AS "createdAt",
            l.id AS "listingId", l.title AS "listingTitle", l.brand AS "listingBrand",
            l.rental_price_paise AS "rentalPricePaise",
            COALESCE(
              (SELECT object_key FROM listing_images WHERE listing_id = l.id AND is_primary = true LIMIT 1),
              ''
            ) AS "primaryImageUrl"
          FROM rental_bookings b
          JOIN listings l ON l.id = b.rental_listing_id
          WHERE (b.renter_user_id::text = $1 OR l.owner_user_id::text = $1)
        `;
        const params: any[] = [auth.userId];

        if (statusFilter) {
          params.push(statusFilter);
          sql += ` AND b.status = $${params.length}`;
        }

        sql += ` ORDER BY b.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const rowsRes = await client.query(sql, params);

        const countRes = await client.query(
          `SELECT count(*)::int AS total
           FROM rental_bookings b
           JOIN listings l ON l.id = b.rental_listing_id
           WHERE (b.renter_user_id::text = $1 OR l.owner_user_id::text = $1)` +
            (statusFilter ? ` AND b.status = $2` : ''),
          statusFilter ? [auth.userId, statusFilter] : [auth.userId],
        );

        return { items: rowsRes.rows, total: countRes.rows[0]?.total ?? 0 };
      });

      return jsonResponse(
        {
          data: result.items,
          pagination: {
            total: result.total,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
          },
        },
        200,
        cors,
      );
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  // 4. Bookings - Detail
  if (path.match(/^\/rentals\/bookings\/[^/]+$/)) {
    const bookingId = path.split('/')[3];
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    try {
      const booking = await withDb(env, ctx, async (client) => {
        const sql = `
          SELECT 
            b.id, b.status, b.start_date AS "startDate", b.end_date AS "endDate",
            b.subtotal_amount_paise AS "subtotalPaise",
            b.deposit_amount_paise AS "depositPaise",
            b.total_amount_paise AS "totalPaise",
            b.deposit_paid AS "depositPaid",
            b.damage_waiver_selected AS "damageWaiverSelected",
            b.backup_size AS "backupSize",
            b.created_at AS "createdAt",
            l.id AS "listingId", l.title AS "listingTitle", l.brand AS "listingBrand",
            l.size AS "listingSize", l.condition AS "listingCondition",
            l.owner_user_id AS "ownerUserId", b.renter_user_id AS "renterUserId",
            COALESCE(
              (
                SELECT json_agg(json_build_object('id', img.id, 'url', img.object_key, 'isPrimary', img.is_primary))
                FROM listing_images img
                WHERE img.listing_id = l.id
              ), '[]'::json
            ) AS images,
            COALESCE(
              (
                SELECT json_agg(json_build_object(
                  'id', rbi.id, 'itemId', rbi.inventory_item_id, 'dailyRatePaise', rbi.daily_rate_paise,
                  'lineTotalPaise', rbi.line_total_paise, 'isBackupSize', rbi.is_backup_size
                ))
                FROM rental_booking_items rbi
                WHERE rbi.rental_booking_id = b.id
              ), '[]'::json
            ) AS items
          FROM rental_bookings b
          JOIN listings l ON l.id = b.rental_listing_id
          WHERE b.id::text = $1 AND (b.renter_user_id::text = $2 OR l.owner_user_id::text = $2)
          LIMIT 1
        `;
        const res = await client.query(sql, [bookingId, auth.userId]);
        return res.rows[0];
      });

      if (!booking) {
        return jsonResponse({ error: { message: 'Booking not found', code: 'NOT_FOUND' } }, 404, cors);
      }

      return jsonResponse({ data: booking }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'QUERY_ERROR' } }, 500, cors);
    }
  }

  // 5. Bookings - Cancel
  if (path.match(/^\/rentals\/bookings\/[^/]+\/cancel$/) && method === 'POST') {
    const bookingId = path.split('/')[3];
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    try {
      await withDb(env, ctx, async (client) => {
        await client.query('BEGIN');
        const check = await client.query(
          `SELECT b.id, b.status, b.renter_user_id, l.owner_user_id
           FROM rental_bookings b
           JOIN listings l ON l.id = b.rental_listing_id
           WHERE b.id::text = $1 FOR UPDATE`,
          [bookingId],
        );
        const b = check.rows[0];
        if (!b) throw new Error('Booking not found');
        if (b.renter_user_id !== auth.userId && b.owner_user_id !== auth.userId) {
          throw new Error('Not authorized to cancel this booking');
        }
        if (b.status !== 'pending' && b.status !== 'confirmed') {
          throw new Error(`Cannot cancel booking in ${b.status} state`);
        }

        await client.query(`UPDATE rental_bookings SET status = 'cancelled' WHERE id = $1`, [b.id]);
        await client.query(`UPDATE rental_booking_items SET item_status = 'cancelled' WHERE rental_booking_id = $1`, [b.id]);
        await client.query(
          `INSERT INTO rental_booking_status_history (rental_booking_id, from_status, to_status, changed_by_user_id, reason)
           VALUES ($1, $2, 'cancelled', $3, 'User cancelled booking')`,
          [b.id, b.status, auth.userId],
        );
        await client.query('COMMIT');
      });

      recordEdgeAudit(env, ctx, 'RENTAL_BOOKING_CANCELLED', auth.userId, request.headers.get('CF-Connecting-IP'), {
        bookingId,
      });

      return jsonResponse({ data: { success: true, status: 'cancelled' } }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'CANCEL_FAILED' } }, 400, cors);
    }
  }

  // 6. Bookings - Accept (Owner)
  if (path.match(/^\/rentals\/bookings\/[^/]+\/accept$/) && method === 'POST') {
    const bookingId = path.split('/')[3];
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    try {
      let bookingDetails: any = null;
      await withDb(env, ctx, async (client) => {
        await client.query('BEGIN');
        const check = await client.query(
          `SELECT b.id, b.status, b.renter_user_id, b.start_date, b.end_date, b.total_amount_paise, l.owner_user_id
           FROM rental_bookings b
           JOIN listings l ON l.id = b.rental_listing_id
           WHERE b.id::text = $1 FOR UPDATE`,
          [bookingId],
        );
        const b = check.rows[0];
        if (!b) throw new Error('Booking not found');
        if (b.owner_user_id !== auth.userId) {
          throw new Error('Only the listing owner can accept this booking');
        }
        if (b.status !== 'pending') {
          throw new Error(`Cannot accept booking in ${b.status} state`);
        }

        await client.query(`UPDATE rental_bookings SET status = 'confirmed' WHERE id = $1`, [b.id]);
        await client.query(`UPDATE rental_booking_items SET item_status = 'confirmed' WHERE rental_booking_id = $1`, [b.id]);
        await client.query(
          `INSERT INTO rental_booking_status_history (rental_booking_id, from_status, to_status, changed_by_user_id, reason)
           VALUES ($1, 'pending', 'confirmed', $2, 'Owner accepted booking')`,
          [b.id, auth.userId],
        );
        await client.query('COMMIT');
        bookingDetails = b;
      });

      recordEdgeAudit(env, ctx, 'RENTAL_BOOKING_ACCEPTED', auth.userId, request.headers.get('CF-Connecting-IP'), {
        bookingId,
      });

      let workflowStarted = false;
      let workflowInstanceId: string | null = null;
      if (env.RENTAL_WORKFLOW && bookingDetails) {
        try {
          workflowInstanceId = `rental-${bookingDetails.id}`; // one lifecycle per booking
          await env.RENTAL_WORKFLOW.create({
            id: workflowInstanceId,
            params: {
              bookingId: bookingDetails.id,
              renterUserId: bookingDetails.renter_user_id,
              startDate: bookingDetails.start_date,
              endDate: bookingDetails.end_date,
              totalPaise: Number(bookingDetails.total_amount_paise),
            },
          });
          workflowStarted = true;
        } catch (wfErr) {
          console.warn('[Workflow] Auto-trigger error:', wfErr);
        }
      }

      return jsonResponse(
        { data: { success: true, status: 'confirmed', workflowStarted, workflowInstanceId } },
        200,
        cors,
      );
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'ACCEPT_FAILED' } }, 400, cors);
    }
  }

  // 6b. Return Inspection (listing owner or admin). The lifecycle workflow settles the deposit from this row.
  if (path.match(/^\/rentals\/bookings\/[^/]+\/inspection$/) && method === 'POST') {
    const bookingId = path.split('/')[3];
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    const body = (await request.json().catch(() => ({}))) as {
      result?: string;
      notes?: string;
      evidenceUrls?: unknown;
      estimatedRecoveryPaise?: unknown;
    };
    const result = body.result;
    const recovery = body.estimatedRecoveryPaise;
    const evidence = Array.isArray(body.evidenceUrls) ? body.evidenceUrls.filter((u) => typeof u === 'string') : [];
    if (result !== 'pass' && result !== 'damage' && result !== 'missing') {
      return jsonResponse({ error: { message: "result must be 'pass', 'damage' or 'missing'", code: 'INVALID_INPUT' } }, 400, cors);
    }
    if (result !== 'pass' && !(Number.isSafeInteger(recovery) && (recovery as number) > 0)) {
      return jsonResponse(
        { error: { message: 'estimatedRecoveryPaise (positive integer) is required for damage/missing', code: 'INVALID_INPUT' } },
        400,
        cors,
      );
    }

    try {
      const outcome = await withDb(env, ctx, async (client) => {
        const b = (
          await client.query(
            `SELECT b.id, b.status, l.owner_user_id FROM rental_bookings b
             JOIN listings l ON l.id = b.rental_listing_id WHERE b.id::text = $1`,
            [bookingId],
          )
        ).rows[0];
        if (!b) return 'NOT_FOUND';
        if (b.owner_user_id !== auth.userId && auth.role !== 'admin') return 'FORBIDDEN';
        if (b.status !== 'active') return 'NOT_ACTIVE';
        const ins = await client.query(
          `INSERT INTO return_inspections (rental_booking_id, inspected_by_user_id, result, notes, evidence_urls, estimated_recovery_paise)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6) ON CONFLICT (rental_booking_id) DO NOTHING`,
          [b.id, auth.userId, result, body.notes ?? null, JSON.stringify(evidence), result === 'pass' ? null : String(recovery)],
        );
        if (!ins.rowCount) return 'EXISTS';
        await client.query(
          `UPDATE rental_bookings SET actual_return_date = COALESCE(actual_return_date, GREATEST(CURRENT_DATE, start_date)), updated_at = now()
           WHERE id = $1`,
          [b.id],
        );
        return 'OK';
      });

      const failures: Record<string, [number, string]> = {
        NOT_FOUND: [404, 'Booking not found'],
        FORBIDDEN: [403, 'Only the listing owner or an admin can record an inspection'],
        NOT_ACTIVE: [409, 'Inspection can only be recorded for an active rental'],
        EXISTS: [409, 'Inspection already recorded for this booking'],
      };
      if (outcome !== 'OK') {
        const [status, message] = failures[outcome];
        return jsonResponse({ error: { message, code: outcome } }, status, cors);
      }

      emitQueueEvent(env, ctx, 'RENTAL_INSPECTION_RECORDED', { bookingId, userId: auth.userId, result });
      return jsonResponse({ data: { bookingId, result, recorded: true } }, 201, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'INSPECTION_FAILED' } }, 500, cors);
    }
  }

  // 7. Workflow Trigger & Status
  if (path.match(/^\/rentals\/bookings\/[^/]+\/workflow\/trigger$/) && method === 'POST') {
    const bookingId = path.split('/')[3];
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    if (!env.RENTAL_WORKFLOW) {
      return jsonResponse({ error: { message: 'Workflows binding is unavailable', code: 'UNAVAILABLE' } }, 503, cors);
    }

    try {
      const booking = await withDb(env, ctx, async (client) => {
        const res = await client.query(
          `SELECT b.id, b.status, b.renter_user_id, b.start_date, b.end_date, b.total_amount_paise, l.owner_user_id
           FROM rental_bookings b
           JOIN listings l ON l.id = b.rental_listing_id
           WHERE b.id::text = $1 AND (b.renter_user_id::text = $2 OR l.owner_user_id::text = $2)`,
          [bookingId, auth.userId],
        );
        return res.rows[0];
      });

      if (!booking) {
        return jsonResponse({ error: { message: 'Booking not found or unauthorized', code: 'NOT_FOUND' } }, 404, cors);
      }

      const instanceId = `rental-${booking.id}`; // create() throws if one already exists
      const instance = await env.RENTAL_WORKFLOW.create({
        id: instanceId,
        params: {
          bookingId: booking.id,
          renterUserId: booking.renter_user_id,
          startDate: booking.start_date,
          endDate: booking.end_date,
          totalPaise: Number(booking.total_amount_paise),
        },
      });

      return jsonResponse({ data: { instanceId, status: await instance.status() } }, 202, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'WORKFLOW_TRIGGER_FAILED' } }, 500, cors);
    }
  }

  if (path.match(/^\/rentals\/bookings\/[^/]+\/workflow$/) && method === 'GET') {
    const bookingId = path.split('/')[3];
    const auth = extractBearerUser(request, jwtSecret);
    if (!auth) {
      return jsonResponse({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401, cors);
    }

    const instanceId = url.searchParams.get('instanceId') || `rental-${bookingId}`;
    if (!env.RENTAL_WORKFLOW) {
      return jsonResponse({ error: { message: 'Workflows unavailable', code: 'UNAVAILABLE' } }, 503, cors);
    }

    try {
      const instance = await env.RENTAL_WORKFLOW.get(instanceId);
      const status = await instance.status();
      return jsonResponse({ data: { instanceId, ...status } }, 200, cors);
    } catch (err: any) {
      return jsonResponse({ error: { message: err.message, code: 'WORKFLOW_STATUS_ERROR' } }, 404, cors);
    }
  }

  return null;
}

