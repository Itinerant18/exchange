import { AppError } from '../../appErrors/AppError.js';
import { withTransaction } from '../../config/database.js';
import { writeAuditLog } from '../../services/auditLogService.js';
import { requireActiveCategory } from '../categories/categories.service.js';
import {
  expectAmount,
  expectEnum,
  expectString,
  isUuid,
} from '../../utils/validators.js';
import { translatePgError } from '../../utils/pgErrorMapper.js';
import * as repository from './listings.repository.js';

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'];
const OWNER_STATUSES = ['active', 'inactive'];
const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];

// ---------------------------------------------------------------------- read

export async function listPublicListings(query, requestedBasis) {
  return repository.listPublicListings(requestedBasis, query);
}

export async function getPublicListing(user, listingId) {
  const listing = await repository.findListingDetail(listingId);
  const isOwner = Boolean(user && listing && listing.ownerId && user.id === listing.ownerId);
  const isAdmin = Boolean(user?.isAdmin);

  if (!listing) {
    throw new AppError('Listing not found.', { statusCode: 404, code: 'LISTING_NOT_FOUND' });
  }
  const publiclyVisible = listing.status === 'active' && listing.categoryActive && listing.categoryName;
  if (!publiclyVisible && !isOwner && !isAdmin) {
    // Non-public offers are unlisted rather than "forbidden" to avoid leaking existence.
    throw new AppError('Listing not found.', { statusCode: 404, code: 'LISTING_NOT_FOUND' });
  }

  if (!isOwner && !isAdmin) {
    // Public view: no internal operational counters or private metadata.
    return {
      id: listing.id, categoryId: listing.categoryId, categoryName: listing.categoryName,
      categorySlug: listing.categorySlug, title: listing.title, description: listing.description,
      condition: listing.condition, size: listing.size, colour: listing.colour, brand: listing.brand,
      rentalPricePaise: listing.rentalPricePaise, salePricePaise: listing.salePricePaise,
      depositPaise: listing.depositPaise, isRental: listing.isRental, isSale: listing.isSale,
      createdAt: listing.createdAt, images: listing.images,
      availableUnits: listing.inventory.available,
    };
  }
  return listing;
}

export async function listMyListings(user, query, pagination) {
  const status = query.status === undefined ? undefined : expectEnum(query.status, 'status', OWNER_STATUSES);
  return repository.listOwnerListings(user.id, { status: status?.toLowerCase() }, pagination);
}

// -------------------------------------------------------------------- create

/**
 * Creates a seller-owned listing. Every new listing authored in the MVP is a
 * personal offer; platform-owned listings are created through staff tooling
 * and remain ordinary rows with owner_type = PLATFORM.
 */
