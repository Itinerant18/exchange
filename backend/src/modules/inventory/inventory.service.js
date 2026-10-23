import { AppError } from '../../appErrors/AppError.js';
import { withTransaction } from '../../config/database.js';
import { writeAuditLog } from '../../services/auditLogService.js';
import { requireListingOwnerForInternalUse } from '../listings/listings.service.js';
import { expectEnum, expectString, isUuid } from '../../utils/validators.js';
import { translatePgError } from '../../utils/pgErrorMapper.js';
import * as repository from './inventory.repository.js';

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'];

// Manual user transitions. RESERVED/RENTED/SALE_PENDING/SOLD are exclusively
// managed inside rental and sale transaction flows, never via this endpoint.
const MANUAL_TRANSITIONS = Object.freeze({
  AVAILABLE: new Set(['MAINTENANCE']),
  MAINTENANCE: new Set(['AVAILABLE']),
  DAMAGED: new Set(['AVAILABLE']),
  LOST: new Set(['RETIRED']),
});

export async function createItem(user, context, body) {
  if (body.listingId === undefined || !isUuid(body.listingId)) {
    throw new AppError('listingId must be a valid listing identifier.', { statusCode: 400, code: 'INVALID_ID' });
  }

  const condition = body.condition === undefined
    ? 'good'
    : expectEnum(body.condition, 'condition', CONDITIONS).toLowerCase();
  let serialOrSku;
  try {
    serialOrSku = body.serialOrSku === undefined || body.serialOrSku === null
      ? null
      : expectString(body.serialOrSku, 'serialOrSku', { min: 1, max: 100 });
  } catch (error) {
    throw error;
  }

  // Platform-owned units may only ever be created by admins onto platform listings.
  let ownerType = 'SELLER';
  let ownerId = user.id;
  if (body.ownerType !== undefined && String(body.ownerType).toUpperCase() === 'PLATFORM') {
    if (!user.isAdmin) {
      throw new AppError('Only administrators may create platform-owned inventory.', { statusCode: 403, code: 'FORBIDDEN' });
    }
  }

  const listing = await requireListingOwnerForInternalUse(user.id, user.isAdmin, body.listingId);
  if (body.ownerType !== undefined && String(body.ownerType).toUpperCase() === 'PLATFORM') {
    if (listing.owner_type !== 'PLATFORM') {
      throw new AppError('Platform inventory can only be attached to platform-owned listings.', {
        statusCode: 409,
        code: 'OWNER_TYPE_MISMATCH',
      });
    }
    ownerType = 'PLATFORM';
    ownerId = null;
  } else if (listing.owner_type !== 'SELLER') {
    throw new AppError('Only seller-owned listings accept manually created inventory.', {
      statusCode: 409,
      code: 'OWNER_TYPE_MISMATCH',
    });
  }

  try {
    const created = await withTransaction(async (client) => {
      const row = await repository.insertItem(client, {
        listing_id: body.listingId,
        owner_type: ownerType,
        owner_user_id: ownerId,
        serial_or_sku: serialOrSku,
        condition,
      });
      await writeAuditLog(client, {
        ...context,
        action: 'INVENTORY_ITEM_CREATED',
        entityType: 'inventory_item',
        entityId: row.id,
        newValue: { listingId: body.listingId, ownerType },
      });
      return row;
    });
    return {
      id: created.id,
      listingId: created.listing_id,
      operationalStatus: created.operational_status,
      createdAt: created.created_at,
    };
  } catch (error) {
    throw translatePgError(error);
  }
}

export async function getItem(user, itemId) {
  const item = await repository.findItemById(itemId);
  if (!item) {
    throw new AppError('Inventory item not found.', { statusCode: 404, code: 'ITEM_NOT_FOUND' });
  }
  if (!user.isAdmin && (item.owner_type !== 'SELLER' || item.owner_user_id !== user.id)) {
    throw new AppError('You do not have access to this inventory item.', { statusCode: 403, code: 'FORBIDDEN' });
  }

  const blocking = await repository.findBlockingRentals([itemId]);
  return {
    ...repository.mapItemRow(item),
    upcomingRentals: blocking.map((row) => ({
      startDate: row.start_date,
      endDate: row.end_date,
      itemStatus: row.item_status,
    })),
  };
}

export async function listMyItems(user, pagination) {
  return repository.listItemsForOwner(user.id, pagination);
}

