import { Router } from 'express';
import { authenticate, maybeAuthenticate } from '../../middleware/authenticate.js';
import * as controller from './listings.controller.js';

export const listingsRouter = Router();
export const listingOwnerRouter = Router();

// Public catalog. Optional auth lets owners see their own non-public rows.
listingsRouter.use(maybeAuthenticate);
listingsRouter.get('/', controller.listPublic);
// Available inventory unit ids (rental availability + buy-now mode).
listingsRouter.get('/:id/units', controller.listUnits);
// Facet value counts for the discovery FilterModal — uses the same filter
// grammar as listPublic so counts stay in sync with the visible catalog.
listingsRouter.get('/facets', controller.listFacets);
// 'Our Runway' reviews for a single listing (Phase 2) — registered before /:id
// so Express does not have to disambiguate trailing segments.
listingsRouter.get('/:id/reviews', controller.listReviews);
// Owner-scoped listings list registered before /:id so /mine is never captured as an id.
listingsRouter.get('/mine', authenticate, controller.listMine);
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
