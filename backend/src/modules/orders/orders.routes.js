import { Router } from 'express';
import { AppError } from '../../appErrors/AppError.js';
import { authenticate } from '../../middleware/authenticate.js';
import { auditContext } from '../../services/auditLogService.js';
import { paginationMeta, sendData } from '../../utils/http.js';
import { parsePagination } from '../../utils/http.js';
import { isUuid } from '../../utils/validators.js';
import * as service from './orders.service.js';

export const ordersRouter = Router();
ordersRouter.use(authenticate);

function assertOrderId(value) {
  if (!isUuid(value)) {
    throw new AppError('The order identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  return value;
}

function assertObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('The request body must be a JSON object.', { statusCode: 400 });
  }
  return body;
}

ordersRouter.post('/', async (req, res, next) => {
  try {
    const order = await service.createOrder(req.authUser, auditContext(req), assertObject(req.body));
    res.status(201).json({ data: order });
  } catch (error) {
    next(error);
  }
});

ordersRouter.get('/', async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const { rows, total } = await service.listMyOrders(req.authUser, req.query ?? {}, pagination);
    sendData(res, rows, { meta: paginationMeta(pagination, total) });
  } catch (error) {
    next(error);
  }
});

ordersRouter.get('/:id', async (req, res, next) => {
  try {
    assertOrderId(req.params.id);
    sendData(res, await service.getOrder(req.authUser, req.params.id));
  } catch (error) {
    next(error);
  }
});

ordersRouter.post('/:id/cancel', async (req, res, next) => {
  try {
    assertOrderId(req.params.id);
    sendData(res, await service.cancelOrder(req.authUser, auditContext(req), req.params.id));
  } catch (error) {
    next(error);
  }
});
