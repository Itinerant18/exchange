import { WorkflowEntrypoint, WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';
import type { Client } from 'pg';
import type { Env, RentalWorkflowParams } from '../types';
import { withDb, withTx } from '../services/db';

const DAY_MS = 24 * 60 * 60 * 1000;
// ponytail: inspection is polled daily rather than pushed via waitForEvent, because instance ids
// are not stored per booking. Store the instance id on the booking if same-minute settlement matters.
const INSPECTION_POLL_DAYS = 7;

// pg returns DATE columns as Date objects, which serialize to full ISO strings; accept either form.
const dayStartUtc = (d: string) => new Date(`${String(d).slice(0, 10)}T00:00:00Z`).getTime();

type Settlement =
  | { outcome: 'SETTLED'; depositStatus: 'released' | 'withheld'; deductionPaise: number; refundPaise: number }
  | { outcome: 'ALREADY_SETTLED'; depositStatus: string }
  | { outcome: 'INSPECTION_MISSING' };

export class RentalLifecycleWorkflow extends WorkflowEntrypoint<Env, RentalWorkflowParams> {
  private tx<T>(fn: (c: Client) => Promise<T>): Promise<T> {
    return withTx(this.env, this.ctx, fn);
  }

  // Awaited inside step.do so a failed send retries the step (at-least-once; consumers dedupe on bookingId).
  private async emit(type: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.env.EVENT_QUEUE) throw new Error('EVENT_QUEUE binding is not configured');
    await this.env.EVENT_QUEUE.send({ type, payload, timestamp: Date.now() });
  }

  async run(event: WorkflowEvent<RentalWorkflowParams>, step: WorkflowStep) {
    const { bookingId, renterUserId, startDate, endDate } = event.payload;
    const returnMs = dayStartUtc(endDate);
    if (Number.isNaN(returnMs)) throw new Error(`Invalid endDate for booking ${bookingId}: ${endDate}`);

    // Step 0: stay 'confirmed' (still cancellable) until the day before the rental starts.
    await step.sleepUntil('wait-for-dispatch-day', new Date(dayStartUtc(startDate) - DAY_MS));

    // Step 1: confirmed -> active, open the escrow record, request courier dispatch.
    const dispatch = await step.do('activate-and-dispatch', async () => {
      const result = await this.tx(async (c) => {
        const row = (
          await c.query(
            `SELECT status, deposit_paid, deposit_amount_paise FROM rental_bookings WHERE id = $1 FOR UPDATE`,
            [bookingId],
          )
        ).rows[0];
        if (!row || !['confirmed', 'active', 'completed'].includes(row.status)) {
          return { proceed: false, status: (row?.status as string) ?? 'missing' };
        }
        if (row.status === 'confirmed') {
          await c.query(`UPDATE rental_bookings SET status = 'active', updated_at = now() WHERE id = $1`, [bookingId]);
          await c.query(
            `UPDATE rental_booking_items SET item_status = 'active', updated_at = now()
             WHERE rental_booking_id = $1 AND item_status = 'confirmed'`,
            [bookingId],
          );
          await c.query(
            `INSERT INTO rental_booking_status_history (rental_booking_id, from_status, to_status, reason)
             VALUES ($1, 'confirmed', 'active', 'Courier dispatched by rental lifecycle workflow')`,
            [bookingId],
          );
        }
        await c.query(
          `INSERT INTO security_deposits (rental_booking_id, status, collected_amount_paise)
           VALUES ($1, 'held', $2) ON CONFLICT (rental_booking_id) DO NOTHING`,
          [bookingId, row.deposit_paid ? String(row.deposit_amount_paise) : '0'],
        );
        return { proceed: true, status: 'active' };
      });
      if (result.proceed) {
        await this.emit('RENTAL_DISPATCH_REQUESTED', { bookingId, userId: renterUserId, startDate, endDate });
      }
      return result;
    });
    if (!dispatch.proceed) return { bookingId, status: 'ABORTED', reason: `booking is ${dispatch.status}` };

    // Step 2: durable sleep until 24h before the return date (no-op if already past).
    await step.sleepUntil('wait-for-return-window', new Date(returnMs - DAY_MS));

    // Step 3: return reminder, unless the booking was cancelled meanwhile.
    const reminder = await step.do('send-return-reminder', async () => {
      const status = (
        await withDb(this.env, this.ctx, (c) => c.query(`SELECT status FROM rental_bookings WHERE id = $1`, [bookingId]))
      ).rows[0]?.status as string | undefined;
      if (status !== 'active') return { reminded: false, status: status ?? 'missing' };
      await this.emit('RENTAL_RETURN_REMINDER', { bookingId, userId: renterUserId, returnDate: String(endDate).slice(0, 10) });
      return { reminded: true, status };
    });
    if (!reminder.reminded) return { bookingId, status: 'ABORTED', reason: `booking is ${reminder.status}` };

    // Step 4: atelier inspection window, 48h after the return date.
    await step.sleepUntil('inspection-window', new Date(returnMs + 2 * DAY_MS));

    // Step 5: settle the deposit from the recorded inspection; poll daily until one exists.
    for (let attempt = 0; attempt < INSPECTION_POLL_DAYS; attempt++) {
      const settlement = await step.do(`settle-deposit-${attempt}`, () => this.settle(bookingId));
      if (settlement.outcome === 'SETTLED') {
        // Separate step: a failed send retries only the notification, never the money movement.
        await step.do(`notify-settlement-${attempt}`, async () => {
          await this.emit('DEPOSIT_SETTLED', { bookingId, userId: renterUserId, ...settlement });
          return { notified: true };
        });
      }
      if (settlement.outcome !== 'INSPECTION_MISSING') return { bookingId, status: 'COMPLETED', settlement };
      await step.do(`flag-inspection-overdue-${attempt}`, async () => {
        await this.emit('RENTAL_INSPECTION_OVERDUE', { bookingId, userId: renterUserId, daysOverdue: attempt });
        return { flagged: true };
      });
      await step.sleep(`await-inspection-${attempt}`, '24 hours');
    }
    // Deposit stays 'held': money is never released without an inspection on record.
    return { bookingId, status: 'NEEDS_MANUAL_SETTLEMENT' };
  }

  private settle(bookingId: string): Promise<Settlement> {
    return this.tx<Settlement>(async (c) => {
      const dep = (
        await c.query(
          `SELECT id, status, collected_amount_paise FROM security_deposits WHERE rental_booking_id = $1 FOR UPDATE`,
          [bookingId],
        )
      ).rows[0];
      if (!dep) throw new Error(`No security_deposits row for booking ${bookingId}`);
      if (dep.status === 'released' || dep.status === 'withheld') {
        return { outcome: 'ALREADY_SETTLED', depositStatus: dep.status };
      }

      const booking = (
        await c.query(`SELECT deposit_paid, deposit_amount_paise FROM rental_bookings WHERE id = $1 FOR UPDATE`, [bookingId])
      ).rows[0];
      const collected = booking?.deposit_paid ? BigInt(booking.deposit_amount_paise) : 0n;
      if (collected !== BigInt(dep.collected_amount_paise)) {
        await c.query(`UPDATE security_deposits SET collected_amount_paise = $2, updated_at = now() WHERE id = $1`, [
          dep.id,
          collected.toString(),
        ]);
      }

      const insp = (
        await c.query(
          `SELECT result, notes, estimated_recovery_paise FROM return_inspections WHERE rental_booking_id = $1`,
          [bookingId],
        )
      ).rows[0];
      if (!insp) return { outcome: 'INSPECTION_MISSING' };

      const claimed = insp.result === 'pass' ? 0n : BigInt(insp.estimated_recovery_paise);
      const deduction = claimed < collected ? claimed : collected; // DB check: deduction <= collected
      const depositStatus = deduction > 0n ? 'withheld' : 'released';
      const reason = deduction > 0n ? `Return inspection: ${insp.result}${insp.notes ? ` - ${insp.notes}` : ''}` : null;

      await c.query(
        `UPDATE security_deposits
         SET status = $2, deduction_amount_paise = $3, deduction_reason = $4, released_at = now(), updated_at = now()
         WHERE id = $1`,
        [dep.id, depositStatus, deduction.toString(), reason],
      );

      if (deduction > 0n) {
        // Damage payout to the garment owner; unique (booking, entry_type) + idempotency key make retries safe.
        await c.query(
          `INSERT INTO earnings_ledger
             (user_id, entry_direction, entry_type, rental_booking_id, source_type, amount_paise, idempotency_key, memo)
           SELECT l.owner_user_id, 'credit', 'damage_charge', b.id, 'rental_booking', $2, $3, $4
           FROM rental_bookings b JOIN listings l ON l.id = b.rental_listing_id
           WHERE b.id = $1
           ON CONFLICT DO NOTHING`,
          [bookingId, deduction.toString(), `damage_charge:${bookingId}`, reason],
        );
      }

      const moved = await c.query(
        `UPDATE rental_bookings SET status = 'completed', updated_at = now() WHERE id = $1 AND status = 'active'`,
        [bookingId],
      );
      if (moved.rowCount) {
        await c.query(
          `UPDATE rental_booking_items SET item_status = 'completed', updated_at = now()
           WHERE rental_booking_id = $1 AND item_status = 'active'`,
          [bookingId],
        );
        await c.query(
          `INSERT INTO rental_booking_status_history (rental_booking_id, from_status, to_status, reason)
           VALUES ($1, 'active', 'completed', $2)`,
          [bookingId, `Deposit ${depositStatus} after return inspection`],
        );
      }

      return {
        outcome: 'SETTLED',
        depositStatus,
        deductionPaise: Number(deduction),
        refundPaise: Number(collected - deduction),
      };
    });
  }
}
