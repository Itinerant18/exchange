import { WorkflowEntrypoint, WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';
import type { Env, RentalWorkflowParams } from '../types';

export class RentalLifecycleWorkflow extends WorkflowEntrypoint<Env, RentalWorkflowParams> {
  async run(event: WorkflowEvent<RentalWorkflowParams>, step: WorkflowStep) {
    const { bookingId, renterUserId, startDate, endDate, totalPaise } = event.payload;

    // Step 1: Booking Confirmation & Logistics Dispatch
    const confirmation = await step.do('confirm-and-dispatch-courier', async () => {
      console.log(`[Workflow:Step 1] Rental booking ${bookingId} confirmed. Dispatching courier logistics.`);
      return { status: 'DISPATCHED', dispatchedAt: new Date().toISOString() };
    });

    // Step 2: Sleep until return window (simulated durable sleep)
    const returnTimestamp = new Date(`${endDate}T00:00:00Z`).getTime();
    const reminderTarget = returnTimestamp - 24 * 60 * 60 * 1000;
    const now = Date.now();
    const waitMs = Math.max(3000, Math.min(10000, reminderTarget - now));

    await step.sleep('wait-for-return-window', waitMs);

    // Step 3: Return Reminder Notice
    const reminder = await step.do('send-return-reminder', async () => {
      console.log(`[Workflow:Step 3] Emitting return reminder notice for renter ${renterUserId} on booking ${bookingId}`);
      return { reminded: true, remindedAt: new Date().toISOString() };
    });

    // Step 4: Atelier Garment Return & Inspection Hold
    await step.sleep('inspection-window-hold', 3000);

    // Step 5: Deposit Settlement Assessment
    const settlement = await step.do('deposit-settlement', async () => {
      console.log(`[Workflow:Step 5] Finalizing deposit settlement for booking ${bookingId}`);
      return { settled: true, settledAt: new Date().toISOString(), depositAction: 'RELEASED' };
    });

    return {
      bookingId,
      confirmation,
      reminder,
      settlement,
      status: 'COMPLETED',
    };
  }
}
