import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../types';

export class InventoryLockDO extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS unit_holds (
        hold_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
  }

  async acquireHold(
    userId: string,
    startDate: string,
    endDate: string,
    durationMinutes = 15,
  ): Promise<{ success: boolean; reason?: string; holdId?: string; expiresAt?: number }> {
    const now = Date.now();
    this.ctx.storage.sql.exec('DELETE FROM unit_holds WHERE expires_at <= ?', now);

    const existing = [...this.ctx.storage.sql.exec(
      'SELECT hold_id, user_id, start_date, end_date, expires_at FROM unit_holds WHERE start_date < ? AND end_date > ? LIMIT 1',
      endDate,
      startDate,
    )];

    if (existing.length > 0) {
      const active = existing[0] as any;
      if (active.user_id === userId) {
        const newExpiry = now + durationMinutes * 60 * 1000;
        this.ctx.storage.sql.exec('UPDATE unit_holds SET expires_at = ? WHERE hold_id = ?', newExpiry, active.hold_id);
        return { success: true, holdId: active.hold_id, expiresAt: newExpiry };
      }
      return {
        success: false,
        reason: 'This garment unit is currently reserved in another customer checkout.',
      };
    }

    const holdId = crypto.randomUUID();
    const expiresAt = now + durationMinutes * 60 * 1000;
    this.ctx.storage.sql.exec(
      'INSERT INTO unit_holds (hold_id, user_id, start_date, end_date, expires_at) VALUES (?, ?, ?, ?, ?)',
      holdId,
      userId,
      startDate,
      endDate,
      expiresAt,
    );
    return { success: true, holdId, expiresAt };
  }

  async releaseHold(userId: string): Promise<{ success: boolean }> {
    this.ctx.storage.sql.exec('DELETE FROM unit_holds WHERE user_id = ?', userId);
    return { success: true };
  }

  async getHoldStatus(): Promise<{ isHeld: boolean; hold?: any }> {
    const now = Date.now();
    this.ctx.storage.sql.exec('DELETE FROM unit_holds WHERE expires_at <= ?', now);
    const holds = [...this.ctx.storage.sql.exec('SELECT hold_id, user_id, start_date, end_date, expires_at FROM unit_holds LIMIT 1')];
    if (holds.length === 0) return { isHeld: false };
    return { isHeld: true, hold: holds[0] };
  }
}