export async function createListing(user, context, body) {
  const title = expectString(body.title, 'title', { min: 3, max: 200 });
  const description = body.description === undefined || body.description === null
    ? null
    : expectString(body.description, 'description', { min: 1, max: 5000 });
  const condition = expectEnum(body.condition, 'condition', CONDITIONS).toLowerCase();

  if (body.categoryId === undefined || !isUuid(body.categoryId)) {
    throw new AppError('categoryId must be a valid category identifier.', { statusCode: 400, code: 'INVALID_ID' });
  }
  await requireActiveCategory(body.categoryId);

  // Offer modes are opt-in flags; every enabled mode needs its price.
  const isRental = body.isRental === undefined ? true : Boolean(body.isRental);
  const isSale = body.isSale === undefined ? false : Boolean(body.isSale);
  const rentalPricePaise = body.rentalPricePaise === undefined || body.rentalPricePaise === null
    ? null
    : expectAmount(body.rentalPricePaise, 'rentalPricePaise');
  const salePricePaise = body.salePricePaise === undefined || body.salePricePaise === null
    ? null
    : expectAmount(body.salePricePaise, 'salePricePaise');
  const depositPaise = body.depositPaise === undefined || body.depositPaise === null
    ? null
    : expectAmount(body.depositPaise, 'depositPaise');
  const replacementValuePaise = body.replacementValuePaise === undefined || body.replacementValuePaise === null
    ? null
    : expectAmount(body.replacementValuePaise, 'replacementValuePaise');

  assertOfferModeConsistency({ isRental, isSale, rentalPricePaise, salePricePaise, depositPaise });

  try {
    const createdId = await withTransaction(async (client) => {
      const created = await repository.insertListing(client, {
        owner_type: 'SELLER',
        owner_user_id: user.id,
        category_id: body.categoryId,
        title,
        description,
        condition,
        size: body.size ?? null,
        colour: body.colour ?? null,
        brand: body.brand ?? null,
        rental_price_paise: rentalPricePaise,
        sale_price_paise: salePricePaise,
        deposit_paise: depositPaise,
        replacement_value_paise: replacementValuePaise,
        is_rental: isRental,
        is_sale: isSale,
        listing_status: 'active',
      });
      await writeAuditLog(client, { ...context, action: 'LISTING_CREATED', entityType: 'listing', entityId: created.id, newValue: { title } });
      return created.id;
    });
    return { id: createdId };
  } catch (error) {
    throw translatePgError(error);
  }
}

function assertOfferModeConsistency({ isRental, isSale, rentalPricePaise, salePricePaise, depositPaise }) {
  if (!isRental && !isSale) {
    throw new AppError('A listing must be offered for rental, for sale, or both.', { statusCode: 400 });
  }
  if (isRental && rentalPricePaise === null) {
    throw new AppError('rentalPricePaise is required for rental offers.', { statusCode: 400 });
  }
  if (isSale && salePricePaise === null) {
    throw new AppError('salePricePaise is required for sale offers.', { statusCode: 400 });
  }
  if (!isRental && depositPaise !== null) {
    throw new AppError('depositPaise only applies to rental offers.', { statusCode: 400 });
  }
}

// --------------------------------------------------------------------- patch

/**
 * Partial update for the owner (PUT uses the same handler with full-body
 * semantics in this MVP: omitted fields keep their current values).
 */
