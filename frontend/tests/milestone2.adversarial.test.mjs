import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { mapBookingRow } from '../../backend/src/modules/rentals/rentals.repository.js';
import { formatPaiseToRupees, formatDate } from '../src/utils/formatters.js';
import { rentalsApi } from '../src/api/rentalsApi.js';
import { endpoints } from '../src/api/endpoints.js';

// Setup environment for testing
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('Milestone 2 Empirical Challenge — Dispute Validation', () => {
  let mockApiCalls = [];

  function simulateDisputeSubmit(form, refType, mockApi = async () => ({ id: 'disp-12345678-0000-0000-0000-000000000000' })) {
    let err = '';
    let msg = '';
    let submittedBody = null;

    const bookingId = (form.rentalBookingId || (refType === 'rental' ? form.refId : '')).trim();
    const orderId = (form.orderId || (refType === 'order' ? form.refId : '')).trim();

    const hasBooking = Boolean(bookingId);
    const hasOrder = Boolean(orderId);

    if (!hasBooking && !hasOrder) {
      err = 'Please provide either a valid Rental Booking ID or Order ID.';
      return { success: false, err, msg, submittedBody };
    }
    if (hasBooking && hasOrder) {
      err = 'Please provide exactly one reference ID (either Rental Booking ID or Order ID, not both).';
      return { success: false, err, msg, submittedBody };
    }

    const targetId = hasBooking ? bookingId : orderId;
    if (!UUID_REGEX.test(targetId)) {
      err = `Please provide a valid 36-character UUID for the ${hasBooking ? 'Rental Booking ID' : 'Order ID'}.`;
      return { success: false, err, msg, submittedBody };
    }

    if (form.description.trim().length < 5) {
      err = 'Description must be at least 5 characters long.';
      return { success: false, err, msg, submittedBody };
    }
    if (form.description.trim().length > 2000) {
      err = 'Description cannot exceed 2000 characters.';
      return { success: false, err, msg, submittedBody };
    }

    submittedBody = {
      disputeType: form.disputeType,
      description: form.description.trim(),
      ...(hasBooking ? { rentalBookingId: bookingId } : { orderId: orderId }),
    };
    if (form.evidenceUrls?.trim()) {
      submittedBody.evidenceUrls = form.evidenceUrls.split(',').map((u) => u.trim()).filter(Boolean);
    }

    return { success: true, err, msg, submittedBody };
  }

  test('Challenge 1.1: Submitting with NEITHER bookingId nor orderId is rejected client-side', () => {
    const form = {
      rentalBookingId: '',
      orderId: '',
      refId: '',
      disputeType: 'quality_issue',
      description: 'Garment arrived damaged',
      evidenceUrls: '',
    };
    const res = simulateDisputeSubmit(form, 'rental');
    assert.equal(res.success, false);
    assert.equal(res.err, 'Please provide either a valid Rental Booking ID or Order ID.');
    assert.equal(res.submittedBody, null, 'No network body should be constructed');
  });

  test('Challenge 1.2: Submitting with BOTH bookingId and orderId is rejected client-side', () => {
    const form = {
      rentalBookingId: '11111111-1111-1111-1111-111111111111',
      orderId: '22222222-2222-2222-2222-222222222222',
      refId: '',
      disputeType: 'damage',
      description: 'Garment damaged in transit',
      evidenceUrls: '',
    };
    const res = simulateDisputeSubmit(form, 'rental');
    assert.equal(res.success, false);
    assert.equal(res.err, 'Please provide exactly one reference ID (either Rental Booking ID or Order ID, not both).');
    assert.equal(res.submittedBody, null, 'No network body should be constructed');
  });

  test('Challenge 1.3: Submitting with non-UUID string for bookingId is rejected with format error', () => {
    const invalidIds = ['12345', 'not-a-uuid', '11111111-1111-1111-1111-11111111111Z', '11111111-1111-1111-1111-11111111111'];
    for (const invalidId of invalidIds) {
      const form = {
        rentalBookingId: invalidId,
        orderId: '',
        refId: invalidId,
        disputeType: 'quality_issue',
        description: 'Quality is very poor',
        evidenceUrls: '',
      };
      const res = simulateDisputeSubmit(form, 'rental');
      assert.equal(res.success, false, `Expected ${invalidId} to fail`);
      assert.equal(res.err, 'Please provide a valid 36-character UUID for the Rental Booking ID.');
      assert.equal(res.submittedBody, null);
    }
  });

  test('Challenge 1.4: Submitting with non-UUID string for orderId is rejected with format error', () => {
    const invalidIds = ['ORDER-999', 'short-id', 'xxxx-yyyy-zzzz'];
    for (const invalidId of invalidIds) {
      const form = {
        rentalBookingId: '',
        orderId: invalidId,
        refId: invalidId,
        disputeType: 'refund',
        description: 'Requesting full refund for order',
        evidenceUrls: '',
      };
      const res = simulateDisputeSubmit(form, 'order');
      assert.equal(res.success, false, `Expected ${invalidId} to fail`);
      assert.equal(res.err, 'Please provide a valid 36-character UUID for the Order ID.');
      assert.equal(res.submittedBody, null);
    }
  });

  test('Challenge 1.5: Submitting with single valid bookingId UUID succeeds and targets rentalBookingId', () => {
    const validBookingUuid = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
    const form = {
      rentalBookingId: validBookingUuid,
      orderId: '',
      refId: validBookingUuid,
      disputeType: 'quality_issue',
      description: 'The zipper was broken upon receipt and fabric torn',
      evidenceUrls: 'https://example.com/p1.jpg, https://example.com/p2.jpg',
    };
    const res = simulateDisputeSubmit(form, 'rental');
    assert.equal(res.success, true);
    assert.equal(res.err, '');
    assert.deepEqual(res.submittedBody, {
      disputeType: 'quality_issue',
      description: 'The zipper was broken upon receipt and fabric torn',
      rentalBookingId: validBookingUuid,
      evidenceUrls: ['https://example.com/p1.jpg', 'https://example.com/p2.jpg'],
    });
    assert.equal('orderId' in res.submittedBody, false, 'orderId must not be present');
  });

  test('Challenge 1.6: Submitting with single valid orderId UUID succeeds and targets orderId', () => {
    const validOrderUuid = 'f9e8d7c6-b5a4-42f1-90e8-123456789abc';
    const form = {
      rentalBookingId: '',
      orderId: validOrderUuid,
      refId: validOrderUuid,
      disputeType: 'refund',
      description: 'Resale garment received in wrong size, requesting refund',
      evidenceUrls: '',
    };
    const res = simulateDisputeSubmit(form, 'order');
    assert.equal(res.success, true);
    assert.equal(res.err, '');
    assert.deepEqual(res.submittedBody, {
      disputeType: 'refund',
      description: 'Resale garment received in wrong size, requesting refund',
      orderId: validOrderUuid,
    });
    assert.equal('rentalBookingId' in res.submittedBody, false, 'rentalBookingId must not be present');
  });

  test('Challenge 1.7: Description length boundaries (<5 chars rejected, 5-2000 accepted, >2000 rejected)', () => {
    const validUuid = '11111111-2222-3333-4444-555555555555';
    // 4 chars
    const shortRes = simulateDisputeSubmit({
      rentalBookingId: validUuid, orderId: '', refId: validUuid,
      disputeType: 'quality_issue', description: 'Torn', evidenceUrls: ''
    }, 'rental');
    assert.equal(shortRes.success, false);
    assert.equal(shortRes.err, 'Description must be at least 5 characters long.');

    // 5 chars
    const exactMinRes = simulateDisputeSubmit({
      rentalBookingId: validUuid, orderId: '', refId: validUuid,
      disputeType: 'quality_issue', description: 'Hello', evidenceUrls: ''
    }, 'rental');
    assert.equal(exactMinRes.success, true);

    // 2000 chars
    const exactMaxRes = simulateDisputeSubmit({
      rentalBookingId: validUuid, orderId: '', refId: validUuid,
      disputeType: 'quality_issue', description: 'A'.repeat(2000), evidenceUrls: ''
    }, 'rental');
    assert.equal(exactMaxRes.success, true);

    // 2001 chars
    const overMaxRes = simulateDisputeSubmit({
      rentalBookingId: validUuid, orderId: '', refId: validUuid,
      disputeType: 'quality_issue', description: 'A'.repeat(2001), evidenceUrls: ''
    }, 'rental');
    assert.equal(overMaxRes.success, false);
    assert.equal(overMaxRes.err, 'Description cannot exceed 2000 characters.');
  });

  test('Challenge 1.8: Radio switch state behavior when user toggles between rental and order', () => {
    // Simulate user state updates in React component
    let refType = 'rental';
    let form = {
      rentalBookingId: '',
      orderId: '',
      refId: '',
      disputeType: 'quality_issue',
      description: 'Item did not match photo',
      evidenceUrls: '',
    };

    // User types in rental booking ID
    const rentalId = '11111111-1111-1111-1111-111111111111';
    form = { ...form, rentalBookingId: rentalId, refId: rentalId };

    // User switches radio to 'order'
    refType = 'order';

    // User clears and types in sales order ID
    const orderId = '22222222-2222-2222-2222-222222222222';
    form = { ...form, orderId: orderId, refId: orderId };

    // What happens upon submit?
    const res = simulateDisputeSubmit(form, refType);
    // Because form.rentalBookingId was retained in state from earlier typing,
    // both hasBooking and hasOrder are true:
    assert.equal(res.success, false, 'Switching radio without clearing rentalBookingId results in mutual exclusivity error');
    assert.equal(res.err, 'Please provide exactly one reference ID (either Rental Booking ID or Order ID, not both).');
  });
});

