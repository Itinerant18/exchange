import { Router } from 'express';
import { AppError } from '../../appErrors/AppError.js';
import { authenticate, requireRole } from '../../middleware/authenticate.js';
import { auditContext } from '../../services/auditLogService.js';
import { paginationMeta, sendData } from '../../utils/http.js';
import { parsePagination } from '../../utils/http.js';
import { isUuid } from '../../utils/validators.js';
import * as service from './rentals.service.js';

export const rentalsRouter = Router();
export const rentalActionRouter = Router();
export const extensionAdminRouter = Router();

function assertBookingId(value) {
  if (!isUuid(value)) {
    throw new AppError('The booking identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
  }
  return value;
}

function assertObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('The request body must be a JSON object.', { statusCode: 400 });
  }
  return body;
}

// Public availability projection for the booking calendar.
rentalsRouter.get('/availability', async (req, res, next) => {
  try {
    const listingId = req.query?.listingId;
    if (!isUuid(listingId)) {
      throw new AppError('listingId is required.', { statusCode: 400, code: 'INVALID_ID' });
    }
    sendData(res, await service.getListingAvailability(listingId, req.query ?? {}));
  } catch (error) {
    next(error);
  }
});

// Authenticated booking views + creation.
rentalActionRouter.use(authenticate);

rentalActionRouter.post('/bookings', async (req, res, next) => {
  try {
    const booking = await service.createRentalBooking(req.authUser, auditContext(req), assertObject(req.body));
    res.status(201).json({ data: booking });
  } catch (error) {
    next(error);
  }
});

rentalActionRouter.get('/bookings', async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const { rows, total } = await service.listBookingsForViewer(req.authUser, req.query ?? {}, pagination);
    sendData(res, rows, { meta: paginationMeta(pagination, total) });
  } catch (error) {
    next(error);
  }
});

rentalActionRouter.get('/bookings/:id', async (req, res, next) => {
  try {
    assertBookingId(req.params.id);
    sendData(res, await service.getBooking(req.authUser, req.params.id));
  } catch (error) {
    next(error);
  }
});

rentalActionRouter.post('/bookings/:id/accept', async (req, res, next) => {
  try {
    assertBookingId(req.params.id);
    sendData(res, await service.acceptRentalBooking(req.authUser, auditContext(req), req.params.id));
  } catch (error) {
    next(error);
  }
});

rentalActionRouter.post('/bookings/:id/reject', async (req, res, next) => {
  try {
    assertBookingId(req.params.id);
    const body = assertObject(req.body ?? {});
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 500) : undefined;
    sendData(res, await service.rejectRentalBooking(req.authUser, auditContext(req), req.params.id, reason));
  } catch (error) {
    next(error);
  }
});

rentalActionRouter.post('/bookings/:id/cancel', async (req, res, next) => {
  try {
    assertBookingId(req.params.id);
    const body = assertObject(req.body ?? {});
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 500) : undefined;
    sendData(res, await service.cancelRentalBooking(req.authUser, auditContext(req), req.params.id, reason));
  } catch (error) {
    next(error);
  }
});

rentalActionRouter.post('/bookings/:id/start', async (req, res, next) => {
  try {
    assertBookingId(req.params.id);
    sendData(res, await service.startRentalBooking(req.authUser, auditContext(req), req.params.id));
  } catch (error) {
    next(error);
  }
});

rentalActionRouter.post('/bookings/:id/return', async (req, res, next) => {
  try {
    assertBookingId(req.params.id);
    const body = assertObject(req.body ?? {});
    sendData(res, await service.completeRentalBooking(req.authUser, auditContext(req), req.params.id, body));
  } catch (error) {
    next(error);
  }
});

// Late-fee transparency: quoted always, charged only via the approved policy.
rentalActionRouter.get('/bookings/:id/late-fee', async (req, res, next) => {
  try {
    assertBookingId(req.params.id);
    sendData(res, await service.getLateFeeQuote(req.authUser, req.params.id));
  } catch (error) {
    next(error);
  }
});

extensionAdminRouter.use(authenticate, requireRole('admin'));
extensionAdminRouter.patch('/:id/decision', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) throw new AppError('The extension identifier is not valid.', { statusCode: 400, code: 'INVALID_ID' });
    sendData(res, await service.decideBookingExtension(req.authUser, auditContext(req), req.params.id, req.body ?? {}));
  } catch (error) { next(error); }
});
rentalActionRouter.post('/bookings/:id/expire', async (req, res, next) => {
  try {
    assertBookingId(req.params.id);
    sendData(res, await service.expireRentalBooking(req.authUser, auditContext(req), req.params.id));
  } catch (error) {
    next(error);
  }
});

// Admin-only late-fee application after an overdue return.
rentalActionRouter.post('/bookings/:id/late-fee', async (req, res, next) => {
  try {
    assertBookingId(req.params.id);
    const body = assertObject(req.body ?? {});
    sendData(res, await service.applyLateFee(req.authUser, auditContext(req), req.params.id, body));
  } catch (error) {
    next(error);
  }
});

// Extensions: renter/provider request, administrator decides.
rentalActionRouter.post('/bookings/:id/extensions', async (req, res, next) => {
  try {
    assertBookingId(req.params.id);
    const body = assertObject(req.body ?? {});
    sendData(res, await service.requestBookingExtension(req.authUser, auditContext(req), req.params.id, body), { status: 201 });
  } catch (error) {
    next(error);
  }
});

rentalActionRouter.get('/bookings/:id/extensions', async (req, res, next) => {
  try {
    assertBookingId(req.params.id);
    sendData(res, await service.listBookingExtensions(req.authUser, req.params.id));
  } catch (error) {
    next(error);
  }
});