export async function updateItem(user, context, itemId, body) {
  const item = await repository.findItemById(itemId);
  if (!item) {
    throw new AppError('Inventory item not found.', { statusCode: 404, code: 'ITEM_NOT_FOUND' });
  }
  if (!user.isAdmin && (item.owner_type !== 'SELLER' || item.owner_user_id !== user.id)) {
    throw new AppError('Only the inventory owner may perform this action.', { statusCode: 403, code: 'FORBIDDEN' });
  }

  const fields = {};
  if (body.serialOrSku !== undefined) {
    fields.serial_or_sku = body.serialOrSku === null ? null : expectString(body.serialOrSku, 'serialOrSku', { min: 1, max: 100 });
  }
  if (body.condition !== undefined) {
    fields.condition = expectEnum(body.condition, 'condition', CONDITIONS).toLowerCase();
  }

  if (body.operationalStatus !== undefined) {
    const target = expectEnum(body.operationalStatus, 'operationalStatus', [
      'AVAILABLE', 'RESERVED', 'RENTED', 'SALE_PENDING', 'SOLD', 'MAINTENANCE', 'DAMAGED', 'LOST', 'RETIRED',
    ]);
    const current = item.operational_status;
    const allowed = MANUAL_TRANSITIONS[current];

    if (current === 'RETIRED') {
      throw new AppError('A retired unit cannot be reactivated.', { statusCode: 409, code: 'ITEM_RETIRED' });
    }
    if (!allowed) {
      throw new AppError(`Units in status ${current} are managed by rental/sale workflows and cannot be switched manually.`, {
        statusCode: 409,
        code: 'ITEM_STATUS_TRANSITION_NOT_ALLOWED',
      });
    }
    if (!allowed.has(target)) {
      throw new AppError(`A unit in status ${current} cannot move to ${target}.`, {
        statusCode: 409,
        code: 'ITEM_STATUS_TRANSITION_NOT_ALLOWED',
      });
    }
    const blocking = await repository.countBlockingRentals(itemId);
    if (blocking > 0) {
      throw new AppError('This unit has active reservations; resolve them before changing its status.', {
        statusCode: 409,
        code: 'ITEM_HAS_ACTIVE_RENTALS',
      });
    }
    fields.operational_status = target;
  }

  if (Object.keys(fields).length === 0) {
    throw new AppError('No fields provided to update.', { statusCode: 400 });
  }

  const updated = await withTransaction(async (client) => {
    const row = await repository.updateItemRow(client, itemId, fields);
    if (row) {
      await writeAuditLog(client, {
        ...context,
        action: 'INVENTORY_ITEM_UPDATED',
        entityType: 'inventory_item',
        entityId: itemId,
        newValue: fields,
      });
    }
    return row;
  });
  if (!updated) {
    throw new AppError('Inventory item not found.', { statusCode: 404, code: 'ITEM_NOT_FOUND' });
  }
  return repository.mapItemRow(updated);
}

/** DELETE semantics: retirement instead of row deletion. */
export async function retireItem(user, context, itemId) {
  const item = await repository.findItemById(itemId);
  if (!item) {
    throw new AppError('Inventory item not found.', { statusCode: 404, code: 'ITEM_NOT_FOUND' });
  }
  if (!user.isAdmin && (item.owner_type !== 'SELLER' || item.owner_user_id !== user.id)) {
    throw new AppError('Only the inventory owner may perform this action.', { statusCode: 403, code: 'FORBIDDEN' });
  }

  const current = item.operational_status;
  if (['RESERVED', 'RENTED', 'SALE_PENDING', 'SOLD'].includes(current)) {
    throw new AppError(`A unit in status ${current} cannot be retired.`, {
      statusCode: 409,
      code: 'ITEM_RETIRE_NOT_ALLOWED',
    });
  }
  if (current === 'RETIRED') {
    return repository.mapItemRow(item);
  }
  const blocking = await repository.countBlockingRentals(itemId);
  if (blocking > 0) {
    throw new AppError('This unit has active reservations; resolve them before retiring it.', {
      statusCode: 409,
      code: 'ITEM_HAS_ACTIVE_RENTALS',
    });
  }

  const updated = await withTransaction(async (client) => {
    const row = await repository.updateItemRow(client, itemId, { operational_status: 'RETIRED' });
    await writeAuditLog(client, { ...context, action: 'INVENTORY_ITEM_RETIRED', entityType: 'inventory_item', entityId: itemId });
    return row;
  });
  return repository.mapItemRow(updated);
}
