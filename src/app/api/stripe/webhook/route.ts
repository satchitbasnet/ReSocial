import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getStripe, planFromPriceId, getSubscriptionBillingPeriod } from "@/lib/stripe";
import type { UserPlan } from "@/lib/plans";
import { creditAffiliateCommission } from "@/lib/affiliate";

async function syncBillingFromSubscription(
  subscription: Stripe.Subscription,
  plan: UserPlan | null
) {
  const db = getDb();
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const period = getSubscriptionBillingPeriod(subscription);

  await db
    .update(users)
    .set({
      ...(plan ? { plan } : {}),
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      ...(period
        ? {
            billingPeriodStart: period.start,
            billingPeriodEnd: period.end,
          }
        : {}),
    })
    .where(eq(users.id, userId));
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const body = Buffer.from(await request.arrayBuffer()).toString("utf8");
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = getDb();

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan as UserPlan | undefined;
      if (userId && plan) {
        await db
          .update(users)
          .set({ plan })
          .where(eq(users.id, userId));
      }

      if (userId && session.subscription) {
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        const priceId = sub.items.data[0]?.price?.id;
        const subPlan = priceId ? planFromPriceId(priceId) : plan ?? null;
        await syncBillingFromSubscription(sub, subPlan);
      }
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceWithSub = invoice as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
      };
      let userId = invoice.metadata?.userId;

      if (!userId && invoiceWithSub.subscription) {
        const subId =
          typeof invoiceWithSub.subscription === "string"
            ? invoiceWithSub.subscription
            : invoiceWithSub.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        userId = sub.metadata?.userId;
      }

      if (!userId && invoice.customer_email) {
        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, invoice.customer_email.toLowerCase()))
          .limit(1);
        userId = user?.id;
      }

      if (userId && invoice.amount_paid > 0) {
        await creditAffiliateCommission(userId, invoice.amount_paid);
      }
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      const priceId = subscription.items.data[0]?.price?.id;
      const plan = priceId ? planFromPriceId(priceId) : null;

      if (userId && plan && subscription.status === "active") {
        await syncBillingFromSubscription(subscription, plan);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      if (userId) {
        await db
          .update(users)
          .set({ plan: "trial" })
          .where(eq(users.id, userId));
      }
    }
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
