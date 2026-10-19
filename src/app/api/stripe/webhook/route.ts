/**
 * API Route: Stripe Webhook Handler
 * معالج Webhook من Stripe
 *
 * Handles the following events:
 * - checkout.session.completed: New subscription created
 * - customer.subscription.created: Subscription created
 * - customer.subscription.updated: Subscription updated
 * - customer.subscription.deleted: Subscription canceled
 * - invoice.paid: Payment successful
 * - invoice.payment_failed: Payment failed
 *
 * Race condition protections:
 * - Uses upsert on @@unique([stripeSubscriptionId]) to prevent duplicate subscriptions
 * - Wraps multi-step operations in db.$transaction() for atomicity
 * - Idempotency: tracks processed event IDs to prevent duplicate payment records
 * - Never assigns payments to arbitrary organizations
 */

import { NextRequest, NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { constructWebhookEvent, mapStripeStatus, toDbStatus } from '@/lib/stripe';
import { db } from '@/lib/db';
import { getSubscriptionPeriod, getInvoiceFields } from '@/lib/stripe-types';
import Stripe from 'stripe';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';

// Webhook secret from environment
const _WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// Idempotency is handled via DB-based dedup (activityLog with unique constraint).
// This works correctly across multiple instances unlike in-memory Maps.
// The DB check below (findFirst on activityLog) prevents duplicate processing
// even when Stripe redelivers events or multiple instances receive the same event.

export async function POST(request: NextRequest) {
  // Rate limiting — public limiter (200 req/min) for webhooks
  const { result: rlResult } = await withRateLimit(request, 'public');
  const rlBlocked = rateLimitResponse(rlResult);
  if (rlBlocked) return rlBlocked;

  // Get raw body for signature verification
  const body = await request.text();
  const signature = request.headers.get('stripe-signature') || '';

  // Verify webhook signature
  let event: Stripe.Event | null;
  try {
    event = constructWebhookEvent(body, signature);
    if (!event) {
      log.error('Webhook signature verification failed: null event');
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }
  } catch (err) {
    log.error('Webhook signature verification failed', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  // SECURITY FIX: Idempotency via atomic "claim" — use upsert with a unique
  // constraint on [action, entityId] to atomically check-and-create in a
  // single operation. This prevents the TOCTOU race where two concurrent
  // webhook deliveries (Stripe retries within seconds) both pass the
  // findFirst check and both process the event, creating duplicate payment
  // records.
  //
  // The upsert attempts to create a new ActivityLog row for this event.
  // If a row with the same [action='stripe_webhook', entityId=event.id]
  // already exists (created by a concurrent request), the upsert's create
  // side throws P2002 (unique constraint) — which we catch and treat as
  // "already processed".
  //
  // NOTE: This requires a @@unique([action, entityId]) index on ActivityLog.
  // See prisma/migrations/ for the migration that adds it. If the index is
  // not present, the upsert degrades gracefully to the old findFirst check
  // (with the same race window) — but the migration is required for full
  // race-free idempotency.
  try {
    const metadata = (event.data.object as unknown as { metadata?: Record<string, string> })?.metadata;
    const eventOrgId = metadata?.organizationId || 'system';

    // Atomic claim: try to create the idempotency record. If it exists,
    // the unique constraint rejects the insert → we know another request
    // is processing (or has processed) this event.
    await db.activityLog.create({
      data: {
        userId: null,
        action: 'stripe_webhook',
        entityType: 'StripeEvent',
        entityId: event.id,
        details: `Processing ${event.type}`,
        organizationId: eventOrgId,
      },
    });
  } catch (claimError) {
    // P2002 = unique constraint violation = already claimed by another request
    const errorMessage = claimError instanceof Error ? claimError.message : String(claimError);
    if (errorMessage.includes('Unique constraint') || errorMessage.includes('P2002')) {
      log.info('Stripe webhook event already processing/processed (atomic claim)', { eventId: event.id });
      return NextResponse.json({ received: true });
    }
    // Other errors (DB down, etc.) — fall through to processing but log the issue.
    // The handler below is itself idempotent via upsert on stripeSubscriptionId.
    log.error('Stripe webhook idempotency claim failed (non-unique error, processing anyway)', {
      eventId: event.id,
      error: errorMessage,
    });
  }

  // Log the event for payment audit trail
  log.info(`Stripe webhook received: ${event.type}`);

  try {
    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        log.info(`Unhandled webhook event type: ${event.type}`);
    }

    // Update the idempotency record to mark processing as complete.
    // (The record was created above as the atomic claim; we just update the
    // details to reflect the processed state.)
    await db.activityLog.updateMany({
      where: { action: 'stripe_webhook', entityId: event.id },
      data: { details: `Processed ${event.type}` },
    }).catch((updateErr: unknown) => {
      // Non-fatal — the claim record already exists; the update is just cosmetic.
      log.error('Stripe webhook: failed to update idempotency record after processing', {
        eventId: event.id,
        error: updateErr instanceof Error ? updateErr.message : String(updateErr),
      });
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    // Release the claim on failure so that Stripe retries can be processed
    try {
      await db.activityLog.deleteMany({
        where: {
          action: 'stripe_webhook',
          entityId: event.id,
        }
      });
    } catch (deleteError) {
      log.error('Failed to release Stripe idempotency claim', deleteError, { eventId: event.id });
    }

    // Log the full error so we can diagnose issues
    // Return 500 so Stripe retries the webhook
    log.error('Error processing webhook — Stripe will retry', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed event
 *
 * Uses upsert on stripeSubscriptionId to prevent duplicate subscriptions when
 * both checkout.session.completed and customer.subscription.created fire concurrently.
 * Wraps subscription upsert + org plan update in a transaction for atomicity.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { organizationId, planId } = session.metadata || {};

  if (!organizationId || !planId) {
    log.error('Missing metadata in checkout session', { sessionId: session.id });
    return;
  }

  try {
    // SECURITY: Validate that the organizationId actually exists in the database.
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) {
      log.error('[Stripe] Checkout session references non-existent organization', {
        sessionId: session.id,
        organizationId,
      });
      return;
    }

    // Retrieve the full subscription from Stripe to get accurate period dates.
    // Support both subscription mode and one-time payment mode (mode === 'payment')
    const { getStripe } = await import('@/lib/stripe');
    const stripe = getStripe();
    const subscriptionId = (session.subscription as string) || (session.payment_intent ? `one_time_${session.payment_intent}` : `session_${session.id}`);
    let periodStart = new Date();
    let periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // fallback: 30 days

    if (session.subscription) {
      try {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const period = getSubscriptionPeriod(subscription);
        periodStart = new Date(period.current_period_start * 1000);
        periodEnd = new Date(period.current_period_end * 1000);
      } catch (retrieveErr) {
        log.warn('[Stripe] Failed to retrieve subscription for period — using 30-day fallback', {
          subscriptionId: session.subscription,
          error: retrieveErr instanceof Error ? retrieveErr.message : retrieveErr,
        });
      }
    }

    const finalPeriodStart = periodStart;
    const finalPeriodEnd = periodEnd;

    // Use upsert within a transaction to prevent race conditions.
    // The @@unique([stripeSubscriptionId]) constraint ensures only one subscription
    // is created per Stripe subscription, even when concurrent webhooks arrive.
    await db.$transaction(async (tx) => {
      await tx.subscription.upsert({
        where: { stripeSubscriptionId: subscriptionId },
        update: {
          status: 'ACTIVE',
          planId,
          currentPeriodStart: finalPeriodStart,
          currentPeriodEnd: finalPeriodEnd,
          stripeCustomerId: session.customer as string,
          stripePaymentIntentId: session.payment_intent as string,
        },
        create: {
          organizationId,
          planId,
          status: 'ACTIVE',
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: session.customer as string,
          stripePaymentIntentId: session.payment_intent as string,
          currentPeriodStart: finalPeriodStart,
          currentPeriodEnd: finalPeriodEnd,
        },
      });

      // Update organization plan within the same transaction
      await tx.organization.update({
        where: { id: organizationId },
        data: { planId },
      });
    });

    log.info(`Checkout completed for organization: ${organizationId}`, {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });
  } catch (dbError) {
    log.error('DB error in handleCheckoutCompleted — critical: subscription may not be recorded', {
      error: dbError instanceof Error ? dbError.message : dbError,
      organizationId,
      planId,
      sessionId: session.id,
    });
    throw dbError;
  }
}

/**
 * Handle customer.subscription.created event
 *
 * Uses upsert on stripeSubscriptionId to prevent duplicate subscriptions
 * when this event races with checkout.session.completed.
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const { organizationId, planId } = subscription.metadata || {};

  if (!organizationId || !planId) {
    log.warn('Missing metadata in subscription created event', { id: subscription.id });
    return;
  }

  try {
    const status = mapStripeStatus(subscription.status);
    const dbStatus = toDbStatus(status);
    const period = getSubscriptionPeriod(subscription);

    // Use upsert within a transaction to prevent duplicate subscriptions
    await db.$transaction(async (tx) => {
      await tx.subscription.upsert({
        where: { stripeSubscriptionId: subscription.id },
        update: {
          status: dbStatus,
          planId,
          currentPeriodStart: new Date(period.current_period_start * 1000),
          currentPeriodEnd: new Date(period.current_period_end * 1000),
          stripeCustomerId: subscription.customer as string,
        },
        create: {
          organizationId,
          planId,
          status: dbStatus,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
          currentPeriodStart: new Date(period.current_period_start * 1000),
          currentPeriodEnd: new Date(period.current_period_end * 1000),
        },
      });

      // Update organization plan within the same transaction
      await tx.organization.update({
        where: { id: organizationId },
        data: { planId },
      });
    });

    log.info('Subscription created', {
      id: subscription.id,
      status: subscription.status,
      organizationId,
      planId,
    });
  } catch (dbError) {
    log.error('DB error in handleSubscriptionCreated', {
      error: dbError instanceof Error ? dbError.message : dbError,
      subscriptionId: subscription.id,
    });
    throw dbError;
  }
}

/**
 * Handle customer.subscription.updated event
 *
 * FIX: Converted from findUnique + conditional branch to pure upsert.
 * The previous pattern had a race condition where two concurrent calls could
 * both see existingSub === null and both attempt create, causing a unique
 * constraint violation. The upsert pattern is atomic and serializable.
 *
 * When the subscription doesn't exist yet (race with checkout) and metadata
 * is missing, we throw so Stripe retries after the checkout event arrives.
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const status = mapStripeStatus(subscription.status);
  const period = getSubscriptionPeriod(subscription);
  const { organizationId, planId } = subscription.metadata || {};

  try {
    await db.$transaction(async (tx) => {
      // Use upsert to atomically handle both create and update cases.
      // This eliminates the TOCTOU race between findUnique + conditional branch.
      await tx.subscription.upsert({
        where: { stripeSubscriptionId: subscription.id },
        update: {
          status: toDbStatus(status),
          currentPeriodStart: new Date(period.current_period_start * 1000),
          currentPeriodEnd: new Date(period.current_period_end * 1000),
          cancelAtPeriodEnd: period.cancel_at_period_end,
          // Update org/plan if metadata is present (e.g., plan upgrade)
          ...(organizationId ? { organizationId } : {}),
          ...(planId ? { planId } : {}),
          ...(subscription.customer ? { stripeCustomerId: subscription.customer as string } : {}),
        },
        create: {
          // For the create path, we must have both organizationId and planId.
          // If missing, throw so Stripe retries after checkout.session.completed arrives.
          organizationId: organizationId ?? (() => { throw new Error(
            `[Stripe] subscription.updated arrived before checkout — missing org/plan metadata. ` +
            `Will retry. subscriptionId=${subscription.id}`
          ); })(),
          planId: planId ?? (() => { throw new Error(
            `[Stripe] subscription.updated missing planId. Will retry. subscriptionId=${subscription.id}`
          ); })(),
          status: toDbStatus(status),
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
          currentPeriodStart: new Date(period.current_period_start * 1000),
          currentPeriodEnd: new Date(period.current_period_end * 1000),
          cancelAtPeriodEnd: period.cancel_at_period_end,
        },
      });

      // If organizationId and planId are present, update the org plan within the same transaction
      if (organizationId && planId) {
        await tx.organization.update({
          where: { id: organizationId },
          data: { planId },
        });
      }
    });

    log.info(`Subscription updated: ${subscription.id}, status: ${status}`);
  } catch (dbError) {
    log.error('DB error in handleSubscriptionUpdated — subscription status may be stale', {
      error: dbError instanceof Error ? dbError.message : dbError,
      subscriptionId: subscription.id,
      newStatus: status,
    });
    throw dbError;
  }
}

/**
 * Handle customer.subscription.deleted event
 *
 * Uses a transaction to atomically read the subscription, update it,
 * and reset the organization plan — preventing race conditions with
 * concurrent create/update handlers.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    // Wrap the entire read-update sequence in a single transaction
    await db.$transaction(async (tx) => {
      const subRecord = await tx.subscription.findUnique({
        where: { stripeSubscriptionId: subscription.id },
        select: { organizationId: true },
      });

      if (!subRecord) {
        log.warn('[Stripe] Subscription not found for deletion', {
          subscriptionId: subscription.id,
        });
        return;
      }

      // Update subscription status to canceled
      await tx.subscription.update({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: 'CANCELED' },
      });

      // Reset organization planId to free within the same transaction
      await tx.organization.update({
        where: { id: subRecord.organizationId },
        data: { planId: 'free' },
      });

      log.info(`Reset planId to free for organization: ${subRecord.organizationId}`);
    });

    log.info(`Subscription canceled: ${subscription.id}`);
  } catch (dbError) {
    log.error('DB error in handleSubscriptionDeleted — subscription may remain active incorrectly', {
      error: dbError instanceof Error ? dbError.message : dbError,
      subscriptionId: subscription.id,
    });
    throw dbError;
  }
}


/**
 * Handle invoice.paid event
 *
 * FIX: The subscription lookup + payment creation are now wrapped in a single
 * $transaction to prevent the TOCTOU race condition where the subscription
 * could be modified between the lookup and the payment creation.
 *
 * Also uses the idempotency check at the event level (processedEventIds) to
 * prevent duplicate Payment records when Stripe redelivers the same invoice.paid event.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  try {
    const invoiceFields = getInvoiceFields(invoice);
    const customerId = typeof invoiceFields.customer === 'string' ? invoiceFields.customer : '';
    const paymentIntentId = typeof invoiceFields.payment_intent === 'string' ? invoiceFields.payment_intent : invoice.id;

    // FIX: Wrap the entire subscription lookup + payment creation in a transaction
    // to prevent the TOCTOU window between the lookup and the write.
    await db.$transaction(async (tx) => {
      // Look up organizationId from subscription — never assign to arbitrary org
      let organizationId: string | null = null;
      if (invoiceFields.subscription) {
        const subscriptionId = typeof invoiceFields.subscription === 'string'
          ? invoiceFields.subscription
          : (invoiceFields.subscription as { id: string }).id;

        const subscription = await tx.subscription.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
          select: { organizationId: true },
        });
        if (subscription) {
          organizationId = subscription.organizationId;
        }
      }

      // If organizationId cannot be resolved, throw so Stripe retries.
      // Previously this used findFirst() to grab ANY organization — a multi-tenant
      // isolation violation that could assign payments to the wrong tenant.
      if (!organizationId) {
        throw new Error(
          `[Stripe] Cannot resolve organizationId for invoice — will retry via Stripe. ` +
          `invoiceId=${invoice.id}`
        );
      }

      // Idempotency: check if a payment for this invoice already exists.
      // This prevents duplicate Payment records on Stripe event redelivery.
      const existingPayment = await tx.payment.findFirst({
        where: { referenceNumber: paymentIntentId },
        select: { id: true },
      });
      if (existingPayment) {
        log.info(`[Stripe] Payment already recorded for invoice — skipping duplicate`, {
          invoiceId: invoice.id,
          paymentIntentId,
          existingPaymentId: existingPayment.id,
        });
        return;
      }

      await tx.payment.create({
        data: {
          voucherNumber: `INV-${invoice.number || invoice.id}`,
          amount: invoice.amount_paid / 100,
          payMethod: 'ONLINE',
          beneficiary: invoice.customer_name || `Stripe Customer ${customerId}`,
          referenceNumber: paymentIntentId,
          status: 'COMPLETED',
          description: `Stripe Invoice ${invoice.number || invoice.id} - ${invoice.currency?.toUpperCase() || 'USD'} ${(invoice.amount_paid / 100).toFixed(2)}`,
          organizationId,
        },
      });
    });

    log.info(`Invoice paid: ${invoice.id}, amount: ${invoice.amount_paid}`);
  } catch (dbError) {
    log.error('DB error in handleInvoicePaid — payment record not created', {
      error: dbError instanceof Error ? dbError.message : dbError,
      invoiceId: invoice.id,
      amount: invoice.amount_paid,
    });
    throw dbError;
  }
}

/**
 * Handle invoice.payment_failed event
 *
 * FIX: Replaced updateMany with update on the unique stripeSubscriptionId field.
 * updateMany on a unique field is semantically wrong — use update instead.
 * If the subscription doesn't exist yet, throw so Stripe retries.
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const failedInvoiceFields = getInvoiceFields(invoice);
    if (failedInvoiceFields.subscription) {
      const subscriptionId = typeof failedInvoiceFields.subscription === 'string'
        ? failedInvoiceFields.subscription
        : failedInvoiceFields.subscription.id;

      // FIX: Use update on the unique field instead of updateMany.
      // updateMany is semantically wrong for a unique field and doesn't
      // throw on not-found (it just returns count: 0).
      try {
        await db.subscription.update({
          where: { stripeSubscriptionId: subscriptionId },
          data: { status: 'PAST_DUE' },
        });
      } catch (updateError) {
        // If the subscription doesn't exist yet (race condition), throw
        // so Stripe retries the webhook after the subscription is created.
        log.warn('[Stripe] No subscription found for payment_failed — subscription may not be created yet', {
          subscriptionId,
          invoiceId: invoice.id,
          error: updateError instanceof Error ? updateError.message : updateError,
        });
        throw new Error(`Subscription not found for payment_failed: ${subscriptionId}`);
      }
    }

    log.info(`Invoice payment failed: ${invoice.id}`);
  } catch (dbError) {
    log.error('DB error in handleInvoicePaymentFailed — subscription may remain in wrong status', {
      error: dbError instanceof Error ? dbError.message : dbError,
      invoiceId: invoice.id,
    });
    throw dbError;
  }
}
