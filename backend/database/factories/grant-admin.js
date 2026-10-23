// Grants the `admin` role to an existing user, identified by email.
//
// Usage:
//   node database/factories/grant-admin.js admin@example.com
//
// Registration only ever grants `customer` + `seller`; administrator promotion
// is deliberately a manual operations step. This script records the grant in
// the audit trail (user_id of the acting identity is NULL = "operations").
//
// Requires the usual DB_* environment variables (same as the API).

import { pool } from '../../src/config/database.js';
import { isUuid } from '../../src/utils/validators.js';

const email = process.argv[2]?.trim().toLowerCase();

if (!email || process.argv[2]?.includes('--help')) {
  console.log('Usage: node database/factories/grant-admin.js <user-email>');
  process.exit(email ? 0 : 1);
}

if (isUuid(email)) {
  console.error('Pass the user EMAIL (not a user id).');
  process.exit(1);
}

const client = await pool.connect();
try {
  await client.query('BEGIN');

  const { rows: userRows } = await client.query(
    `SELECT id, email, status FROM public.users WHERE lower(email) = $1 LIMIT 1`,
    [email],
  );
  if (userRows.length === 0) {
    await client.query('ROLLBACK');
    console.error(`No user found with email ${email}. Register the account first.`);
    process.exit(1);
  }
  const user = userRows[0];

  const { rows: granted, rowCount } = await client.query(
    `INSERT INTO public.user_roles (user_id, role_name)
     VALUES ($1, 'admin')
     ON CONFLICT (user_id, role_name) DO NOTHING
     RETURNING role_name`,
    [user.id],
  );

  await client.query(
    `INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_value)
     VALUES (NULL, $1, 'user', $2, $3::jsonb)`,
    [
      rowCount > 0 ? 'ROLE_ADMIN_GRANTED' : 'ROLE_ADMIN_ALREADY_PRESENT',
      user.id,
      JSON.stringify({ email: user.email }),
    ],
  );

  await client.query('COMMIT');

  if (rowCount > 0) {
    console.log(`Admin role granted to ${user.email} (${user.id}).`);
  } else {
    console.log(`${user.email} already holds the admin role.`);
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Grant failed:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
