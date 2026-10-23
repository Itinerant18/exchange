import { Router } from 'express';
import { AppError } from '../../appErrors/AppError.js';
import { authenticate, requireRole } from '../../middleware/authenticate.js';
import { auditContext } from '../../services/auditLogService.js';
import { paginationMeta, sendData } from '../../utils/http.js';
import { parsePagination } from '../../utils/http.js';
import * as service from './kyc.service.js';

export const kycRouter = Router();
export const kycAdminRouter = Router();

function assertObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('The request body must be a JSON object.', { statusCode: 400 });
  }
  return body;
}

kycRouter.use(authenticate);

kycRouter.post('/', async (req, res, next) => {
  try {
    const attempt = await service.createMyAttempt(req.authUser, auditContext(req), assertObject(req.body ?? {}));
    res.status(201).json({ data: attempt });
  } catch (error) {
    next(error);
  }
});

kycRouter.get('/', async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const { rows, total } = await service.listMyKyc(req.authUser, pagination);
    sendData(res, rows, { meta: paginationMeta(pagination, total) });
  } catch (error) {
    next(error);
  }
});

// Admin review queue
kycAdminRouter.use(authenticate, requireRole('admin'));

kycAdminRouter.get('/', async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const { rows, total } = await service.listKycForAdmin(req.query ?? {}, pagination);
    sendData(res, rows, { meta: paginationMeta(pagination, total) });
  } catch (error) {
    next(error);
  }
});

kycAdminRouter.patch('/:id', async (req, res, next) => {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
      throw new AppError('The KYC identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
    }
    sendData(res, await service.reviewKyc(req.authUser, auditContext(req), req.params.id, assertObject(req.body ?? {})));
  } catch (error) {
    next(error);
  }
});