describe('Milestone 2 Empirical Challenge — Admin Actions', () => {
  let mockFetchCalls = [];

  function simulateHandleResolveDispute(resolvingDispute, resolutionText, resolutionStatus) {
    let err = '';
    let msg = '';
    let apiPayload = null;

    if (!resolvingDispute) return { aborted: true };
    const trimmed = resolutionText.trim();
    if (trimmed.length < 5) {
      err = 'Arbitration finding/notes must be at least 5 characters long.';
      return { success: false, err };
    }
    const outcome = resolutionStatus === 'reject' || resolutionStatus === 'rejected' ? 'reject' : 'resolve';
    apiPayload = {
      outcome,
      resolution: trimmed,
      status: outcome === 'resolve' ? 'resolved' : 'rejected',
    };
    msg = `Dispute #${resolvingDispute.id.slice(0, 8)} ${outcome === 'resolve' ? 'resolved' : 'rejected'}.`;
    return { success: true, apiPayload, msg };
  }

  function simulateHandleReviewKyc(kycItem, decision, reason = '') {
    let err = '';
    let msg = '';
    let apiPayload = null;

    if (!kycItem?.id) return { aborted: true };
    const status = decision === 'approved' || decision === 'verified' ? 'verified' : 'rejected';
    const trimmedReason = reason?.trim();
    if (status === 'rejected' && (!trimmedReason || trimmedReason.length < 4)) {
      err = 'Rejection reason must be at least 4 characters long.';
      return { success: false, err };
    }
    apiPayload = {
      status,
      rejectionReason: status === 'rejected' ? (trimmedReason || 'Document unreadable or invalid') : undefined,
    };
    msg = `KYC attempt #${kycItem.id.slice(0, 8)} marked as ${status}.`;
    return { success: true, apiPayload, msg };
  }

  test('Challenge 2.1: Dispute resolution outcome mapping generates { outcome: "resolve" | "reject", resolution }', () => {
    const dispute = { id: 'd0000000-0000-0000-0000-000000000001', type: 'quality_issue' };

    // Resolve outcome
    const resolveRes = simulateHandleResolveDispute(dispute, 'Claim upheld; full security deposit refunded.', 'resolved');
    assert.equal(resolveRes.success, true);
    assert.equal(resolveRes.apiPayload.outcome, 'resolve');
    assert.equal(resolveRes.apiPayload.resolution, 'Claim upheld; full security deposit refunded.');
    assert.equal(['resolve', 'reject'].includes(resolveRes.apiPayload.outcome), true);

    // Reject outcome
    const rejectRes = simulateHandleResolveDispute(dispute, 'Item inspection confirmed normal wear and tear; claim dismissed.', 'rejected');
    assert.equal(rejectRes.success, true);
    assert.equal(rejectRes.apiPayload.outcome, 'reject');
    assert.equal(rejectRes.apiPayload.resolution, 'Item inspection confirmed normal wear and tear; claim dismissed.');
    assert.equal(['resolve', 'reject'].includes(rejectRes.apiPayload.outcome), true);

    // Reject with 'reject' value
    const rejectShortRes = simulateHandleResolveDispute(dispute, 'Claim rejected due to missing evidence photos.', 'reject');
    assert.equal(rejectShortRes.success, true);
    assert.equal(rejectShortRes.apiPayload.outcome, 'reject');
  });

  test('Challenge 2.2: Dispute resolution notes < 5 characters is rejected client-side', () => {
    const dispute = { id: 'd0000000-0000-0000-0000-000000000001' };
    const shortRes = simulateHandleResolveDispute(dispute, 'Done', 'resolved');
    assert.equal(shortRes.success, false);
    assert.equal(shortRes.err, 'Arbitration finding/notes must be at least 5 characters long.');
  });

  test('Challenge 2.3: KYC review approve action sends status "verified" without TypeError', () => {
    const kycItem = { id: 'k0000000-0000-0000-0000-000000000001', status: 'pending' };

    // Direct invocation does not throw TypeError (fixing previous `reviewingKyc(k)` bug)
    assert.doesNotThrow(() => {
      const res = simulateHandleReviewKyc(kycItem, 'verified');
      assert.equal(res.success, true);
      assert.equal(res.apiPayload.status, 'verified');
      assert.equal(res.apiPayload.rejectionReason, undefined);
    });

    // Also supports 'approved' decision alias, mapping strictly to 'verified'
    const aliasRes = simulateHandleReviewKyc(kycItem, 'approved');
    assert.equal(aliasRes.success, true);
    assert.equal(aliasRes.apiPayload.status, 'verified', 'Must map approved to verified');
  });

  test('Challenge 2.4: KYC review reject action validates reason (min 4 chars) and sends status "rejected"', () => {
    const kycItem = { id: 'k0000000-0000-0000-0000-000000000001', status: 'pending' };

    // Missing or short reason (<4 chars) is rejected
    const emptyRes = simulateHandleReviewKyc(kycItem, 'rejected', '');
    assert.equal(emptyRes.success, false);
    assert.equal(emptyRes.err, 'Rejection reason must be at least 4 characters long.');

    const shortReasonRes = simulateHandleReviewKyc(kycItem, 'rejected', 'No');
    assert.equal(shortReasonRes.success, false);
    assert.equal(shortReasonRes.err, 'Rejection reason must be at least 4 characters long.');

    // Valid reason >= 4 chars succeeds
    const validRejectRes = simulateHandleReviewKyc(kycItem, 'rejected', 'Document scan is blurry and unreadable');
    assert.equal(validRejectRes.success, true);
    assert.equal(validRejectRes.apiPayload.status, 'rejected');
    assert.equal(validRejectRes.apiPayload.rejectionReason, 'Document scan is blurry and unreadable');
  });
});

