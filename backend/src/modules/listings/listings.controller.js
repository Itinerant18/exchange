import { AppError } from '../../appErrors/AppError.js';
import { auditContext } from '../../services/auditLogService.js';
import { paginationMeta, sendData } from '../../utils/http.js';
import { expectAmount, expectEnum, isUuid } from '../../utils/validators.js';
import { parsePagination } from '../../utils/http.js';
import * as service from './listings.service.js';

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'];
const SORT_KEYS = ['newest', 'price_asc', 'price_desc'];

function assertObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('The request body must be a JSON object.', { statusCode: 400 });
  }
  return body;
}

function assertListingId(value) {
  if (!isUuid(value)) {
    throw new AppError('The listing identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  return value;
}

function parseListFilters(query) {
  const filters = {};
  if (query.categoryId !== undefined) {
    if (!isUuid(query.categoryId)) {
      throw new AppError('categoryId is not valid.', { statusCode: 400, code: 'INVALID_ID' });
    }
    filters.categoryId = query.categoryId;
  }
  if (query.condition !== undefined) {
    filters.condition = expectEnum(query.condition, 'condition', CONDITIONS).toLowerCase();
  }
  if (query.mode !== undefined) {
    const mode = String(query.mode).toLowerCase();
    if (mode !== 'rent' && mode !== 'sale') {
      throw new AppError('mode must be "rent" or "sale".', { statusCode: 400 });
    }
    filters.mode = mode;
  }
  if (query.minPrice !== undefined) filters.minPrice = expectAmount(Number(query.minPrice), 'minPrice');
  if (query.maxPrice !== undefined) filters.maxPrice = expectAmount(Number(query.maxPrice), 'maxPrice');
  if (query.q !== undefined) {
    const keyword = String(query.q).trim().slice(0, 100);
    if (keyword) filters.keyword = keyword;
  }
  if (query.sort !== undefined) {
    const sortKey = String(query.sort);
    if (!SORT_KEYS.includes(sortKey)) {
      throw new AppError(`sort must be one of: ${SORT_KEYS.join(', ')}.`, { statusCode: 400 });
    }
    filters.sortKey = sortKey;
  }
  return filters;
}

export async function listPublic(req, res, next) {
  try {
    const filters = parseListFilters(req.query ?? {});
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const { rows, total } = await service.listPublicListings(pagination, filters);
    sendData(res, rows, { meta: paginationMeta(pagination, total) });
  } catch (error) {
    next(error);
  }
}

export async function getDetail(req, res, next) {
  try {
    assertListingId(req.params.id);
    const listing = await service.getPublicListing(req.authUser ?? null, req.params.id);
    sendData(res, listing);
  } catch (error) {
    next(error);
  }
}

export async function listMine(req, res, next) {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const { rows, total } = await service.listMyListings(req.authUser, req.query ?? {}, pagination);
    sendData(res, rows, { meta: paginationMeta(pagination, total) });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const listing = await service.createListing(req.authUser, auditContext(req), assertObject(req.body));
    res.status(201).json({ data: listing });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    assertListingId(req.params.id);
    const listing = await service.updateListing(req.authUser, auditContext(req), req.params.id, assertObject(req.body));
    sendData(res, listing);
  } catch (error) {
    next(error);
  }
}

export async function retire(req, res, next) {
  try {
    assertListingId(req.params.id);
    const result = await service.retireListing(req.authUser, auditContext(req), req.params.id);
    sendData(res, result);
  } catch (error) {
    next(error);
  }
}

export async function addImage(req, res, next) {
  try {
    assertListingId(req.params.id);
    const image = await service.addListingImage(req.authUser, req.params.id, assertObject(req.body));
    res.status(201).json({ data: image });
  } catch (error) {
    next(error);
  }
}

export async function deleteImage(req, res, next) {
  try {
    assertListingId(req.params.id);
    if (!isUuid(req.params.imageId)) {
      throw new AppError('The image identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
    }
    await service.deleteListingImage(req.authUser, req.params.id, req.params.imageId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
