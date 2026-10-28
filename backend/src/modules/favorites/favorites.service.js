import { AppError } from '../../appErrors/AppError.js';
import { isUuid, expectString } from '../../utils/validators.js';
import { loadListingRow } from '../listings/listings.service.js';
import * as repository from './favorites.repository.js';

export async function getFavoriteIds(user) {
  return repository.listUserFavoriteIds(user.id);
}

export async function getFavorites(user, pagination) {
  return repository.listUserFavorites(user.id, pagination);
}

export async function addFavorite(user, listingId) {
  if (!isUuid(listingId)) {
    throw new AppError('The listing identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  // Verify listing exists and is active
  await loadListingRow(listingId);
  return repository.addFavorite(user.id, listingId);
}

export async function removeFavorite(user, listingId) {
  if (!isUuid(listingId)) {
    throw new AppError('The listing identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  return repository.removeFavorite(user.id, listingId);
}

export async function getShortlists(user) {
  return repository.listUserShortlists(user.id);
}

export async function createShortlist(user, body) {
  const title = expectString(body.title, 'title', { min: 1, max: 100 });
  const description = body.description ? expectString(body.description, 'description', { min: 1, max: 500 }) : null;
  return repository.createShortlist(user.id, { title, description });
}

export async function addItemToShortlist(user, shortlistId, listingId) {
  if (!isUuid(shortlistId) || !isUuid(listingId)) {
    throw new AppError('Invalid identifier provided.', { statusCode: 400, code: 'INVALID_ID' });
  }
  await loadListingRow(listingId);
  const result = await repository.addShortlistItem(user.id, shortlistId, listingId);
  if (!result) {
    throw new AppError('Shortlist not found.', { statusCode: 404, code: 'SHORTLIST_NOT_FOUND' });
  }
  return { success: true };
}

export async function removeItemFromShortlist(user, shortlistId, listingId) {
  if (!isUuid(shortlistId) || !isUuid(listingId)) {
    throw new AppError('Invalid identifier provided.', { statusCode: 400, code: 'INVALID_ID' });
  }
  const result = await repository.removeShortlistItem(user.id, shortlistId, listingId);
  if (!result) {
    throw new AppError('Shortlist not found.', { statusCode: 404, code: 'SHORTLIST_NOT_FOUND' });
  }
  return { success: true };
}
