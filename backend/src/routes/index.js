import { Router } from 'express';
import { AppError } from '../appErrors/AppError.js';
import { checkDatabaseConnection } from '../config/database.js';
import { env } from '../config/env.js';
import { platform } from '../config/platform.js';

// Module routers
import { authRouter } from '../modules/auth/auth.routes.js';
import { usersRouter } from '../modules/users/users.routes.js';
import { categoriesRouter, categoryAdminRouter, categoryAdminReadRouter } from '../modules/categories/categories.routes.js';
import { listingsRouter, listingOwnerRouter } from '../modules/listings/listings.routes.js';
import { inventoryRouter } from '../modules/inventory/inventory.routes.js';
import { rentalsRouter, rentalActionRouter } from '../modules/rentals/rentals.routes.js';
import { ordersRouter } from '../modules/orders/orders.routes.js';
import { paymentsRouter, paymentsAdminRouter } from '../modules/payments/payments.routes.js';
import { depositsRouter, depositsAdminRouter } from '../modules/deposits/deposits.routes.js';
import { refundsRouter, refundsAdminRouter } from '../modules/refunds/refunds.routes.js';
import { reviewsRouter, reviewsAdminRouter } from '../modules/reviews/reviews.routes.js';
import { kycRouter, kycAdminRouter } from '../modules/kyc/kyc.routes.js';
import { adminRouter } from '../modules/admin/admin.routes.js';

const router = Router();

router.get('/health', async (req, res, next) => {
  try {
    const database = await checkDatabaseConnection();

    res.status(200).json({
      data: {
        status: 'ok',
        service: platform.apiServiceName,
        environment: env.nodeEnv,
        database: database.ok ? 'connected' : 'unavailable',
        databaseLatencyMs: database.latencyMs,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(
      new AppError('The database is not available.', {
        statusCode: 503,
        code: 'DATABASE_UNAVAILABLE',
        cause: error,
      }),
    );
  }
});

// Auth (register/login/refresh/logout/me)
router.use('/auth', authRouter);

// Users: own profile + addresses
router.use('/users', usersRouter);

// Categories: public tree/detail reads, admin-only mutations
router.use('/categories', categoriesRouter);
router.use('/categories', categoryAdminRouter);
router.use('/admin/categories', categoryAdminReadRouter);

// Listings: public catalog, owner management (incl. images)
router.use('/listings', listingsRouter);
router.use('/listings', listingOwnerRouter);

// Inventory items: owner-only management (guards inside)
router.use('/inventory', inventoryRouter);

// Rentals: public availability projection + authenticated booking flows
router.use('/rentals', rentalsRouter);
router.use('/rentals', rentalActionRouter);

// Sales orders
router.use('/orders', ordersRouter);

// Payments: participant intents + admin manual settlement
router.use('/payments', paymentsRouter);
router.use('/admin/payments', paymentsAdminRouter);

// Security deposits: renter reads + admin release/deduct
router.use('/deposits', depositsRouter);
router.use('/admin/deposits', depositsAdminRouter);

// Refunds: admin workflows + participant single-read
router.use('/admin/refunds', refundsAdminRouter);
router.use('/refunds', refundsRouter);

// Reviews: public lists/detail, member create, admin moderation
router.use('/reviews', reviewsRouter);
router.use('/admin/reviews', reviewsAdminRouter);

// KYC: self-service attempts + admin review queue
router.use('/kyc', kycRouter);
router.use('/admin/kyc', kycAdminRouter);

// Admin: read-only audit trail
router.use('/admin', adminRouter);

export const apiRouter = router;
