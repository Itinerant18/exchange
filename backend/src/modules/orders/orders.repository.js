import { pool } from '../../config/database.js';

const ORDER_COLUMNS = `
    o.id, o.buyer_user_id, o.status, o.total_amount_paise, o.created_at, o.updated_at`;

export async function insertOrder(client, { buyer_user_id, total_amount_paise }) {
  const { rows } = await client.query(
    `INSERT INTO public.orders (buyer_user_id, total_amount_paise)
     VALUES ($1, $2)
     RETURNING id, buyer_user_id, status, total_amount_paise, created_at`,
    [buyer_user_id, total_amount_paise],
  );
  return rows[0];
}

export async function insertOrderItem(client, { order_id, inventory_item_id, listing_id, unit_price_paise }) {
  const { rows } = await client.query(
    `INSERT INTO public.order_items (order_id, inventory_item_id, listing_id, unit_price_paise)
     VALUES ($1, $2, $3, $4)
     RETURNING id, inventory_item_id, listing_id, unit_price_paise, created_at`,
    [order_id, inventory_item_id, listing_id, unit_price_paise],
  );
  return rows[0];
}

export async function findOrderById(orderId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${ORDER_COLUMNS} FROM public.orders o WHERE o.id = $1 LIMIT 1`,
    [orderId],
  );
  return rows[0] ?? null;
}

export async function findOrderItems(orderId, client = pool) {
  const { rows } = await client.query(
    `SELECT oi.id, oi.inventory_item_id, oi.listing_id, oi.unit_price_paise, oi.status,
            l.title AS listing_title
     FROM public.order_items oi
     JOIN public.listings l ON l.id = oi.listing_id
     WHERE oi.order_id = $1
     ORDER BY oi.created_at ASC, oi.id ASC`,
    [orderId],
  );
  return rows;
}

export async function findOrderOwnerIds(orderId, client = pool) {
  const { rows } = await client.query(
    `SELECT DISTINCT l.owner_type, l.owner_user_id
     FROM public.order_items oi
     JOIN public.listings l ON l.id = oi.listing_id
     WHERE oi.order_id = $1`,
    [orderId],
  );
  return rows;
}

/** Buyer list: orders summarised with item count. */
export async function listOrdersForBuyer(buyerUserId, { status }, { limit, offset }) {
  const conditions = ['o.buyer_user_id = $1'];
  const params = [buyerUserId];
  if (status) {
    params.push(status);
    conditions.push(`o.status = $${params.length}`);
  }
  const where = conditions.join(' AND ');

  const [listResult, countResult] = await Promise.all([
    pool.query(
      `SELECT ${ORDER_COLUMNS},
              (SELECT count(*)::int FROM public.order_items oi WHERE oi.order_id = o.id) AS item_count
       FROM public.orders o
       WHERE ${where}
       ORDER BY o.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    ),
    pool.query(`SELECT count(*)::int AS total FROM public.orders o WHERE ${where}`, params),
  ]);
  return {
    rows: listResult.rows.map((row) => ({ ...mapOrderRow(row), itemCount: row.item_count })),
    total: countResult.rows[0].total,
  };
}

export async function listOrdersForAdmin({ status }, { limit, offset }) {
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `WHERE o.status = $1`;
  }
  const [listResult, countResult] = await Promise.all([
    pool.query(
      `SELECT ${ORDER_COLUMNS} FROM public.orders o ${where}
       ORDER BY o.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    ),
    pool.query(`SELECT count(*)::int AS total FROM public.orders o ${where}`, params),
  ]);
  return { rows: listResult.rows.map(mapOrderRow), total: countResult.rows[0].total };
}

/** Guarded header transition; line status must be moved in the same transaction. */
export async function transitionOrderStatus(client, orderId, { fromStatus, toStatus }) {
  const { rowCount } = await client.query(
    `UPDATE public.orders SET status = $3, updated_at = now()
     WHERE id = $1 AND status = ANY($2::varchar[])`,
    [orderId, fromStatus, toStatus],
  );
  return rowCount === 1;
}

export async function setOrderItemsStatus(client, orderId, { fromStatus, toStatus }) {
  const { rowCount } = await client.query(
    `UPDATE public.order_items SET status = $3, updated_at = now()
     WHERE order_id = $1 AND status = $2 AND status <> $3`,
    [orderId, fromStatus, toStatus],
  );
  return rowCount;
}

export function mapOrderRow(row) {
  return {
    id: row.id,
    buyerUserId: row.buyer_user_id,
    status: row.status,
    totalAmountPaise: Number(row.total_amount_paise),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