export async function updateListing(user, context, listingId, body) {
  const existing = await repository.findListingById(listingId);
  if (!existing) {
    throw new AppError('Listing not found.', { statusCode: 404, code: 'LISTING_NOT_FOUND' });
  }
  requireOwner(user, existing);

  const merged = {
    title: existing.title,
    description: existing.description,
    condition: existing.condition,
    size: existing.size,
    colour: existing.colour,
    brand: existing.brand,
    rental_price: existing.rental_price_paise,
    sale_price: existing.sale_price_paise,
    deposit: existing.deposit_paise,
    replacement: existing.replacement_value_paise,
    is_rental: existing.is_rental,
    is_sale: existing.is_sale,
    status: existing.listing_status,
  };

  let categoryIdChanged = false;
  if (body.categoryId !== undefined) {
    if (!isUuid(body.categoryId)) {
      throw new AppError('categoryId must be a valid category identifier.', { statusCode: 400, code: 'INVALID_ID' });
    }
    if (body.categoryId !== existing.category_id) {
      await requireActiveCategory(body.categoryId);
      categoryIdChanged = true;
    }
  }

  if (body.title !== undefined) merged.title = expectString(body.title, 'title', { min: 3, max: 200 });
  if (body.description !== undefined) {
    merged.description = body.description === null ? null : expectString(body.description, 'description', { min: 1, max: 5000 });
  }
  if (body.condition !== undefined) merged.condition = expectEnum(body.condition, 'condition', CONDITIONS).toLowerCase();
  for (const key of ['size', 'colour', 'brand']) {
    if (body[key] !== undefined) {
      merged[key] = body[key] === null ? null : expectString(body[key], key, { min: 1, max: 120, optional: false });
    }
  }

  if (body.isRental !== undefined) merged.is_rental = Boolean(body.isRental);
  if (body.isSale !== undefined) merged.is_sale = Boolean(body.isSale);
  if (body.rentalPricePaise !== undefined) merged.rental_price = expectAmount(body.rentalPricePaise, 'rentalPricePaise');
  if (body.salePricePaise !== undefined) merged.sale_price = expectAmount(body.salePricePaise, 'salePricePaise');
  if (body.depositPaise !== undefined) merged.deposit = body.depositPaise === null ? null : expectAmount(body.depositPaise, 'depositPaise');
  if (body.replacementValuePaise !== undefined) {
    merged.replacement = body.replacementValuePaise === null ? null : expectAmount(body.replacementValuePaise, 'replacementValuePaise');
  }

  assertOfferModeConsistency({
    isRental: merged.is_rental,
    isSale: merged.is_sale,
    rentalPricePaise: merged.rental_price,
    salePricePaise: merged.sale_price,
    depositPaise: merged.deposit,
  });

  if (body.status !== undefined) {
    const newStatus = String(body.status).trim().toLowerCase();
    if (!OWNER_STATUSES.includes(newStatus)) {
      throw new AppError(`status must be one of: ${OWNER_STATUSES.join(', ')}. 'retired' is set by deleting the listing.`, {
        statusCode: 400,
      });
    }
    if (merged.status === 'retired') {
      throw new AppError('A retired listing cannot be reactivated.', { statusCode: 409, code: 'LISTING_RETIRED' });
    }
    merged.status = newStatus;
  }

  const fields = {
    title: merged.title,
    description: merged.description,
    condition: merged.condition,
    size: merged.size,
    colour: merged.colour,
    brand: merged.brand,
    rental_price_paise: merged.rental_price,
    sale_price_paise: merged.sale_price,
    deposit_paise: body.depositPaise === undefined ? undefined : merged.deposit,
    replacement_value_paise: body.replacementValuePaise === undefined ? undefined : merged.replacement,
    is_rental: merged.is_rental,
    is_sale: merged.is_sale,
    listing_status: merged.status,
  };
  // CASE-gated columns must be explicitly present for changes to apply.
  if (body.title === undefined) delete fields.title;
  if (body.description === undefined) delete fields.description;
  if (body.condition === undefined) delete fields.condition;
  if (body.size === undefined) delete fields.size;
  if (body.colour === undefined) delete fields.colour;
  if (body.brand === undefined) delete fields.brand;
  if (body.isRental === undefined) delete fields.is_rental;
  if (body.isSale === undefined) delete fields.is_sale;
  if (body.status === undefined) delete fields.listing_status;
  if (body.rentalPricePaise === undefined) delete fields.rental_price_paise;
  if (body.salePricePaise === undefined) delete fields.sale_price_paise;

  try {
    const updated = await withTransaction(async (client) => {
      const row = await repository.updateListingRow(client, listingId, fields);
      if (row) {
        await writeAuditLog(client, {
          ...context,
          action: 'LISTING_UPDATED',
          entityType: 'listing',
          entityId: listingId,
          newValue: { fields: Object.keys(fields) },
        });
      }
      return row;
    });
    void categoryIdChanged;
    if (!updated) {
      throw new AppError('Listing not found.', { statusCode: 404, code: 'LISTING_NOT_FOUND' });
    }
    return repository.mapListingRow(updated);
  } catch (error) {
    throw translatePgError(error);
  }
}

/**
 * DELETE semantics: retiring the listing. Blocked while any physical unit is
 * reserved, rented, or awaiting a sale so live transactions are never orphaned.
 */
