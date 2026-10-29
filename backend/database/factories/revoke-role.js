// Revokes a role from an existing user, identified by email.
//
// Usage:
//   node database/factories/revoke-role.js <user-email> <role-name>
//
// Example:
//   node database/factories/revoke-role.js aniket.karmakar@seple.in admin

import { pool } from '../../src/config/database.js';
import { isUuid } from '../../src/utils/validators.js';

const email = process.argv[2]?.trim().toLowerCase();
const roleName = process.argv[3]?.trim().toLowerCase();

if (!email || !roleName || process.argv[2]?.includes('--help')) {
  console.log('Usage: node database/factories/revoke-role.js <user-email> <role-name>');
  process.exit(email && roleName ? 0 : 1);
}

if (isUuid(email)) {
  console.error('Pass the user EMAIL (not a user id).');
  process.exit(1);
}

const client = await pool.connect();
try {
  await client.query('BEGIN');

  const { rows: userRows } = await client.query(
    `SELECT id, email FROM public.users WHERE lower(email) = $1 LIMIT 1`,
    [email],
  );
  if (userRows.length === 0) {
    await client.query('ROLLBACK');
    console.error(`No user found with email ${email}.`);
    process.exit(1);
  }
  const user = userRows[0];

  const { rowCount } = await client.query(
    `DELETE FROM public.user_roles 
     WHERE user_id = $1 AND role_name = $2`,
    [user.id, roleName],
  );

  await client.query(
    `UPDATE public.refresh_sessions 
     SET revoked_at = now() 
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [user.id],
  );

  await client.query(
    `INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_value)
     VALUES (NULL, 'ROLE_REVOKED', 'user', $1, $2::jsonb)`,
    [user.id, JSON.stringify({ email: user.email, revokedRole: roleName })],
  );

  await client.query('COMMIT');
  console.log(`Role '${roleName}' revoked from ${user.email} (${rowCount > 0 ? 'removed' : 'not present'}).`);
} catch (error) {
  await client.query('ROLLBACK');
  console.error('Failed to revoke role:', error);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
