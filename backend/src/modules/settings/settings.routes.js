import { Router } from 'express';
import { AppError } from '../../appErrors/AppError.js';
import { authenticate, requireRole } from '../../middleware/authenticate.js';
import { auditContext } from '../../services/auditLogService.js';
import * as service from './settings.service.js';

export const settingsAdminRouter = Router();

// Guards MUST come before handlers.
settingsAdminRouter.use(authenticate, requireRole('admin'));

settingsAdminRouter.get('/', async (req, res, next) => {
  try {
    res.status(200).json({ data: await service.listAllSettings() });
  } catch (error) {
    next(error);
  }
});

// One endpoint, two explicit operations: value replacement, or approval.
settingsAdminRouter.patch('/:key', async (req, res, next) => {
  try {
    const key = req.params.key;
    if (typeof key !== 'string' || key.length === 0 || key.length > 100 || !/^[a-z0-9_]+$/.test(key)) {
      throw new AppError('The setting key is not valid.', { statusCode: 400, code: 'INVALID_ID' });
    }
    const body = req.body ?? {};
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new AppError('The request body must be a JSON object.', { statusCode: 400 });
    }
    if ('isApproved' in body && !('value' in body)) {
      const updated = await service.adminSetApproval(req.authUser, key, Boolean(body.isApproved));
      res.status(200).json({ data: updated });
      return;
    }
    if ('value' in body) {
      const updated = await service.adminUpdateValue(req.authUser, key, body.value);
      res.status(200).json({ data: updated });
      return;
    }
    throw new AppError('Provide either `value` or `isApproved`.', { statusCode: 400 });
  } catch (error) {
    next(error);
  }
});
