import { Router } from 'express';
import { AppError } from '../../appErrors/AppError.js';
import { authenticate } from '../../middleware/authenticate.js';
import { auditContext } from '../../services/auditLogService.js';
import { paginationMeta, sendData } from '../../utils/http.js';
import { parsePagination } from '../../utils/http.js';
import { isUuid } from '../../utils/validators.js';
import * as service from './inventory.service.js';

export const inventoryRouter = Router();
inventoryRouter.use(authenticate);

function assertItemId(value) {
  if (!isUuid(value)) {
    throw new AppError('The inventory item identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  return value;
}

inventoryRouter.post('/items', async (req, res, next) => {
  try {
    const body = req.body ?? {};
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new AppError('The request body must be a JSON object.', { statusCode: 400 });
    }
    const item = await service.createItem(req.authUser, auditContext(req), body);
    res.status(201).json({ data: item });
  } catch (error) {
    next(error);
  }
});

inventoryRouter.get('/items', async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const { rows, total } = await service.listMyItems(req.authUser, pagination);
    sendData(res, rows, { meta: paginationMeta(pagination, total) });
  } catch (error) {
    next(error);
  }
});

inventoryRouter.get('/items/:id', async (req, res, next) => {
  try {
    assertItemId(req.params.id);
    sendData(res, await service.getItem(req.authUser, req.params.id));
  } catch (error) {
    next(error);
  }
});

inventoryRouter.patch('/items/:id', async (req, res, next) => {
  try {
    assertItemId(req.params.id);
    const body = req.body ?? {};
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new AppError('The request body must be a JSON object.', { statusCode: 400 });
    }
    sendData(res, await service.updateItem(req.authUser, auditContext(req), req.params.id, body));
  } catch (error) {
    next(error);
  }
});

inventoryRouter.delete('/items/:id', async (req, res, next) => {
  try {
    assertItemId(req.params.id);
    sendData(res, await service.retireItem(req.authUser, auditContext(req), req.params.id));
  } catch (error) {
    next(error);
  }
});
