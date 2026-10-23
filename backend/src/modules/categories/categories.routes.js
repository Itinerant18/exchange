import { Router } from 'express';
import { AppError } from '../../appErrors/AppError.js';
import { authenticate, requireRole } from '../../middleware/authenticate.js';
import { auditContext } from '../../services/auditLogService.js';
import { isUuid } from '../../utils/validators.js';
import * as service from './categories.service.js';

export const categoriesRouter = Router();
export const categoryAdminRouter = Router();
// Read-only admin views live under their own prefix so they are never shadowed
// by the public reads mounted on the same `/categories` path.
export const categoryAdminReadRouter = Router();

// Guards MUST be registered before the admin handlers.
categoryAdminReadRouter.use(authenticate, requireRole('admin'));

categoryAdminReadRouter.get('/', async (req, res, next) => {
  try {
    res.status(200).json({ data: await service.listAdminCategories() });
  } catch (error) {
    next(error);
  }
});

categoryAdminReadRouter.get('/:id', async (req, res, next) => {
  try {
    assertId(req.params.id);
    const category = await service.getAnyCategoryForAdmin(req.params.id);
    res.status(200).json({ data: category });
  } catch (error) {
    next(error);
  }
});

function assertId(value) {
  if (!isUuid(value)) {
    throw new AppError('The identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  return value;
}

function assertObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('The request body must be a JSON object.', { statusCode: 400 });
  }
  return body;
}

// Public reads
categoriesRouter.get('/', async (req, res, next) => {
  try {
    res.status(200).json({ data: await service.listPublicCategories() });
  } catch (error) {
    next(error);
  }
});

categoriesRouter.get('/:id', async (req, res, next) => {
  try {
    assertId(req.params.id);
    res.status(200).json({ data: await service.getPublicCategory(req.params.id) });
  } catch (error) {
    next(error);
  }
});

// Admin writes — guards MUST be registered before the handlers.
categoryAdminRouter.use(authenticate, requireRole('admin'));

categoryAdminRouter.post('/', async (req, res, next) => {
  try {
    res.status(201).json({ data: await service.adminCreateCategory(req.authUser, auditContext(req), assertObject(req.body)) });
  } catch (error) {
    next(error);
  }
});

categoryAdminRouter.patch('/:id', async (req, res, next) => {
  try {
    assertId(req.params.id);
    res.status(200).json({ data: await service.adminUpdateCategory(req.authUser, auditContext(req), req.params.id, assertObject(req.body)) });
  } catch (error) {
    next(error);
  }
});

categoryAdminRouter.delete('/:id', async (req, res, next) => {
  try {
    assertId(req.params.id);
    res.status(200).json({ data: await service.adminDeactivateCategory(req.authUser, auditContext(req), req.params.id) });
  } catch (error) {
    next(error);
  }
});
