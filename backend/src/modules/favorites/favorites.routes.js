import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import * as controller from './favorites.controller.js';

export const favoritesRouter = Router();

// All favorite routes require authentication
favoritesRouter.use(authenticate);

// Quick IDs array for fast heart rendering on grid
favoritesRouter.get('/ids', controller.getFavoriteIds);

// Shortlists / Moodboards (MUST BE REGISTERED BEFORE :listingId)
favoritesRouter.get('/shortlists', controller.getShortlists);
favoritesRouter.post('/shortlists', controller.createShortlist);
favoritesRouter.post('/shortlists/:shortlistId/items/:listingId', controller.addShortlistItem);
favoritesRouter.delete('/shortlists/:shortlistId/items/:listingId', controller.removeShortlistItem);

// Paginated listing models for Favorites page
favoritesRouter.get('/', controller.getFavorites);

// Heart / Unheart a listing
favoritesRouter.post('/:listingId', controller.addFavorite);
favoritesRouter.delete('/:listingId', controller.removeFavorite);
