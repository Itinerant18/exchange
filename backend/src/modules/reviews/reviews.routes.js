import { Router } from 'express';
import { AppError } from '../../appErrors/AppError.js';
import { authenticate, requireRole, maybeAuthenticate } from '../../middleware/authenticate.js';
import { auditContext } from '../../services/auditLogService.js';
import { paginationMeta, sendData } from '../../utils/http.js';
import { parsePagination } from '../../utils/http.js';
import { isUuid } from '../../utils/validators.js';
import * as service from './reviews.service.js';

export const reviewsRouter = Router();
export const reviewsAdminRouter = Router();

function assertObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('The request body must be a JSON object.', { statusCode: 400 });
  }
  return body;
}

function assertReviewId(value) {
  if (!isUuid(value)) {
    throw new AppError('The review identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  return value;
}

/**
 * Public reads (optional identity for hidden-review visibility). Uses the
 * shared optional-auth middleware: anonymous callers browse published reviews
 * and a present-but-broken token degrades to anonymous instead of failing a
 * public read.
 */
reviewsRouter.use(maybeAuthenticate);

reviewsRouter.get('/', async (req, res, next) => {
  try {
    const revieweeId = req.query?.revieweeId;
    if (!isUuid(revieweeId)) {
      throw new AppError('revieweeId is required.', { statusCode: 400, code: 'INVALID_ID' });
    }
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const { rows, total, reputation } = await service.listReviewsForUser(revieweeId, req.query ?? {}, pagination);
    sendData(res, rows, { meta: { ...paginationMeta(pagination, total), reputation } });
  } catch (error) {
    next(error);
  }
});

// Authenticated reviewer actions (registered before /:id so /mine is never captured as an id).
reviewsRouter.post('/', authenticate, async (req, res, next) => {
  try {
    const review = await service.createReview(req.authUser, auditContext(req), assertObject(req.body ?? {}));
    res.status(201).json({ data: review });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.get('/mine', authenticate, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const { rows, total } = await service.listMyWritten(req.authUser, pagination);
    sendData(res, rows, { meta: paginationMeta(pagination, total) });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.delete('/:id', authenticate, async (req, res, next) => {
  try {
    assertReviewId(req.params.id);
    await service.deleteReview(req.authUser, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Public review detail read (unauthenticated allowed for published reviews).
reviewsRouter.get('/:id', async (req, res, next) => {
  try {
    assertReviewId(req.params.id);
    sendData(res, await service.getPublicReview(req.authUser ?? null, req.params.id));
  } catch (error) {
    next(error);
  }
});

// Admin moderation
reviewsAdminRouter.use(authenticate, requireRole('admin'));

reviewsAdminRouter.patch('/:id', async (req, res, next) => {
  try {
    assertReviewId(req.params.id);
    sendData(res, await service.moderateReview(req.authUser, auditContext(req), req.params.id, assertObject(req.body ?? {})));
  } catch (error) {
    next(error);
  }
});
