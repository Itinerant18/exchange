import { pool } from '../../config/database.js';

const KYC_COLUMNS = `
    k.id, k.user_id, k.verification_type, k.status, k.provider, k.provider_reference,
    k.document_url, k.attempt_number, k.expires_at, k.reviewed_by_user_id, k.reviewed_at,
    k.rejection_reason, k.created_at, k.updated_at`;

export async function insertKycAttempt(client, fields) {
  const { rows } = await client.query(
    `INSERT INTO public.kyc_verifications
        (user_id, verification_type, status, provider, provider_reference, document_url,
         attempt_number, expires_at)
     VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7)
     RETURNING id, attempt_number, created_at`,
    [
      fields.user_id, fields.verification_type, fields.provider ?? null,
      fields.provider_reference ?? null, fields.document_url ?? null,
      fields.attempt_number, fields.expires_at ?? null,
    ],
  );
  return rows[0];
}

export async function getLatestAttemptNumber(client, userId) {
  const { rows } = await client.query(
    `SELECT COALESCE(max(attempt_number), 0)::int AS latest
     FROM public.kyc_verifications WHERE user_id = $1`,
    [userId],
  );
  return rows[0].latest;
}

export async function listKycForUser(userId, { limit, offset }) {
  const [list, count] = await Promise.all([
    pool.query(
      `SELECT ${KYC_COLUMNS} FROM public.kyc_verifications k
       WHERE k.user_id = $1 ORDER BY k.created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    ),
    pool.query(`SELECT count(*)::int AS total FROM public.kyc_verifications k WHERE k.user_id = $1`, [userId]),
  ]);
  return { rows: list.rows.map(mapKycRow), total: count.rows[0].total };
}

export async function listKycForAdmin({ status }, { limit, offset }) {
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `WHERE k.status = $1`;
  }
  const [list, count] = await Promise.all([
    pool.query(
      `SELECT ${KYC_COLUMNS} FROM public.kyc_verifications k ${where}
       ORDER BY k.created_at ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    ),
    pool.query(`SELECT count(*)::int AS total FROM public.kyc_verifications k ${where}`, params),
  ]);
  return { rows: list.rows.map(mapKycRow), total: count.rows[0].total };
}

/** Guarded review: set pending -> verified/rejected with reviewer metadata. */
export async function reviewKycAttempt(client, kycId, { status, reviewed_by_user_id, rejection_reason }) {
  const { rows } = await client.query(
    `UPDATE public.kyc_verifications
     SET status = $3, reviewed_by_user_id = $4, reviewed_at = now(),
         rejection_reason = CASE WHEN $3 = 'rejected' THEN $5 ELSE rejection_reason END,
         updated_at = now()
     WHERE id = $1 AND status = ANY($2::varchar[])
     RETURNING ${KYC_COLUMNS.replace(/\bk\./g, '')}`,
    [kycId, ['pending'], status, reviewed_by_user_id, rejection_reason ?? null],
  );
  return rows[0] ?? null;
}

export async function findKycById(kycId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${KYC_COLUMNS} FROM public.kyc_verifications k WHERE k.id = $1 LIMIT 1`,
    [kycId],
  );
  return rows[0] ?? null;
}

export function mapKycRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    verificationType: row.verification_type,
    status: row.status,
    provider: row.provider ?? null,
    providerReference: row.provider_reference ?? null,
    documentUrl: row.document_url ?? null,
    attemptNumber: row.attempt_number,
    expiresAt: row.expires_at ?? null,
    reviewedByUserId: row.reviewed_by_user_id ?? null,
    reviewedAt: row.reviewed_at ?? null,
    rejectionReason: row.rejection_reason ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