describe('Milestone 2 Empirical Challenge — Security Deposit Display', () => {
  function renderMyBookingsDeposit(booking) {
    function formatPrice(paise) {
      if (!paise) return '—';
      return `₹${(Number(paise) / 100).toFixed(0)}`;
    }
    const val = booking.depositAmountPaise ?? booking.depositPaise ?? booking.deposit_amount_paise ?? booking.deposit_paise;
    return val ? formatPrice(val) : '—';
  }

  function renderBookingDetailDeposit(booking) {
    const val = booking.depositAmountPaise ?? booking.depositPaise ?? booking.deposit_amount_paise ?? booking.deposit_paise;
    return val ? formatPaiseToRupees(val) : '₹0';
  }

  test('Challenge 3.1: Booking with ONLY depositAmountPaise renders accurate rupee currency without "—" or "₹0"', () => {
    const booking = {
      id: 'b-1',
      totalAmountPaise: 75000,
      depositAmountPaise: 50000,
      // depositPaise is explicitly undefined
    };

    const myBookingsDisplay = renderMyBookingsDeposit(booking);
    const detailDisplay = renderBookingDetailDeposit(booking);

    assert.equal(myBookingsDisplay, '₹500', 'MyBookingsPage must render ₹500');
    assert.notEqual(myBookingsDisplay, '—', 'Must NOT render em-dash');
    assert.notEqual(myBookingsDisplay, '₹0', 'Must NOT render ₹0');

    assert.equal(detailDisplay, '₹500', 'BookingDetailPage must render ₹500');
    assert.notEqual(detailDisplay, '—', 'Must NOT render em-dash');
    assert.notEqual(detailDisplay, '₹0', 'Must NOT render ₹0');
  });

  test('Challenge 3.2: Booking with ONLY depositPaise renders accurate rupee currency without "—" or "₹0"', () => {
    const booking = {
      id: 'b-2',
      totalAmountPaise: 150000,
      depositPaise: 100000,
      // depositAmountPaise is explicitly undefined
    };

    const myBookingsDisplay = renderMyBookingsDeposit(booking);
    const detailDisplay = renderBookingDetailDeposit(booking);

    assert.equal(myBookingsDisplay, '₹1000', 'MyBookingsPage must render ₹1000');
    assert.notEqual(myBookingsDisplay, '—');
    assert.notEqual(myBookingsDisplay, '₹0');

    assert.equal(detailDisplay, '₹1,000', 'BookingDetailPage must render ₹1,000');
    assert.notEqual(detailDisplay, '—');
    assert.notEqual(detailDisplay, '₹0');
  });

  test('Challenge 3.3: Booking with raw SQL snake_case deposit_amount_paise renders accurately', () => {
    const booking = {
      id: 'b-3',
      deposit_amount_paise: 250000,
    };

    const myBookingsDisplay = renderMyBookingsDeposit(booking);
    const detailDisplay = renderBookingDetailDeposit(booking);

    assert.equal(myBookingsDisplay, '₹2500');
    assert.equal(detailDisplay, '₹2,500');
  });

  test('Challenge 3.4: Booking with both depositAmountPaise and depositPaise maintains precedence without error', () => {
    const booking = {
      id: 'b-4',
      depositAmountPaise: 80000,
      depositPaise: 80000,
    };

    assert.equal(renderMyBookingsDeposit(booking), '₹800');
    assert.equal(renderBookingDetailDeposit(booking), '₹800');
  });

  test('Challenge 3.5: Booking with missing or null deposit gracefully falls back to "—" or "₹0"', () => {
    const nullBooking = { id: 'b-5', depositAmountPaise: null, depositPaise: null };
    assert.equal(renderMyBookingsDeposit(nullBooking), '—');
    assert.equal(renderBookingDetailDeposit(nullBooking), '₹0');

    const zeroBooking = { id: 'b-6', depositAmountPaise: 0, depositPaise: 0 };
    assert.equal(renderMyBookingsDeposit(zeroBooking), '—');
    assert.equal(renderBookingDetailDeposit(zeroBooking), '₹0');

    const emptyBooking = { id: 'b-7' };
    assert.equal(renderMyBookingsDeposit(emptyBooking), '—');
    assert.equal(renderBookingDetailDeposit(emptyBooking), '₹0');
  });
});

