import { AppError } from '../../appErrors/AppError.js';
import { pool, withTransaction } from '../../config/database.js';
import { writeAuditLog } from '../../services/auditLogService.js';
import { claimUnitsToStatus } from '../inventory/inventory.repository.js';
import { isUuid } from '../../utils/validators.js';
import { translatePgError } from '../../utils/pgErrorMapper.js';
import * as repository from './orders.repository.js';

const ORDER_STATUSES = ['pending', 'paid', 'cancelled', 'refunded'];

// -------------------------------------------------------------------- create

/**
 * Creates a pending order in one transaction:
 *   - every line is one physical unit; the sale price is snapshotted here,
 *   - each unit is conditionally claimed to SALE_PENDING (a concurrent claim
 *     fails the claim and rolls the whole order back),
 *   - the partial unique index on order_items(inventory_item_id) blocks any
 *     residual double-claim at the database layer.
 */
export async function createOrder(user, context, body) {
  const requestedItems = Array.isArray(body.items) ? body.items : null;
  if (!requestedItems || requestedItems.length === 0) {
    throw new AppError('items must be a non-empty array of inventory item ids.', { statusCode: 400 });
  }
  if (requestedItems.length > 20) {
    throw new AppError('An order may contain at most 20 units.', { statusCode: 400, code: 'ORDER_TOO_LARGE' });
  }

  const itemIds = [];
  for (const entry of requestedItems) {
    const id = typeof entry === 'string' ? entry : entry?.inventoryItemId;
    if (!isUuid(id)) {
      throw new AppError('items must reference valid inventory item ids.', { statusCode: 400, code: 'INVALID_ID' });
    }
    if (itemIds.includes(id)) {
      throw new AppError('The same unit cannot be requested twice.', { statusCode: 400, code: 'DUPLICATE_ITEM' });
    }
    itemIds.push(id);
  }

  const resolved = [];
  for (const itemId of itemIds) {
    const listing = await loadListingForItem(itemId);
    if (!listing.is_sale || listing.sale_price_paise === null) {
      throw new AppError('This listing is not offered for sale.', { statusCode: 409, code: 'LISTING_NOT_SALEABLE' });
    }
    if (listing.listing_status !== 'active') {
      throw new AppError('Listing not found.', { statusCode: 404, code: 'LISTING_NOT_FOUND' });
    }
    if (listing.owner_type === 'SELLER' && listing.owner_user_id === user.id) {
      throw new AppError('Buying a unit from your own listing is not supported.', {
        statusCode: 409,
        code: 'SELF_PURCHASE_NOT_ALLOWED',
      });
    }
    resolved.push({ itemId, listingId: listing.listing_id, unitPrice: Number(listing.sale_price_paise) });
  }

  const totalPaise = resolved.reduce((sum, line) => sum + line.unitPrice, 0);

  try {
    const order = await withTransaction(async (client) => {
      const header = await repository.insertOrder(client, {
        buyer_user_id: user.id,
        total_amount_paise: totalPaise,
      });

      const claimedAll = await claimUnitsToStatus(
        client,
        itemIds,
        ['AVAILABLE'],
        'SALE_PENDING',
      );
      if (!claimedAll) {
        throw new AppError('One of the units is no longer available.', {
          statusCode: 409,
          code: 'ITEM_NO_LONGER_AVAILABLE',
        });
      }

      for (const line of resolved) {
        await repository.insertOrderItem(client, {
          order_id: header.id,
          inventory_item_id: line.itemId,
          listing_id: line.listingId,
          unit_price_paise: line.unitPrice,
        });
      }

      await writeAuditLog(client, {
        ...context,
        action: 'ORDER_CREATED',
        entityType: 'order',
        entityId: header.id,
        newValue: { total: totalPaise, units: itemIds.length },
      });
      return header;
    });

    return {
      id: order.id,
      status: order.status,
      totalAmountPaise: Number(order.total_amount_paise),
      items: resolved.map((line) => ({ inventoryItemId: line.itemId, unitPricePaise: line.unitPrice })),
    };
  } catch (error) {
    throw translatePgError(error);
  }
}

// ---------------------------------------------------------------------- read

function requireOrderViewer(order, user) {
  if (order.buyer_user_id === user.id || user.isAdmin) return;
  throw new AppError('You do not have access to this order.', { statusCode: 403, code: 'FORBIDDEN' });
}

export async function getOrder(user, orderId) {
  const order = await repository.findOrderById(orderId);
  if (!order) {
    throw new AppError('Order not found.', { statusCode: 404, code: 'ORDER_NOT_FOUND' });
  }
  requireOrderViewer(order, user);
  const items = await repository.findOrderItems(orderId);
  return {
    ...repository.mapOrderRow(order),
    items: items.map((row) => ({
      id: row.id,
      inventoryItemId: row.inventory_item_id,
      listingId: row.listing_id,
      listingTitle: row.listing_title,
      unitPricePaise: Number(row.unit_price_paise),
      status: row.status,
    })),
  };
}

