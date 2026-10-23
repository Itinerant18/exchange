import { Router } from 'express';
import { AppError } from '../../appErrors/AppError.js';
import { authenticate, requireRole } from '../../middleware/authenticate.js';
import { auditContext } from '../../services/auditLogService.js';
import { paginationMeta, sendData } from '../../utils/http.js';
import { parsePagination } from '../../utils/http.js';
import { isUuid } from '../../utils/validators.js';
import * as service from './payments.service.js';

export const paymentsRouter = Router();
export const paymentsAdminRouter = Router();

function assertPaymentId(value) {
  if (!isUuid(value)) {
    throw new AppError('The payment identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  return value;
}

function assertObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('The request body must be a JSON object.', { statusCode: 400 });
  }
  return body;
}

// Participant endpoints
paymentsRouter.use(authenticate);

paymentsRouter.post('/', async (req, res, next) => {
  try {
    const result = await service.createPaymentIntent(req.authUser, auditContext(req), assertObject(req.body));
    res.status(result.existing ? 200 : 201).json({ data: result.payment });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.get('/', async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const { rows, total } = await service.listMyPayments(req.authUser, pagination);
    sendData(res, rows, { meta: paginationMeta(pagination, total) });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.get('/:id', async (req, res, next) => {
  try {
    assertPaymentId(req.params.id);
    sendData(res, await service.getPayment(req.authUser, req.params.id));
  } catch (error) {
    next(error);
  }
});

// Admin settlement endpoints (manual/offline recording; no live provider calls).
paymentsAdminRouter.use(authenticate, requireRole('admin'));

paymentsAdminRouter.post('/:id/settle', async (req, res, next) => {
  try {
    assertPaymentId(req.params.id);
    const body = assertObject(req.body ?? {});
    const result = await service.settlePayment(req.authUser, auditContext(req), req.params.id, body);
    res.status(200).json({ data: result.payment });
  } catch (error) {
    next(error);
  }
});

paymentsAdminRouter.post('/:id/fail', async (req, res, next) => {
  try {
    assertPaymentId(req.params.id);
    const body = assertObject(req.body ?? {});
    await service.failSettlement(req.authUser, auditContext(req), req.params.id, body);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
