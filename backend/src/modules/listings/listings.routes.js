import { Router } from 'express';
import { authenticate, maybeAuthenticate } from '../../middleware/authenticate.js';
import * as controller from './listings.controller.js';

export const listingsRouter = Router();
export const listingOwnerRouter = Router();

// Public catalog. Optional auth lets owners see their own non-public rows.
listingsRouter.use(maybeAuthenticate);
listingsRouter.get('/', controller.listPublic);
listingsRouter.get('/:id', controller.getDetail);

// Owner-scoped listing management. Guards registered before handlers.
listingOwnerRouter.use(authenticate);

listingOwnerRouter.get('/mine', controller.listMine);
listingOwnerRouter.post('/', controller.create);
listingOwnerRouter.patch('/:id', controller.update);
listingOwnerRouter.put('/:id', controller.update);
listingOwnerRouter.delete('/:id', controller.retire);
listingOwnerRouter.post('/:id/images', controller.addImage);
listingOwnerRouter.delete('/:id/images/:imageId', controller.deleteImage);