export async function listMyOrders(user, query, pagination) {
  let status;
  if (query.status !== undefined) {
    status = String(query.status).trim().toLowerCase();
    if (!ORDER_STATUSES.includes(status)) {
      throw new AppError(`status must be one of: ${ORDER_STATUSES.join(', ')}.`, { statusCode: 400 });
    }
  }
  return repository.listOrdersForBuyer(user.id, { status }, pagination);
}

// --------------------------------------------------------------------- cancel

/**
 * Buyer cancellation while the order is still pending: releases the claim so
 * the units become rentable/purchasable again. Paid orders are cancelled only
 * through the refund workflow.
 */
export async function cancelOrder(user, context, orderId) {
  const order = await repository.findOrderById(orderId);
  if (!order) {
    throw new AppError('Order not found.', { statusCode: 404, code: 'ORDER_NOT_FOUND' });
  }
  requireOrderViewer(order, user);
  if (order.status !== 'pending') {
    throw new AppError(`An order in status ${order.status} cannot be cancelled by the buyer.`, {
      statusCode: 409,
      code: 'ORDER_CANCEL_NOT_ALLOWED',
    });
  }

  await withTransaction(async (client) => {
    const moved = await repository.transitionOrderStatus(client, orderId, { fromStatus: ['pending'], toStatus: 'cancelled' });
    if (!moved) {
      throw new AppError('The order has already changed state.', { statusCode: 409, code: 'ORDER_STATE_CONFLICT' });
    }
    await repository.setOrderItemsStatus(client, orderId, { fromStatus: 'pending', toStatus: 'cancelled' });

    const items = (await repository.findOrderItems(orderId, client)).map((row) => row.inventory_item_id);
    await claimUnitsToStatus(client, items, ['SALE_PENDING'], 'AVAILABLE');

    await writeAuditLog(client, { ...context, action: 'ORDER_CANCELLED', entityType: 'order', entityId: orderId, newValue: { fromStatus: 'pending' } });
  });
  return { id: orderId, status: 'cancelled' };
}

// -------------------------------------------------- used by payments service

/** Marks a pending order paid after its sale payment settles. Caller's transaction. */
export async function markOrderPaidInTransaction(client, orderId, changedByUserId, auditEntry) {
  const order = await repository.findOrderById(orderId, client);
  if (!order) {
    throw new AppError('Order not found.', { statusCode: 404, code: 'ORDER_NOT_FOUND' });
  }
  if (order.status === 'paid') return order;
  if (order.status !== 'pending') {
    throw new AppError(`An order in status ${order.status} cannot be marked paid.`, {
      statusCode: 409,
      code: 'ORDER_CONFIRM_NOT_ALLOWED',
    });
  }

  const moved = await repository.transitionOrderStatus(client, orderId, { fromStatus: ['pending'], toStatus: 'paid' });
  if (!moved) {
    throw new AppError('The order has already changed state.', { statusCode: 409, code: 'ORDER_STATE_CONFLICT' });
  }
  await repository.setOrderItemsStatus(client, orderId, { fromStatus: 'pending', toStatus: 'paid' });

  const items = (await repository.findOrderItems(orderId, client)).map((row) => row.inventory_item_id);
  const sold = await claimUnitsToStatus(client, items, ['SALE_PENDING'], 'SOLD');
  if (!sold) {
    throw new AppError('A unit is not in the sale-pending state; the order cannot be marked paid.', {
      statusCode: 409,
      code: 'ITEM_STATE_CONFLICT',
    });
  }

  await writeAuditLog(client, {
    ...auditEntry,
    action: 'ORDER_PAID',
    entityType: 'order',
    entityId: orderId,
    newValue: { paymentRecordedBy: changedByUserId },
  });
  return order;
}

/** Loads the saleable listing behind an inventory item. */
async function loadListingForItem(itemId) {
  const record = await queryItemWithListing(itemId);
  if (!record) {
    throw new AppError('Inventory item not found.', { statusCode: 404, code: 'ITEM_NOT_FOUND' });
  }
  return {
    listing_id: record.listing_id,
    is_sale: record.is_sale,
    sale_price_paise: record.sale_price_paise,
    listing_status: record.listing_status,
    owner_type: record.owner_type,
    owner_user_id: record.owner_user_id,
  };
}

async function queryItemWithListing(itemId) {
  const { rows } = await pool.query(
    `SELECT i.listing_id, i.operational_status,
            l.is_sale, l.sale_price_paise, l.listing_status, l.owner_type, l.owner_user_id
     FROM public.inventory_items i
     JOIN public.listings l ON l.id = i.listing_id
     WHERE i.id = $1 LIMIT 1`,
    [itemId],
  );
  return rows[0] ?? null;
}
