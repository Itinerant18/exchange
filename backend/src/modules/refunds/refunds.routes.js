import { Router } from 'express';
import { AppError } from '../../appErrors/AppError.js';
import { authenticate, requireRole } from '../../middleware/authenticate.js';
import { auditContext } from '../../services/auditLogService.js';
import { paginationMeta, sendData } from '../../utils/http.js';
import { parsePagination } from '../../utils/http.js';
import * as service from './refunds.service.js';

export const refundsRouter = Router();
export const refundsAdminRouter = Router();

function assertObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('The request body must be a JSON object.', { statusCode: 400 });
  }
  return body;
}

refundsAdminRouter.use(authenticate, requireRole('admin'));

refundsAdminRouter.post('/', async (req, res, next) => {
  try {
    const refund = await service.createRefund(req.authUser, auditContext(req), assertObject(req.body));
    res.status(201).json({ data: refund });
  } catch (error) {
    next(error);
  }
});

refundsAdminRouter.get('/', async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const { rows, total } = await service.listRefundsForAdmin(req.query ?? {}, pagination);
    sendData(res, rows, { meta: paginationMeta(pagination, total) });
  } catch (error) {
    next(error);
  }
});

refundsAdminRouter.post('/:id/settle', async (req, res, next) => {
  try {
    const body = assertObject(req.body ?? {});
    const outcome = body.outcome === 'failed' ? 'failed' : 'succeeded';
    await service.settleRefund(req.authUser, auditContext(req), req.params.id, outcome);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Participant view of a single refund (guards inside the service).
refundsRouter.use(authenticate);
refundsRouter.get('/:id', async (req, res, next) => {
  try {
    sendData(res, await service.getRefund(req.authUser, req.params.id));
  } catch (error) {
    next(error);
  }
});
