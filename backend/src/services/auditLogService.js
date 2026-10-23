// Centralized audit-log writer used by sensitive workflows. Never throws for
// logging-only failures in the fire path (production audits use dedicated
// transactions; write failures during cancellation paths must not swallow the
// primary operation, so callers decide via `required`).

export async function writeAuditLog(client, entry) {
  const {
    userId = null,
    action,
    entityType,
    entityId = null,
    previousValue = null,
    newValue = null,
    ipAddress = null,
    userAgent = null,
  } = entry;

  await client.query(
    `INSERT INTO public.audit_logs
        (user_id, action, entity_type, entity_id, previous_value, new_value, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::inet, $8)`,
    [
      userId,
      action,
      entityType,
      entityId,
      previousValue === null ? null : JSON.stringify(previousValue),
      newValue === null ? null : JSON.stringify(newValue),
      ipAddress,
      userAgent === null ? null : String(userAgent).slice(0, 500),
    ],
  );
}

/**
 * Convenience helper that captures request context for audit entries.
 * `client` is the transaction client of the workflow being audited.
 */
export function auditContext(req) {
  return {
    userId: req.authUser?.id ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  };
}
