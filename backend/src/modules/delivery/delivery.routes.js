import { Router } from 'express';
import { assertObject } from '../../utils/http.js';
import * as deliveryService from './delivery.service.js';

export const deliveryRouter = Router();

// Public quote endpoint: distances are client-supplied; pricing comes from the
// configured platform rate. No auth needed to price a hypothetical booking.
deliveryRouter.post('/quote', async (req, res, next) => {
  try {
    const body = assertObject(req.body ?? {});
    const quote = await deliveryService.quoteTransport({
      mode: body.transportMode,
      outboundDistanceKm: body.outboundDistanceKm,
      returnDistanceKm: body.returnDistanceKm,
    });
    res.status(200).json({ data: quote });
  } catch (error) {
    next(error);
  }
});
