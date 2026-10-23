import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/authenticate.js';
import { auditContext } from '../../services/auditLogService.js';
import { paginationMeta, sendData } from '../../utils/http.js';
import { parsePagination } from '../../utils/http.js';
import { isUuid } from '../../utils/validators.js';
import { AppError } from '../../appErrors/AppError.js';
import * as service from './disputes.service.js';

export const disputesRouter = Router();
export const disputesAdminRouter = Router();

disputesRouter.use(authenticate);
disputesAdminRouter.use(authenticate, requireRole('admin'));

disputesRouter.post('/', async (req, res, next) => {
  try {
    sendData(res, await service.openDispute(req.authUser, auditContext(req), req.body ?? {}), { status: 201 });
  } catch (error) { next(error); }
});

disputesRouter.get('/', async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const { rows, total } = await service.listMyDisputes(req.authUser, pagination);
    sendData(res, rows, { meta: paginationMeta(pagination, total) });
  } catch (error) { next(error); }
});

disputesRouter.get('/:id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) throw new AppError('The dispute identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
    sendData(res, await service.getDispute(req.authUser, req.params.id));
  } catch (error) { next(error); }
});

disputesAdminRouter.get('/', async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const { rows, total } = await service.listDisputesForAdmin(req.query ?? {}, pagination);
    sendData(res, rows, { meta: paginationMeta(pagination, total) });
  } catch (error) { next(error); }
});

disputesAdminRouter.patch('/:id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) throw new AppError('The dispute identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
    sendData(res, await service.resolveDispute(req.authUser, auditContext(req), req.params.id, req.body ?? {}));
  } catch (error) { next(error); }
});