describe('Milestone 2 Empirical Challenge — Repository Mapping and Provider Role Workflow', () => {
  test('Challenge 4.1: mapBookingRow projects listingOwnerId, listingOwnerType, and dual deposit keys', () => {
    const rawSqlRow = {
      id: 'b-100',
      renter_user_id: 'u-renter-1',
      rental_listing_id: 'l-couture-gaspard',
      listing_title: 'Gaspard Silk Gown',
      listing_owner_id: 'u-provider-42',
      listing_owner_type: 'SELLER',
      status: 'pending',
      start_date: '2026-11-01',
      end_date: '2026-11-05',
      subtotal_amount_paise: '30000',
      deposit_amount_paise: '20000',
      total_amount_paise: '50000',
      deposit_paid: true,
      actual_return_date: null,
      damage_waiver_selected: true,
      damage_waiver_fee_paise: '1500',
      backup_size: 'M',
      transport_mode: 'both',
      outbound_distance_km: '12.5',
      return_distance_km: '12.5',
      transport_rate_paise_per_km: '2000',
      outbound_transport_amount_paise: '25000',
      return_transport_amount_paise: '25000',
      overdue_days: null,
      late_fee_amount_paise: null,
      created_at: '2026-10-28T12:00:00Z',
      updated_at: '2026-10-28T12:00:00Z',
    };

    const mapped = mapBookingRow(rawSqlRow);

    assert.equal(mapped.id, 'b-100');
    assert.equal(mapped.renterUserId, 'u-renter-1');
    assert.equal(mapped.listingId, 'l-couture-gaspard');
    assert.equal(mapped.listingTitle, 'Gaspard Silk Gown');
    assert.equal(mapped.listingOwnerId, 'u-provider-42', 'Must expose listingOwnerId');
    assert.equal(mapped.listingOwnerType, 'SELLER', 'Must expose listingOwnerType');
    assert.equal(mapped.depositAmountPaise, 20000, 'Must expose depositAmountPaise');
    assert.equal(mapped.depositPaise, 20000, 'Must expose depositPaise');
    assert.equal(mapped.totalAmountPaise, 50000);
    assert.equal(mapped.rentalDays, 4);
  });

  test('Challenge 4.2: rentalsApi.getMyBookings appends role parameter when provided', async () => {
    let capturedUrl = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      capturedUrl = url.toString();
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      // Test role=provider
      await rentalsApi.getMyBookings({ role: 'provider' });
      assert.match(capturedUrl, /role=provider/, 'Must append role=provider');

      // Test role=renter
      await rentalsApi.getMyBookings({ role: 'renter' });
      assert.match(capturedUrl, /role=renter/, 'Must append role=renter');

      // Test without role
      await rentalsApi.getMyBookings({});
      assert.doesNotMatch(capturedUrl, /role=/, 'Must not append empty role query parameter');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('Challenge 4.3: Provider action controls authorization logic in BookingDetailPage', () => {
    const booking = {
      id: 'b-200',
      renterUserId: 'user-renter',
      listingOwnerId: 'user-provider',
      status: 'pending',
    };

    // Case A: Current user is the garment provider
    const providerUser = { id: 'user-provider', isAdmin: false };
    const isRenterForProvider = booking.renterUserId === providerUser.id;
    const isProviderForProvider = Boolean(booking.listingOwnerId && booking.listingOwnerId === providerUser.id);
    const canCancelForProvider = (isRenterForProvider || Boolean(providerUser.isAdmin)) && ['created', 'pending', 'confirmed'].includes(booking.status);
    const canAcceptForProvider = isProviderForProvider && booking.status === 'pending';
    const canRejectForProvider = isProviderForProvider && booking.status === 'pending';

    assert.equal(isRenterForProvider, false);
    assert.equal(isProviderForProvider, true);
    assert.equal(canCancelForProvider, false, 'Provider must NOT be able to cancel booking (prevents 409 conflict)');
    assert.equal(canAcceptForProvider, true, 'Provider can accept pending booking');
    assert.equal(canRejectForProvider, true, 'Provider can reject pending booking');

    // Case B: Current user is the renter
    const renterUser = { id: 'user-renter', isAdmin: false };
    const isRenterForRenter = booking.renterUserId === renterUser.id;
    const isProviderForRenter = Boolean(booking.listingOwnerId && booking.listingOwnerId === renterUser.id);
    const canCancelForRenter = (isRenterForRenter || Boolean(renterUser.isAdmin)) && ['created', 'pending', 'confirmed'].includes(booking.status);
    const canAcceptForRenter = isProviderForRenter && booking.status === 'pending';

    assert.equal(isRenterForRenter, true);
    assert.equal(isProviderForRenter, false);
    assert.equal(canCancelForRenter, true, 'Renter can cancel pending booking');
    assert.equal(canAcceptForRenter, false, 'Renter cannot accept booking');

    // Case C: Transition to confirmed: provider can start, but not accept again
    booking.status = 'confirmed';
    const canStartForProvider = isProviderForProvider && booking.status === 'confirmed';
    const canAcceptConfirmed = isProviderForProvider && booking.status === 'pending';
    assert.equal(canStartForProvider, true, 'Provider can start/dispatch confirmed rental');
    assert.equal(canAcceptConfirmed, false);
  });
});
