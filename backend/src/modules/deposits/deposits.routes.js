import { Router } from 'express';
import { AppError } from '../../appErrors/AppError.js';
import { authenticate, requireRole } from '../../middleware/authenticate.js';
import { auditContext } from '../../services/auditLogService.js';
import { paginationMeta, sendData } from '../../utils/http.js';
import { parsePagination } from '../../utils/http.js';
import * as service from './deposits.service.js';

export const depositsRouter = Router();
export const depositsAdminRouter = Router();

function assertObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('The request body must be a JSON object.', { statusCode: 400 });
  }
  return body;
}

depositsRouter.use(authenticate);

depositsRouter.get('/', async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const { rows, total } = await service.listMyDeposits(req.authUser, pagination);
    sendData(res, rows, { meta: paginationMeta(pagination, total) });
  } catch (error) {
    next(error);
  }
});

depositsRouter.get('/:id', async (req, res, next) => {
  try {
    sendData(res, await service.getDeposit(req.authUser, req.params.id));
  } catch (error) {
    next(error);
  }
});

// Admin controls
depositsAdminRouter.use(authenticate, requireRole('admin'));

depositsAdminRouter.post('/:id/release', async (req, res, next) => {
  try {
    sendData(res, await service.releaseDeposit(req.authUser, auditContext(req), req.params.id));
  } catch (error) {
    next(error);
  }
});

depositsAdminRouter.post('/:id/deduct', async (req, res, next) => {
  try {
    const body = assertObject(req.body ?? {});
    sendData(res, await service.deductDeposit(req.authUser, auditContext(req), req.params.id, body));
  } catch (error) {
    next(error);
  }
});
