import { parsePagination, paginationMeta, sendData } from '../../utils/http.js';
import * as service from './favorites.service.js';

export async function getFavoriteIds(req, res, next) {
  try {
    const ids = await service.getFavoriteIds(req.authUser);
    sendData(res, ids);
  } catch (error) {
    next(error);
  }
}

export async function getFavorites(req, res, next) {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const { rows, total } = await service.getFavorites(req.authUser, pagination);
    sendData(res, rows, { meta: paginationMeta(pagination, total) });
  } catch (error) {
    next(error);
  }
}

export async function addFavorite(req, res, next) {
  try {
    const result = await service.addFavorite(req.authUser, req.params.listingId);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function removeFavorite(req, res, next) {
  try {
    await service.removeFavorite(req.authUser, req.params.listingId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function getShortlists(req, res, next) {
  try {
    const shortlists = await service.getShortlists(req.authUser);
    sendData(res, shortlists);
  } catch (error) {
    next(error);
  }
}

export async function createShortlist(req, res, next) {
  try {
    const shortlist = await service.createShortlist(req.authUser, req.body ?? {});
    res.status(201).json({ data: shortlist });
  } catch (error) {
    next(error);
  }
}

export async function addShortlistItem(req, res, next) {
  try {
    const result = await service.addItemToShortlist(req.authUser, req.params.shortlistId, req.params.listingId);
    sendData(res, result);
  } catch (error) {
    next(error);
  }
}

export async function removeShortlistItem(req, res, next) {
  try {
    await service.removeItemFromShortlist(req.authUser, req.params.shortlistId, req.params.listingId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function getShortlistItems(req, res, next) {
  try {
    const items = await service.getShortlistItems(req.authUser, req.params.shortlistId);
    sendData(res, items);
  } catch (error) {
    next(error);
  }
}
