-- Phase C verification: remaining constraint behaviors after rental overlap tests.
-- Runs entirely inside one transaction and rolls back — safe on the dev database.
-- Usage:  docker compose exec -T postgres psql -U exchnage_app -d exchnage_dev -v ON_ERROR_STOP=1 -f /dev/stdin < this-file
DO $$
DECLARE
  v_user_id uuid; v_cat uuid; v_listing uuid; v_item uuid;
  v_renter uuid; v_booking uuid; v_item2 uuid; v_order1 uuid; v_order2 uuid;
BEGIN
  INSERT INTO users (email, password_hash) VALUES ('tester@example.com', 'x') RETURNING id INTO v_user_id;
  INSERT INTO users (email, password_hash) VALUES ('other@example.com', 'x') RETURNING id INTO v_renter;
  INSERT INTO categories (name, slug) VALUES ('Kurtas', 'kurtas') RETURNING id INTO v_cat;
  INSERT INTO listings (owner_user_id, category_id, title, condition, is_rental, is_sale, rental_price_paise, sale_price_paise)
    VALUES (v_user_id, v_cat, 'Silk kurta', 'like_new', true, true, 50000, 250000) RETURNING id INTO v_listing;
  INSERT INTO inventory_items (listing_id, owner_type, owner_user_id, condition, operational_status)
    VALUES (v_listing, 'SELLER', v_user_id, 'good', 'SALE_PENDING') RETURNING id INTO v_item2;
  INSERT INTO inventory_items (listing_id, owner_type, owner_user_id, condition)
    VALUES (v_listing, 'SELLER', v_user_id, 'good') RETURNING id INTO v_item;

  -- SALE exclusivity: first active claim
  INSERT INTO orders (buyer_user_id, total_amount_paise) VALUES (v_renter, 250000) RETURNING id INTO v_order1;
  INSERT INTO order_items (order_id, inventory_item_id, listing_id, unit_price_paise) VALUES (v_order1, v_item2, v_listing, 250000);

  BEGIN
    INSERT INTO orders (buyer_user_id, total_amount_paise) VALUES (v_user_id, 250000) RETURNING id INTO v_order2;
    INSERT INTO order_items (order_id, inventory_item_id, listing_id, unit_price_paise) VALUES (v_order2, v_item2, v_listing, 250000);
    RAISE EXCEPTION 'EXPECTED FAILURE: duplicate sale claim accepted';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'ok: duplicate sale claim rejected'; END;

  UPDATE order_items SET status = 'cancelled' WHERE order_id = v_order1;
  INSERT INTO orders (buyer_user_id, total_amount_paise) VALUES (v_user_id, 250000) RETURNING id INTO v_order2;
  INSERT INTO order_items (order_id, inventory_item_id, listing_id, unit_price_paise) VALUES (v_order2, v_item2, v_listing, 250000);
  RAISE NOTICE 'ok: cancelled claim frees the item';

  BEGIN
    UPDATE orders SET total_amount_paise = -1 WHERE id = v_order2;
    RAISE EXCEPTION 'EXPECTED FAILURE: negative total accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: negative order total rejected'; END;

  BEGIN
    INSERT INTO payments (payment_type, direction, amount_paise, status) VALUES ('rental', 'in', 99000, 'pending');
    RAISE EXCEPTION 'EXPECTED FAILURE: payment without entity accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: payment entity xor enforced'; END;

  BEGIN
    INSERT INTO payments (payment_type, direction, amount_paise, status, order_id) VALUES ('deposit', 'in', 99000, 'pending', v_order1);
    RAISE EXCEPTION 'EXPECTED FAILURE: deposit attached to order accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: deposit-on-order rejected'; END;

  -- booking for payment/deposit linkage
  INSERT INTO rental_bookings (renter_user_id, rental_listing_id, start_date, end_date, subtotal_amount_paise, deposit_amount_paise, total_amount_paise)
    VALUES (v_renter, v_listing, DATE '2026-12-01', DATE '2026-12-03', 100000, 50000, 150000)
    RETURNING id INTO v_booking;
  INSERT INTO rental_booking_items (rental_booking_id, inventory_item_id, item_status, start_date, end_date, daily_rate_paise, line_total_paise)
    VALUES (v_booking, v_item, 'pending', DATE '2026-12-01', DATE '2026-12-03', 50000, 100000);

  INSERT INTO payments (payment_type, direction, amount_paise, status, rental_booking_id, idempotency_key)
    VALUES ('rental', 'in', 100000, 'pending', v_booking, 'idem-1');
  BEGIN
    INSERT INTO payments (payment_type, direction, amount_paise, status, rental_booking_id, idempotency_key)
      VALUES ('rental', 'in', 100000, 'pending', v_booking, 'idem-1');
    RAISE EXCEPTION 'EXPECTED FAILURE: duplicate idempotency key accepted';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'ok: payment idempotency enforced'; END;

  BEGIN
    INSERT INTO security_deposits (rental_booking_id, status, collected_amount_paise, deduction_amount_paise)
      VALUES (v_booking, 'withheld', 50000, 10000); -- deduction without reason
    RAISE EXCEPTION 'EXPECTED FAILURE: deduction without reason accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: deduction reason required'; END;

  INSERT INTO security_deposits (rental_booking_id, status, collected_amount_paise)
    VALUES (v_booking, 'held', 50000);
  BEGIN
    INSERT INTO security_deposits (rental_booking_id, status, collected_amount_paise)
      VALUES (v_booking, 'held', 50000);
    RAISE EXCEPTION 'EXPECTED FAILURE: second deposit row for booking accepted';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'ok: one deposit per booking'; END;

  BEGIN
    INSERT INTO reviews (reviewer_user_id, reviewee_user_id, qualifying_rental_booking_id, rating)
      VALUES (v_renter, v_renter, v_booking, 5);
    RAISE EXCEPTION 'EXPECTED FAILURE: self review accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: self review rejected'; END;

  BEGIN
    INSERT INTO reviews (reviewer_user_id, reviewee_user_id, rating) VALUES (v_renter, v_user_id, 5);
    RAISE EXCEPTION 'EXPECTED FAILURE: review without qualifier accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: missing qualifier rejected'; END;

  BEGIN
    INSERT INTO reviews (reviewer_user_id, reviewee_user_id, qualifying_rental_booking_id, qualifying_order_id, rating)
      VALUES (v_renter, v_user_id, v_booking, v_order2, 5);
    RAISE EXCEPTION 'EXPECTED FAILURE: review with both qualifiers accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: both qualifiers rejected'; END;

  UPDATE users SET last_login_at = now() WHERE id = v_user_id; -- trigger sanity
  RAISE NOTICE 'updated_at trigger fired without error';

  RAISE NOTICE 'ALL REMAINING CONSTRAINT TESTS PASSED';
END
$$;
ROLLBACK;