export async function retireListing(user, context, listingId) {
  const existing = await repository.findListingById(listingId);
  if (!existing) {
    throw new AppError('Listing not found.', { statusCode: 404, code: 'LISTING_NOT_FOUND' });
  }
  requireOwner(user, existing);
  if (existing.listing_status === 'retired') {
    return { id: listingId, status: 'retired' };
  }

  const claims = await repository.countListingUnitClaims(listingId);
  if (claims > 0) {
    throw new AppError('Cannot retire a listing while its items are reserved, rented, or pending sale.', {
      statusCode: 409,
      code: 'LISTING_HAS_ACTIVE_CLAIMS',
    });
  }

  await withTransaction(async (client) => {
    await repository.updateListingRow(client, listingId, { listing_status: 'retired' });
    await writeAuditLog(client, { ...context, action: 'LISTING_RETIRED', entityType: 'listing', entityId: listingId });
  });
  return { id: listingId, status: 'retired' };
}

// -------------------------------------------------------------------- images

export async function addListingImage(user, listingId, body) {
  const existing = await repository.findListingById(listingId);
  if (!existing) {
    throw new AppError('Listing not found.', { statusCode: 404, code: 'LISTING_NOT_FOUND' });
  }
  requireOwner(user, existing);
  if (existing.listing_status === 'retired') {
    throw new AppError('A retired listing cannot accept images.', { statusCode: 409, code: 'LISTING_RETIRED' });
  }

  const objectKey = expectString(body.objectKey, 'objectKey', { min: 4, max: 500 });
  const mimeType = String(body.mimeType ?? '').trim().toLowerCase();
  if (!IMAGE_MIME_TYPES.includes(mimeType)) {
    throw new AppError(`mimeType must be one of: ${IMAGE_MIME_TYPES.join(', ')}.`, { statusCode: 400 });
  }
  const sizeBytes = Number(body.sizeBytes);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > 25 * 1024 * 1024) {
    throw new AppError('sizeBytes must be the actual file size (1 byte to 25 MiB).', { statusCode: 400 });
  }

  const result = await withTransaction(async (client) => {
    if (body.isPrimary === true) {
      await repository.demotePrimaryImages(listingId, {}, client);
    }
    return repository.insertListingImage(client, {
      listingId,
      objectKey,
      mimeType,
      sizeBytes,
      isPrimary: Boolean(body.isPrimary),
    });
  });

  return {
    id: result.id,
    objectKey: result.object_key,
    mimeType: result.mime_type,
    sizeBytes: Number(result.size_bytes),
    isPrimary: result.is_primary,
    createdAt: result.created_at,
  };
}

export async function deleteListingImage(user, listingId, imageId) {
  const existing = await repository.findListingById(listingId);
  if (!existing) {
    throw new AppError('Listing not found.', { statusCode: 404, code: 'LISTING_NOT_FOUND' });
  }
  requireOwner(user, existing);

  const deleted = await withTransaction((client) => repository.deleteImage(listingId, imageId, client));
  if (!deleted) {
    throw new AppError('Image not found.', { statusCode: 404, code: 'IMAGE_NOT_FOUND' });
  }
}

function requireOwner(user, listing) {
  if (user?.isAdmin) return;
  if (listing.owner_type !== 'SELLER' || listing.owner_user_id !== user?.id) {
    throw new AppError('Only the listing owner may perform this action.', { statusCode: 403, code: 'FORBIDDEN' });
  }
}

/** Shared with the inventory module: verifies the caller owns this listing. */
export async function requireListingOwnerForInternalUse(userId, isAdmin, listingId) {
  const listing = await repository.findListingById(listingId);
  if (!listing) {
    throw new AppError('Listing not found.', { statusCode: 404, code: 'LISTING_NOT_FOUND' });
  }
  if (!isAdmin && (listing.owner_type !== 'SELLER' || listing.owner_user_id !== userId)) {
    throw new AppError('Only the listing owner may perform this action.', { statusCode: 403, code: 'FORBIDDEN' });
  }
  return listing;
}

export async function loadListingRow(listingId) {
  const listing = await repository.findListingById(listingId);
  if (!listing) {
    throw new AppError('Listing not found.', { statusCode: 404, code: 'LISTING_NOT_FOUND' });
  }
  return listing;
}
