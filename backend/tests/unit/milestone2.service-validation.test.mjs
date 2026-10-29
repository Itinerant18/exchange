import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { openDispute, resolveDispute } from '../../src/modules/disputes/disputes.service.js';
import { reviewKyc } from '../../src/modules/kyc/kyc.service.js';

describe('Milestone 2 Backend Service Contract Validation', () => {
  const adminUser = { id: 'u0000000-0000-0000-0000-000000000001', isAdmin: true };
  const regularUser = { id: 'u0000000-0000-0000-0000-000000000002', isAdmin: false };
  const dummyContext = { requestId: 'req-test-123' };
  const validUuid = 'd0000000-0000-0000-0000-000000000001';

  test('resolveDispute enforces outcome in ["resolve", "reject"]', async () => {
    // Missing outcome
    await assert.rejects(
      async () => resolveDispute(adminUser, dummyContext, validUuid, { resolution: 'Valid resolution text' }),
      { statusCode: 400, message: "outcome must be 'resolve' or 'reject'." }
    );

    // Invalid outcome
    await assert.rejects(
      async () => resolveDispute(adminUser, dummyContext, validUuid, { outcome: 'arbitrated', resolution: 'Valid resolution text' }),
      { statusCode: 400, message: "outcome must be 'resolve' or 'reject'." }
    );

    // Valid outcome 'resolve' passes parameter validation (proceeds to database query)
    try {
      await resolveDispute(adminUser, dummyContext, validUuid, { outcome: 'resolve', resolution: 'Valid resolution notes' });
    } catch (err) {
      // Should fail on DB connection or dispute lookup, NOT on outcome validation
      assert.notEqual(err.message, "outcome must be 'resolve' or 'reject'.");
      assert.notEqual(err.message, 'resolution must be between 5 and 2000 characters.');
    }

    // Valid outcome 'reject' passes parameter validation
    try {
      await resolveDispute(adminUser, dummyContext, validUuid, { outcome: 'reject', resolution: 'Valid rejection notes' });
    } catch (err) {
      assert.notEqual(err.message, "outcome must be 'resolve' or 'reject'.");
      assert.notEqual(err.message, 'resolution must be between 5 and 2000 characters.');
    }
  });

  test('resolveDispute rejects resolution < 5 characters', async () => {
    await assert.rejects(
      async () => resolveDispute(adminUser, dummyContext, validUuid, { outcome: 'resolve', resolution: 'No' }),
      { statusCode: 400, message: 'resolution must be between 5 and 2000 characters.' }
    );
  });

  test('resolveDispute enforces admin authorization', async () => {
    await assert.rejects(
      async () => resolveDispute(regularUser, dummyContext, validUuid, { outcome: 'resolve', resolution: 'Valid resolution text' }),
      { statusCode: 403, code: 'FORBIDDEN' }
    );
  });

  test('reviewKyc rejects status "approved" and mandates ["verified", "rejected"]', async () => {
    // Sending 'approved' must fail enum validation
    await assert.rejects(
      async () => reviewKyc(adminUser, dummyContext, validUuid, { status: 'approved' }),
      { statusCode: 400 }
    );

    // Sending 'rejected' without reason must fail
    await assert.rejects(
      async () => reviewKyc(adminUser, dummyContext, validUuid, { status: 'rejected' }),
      { statusCode: 400, message: 'rejectionReason is required to reject a verification.' }
    );

    // Sending 'rejected' with short reason (<4 chars) must fail
    await assert.rejects(
      async () => reviewKyc(adminUser, dummyContext, validUuid, { status: 'rejected', rejectionReason: 'No' }),
      { statusCode: 400 }
    );
  });

  test('openDispute mandates exactly one of rentalBookingId or orderId', async () => {
    const validBookingId = 'b0000000-0000-0000-0000-000000000001';
    const validOrderId = 'c0000000-0000-0000-0000-000000000001';

    // Neither
    await assert.rejects(
      async () => openDispute(regularUser, dummyContext, {
        disputeType: 'quality_issue',
        description: 'Torn fabric on delivery',
      }),
      { statusCode: 400, message: 'Provide exactly one of rentalBookingId or orderId.' }
    );

    // Both
    await assert.rejects(
      async () => openDispute(regularUser, dummyContext, {
        disputeType: 'quality_issue',
        description: 'Torn fabric on delivery',
        rentalBookingId: validBookingId,
        orderId: validOrderId,
      }),
      { statusCode: 400, message: 'Provide exactly one of rentalBookingId or orderId.' }
    );
  });
});
